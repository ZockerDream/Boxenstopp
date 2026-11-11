// Generische Anlage/Änderung/Löschung für einfache Tabellen.
// Felder: jsonKey -> [Spalte, zod-Schema, { json: true } für jsonb]
import { z } from 'zod';
import { tx } from './db.js';
import { fail, audit } from './lib.js';

const str = (max = 200) => z.string().trim().max(max);
const req = (max = 200) => z.string().trim().min(1, 'darf nicht leer sein').max(max);
const strN = (max = 300) => z.string().trim().max(max).nullable().transform((v) => (v === '' ? null : v));
const id = z.string().uuid();
const idN = z.string().uuid().nullable().or(z.literal('').transform(() => null));
const money = z.coerce.number().min(0).max(1e9);
const int = z.coerce.number().int().min(0).max(1e9);
const intN = z.coerce.number().int().min(0).max(1e6).nullable().or(z.literal('').transform(() => null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT');
const dateN = date.nullable().or(z.literal('').transform(() => null));
const bool = z.coerce.boolean();
const tags = z.array(z.string().trim().max(30)).max(12);

export const RESOURCES = {
  customers: {
    table: 'customers', module: 'customers', area: 'Kunden', label: (r) => r.name,
    fields: { name: ['name', req(120)], kind: ['kind', z.enum(['person', 'company', 'authority'])], phone: ['phone', str(40)], pg: ['price_group_id', idN], terms: ['terms_days', int], tags: ['tags', tags], warning: ['warning', strN()], blocked: ['blocked', strN()], archived: ['archived', bool] },
  },
  customerEntries: {
    table: 'customer_entries', module: 'customers', area: 'Kunden', label: () => 'Eintrag',
    fields: { customer: ['customer_id', id], body: ['body', req(4000)] }, defaults: (r) => ({ author_id: r.user.id }),
  },
  vehicles: {
    table: 'vehicles', module: 'vehicles', area: 'Fahrzeuge', label: (r) => r.plate,
    fields: { plate: ['plate', req(16).transform((v) => v.toUpperCase())], make: ['make', str(60)], model: ['model', str(60)], cls: ['class_id', idN], color: ['color', str(40)], vin: ['vin', str(40)], km: ['km', int], owner: ['owner_id', idN], status: ['status', z.enum(['active', 'scrapped', 'stolen'])], modelId: ['model_id', idN] },
    after: async (c, row, before) => {
      if (!before || before.owner_id !== row.owner_id) {
        await c.query('UPDATE vehicle_owner_history SET to_at = current_date WHERE vehicle_id = $1 AND to_at IS NULL', [row.id]);
        if (row.owner_id) await c.query('INSERT INTO vehicle_owner_history (vehicle_id, customer_id) VALUES ($1, $2)', [row.id, row.owner_id]);
      }
    },
  },
  vehicleClasses: { table: 'vehicle_classes', module: 'settings', write: 3, area: 'Firmen-Einstellungen', label: (r) => 'Fahrzeugklasse ' + r.name, fields: { name: ['name', req(40)], pos: ['position', int] } },
  categories: { table: 'catalog_categories', module: 'catalog', area: 'Preisliste', label: (r) => 'Kategorie ' + r.name, fields: { name: ['name', req(60)], pos: ['position', int] } },
  catalog: {
    table: 'catalog_items', module: 'catalog', area: 'Preisliste', label: (r) => r.name,
    fields: {
      cat: ['category_id', id], name: ['name', req(120)], kind: ['kind', z.enum(['flat', 'labor', 'part', 'bundle'])], unit: ['unit', str(20)], price: ['price', money],
      surcharge: ['surcharge', z.record(z.string(), z.coerce.number().min(-90).max(500)).nullable(), { json: true }],
      classPrices: ['class_prices', z.record(z.string(), money).nullable(), { json: true }],
      material: ['material', money], minutes: ['minutes', int], warranty: ['warranty', int], req: ['req', z.array(z.string().regex(/^(training|license):[0-9a-f-]{36}$/)).max(5)],
      group: ['group_id', idN], tuning: ['tuning', z.tuple([z.string().max(30), z.coerce.number().int().min(1).max(5)]).nullable(), { json: true }],
      parts: ['parts', z.array(z.object({ part: id, qty: z.coerce.number().positive().max(1000) })).max(10).nullable(), { json: true }],
      part: ['part_id', idN], active: ['active', bool], note: ['note', str(300)], pos: ['position', int],
    },
  },
  priceGroups: {
    table: 'price_groups', module: 'catalog', write: 4, area: 'Preisliste', label: (r) => 'Preisgruppe ' + r.name,
    fields: { name: ['name', req(40)], pct: ['pct', z.coerce.number().min(0).max(100)], cats: ['cats', z.record(z.string(), z.coerce.number().min(0).max(100)), { json: true }], isDefault: ['is_default', bool] },
  },
  parts: {
    table: 'parts', module: 'stock', area: 'Lager', label: (r) => r.name,
    fields: { sku: ['sku', str(40)], name: ['name', req(80)], unit: ['unit', str(10)], min: ['min_stock', money], loc: ['location', str(60)], buy: ['buy', money], sell: ['sell', money], active: ['active', bool] },
  },
  bays: { table: 'bays', module: 'appointments', write: 4, area: 'Termine', label: (r) => 'Stellplatz ' + r.name, fields: { name: ['name', req(40)], pos: ['position', int], active: ['active', bool] } },
  appointments: {
    table: 'appointments', module: 'appointments', area: 'Termine', label: (r) => r.title,
    fields: { date: ['day', date], time: ['time', str(20)], bay: ['bay_id', id], title: ['title', req(120)], customer: ['customer_id', idN], order: ['order_id', idN], note: ['note', str(300)] },
  },
  accounts: { table: 'accounts', module: 'accounts', write: 4, area: 'Konten', label: (r) => r.name, fields: { name: ['name', req(60)], kind: ['kind', z.enum(['bank', 'cash', 'tax_reserve', 'other'])], archived: ['archived', bool] } },
  recurring: {
    table: 'recurring_rules', module: 'accounts', area: 'Buchungen', label: (r) => 'Dauerauftrag ' + r.name,
    fields: { name: ['name', req(80)], account: ['account_id', id], type: ['type', z.enum(['income', 'expense'])], amount: ['amount', money.refine((v) => v > 0, 'muss größer 0 sein')], category: ['category', str(40)], every: ['every', z.enum(['weekly', 'monthly', 'yearly'])], next: ['next_run', date], active: ['active', bool], taxable: ['taxable', bool] },
  },
  absences: {
    table: 'absences', module: 'shifts', write: 3, own: 'user_id', area: 'Dienstplan', label: (r) => 'Abwesenheit ' + r.kind,
    fields: { user: ['user_id', id], kind: ['kind', req(30)], from: ['from_day', date], to: ['to_day', date], note: ['note', str(200)] },
  },
  staffEntries: {
    table: 'staff_entries', module: 'stafffiles', area: 'Personalakten', label: (r) => r.kind,
    fields: { user: ['user_id', id], kind: ['kind', req(30)], level: ['level', intN], date: ['day', date], text: ['text', req(4000)], self: ['self_visible', bool], expires: ['expires', dateN] },
    defaults: (r) => ({ author_id: r.user.id }),
  },
  trainings: { table: 'trainings', module: 'trainings', write: 4, area: 'Schulungen', label: (r) => r.name, fields: { name: ['name', req(80)], desc: ['description', str(2000)], months: ['months', intN], test: ['test', bool], active: ['active', bool] } },
  sessions: {
    table: 'training_sessions', module: 'trainings', area: 'Schulungen', label: () => 'Termin',
    fields: { training: ['training_id', id], date: ['day', date], time: ['time', str(20)], loc: ['location', str(80)], trainer: ['trainer_id', idN], done: ['done', bool] },
  },
  licenseTypes: { table: 'license_types', module: 'licenses', write: 4, area: 'Lizenzen', label: (r) => r.name, fields: { name: ['name', req(60)], holder: ['holder', z.enum(['member', 'firm'])], months: ['months', intN] } },
  licenses: {
    table: 'licenses', module: 'licenses', area: 'Lizenzen', label: (r) => 'Lizenz ' + r.no,
    fields: { type: ['type_id', id], user: ['user_id', idN], no: ['no', str(40)], issuer: ['issuer', str(80)], issued: ['issued', date], expires: ['expires', dateN], status: ['status', z.enum(['valid', 'suspended', 'revoked'])], reason: ['reason', strN()] },
  },
  boardPosts: { table: 'board_posts', module: 'board', area: 'Schwarzes Brett', label: (r) => r.title, fields: { title: ['title', req(120)], body: ['body', str(8000)], pinned: ['pinned', bool] }, defaults: (r) => ({ author_id: r.user.id }) },
  fleet: {
    table: 'fleet_vehicles', module: 'fleet', area: 'Fuhrpark', label: (r) => `${r.name} (${r.plate})`,
    fields: {
      name: ['name', req(60)], plate: ['plate', req(16).transform((v) => v.toUpperCase())], kind: ['kind', str(40)], modelId: ['model_id', idN], make: ['make', str(60)], model: ['model', str(60)],
      status: ['status', z.enum(['available', 'in_use', 'workshop', 'retired'])], km: ['km', int], serviceDue: ['service_due', dateN], serviceKm: ['service_km', intN], insuranceUntil: ['insurance_until', dateN],
      purchasePrice: ['purchase_price', money.nullable().or(z.literal('').transform(() => null))], purchasedOn: ['purchased_on', dateN], note: ['note', str(500)],
    },
  },
  models: {
    table: 'vehicle_models', module: 'models', area: 'Fahrzeug-Katalog', label: (r) => `${r.make} ${r.model}`,
    fields: {
      make: ['make', req(60)], model: ['model', req(60)], cls: ['class_id', idN], body: ['body', str(40)], price: ['price', money.nullable().or(z.literal('').transform(() => null))],
      seats: ['seats', intN], topSpeed: ['top_speed', intN], drive: ['drive', str(30)], fuel: ['fuel', str(30)], description: ['description', str(4000)], tuningNote: ['tuning_note', str(1000)], active: ['active', bool],
    },
  },
  tuningPackages: {
    table: 'tuning_packages', module: 'tuning', area: 'Tuning', label: (r) => 'Paket ' + r.name,
    fields: { name: ['name', req(80)], description: ['description', str(1000)], items: ['items', z.array(id).min(1, 'mindestens eine Leistung').max(20)], discount: ['discount', z.coerce.number().min(0).max(50)], active: ['active', bool], pos: ['position', int] },
  },
  groups: { table: 'groups', module: 'ranks', write: 4, area: 'Gruppen', label: (r) => r.name, fields: { name: ['name', req(40)], desc: ['description', str(200)] } },
};

export function schemaFor(spec, partial) {
  const shape = {};
  for (const [k, [, s]] of Object.entries(spec.fields)) shape[k] = s;
  const obj = z.object(shape).strict();
  return partial ? obj.partial() : obj;
}

function toCols(spec, data) {
  const cols = [], vals = [];
  for (const [k, v] of Object.entries(data)) {
    const [col, , opts] = spec.fields[k];
    cols.push(col);
    vals.push(opts && opts.json && v !== null ? JSON.stringify(v) : v);
  }
  return { cols, vals };
}

async function checkWrite(req, spec, row) {
  const lvl = req.level(spec.module);
  if (lvl >= (spec.write || 3)) return;
  if (spec.own && lvl >= 1 && row && row[spec.own] === req.user.id) return;
  fail(403, 'Dafür fehlt dir das Recht.');
}

export function registerResources(app) {
  app.post('/api/r/:name', async (req) => {
    const spec = RESOURCES[req.params.name] || fail(404, 'Unbekannt');
    const data = schemaFor(spec, false).partial().parse(req.body || {});
    const { cols, vals } = toCols(spec, data);
    const extra = spec.defaults ? spec.defaults(req) : {};
    for (const [k, v] of Object.entries(extra)) { cols.push(k); vals.push(v); }
    await checkWrite(req, spec, Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
    return tx(async (c) => {
      const row = await c.one(`INSERT INTO ${spec.table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, vals);
      if (spec.after) await spec.after(c, row, null, req);
      await audit(req, spec.area, 'Angelegt', spec.label(row), c);
      return { id: row.id };
    });
  });
  app.patch('/api/r/:name/:id', async (req) => {
    const spec = RESOURCES[req.params.name] || fail(404, 'Unbekannt');
    const data = schemaFor(spec, true).parse(req.body || {});
    return tx(async (c) => {
      const before = await c.one(`SELECT * FROM ${spec.table} WHERE id = $1 FOR UPDATE`, [req.params.id]) || fail(404, 'Nicht gefunden');
      await checkWrite(req, spec, before);
      const { cols, vals } = toCols(spec, data);
      if (!cols.length) return { id: before.id };
      const row = await c.one(`UPDATE ${spec.table} SET ${cols.map((col, i) => `${col} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`, [req.params.id, ...vals]);
      if (spec.own && req.level(spec.module) < (spec.write || 3) && row[spec.own] !== req.user.id) fail(403, 'Nur eigene Einträge.');
      if (spec.after) await spec.after(c, row, before, req);
      await audit(req, spec.area, 'Geändert', spec.label(row), c);
      return { id: row.id };
    });
  });
  app.delete('/api/r/:name/:id', async (req) => {
    const spec = RESOURCES[req.params.name] || fail(404, 'Unbekannt');
    return tx(async (c) => {
      const before = await c.one(`SELECT * FROM ${spec.table} WHERE id = $1`, [req.params.id]) || fail(404, 'Nicht gefunden');
      const lvl = req.level(spec.module);
      if (!(lvl >= Math.max(4, spec.write || 3) || (spec.own && lvl >= 1 && before[spec.own] === req.user.id) || (spec.delete && lvl >= spec.delete))) fail(403, 'Löschen braucht „Verwalten“.');
      await c.query(`DELETE FROM ${spec.table} WHERE id = $1`, [req.params.id]);
      await audit(req, spec.area, 'Gelöscht', spec.label(before), c);
      return { ok: true };
    });
  });
}
