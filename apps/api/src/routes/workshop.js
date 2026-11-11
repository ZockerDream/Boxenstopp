// Aufträge, Positionen, Rabattfreigaben, Einsätze, Fahrzeug-Tuning
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { fail, audit, nextNumber, notify, fireWebhooks, getSetting, today } from '../lib.js';
import { loadAuthz, levelOf, flagOf } from '../authz.js';
import { unitPrice, groupDiscount } from '../pricing.js';
import { createInvoice } from '../invoice.js';

const uuid = z.string().uuid();
const LOCKED = ['invoiced', 'picked_up', 'cancelled', 'rejected'];
const OPEN = ['quote', 'accepted', 'in_progress', 'waiting_parts', 'done'];
const STATUS_LABEL = { quote: 'Angebot', accepted: 'Angenommen', in_progress: 'In Arbeit', waiting_parts: 'Wartet auf Teile', done: 'Fertig', invoiced: 'Abgerechnet', picked_up: 'Abgeholt', rejected: 'Abgelehnt', cancelled: 'Storniert' };

async function loadOrder(c, req, id, write = true) {
  const o = await c.one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]) || fail(404, 'Auftrag nicht gefunden');
  const lvl = req.level('orders');
  if (lvl >= 3) return o;
  if (lvl >= (write ? 1 : 1)) {
    const a = await c.one('SELECT 1 FROM order_assignees WHERE order_id = $1 AND user_id = $2', [id, req.user.id]);
    if (a) return o;
  }
  return fail(403, 'Das ist nicht dein Auftrag.');
}
const event = (c, req, orderId, text) => c.query('INSERT INTO order_events (order_id, user_id, text) VALUES ($1, $2, $3)', [orderId, req.user.id, text]);

// Fehlende Qualifikationen eines Mitarbeiters für eine Leistung
export async function missingQual(c, userId, item) {
  const out = [];
  for (const r of item.req || []) {
    const [kind, id] = r.split(':');
    if (kind === 'training') {
      const ok = await c.one(`SELECT 1 FROM certificates WHERE user_id = $1 AND training_id = $2 AND (valid_until IS NULL OR valid_until >= current_date)`, [userId, id]);
      if (!ok) out.push((await c.one('SELECT name FROM trainings WHERE id = $1', [id]) || { name: 'Schulung' }).name);
    } else {
      const ok = await c.one(`SELECT 1 FROM licenses WHERE user_id = $1 AND type_id = $2 AND status = 'valid' AND (expires IS NULL OR expires >= current_date)`, [userId, id]);
      if (!ok) out.push((await c.one('SELECT name FROM license_types WHERE id = $1', [id]) || { name: 'Lizenz' }).name);
    }
  }
  return out;
}

async function moveStock(c, req, partId, qty, kind, ref) {
  if (kind === 'reserve') await c.query('UPDATE parts SET reserved = reserved + $2 WHERE id = $1', [partId, qty]);
  if (kind === 'release') await c.query('UPDATE parts SET reserved = greatest(0, reserved - $2) WHERE id = $1', [partId, qty]);
  if (kind === 'out') await c.query('UPDATE parts SET stock = stock - $2, reserved = greatest(0, reserved - $2) WHERE id = $1', [partId, qty]);
  await c.query('INSERT INTO stock_movements (part_id, qty, kind, ref, by_user) VALUES ($1, $2, $3, $4, $5)', [partId, kind === 'reserve' || kind === 'out' ? -qty : qty, kind, ref, req.user.id]);
}
export { moveStock };

async function releaseItemParts(c, req, item, ref) {
  if (item.parts_taken || !item.parts) return;
  for (const p of item.parts) await moveStock(c, req, p.part, Number(p.qty), 'release', ref);
}

export default async function workshopRoutes(app) {
  // ---------- Auftrag anlegen ----------
  app.post('/api/orders', async (req) => {
    req.need('orders', 3);
    const b = z.object({
      vehicle: uuid.optional(),
      newVehicle: z.object({ plate: z.string().trim().min(2).max(16), make: z.string().max(60).default(''), model: z.string().max(60).default(''), cls: uuid.nullable().optional(), color: z.string().max(40).default(''), owner: uuid.optional(), ownerName: z.string().trim().max(120).optional() }).optional(),
      request: z.string().max(2000).default(''), mileage: z.coerce.number().int().min(0).max(9999999).default(0),
      due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), bay: uuid.nullable().optional(),
      assignees: z.array(uuid).max(6).default([]), status: z.enum(['quote', 'accepted']).default('accepted'),
      condition: z.record(z.string(), z.coerce.number().int().min(0).max(100)).optional(),
    }).parse(req.body || {});
    const id = await tx(async (c) => {
      let vehicleId = b.vehicle;
      if (!vehicleId) {
        const nv = b.newVehicle || fail(400, 'Fahrzeug fehlt.');
        req.need('vehicles', 3);
        const plate = nv.plate.toUpperCase();
        const ex = await c.one(`SELECT id FROM vehicles WHERE upper(replace(plate, ' ', '')) = upper(replace($1, ' ', '')) AND status <> 'scrapped'`, [plate]);
        if (ex) vehicleId = ex.id;
        else {
          let owner = nv.owner;
          if (!owner) {
            if (!nv.ownerName) fail(400, 'Halter fehlt.');
            req.need('customers', 3);
            const pg = await c.one('SELECT id FROM price_groups WHERE is_default ORDER BY name LIMIT 1');
            owner = (await c.one('INSERT INTO customers (name, price_group_id) VALUES ($1, $2) RETURNING id', [nv.ownerName, pg && pg.id])).id;
          }
          const v = await c.one('INSERT INTO vehicles (plate, make, model, class_id, color, km, owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [plate, nv.make, nv.model, nv.cls || null, nv.color, b.mileage, owner]);
          await c.query('INSERT INTO vehicle_owner_history (vehicle_id, customer_id) VALUES ($1, $2)', [v.id, owner]);
          vehicleId = v.id;
        }
      }
      const v = await c.one('SELECT * FROM vehicles WHERE id = $1', [vehicleId]) || fail(404, 'Fahrzeug nicht gefunden');
      if (v.status === 'scrapped') fail(409, 'Das Fahrzeug ist verschrottet.');
      const cust = await c.one('SELECT * FROM customers WHERE id = $1', [v.owner_id]) || fail(409, 'Das Fahrzeug hat keinen Halter.');
      if (cust.blocked) fail(409, `Kunde gesperrt: ${cust.blocked}`);
      const no = await nextNumber(c, 'order');
      const o = await c.one(`INSERT INTO orders (no, status, customer_id, vehicle_id, price_group_id, request, mileage, due, bay_id, condition, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [no, b.status, cust.id, v.id, cust.price_group_id, b.request, b.mileage || v.km, b.due || null, b.bay || null, b.condition || {}, req.user.id]);
      const team = b.assignees.length ? b.assignees : [req.user.id];
      for (const u of team) await c.query('INSERT INTO order_assignees VALUES ($1, $2) ON CONFLICT DO NOTHING', [o.id, u]);
      if (b.mileage > v.km) await c.query('UPDATE vehicles SET km = $2 WHERE id = $1', [v.id, b.mileage]);
      await event(c, req, o.id, `${STATUS_LABEL[b.status]} angelegt · km ${b.mileage || v.km}`);
      await audit(req, 'Auftrag', 'Angelegt', `${no} · ${v.plate}`, c);
      return o.id;
    });
    return { id };
  });

  app.patch('/api/orders/:id', async (req) => {
    const b = z.object({ request: z.string().max(2000).optional(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), bay: uuid.nullable().optional(), mileage: z.coerce.number().int().min(0).optional(), condition: z.record(z.string(), z.coerce.number().int().min(0).max(100)).optional(), assignees: z.array(uuid).min(1).max(6).optional() }).strict().parse(req.body || {});
    return tx(async (c) => {
      const o = await loadOrder(c, req, req.params.id);
      if (LOCKED.includes(o.status)) fail(409, 'Der Auftrag ist abgeschlossen.');
      await c.query(`UPDATE orders SET request = coalesce($2, request), due = CASE WHEN $3::boolean THEN $4::date ELSE due END, bay_id = CASE WHEN $5::boolean THEN $6::uuid ELSE bay_id END,
                     mileage = coalesce($7, mileage), condition = coalesce($8, condition) WHERE id = $1`,
      [o.id, b.request ?? null, 'due' in b, b.due ?? null, 'bay' in b, b.bay ?? null, b.mileage ?? null, b.condition ? JSON.stringify(b.condition) : null]);
      if (b.assignees) {
        if (req.level('orders') < 3) fail(403, 'Bearbeiter ändern braucht „Lesen & Schreiben“.');
        await c.query('DELETE FROM order_assignees WHERE order_id = $1', [o.id]);
        for (const u of b.assignees) await c.query('INSERT INTO order_assignees VALUES ($1, $2)', [o.id, u]);
        await event(c, req, o.id, 'Bearbeiter geändert');
      }
      return { ok: true };
    });
  });

  // ---------- Positionen ----------
  app.post('/api/orders/:id/items', async (req) => {
    const b = z.object({ item: uuid.optional(), name: z.string().trim().max(120).optional(), unit: z.coerce.number().min(0).max(1e8).optional(), qty: z.coerce.number().positive().max(1000).default(1), disc: z.coerce.number().min(0).max(100).optional(), by: uuid }).parse(req.body || {});
    return tx(async (c) => {
      const o = await loadOrder(c, req, req.params.id);
      if (LOCKED.includes(o.status)) fail(409, 'Der Auftrag ist abgeschlossen.');
      const v = await c.one('SELECT class_id FROM vehicles WHERE id = $1', [o.vehicle_id]);
      const pg = o.price_group_id ? await c.one('SELECT * FROM price_groups WHERE id = $1', [o.price_group_id]) : null;
      const features = await getSetting('features', c);
      let row, it = null, warning = null, request = null;
      if (b.item) {
        it = await c.one('SELECT * FROM catalog_items WHERE id = $1 AND active', [b.item]) || fail(404, 'Leistung nicht gefunden oder inaktiv.');
        let unit = unitPrice(it, v.class_id);
        if (b.unit !== undefined && Math.abs(b.unit - unit) > 0.001) { if (!req.flag('auftrag.preis_aendern')) fail(403, 'Vom Preislistenpreis abweichen darfst du nicht.'); unit = b.unit; }
        const gd = groupDiscount(pg, it);
        let disc = gd;
        if (b.disc !== undefined && b.disc > gd) {
          const max = Math.max(gd, Number(req.flag('rabatt.max_prozent')));
          if (b.disc <= max) disc = b.disc; else request = b.disc;
        } else if (b.disc !== undefined) disc = b.disc;
        const miss = await missingQual(c, b.by, it);
        if (miss.length) { if (features.qualHard) fail(409, `Qualifikation fehlt: ${miss.join(', ')}`); warning = `Qualifikation fehlt: ${miss.join(', ')}`; }
        let parts = null;
        if (features.stock) {
          if (it.kind === 'part' && it.part_id) parts = [{ part: it.part_id, qty: b.qty }];
          else if (it.parts && it.parts.length) parts = it.parts.map((p) => ({ part: p.part, qty: Number(p.qty) * b.qty }));
        }
        row = await c.one(`INSERT INTO order_items (order_id, catalog_item_id, name, kind, qty, unit_price, disc, by_user, parts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [o.id, it.id, it.name, it.kind, b.qty, unit, disc, b.by, parts ? JSON.stringify(parts) : null]);
        if (parts) for (const p of parts) await moveStock(c, req, p.part, p.qty, 'reserve', o.no);
      } else {
        if (!req.flag('auftrag.preis_aendern')) fail(403, 'Freie Positionen braucht das Einzelrecht „Vom Preis abweichen“.');
        if (!b.name || b.unit === undefined) fail(400, 'Name und Preis angeben.');
        const disc = b.disc || 0;
        if (disc > Number(req.flag('rabatt.max_prozent'))) fail(403, 'Rabatt über deinem Limit.');
        row = await c.one(`INSERT INTO order_items (order_id, name, kind, qty, unit_price, disc, by_user) VALUES ($1,$2,'flat',$3,$4,$5,$6) RETURNING id`, [o.id, b.name, b.qty, b.unit, disc, b.by]);
      }
      if (request !== null) {
        await c.query('INSERT INTO discount_requests (order_item_id, order_id, requested_by, pct) VALUES ($1, $2, $3, $4)', [row.id, o.id, req.user.id, request]);
        const A = await loadAuthz();
        const users = await c.q(`SELECT * FROM users WHERE status = 'active'`);
        const deciders = users.filter((u) => u.id !== req.user.id && levelOf(A, u, 'orders') >= 3 && Number(flagOf(A, u, 'rabatt.max_prozent')) >= request).map((u) => u.id);
        await notify(deciders, 'discount', `Rabattfreigabe: ${req.user.name} möchte ${request} % auf „${it.name}“ (${o.no})`, '#/auftrag/' + o.id, 'accent');
        warning = (warning ? warning + ' · ' : '') + `Rabatt ${request} % liegt über deinem Limit – Freigabe angefragt.`;
      }
      await event(c, req, o.id, `Position: ${b.item ? it.name : b.name}`);
      await audit(req, 'Auftrag', 'Position hinzugefügt', `${o.no} · ${b.item ? it.name : b.name} × ${b.qty}`, c);
      return { id: row.id, warning };
    });
  });

  app.delete('/api/orders/:id/items/:item', async (req) => {
    return tx(async (c) => {
      const o = await loadOrder(c, req, req.params.id);
      if (LOCKED.includes(o.status)) fail(409, 'Der Auftrag ist abgeschlossen.');
      const it = await c.one('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [req.params.item, o.id]) || fail(404, 'Position nicht gefunden');
      if (it.parts_taken) fail(409, 'Teile wurden schon entnommen – Korrektur über das Lager.');
      await releaseItemParts(c, req, it, o.no);
      await c.query('DELETE FROM order_items WHERE id = $1', [it.id]);
      await event(c, req, o.id, `Position entfernt: ${it.name}`);
      await audit(req, 'Auftrag', 'Position entfernt', `${o.no} · ${it.name}`, c);
      return { ok: true };
    });
  });

  app.post('/api/orders/:id/notes', async (req) => {
    const b = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body || {});
    return tx(async (c) => {
      const o = await loadOrder(c, req, req.params.id);
      await c.query('INSERT INTO order_notes (order_id, author_id, body) VALUES ($1, $2, $3)', [o.id, req.user.id, b.body]);
      return { ok: true };
    });
  });

  // ---------- Status ----------
  app.post('/api/orders/:id/status', async (req) => {
    const b = z.object({ to: z.enum(Object.keys(STATUS_LABEL)), reason: z.string().trim().max(300).optional() }).parse(req.body || {});
    return tx(async (c) => {
      const o = await loadOrder(c, req, req.params.id);
      const from = o.status;
      if (from === b.to) return { ok: true };
      const features = await getSetting('features', c);
      const ok =
        (OPEN.includes(from) && ['quote', 'accepted', 'in_progress', 'waiting_parts', 'done'].includes(b.to) && from !== 'done') ||
        (from === 'done' && ['in_progress', 'invoiced'].includes(b.to)) ||
        (from === 'quote' && b.to === 'rejected') ||
        (OPEN.includes(from) && b.to === 'cancelled') ||
        (from === 'invoiced' && b.to === 'picked_up');
      if (!ok) fail(409, `Von „${STATUS_LABEL[from]}“ nach „${STATUS_LABEL[b.to]}“ geht nicht.`);
      if (b.to === 'done' && features.fourEyes && req.level('orders') < 4) fail(403, 'Vier-Augen-Prüfung: „Fertig“ meldet ein Meister.');
      if (b.to === 'cancelled' && !b.reason) fail(400, 'Bitte einen Grund angeben.');
      const items = await c.q('SELECT * FROM order_items WHERE order_id = $1', [o.id]);
      let invoice = null;
      if (b.to === 'done' || (b.to === 'invoiced' && from !== 'done')) {
        for (const it of items) {
          if (it.parts && !it.parts_taken) {
            for (const p of it.parts) await moveStock(c, req, p.part, Number(p.qty), 'out', o.no);
            await c.query('UPDATE order_items SET parts_taken = true WHERE id = $1', [it.id]);
          }
        }
        const v = await c.one('SELECT plate FROM vehicles WHERE id = $1', [o.vehicle_id]);
        for (const it of items) {
          const ci = it.catalog_item_id ? await c.one('SELECT tuning FROM catalog_items WHERE id = $1', [it.catalog_item_id]) : null;
          if (ci && ci.tuning) {
            await c.query(`INSERT INTO vehicle_tuning (vehicle_id, category, level, source) VALUES ($1, $2, $3, $4)
              ON CONFLICT (vehicle_id, category) DO UPDATE SET level = EXCLUDED.level, source = EXCLUDED.source, updated_at = now() WHERE vehicle_tuning.level <= EXCLUDED.level`,
            [o.vehicle_id, ci.tuning[0], ci.tuning[1], `${o.no} · ${today().split('-').reverse().join('.')}`]);
          }
        }
        if (b.to === 'done') fireWebhooks('Auftrag fertig', `${o.no} · ${v.plate}`);
      }
      if (b.to === 'invoiced') {
        req.need('invoices', 3);
        if (!items.length) fail(409, 'Der Auftrag hat keine Positionen.');
        const open = await c.one(`SELECT 1 FROM discount_requests WHERE order_id = $1 AND status = 'open'`, [o.id]);
        if (open) fail(409, 'Es gibt noch eine offene Rabattfreigabe.');
        const v = await c.one('SELECT v.plate, v.make, v.model FROM vehicles v WHERE id = $1', [o.vehicle_id]);
        invoice = await createInvoice(c, req, { orderId: o.id, customerId: o.customer_id, vehicle: v, ref: o.no, lines: items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit_price, disc: i.disc })) });
      }
      if (b.to === 'cancelled' || b.to === 'rejected') {
        for (const it of items) await releaseItemParts(c, req, it, o.no);
        await c.query(`UPDATE discount_requests SET status = 'rejected', decided_at = now() WHERE order_id = $1 AND status = 'open'`, [o.id]);
      }
      await c.query('UPDATE orders SET status = $2, cancel_reason = coalesce($3, cancel_reason) WHERE id = $1', [o.id, b.to, b.reason || null]);
      await event(c, req, o.id, `${STATUS_LABEL[b.to]}${b.reason ? ' · ' + b.reason : ''}${invoice ? ' · Rechnung ' + invoice.no : ''}`);
      await audit(req, 'Auftrag', 'Status', `${o.no}: ${STATUS_LABEL[from]} → ${STATUS_LABEL[b.to]}`, c);
      return { ok: true, invoice };
    });
  });

  // ---------- Rabattfreigabe ----------
  app.post('/api/discounts/:id', async (req) => {
    const b = z.object({ approve: z.boolean() }).parse(req.body || {});
    return tx(async (c) => {
      const d = await c.one(`SELECT d.*, o.no FROM discount_requests d JOIN orders o ON o.id = d.order_id WHERE d.id = $1 AND d.status = 'open' FOR UPDATE`, [req.params.id]) || fail(404, 'Anfrage nicht gefunden oder schon entschieden.');
      req.need('orders', 3);
      if (d.requested_by === req.user.id && !req.user.is_owner) fail(403, 'Eigene Anfragen gibt jemand anderes frei.');
      if (b.approve && Number(req.flag('rabatt.max_prozent')) < Number(d.pct)) fail(403, `Dein Limit (${req.flag('rabatt.max_prozent')} %) reicht für ${d.pct} % nicht.`);
      await c.query(`UPDATE discount_requests SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1`, [d.id, b.approve ? 'approved' : 'rejected', req.user.id]);
      if (b.approve) await c.query('UPDATE order_items SET disc = $2 WHERE id = $1', [d.order_item_id, d.pct]);
      await event(c, req, d.order_id, `Rabatt ${d.pct} % ${b.approve ? 'freigegeben' : 'abgelehnt'}`);
      await audit(req, 'Auftrag', b.approve ? 'Rabatt freigegeben' : 'Rabatt abgelehnt', `${d.no} · ${d.pct} %`, c);
      await notify([d.requested_by], 'discount_decided', `Rabatt ${d.pct} % auf ${d.no} ${b.approve ? 'freigegeben' : 'abgelehnt'}`, '#/auftrag/' + d.order_id, b.approve ? 'ok' : 'bad');
      return { ok: true };
    });
  });

  // ---------- Fahrzeug: Tuning von Hand ----------
  app.put('/api/vehicles/:id/tuning', async (req) => {
    req.need('vehicles', 3);
    const b = z.object({ category: z.string().trim().min(1).max(30), level: z.coerce.number().int().min(0).max(5) }).parse(req.body || {});
    if (b.level === 0) await q('DELETE FROM vehicle_tuning WHERE vehicle_id = $1 AND category = $2', [req.params.id, b.category]);
    else await q(`INSERT INTO vehicle_tuning (vehicle_id, category, level, source) VALUES ($1, $2, $3, $4) ON CONFLICT (vehicle_id, category) DO UPDATE SET level = EXCLUDED.level, source = EXCLUDED.source, updated_at = now()`, [req.params.id, b.category, b.level, 'von Hand · ' + req.user.name]);
    await audit(req, 'Fahrzeuge', 'Tuning korrigiert', `${b.category} → ${b.level}`);
    return { ok: true };
  });

  // ---------- Einsätze ----------
  app.post('/api/callouts', async (req) => {
    req.need('callouts', 3);
    const b = z.object({ location: z.string().trim().min(2).max(160), by: z.string().trim().max(80).default('Kunde'), customer: uuid.nullable().optional(), vehicle: uuid.nullable().optional(), driver: uuid.nullable().optional(), item: uuid.nullable().optional() }).parse(req.body || {});
    return tx(async (c) => {
      const no = await nextNumber(c, 'callout');
      const it = b.item ? await c.one('SELECT * FROM catalog_items WHERE id = $1', [b.item]) : null;
      let fee = it ? Number(it.price) : 0;
      if (it && b.vehicle) { const v = await c.one('SELECT class_id FROM vehicles WHERE id = $1', [b.vehicle]); if (v) fee = unitPrice(it, v.class_id); }
      const r = await c.one(`INSERT INTO callouts (no, location, requested_by, customer_id, vehicle_id, driver_id, fee, catalog_item_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [no, b.location, b.by, b.customer || null, b.vehicle || null, b.driver || null, fee, b.item || null, b.driver ? 'en_route' : 'open']);
      await audit(req, 'Einsätze', 'Angelegt', `${no} · ${b.location}`, c);
      fireWebhooks('Einsatz neu', `${no} · ${b.location} · ${b.by}`);
      const drivers = await c.q(`SELECT gm.user_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.name ILIKE '%abschlepp%'`);
      await notify(drivers.map((d) => d.user_id), 'callout', `Neuer Einsatz ${no}: ${b.location}`, '#/einsaetze', 'info');
      return { id: r.id };
    });
  });
  app.patch('/api/callouts/:id', async (req) => {
    req.need('callouts', 3);
    const b = z.object({ status: z.enum(['open', 'en_route', 'on_site', 'done', 'cancelled']).optional(), driver: uuid.nullable().optional(), vehicle: uuid.nullable().optional(), fee: z.coerce.number().min(0).max(1e7).optional() }).strict().parse(req.body || {});
    const co = await one('SELECT * FROM callouts WHERE id = $1', [req.params.id]) || fail(404, 'Einsatz nicht gefunden');
    if (co.invoice_id) fail(409, 'Der Einsatz ist abgerechnet.');
    if (b.fee !== undefined && !req.flag('auftrag.preis_aendern')) fail(403, 'Gebühr ändern braucht „Vom Preis abweichen“.');
    await q(`UPDATE callouts SET status = coalesce($2, status), driver_id = CASE WHEN $3::boolean THEN $4::uuid ELSE driver_id END, vehicle_id = CASE WHEN $5::boolean THEN $6::uuid ELSE vehicle_id END, fee = coalesce($7, fee) WHERE id = $1`,
      [co.id, b.status ?? null, 'driver' in b, b.driver ?? null, 'vehicle' in b, b.vehicle ?? null, b.fee ?? null]);
    await audit(req, 'Einsätze', 'Geändert', `${co.no}${b.status ? ' · ' + b.status : ''}`);
    return { ok: true };
  });
  app.post('/api/callouts/:id/invoice', async (req) => {
    req.need('callouts', 3); req.need('invoices', 3);
    return tx(async (c) => {
      const co = await c.one('SELECT * FROM callouts WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Einsatz nicht gefunden');
      if (co.invoice_id) fail(409, 'Schon abgerechnet.');
      if (!co.customer_id) fail(409, 'Dem Einsatz fehlt ein Kunde.');
      const cust = await c.one('SELECT * FROM customers WHERE id = $1', [co.customer_id]);
      const pg = cust.price_group_id ? await c.one('SELECT * FROM price_groups WHERE id = $1', [cust.price_group_id]) : null;
      const it = co.catalog_item_id ? await c.one('SELECT * FROM catalog_items WHERE id = $1', [co.catalog_item_id]) : null;
      const v = co.vehicle_id ? await c.one('SELECT plate, make, model FROM vehicles WHERE id = $1', [co.vehicle_id]) : null;
      const inv = await createInvoice(c, req, { calloutId: co.id, customerId: co.customer_id, vehicle: v, ref: co.no, lines: [{ name: (it ? it.name : 'Einsatz') + ' · ' + co.location, qty: 1, unit: co.fee, disc: it ? groupDiscount(pg, it) : 0 }] });
      await c.query(`UPDATE callouts SET invoice_id = $2, status = 'done' WHERE id = $1`, [co.id, inv.id]);
      return { invoice: inv };
    });
  });
  app.post('/api/callouts/:id/order', async (req) => {
    req.need('callouts', 3); req.need('orders', 3);
    return tx(async (c) => {
      const co = await c.one('SELECT * FROM callouts WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Einsatz nicht gefunden');
      if (co.order_id) return { id: co.order_id };
      if (!co.vehicle_id) fail(409, 'Erst ein Fahrzeug am Einsatz eintragen.');
      const v = await c.one('SELECT * FROM vehicles WHERE id = $1', [co.vehicle_id]);
      const cust = await c.one('SELECT * FROM customers WHERE id = $1', [v.owner_id]) || fail(409, 'Fahrzeug ohne Halter.');
      const no = await nextNumber(c, 'order');
      const o = await c.one(`INSERT INTO orders (no, status, customer_id, vehicle_id, price_group_id, request, mileage, created_by) VALUES ($1, 'accepted', $2, $3, $4, $5, $6, $7) RETURNING id`,
        [no, cust.id, v.id, cust.price_group_id, `Aus Einsatz ${co.no}: ${co.location}`, v.km, req.user.id]);
      await c.query('INSERT INTO order_assignees VALUES ($1, $2)', [o.id, co.driver_id || req.user.id]);
      if (co.catalog_item_id && Number(co.fee) > 0) {
        const it = await c.one('SELECT * FROM catalog_items WHERE id = $1', [co.catalog_item_id]);
        const pg = cust.price_group_id ? await c.one('SELECT * FROM price_groups WHERE id = $1', [cust.price_group_id]) : null;
        await c.query(`INSERT INTO order_items (order_id, catalog_item_id, name, kind, qty, unit_price, disc, by_user) VALUES ($1,$2,$3,$4,1,$5,$6,$7)`, [o.id, it.id, it.name, it.kind, co.fee, groupDiscount(pg, it), co.driver_id || req.user.id]);
      }
      await c.query(`UPDATE callouts SET order_id = $2, status = 'done' WHERE id = $1`, [co.id, o.id]);
      await event(c, req, o.id, `Angelegt aus Einsatz ${co.no}`);
      await audit(req, 'Auftrag', 'Angelegt', `${no} aus ${co.no}`, c);
      return { id: o.id };
    });
  });
}
