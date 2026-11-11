// 0.3.0: Bilder, Fuhrpark-Aktionen, Tuning-Konfigurator, Regelwerk
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { fail, audit, nextNumber, notify, getSetting, today } from '../lib.js';
import { unitPrice, groupDiscount } from '../pricing.js';
import { missingQual, moveStock } from './workshop.js';

const uuid = z.string().uuid();
const MAX_IMAGE = 3 * 1024 * 1024;
const MAGIC = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/webp': [0x52, 0x49, 0x46, 0x46] };
const IMG_PERM = { model: 'models', fleet: 'fleet' };

export default async function extraRoutes(app) {
  // ---------- Bilder ----------
  app.post('/api/images', async (req) => {
    const b = z.object({ ownerType: z.enum(['model', 'fleet']), ownerId: uuid, data: z.string().max(5_000_000), caption: z.string().trim().max(200).default('') }).parse(req.body || {});
    req.need(IMG_PERM[b.ownerType], 3);
    const m = b.data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/) || fail(400, 'Nur PNG, JPEG oder WebP.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_IMAGE) fail(400, 'Bild zu groß (max. 3 MB).');
    if (!MAGIC[m[1]].every((x, i) => buf[i] === x)) fail(400, 'Die Datei ist kein gültiges Bild.');
    const owner = await one(b.ownerType === 'model' ? 'SELECT id FROM vehicle_models WHERE id = $1' : 'SELECT id FROM fleet_vehicles WHERE id = $1', [b.ownerId]);
    if (!owner) fail(404, 'Nicht gefunden');
    const cnt = await one('SELECT count(*)::int AS n FROM images WHERE owner_type = $1 AND owner_id = $2', [b.ownerType, b.ownerId]);
    if (cnt.n >= 30) fail(409, 'Höchstens 30 Bilder je Eintrag.');
    const r = await one('INSERT INTO images (owner_type, owner_id, mime, data, size, caption, position, is_cover, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [b.ownerType, b.ownerId, m[1], buf, buf.length, b.caption, cnt.n, cnt.n === 0, req.user.id]);
    await audit(req, b.ownerType === 'model' ? 'Fahrzeug-Katalog' : 'Fuhrpark', 'Bild hochgeladen', b.caption || r.id);
    return { id: r.id };
  });
  app.get('/api/images/:id', async (req, reply) => {
    const img = await one('SELECT mime, data FROM images WHERE id = $1', [req.params.id]) || fail(404, 'Bild nicht gefunden');
    reply.header('Content-Type', img.mime).header('Cache-Control', 'private, max-age=86400').header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return reply.send(img.data);
  });
  app.patch('/api/images/:id', async (req) => {
    const b = z.object({ caption: z.string().trim().max(200).optional(), cover: z.literal(true).optional(), move: z.enum(['left', 'right']).optional() }).strict().parse(req.body || {});
    const img = await one('SELECT id, owner_type, owner_id, position FROM images WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    req.need(IMG_PERM[img.owner_type], 3);
    await tx(async (c) => {
      if (b.caption !== undefined) await c.query('UPDATE images SET caption = $2 WHERE id = $1', [img.id, b.caption]);
      if (b.cover) {
        await c.query('UPDATE images SET is_cover = false WHERE owner_type = $1 AND owner_id = $2', [img.owner_type, img.owner_id]);
        await c.query('UPDATE images SET is_cover = true WHERE id = $1', [img.id]);
      }
      if (b.move) {
        const other = await c.one(`SELECT id, position FROM images WHERE owner_type = $1 AND owner_id = $2 AND position ${b.move === 'left' ? '<' : '>'} $3 ORDER BY position ${b.move === 'left' ? 'DESC' : 'ASC'} LIMIT 1`, [img.owner_type, img.owner_id, img.position]);
        if (other) { await c.query('UPDATE images SET position = $2 WHERE id = $1', [img.id, other.position]); await c.query('UPDATE images SET position = $2 WHERE id = $1', [other.id, img.position]); }
      }
    });
    return { ok: true };
  });
  app.delete('/api/images/:id', async (req) => {
    const img = await one('SELECT id, owner_type, owner_id, is_cover FROM images WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    req.need(IMG_PERM[img.owner_type], 3);
    await q('DELETE FROM images WHERE id = $1', [img.id]);
    if (img.is_cover) await q('UPDATE images SET is_cover = true WHERE id = (SELECT id FROM images WHERE owner_type = $1 AND owner_id = $2 ORDER BY position LIMIT 1)', [img.owner_type, img.owner_id]);
    await audit(req, img.owner_type === 'model' ? 'Fahrzeug-Katalog' : 'Fuhrpark', 'Bild gelöscht', img.id);
    return { ok: true };
  });

  // ---------- Fuhrpark ----------
  const loadFleet = async (c, id) => c.one('SELECT * FROM fleet_vehicles WHERE id = $1 FOR UPDATE', [id]) || fail(404, 'Fahrzeug nicht gefunden');
  const flog = (c, req, f, kind, extra = {}) => c.query('INSERT INTO fleet_log (fleet_id, user_id, kind, started_at, ended_at, km_start, km_end, amount, transaction_id, text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [f.id, req.user.id, kind, extra.started || null, extra.ended || null, extra.kmStart ?? null, extra.kmEnd ?? null, extra.amount ?? null, extra.tx || null, extra.text || '']);
  app.post('/api/fleet/:id/checkout', async (req) => {
    const b = z.object({ driver: uuid.optional(), km: z.coerce.number().int().min(0).optional(), note: z.string().max(300).default('') }).parse(req.body || {});
    const driver = b.driver || req.user.id;
    req.need('fleet', driver === req.user.id ? 2 : 3);
    return tx(async (c) => {
      const f = await loadFleet(c, req.params.id);
      if (f.status !== 'available') fail(409, f.status === 'in_use' ? 'Das Fahrzeug ist schon ausgegeben.' : 'Das Fahrzeug ist nicht verfügbar.');
      const km = b.km ?? f.km;
      if (km < f.km) fail(400, `Kilometerstand kleiner als zuletzt (${f.km}).`);
      await c.query(`UPDATE fleet_vehicles SET status = 'in_use', driver_id = $2, km = $3 WHERE id = $1`, [f.id, driver, km]);
      await flog(c, req, f, 'checkout', { started: new Date(), kmStart: km, text: b.note });
      await audit(req, 'Fuhrpark', 'Ausgegeben', `${f.name} → ${(await c.one('SELECT name FROM users WHERE id = $1', [driver])).name}`, c);
      return { ok: true };
    });
  });
  app.post('/api/fleet/:id/checkin', async (req) => {
    const b = z.object({ km: z.coerce.number().int().min(0), note: z.string().max(300).default(''), damage: z.boolean().default(false) }).parse(req.body || {});
    return tx(async (c) => {
      const f = await loadFleet(c, req.params.id);
      if (f.status !== 'in_use') fail(409, 'Das Fahrzeug ist nicht ausgegeben.');
      if (f.driver_id !== req.user.id) req.need('fleet', 3); else req.need('fleet', 1);
      if (b.km < f.km) fail(400, `Kilometerstand kleiner als bei der Ausgabe (${f.km}).`);
      const out = await c.one(`SELECT started_at FROM fleet_log WHERE fleet_id = $1 AND kind = 'checkout' ORDER BY at DESC LIMIT 1`, [f.id]);
      await c.query(`UPDATE fleet_vehicles SET status = $2, driver_id = NULL, km = $3 WHERE id = $1`, [f.id, b.damage ? 'workshop' : 'available', b.km]);
      await flog(c, req, f, 'checkin', { started: out && out.started_at, ended: new Date(), kmStart: f.km, kmEnd: b.km, text: b.note });
      if (b.damage) {
        await flog(c, req, f, 'damage', { text: b.note || 'Schaden bei Rückgabe gemeldet' });
        const { loadAuthz, levelOf } = await import('../authz.js');
        const A = await loadAuthz();
        const users = await c.q(`SELECT * FROM users WHERE status = 'active'`);
        await notify(users.filter((u) => levelOf(A, u, 'fleet') >= 3).map((u) => u.id), 'fleet', `Schaden an ${f.name}: ${b.note || 'bitte prüfen'}`, '#/fuhrpark/' + f.id, 'warn');
      }
      await audit(req, 'Fuhrpark', 'Zurückgegeben', `${f.name} · ${b.km - f.km} km${b.damage ? ' · Schaden' : ''}`, c);
      return { ok: true };
    });
  });
  app.post('/api/fleet/:id/entry', async (req) => {
    const b = z.object({
      kind: z.enum(['service', 'damage', 'fuel', 'cost', 'note']), text: z.string().trim().max(500).default(''), amount: z.coerce.number().min(0).max(1e8).optional(),
      account: uuid.nullable().optional(), km: z.coerce.number().int().min(0).optional(), nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), nextKm: z.coerce.number().int().min(0).nullable().optional(),
    }).parse(req.body || {});
    req.need('fleet', ['damage', 'note', 'fuel'].includes(b.kind) ? 2 : 3);
    return tx(async (c) => {
      const f = await loadFleet(c, req.params.id);
      let tId = null;
      if (b.amount && b.account) {
        req.need('accounts', 3);
        const closed = await c.one('SELECT 1 FROM cash_closings WHERE account_id = $1 AND day = $2', [b.account, today()]);
        if (closed) fail(409, 'Für diese Kasse ist der Tag schon abgeschlossen.');
        const label = { service: 'Service', damage: 'Reparatur', fuel: 'Tanken', cost: 'Kosten', note: 'Kosten' }[b.kind];
        tId = (await c.one(`INSERT INTO transactions (account_id, type, amount, title, category, source, source_id, created_by) VALUES ($1, 'expense', $2, $3, 'Fuhrpark', 'fleet', $4, $5) RETURNING id`, [b.account, b.amount.toFixed(2), `${label} ${f.name}${b.text ? ' · ' + b.text : ''}`, f.id, req.user.id])).id;
      }
      await flog(c, req, f, b.kind, { amount: b.amount ?? null, tx: tId, text: b.text, kmEnd: b.km ?? null });
      if (b.kind === 'service') {
        await c.query(`UPDATE fleet_vehicles SET service_due = $2, service_km = $3, km = greatest(km, coalesce($4, km)), status = CASE WHEN status = 'workshop' THEN 'available' ELSE status END WHERE id = $1`, [f.id, b.nextDue ?? null, b.nextKm ?? null, b.km ?? null]);
      }
      if (b.kind === 'damage' && f.status === 'available') await c.query(`UPDATE fleet_vehicles SET status = 'workshop' WHERE id = $1`, [f.id]);
      await audit(req, 'Fuhrpark', { service: 'Service', damage: 'Schaden', fuel: 'Tanken', cost: 'Kosten', note: 'Vermerk' }[b.kind], `${f.name}${b.amount ? ' · $ ' + b.amount : ''}${b.text ? ' · ' + b.text : ''}`, c);
      return { ok: true };
    });
  });

  // ---------- Tuning-Konfigurator: Angebot/Auftrag aus Auswahl ----------
  app.post('/api/tuning/order', async (req) => {
    req.need('orders', 3);
    const b = z.object({ vehicle: uuid, items: z.array(uuid).max(30).default([]), packages: z.array(uuid).max(5).default([]), by: uuid.optional(), status: z.enum(['quote', 'accepted']).default('quote'), request: z.string().max(1000).default('') }).parse(req.body || {});
    return tx(async (c) => {
      const v = await c.one('SELECT * FROM vehicles WHERE id = $1', [b.vehicle]) || fail(404, 'Fahrzeug nicht gefunden');
      const cust = await c.one('SELECT * FROM customers WHERE id = $1', [v.owner_id]) || fail(409, 'Das Fahrzeug hat keinen Halter.');
      if (cust.blocked) fail(409, `Kunde gesperrt: ${cust.blocked}`);
      const pg = cust.price_group_id ? await c.one('SELECT * FROM price_groups WHERE id = $1', [cust.price_group_id]) : null;
      const features = await getSetting('features', c);
      const pkgs = b.packages.length ? await c.q('SELECT * FROM tuning_packages WHERE id = ANY($1) AND active', [b.packages]) : [];
      const pkgDisc = {};
      for (const p of pkgs) for (const i of p.items) pkgDisc[i] = Math.max(pkgDisc[i] || 0, Number(p.discount));
      const ids = [...new Set([...b.items, ...pkgs.flatMap((p) => p.items)])];
      if (!ids.length) fail(400, 'Nichts ausgewählt – Upgrades oder ein Paket wählen.');
      const items = await c.q('SELECT * FROM catalog_items WHERE id = ANY($1) AND active', [ids]);
      if (!items.length) fail(400, 'Keine gültigen Leistungen.');
      const by = b.by || req.user.id;
      const no = await nextNumber(c, 'order');
      const o = await c.one(`INSERT INTO orders (no, status, customer_id, vehicle_id, price_group_id, request, mileage, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, no`,
        [no, b.status, cust.id, v.id, cust.price_group_id, b.request || `Tuning: ${items.map((i) => i.name).join(', ')}`, v.km, req.user.id]);
      await c.query('INSERT INTO order_assignees VALUES ($1, $2)', [o.id, by]);
      const warnings = [];
      for (const it of items) {
        const disc = Math.max(groupDiscount(pg, it), pkgDisc[it.id] || 0);
        const miss = await missingQual(c, by, it);
        if (miss.length) { if (features.qualHard) fail(409, `Qualifikation fehlt für ${it.name}: ${miss.join(', ')}`); warnings.push(`${it.name}: ${miss.join(', ')}`); }
        const parts = features.stock ? (it.kind === 'part' && it.part_id ? [{ part: it.part_id, qty: 1 }] : it.parts && it.parts.length ? it.parts.map((p) => ({ part: p.part, qty: Number(p.qty) })) : null) : null;
        await c.query(`INSERT INTO order_items (order_id, catalog_item_id, name, kind, qty, unit_price, disc, by_user, parts) VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8)`, [o.id, it.id, it.name, it.kind, unitPrice(it, v.class_id), disc, by, parts ? JSON.stringify(parts) : null]);
        if (parts) for (const p of parts) await moveStock(c, req, p.part, p.qty, 'reserve', no);
      }
      await c.query('INSERT INTO order_events (order_id, user_id, text) VALUES ($1, $2, $3)', [o.id, req.user.id, `Aus dem Tuning-Konfigurator${pkgs.length ? ' · Paket ' + pkgs.map((p) => p.name).join(', ') : ''}`]);
      await audit(req, 'Auftrag', 'Angelegt (Tuning)', `${no} · ${v.plate} · ${items.length} Positionen`, c);
      return { id: o.id, no, warning: warnings.length ? 'Qualifikation fehlt: ' + warnings.join('; ') : null };
    });
  });

  // ---------- Regelwerk ----------
  const docBody = z.object({ title: z.string().trim().min(2).max(120), body: z.string().max(100000), requireAck: z.boolean().default(true), note: z.string().max(300).default(''), newVersion: z.boolean().default(true) });
  app.post('/api/rules', async (req) => {
    req.need('rules', 4);
    const b = docBody.parse(req.body || {});
    return tx(async (c) => {
      const pos = await c.one('SELECT coalesce(max(position), 0) + 1 AS p FROM rule_docs');
      const d = await c.one('INSERT INTO rule_docs (title, body, require_ack, position, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [b.title, b.body, b.requireAck, pos.p, req.user.id]);
      await c.query('INSERT INTO rule_doc_versions (doc_id, version, title, body, note, changed_by) VALUES ($1, 1, $2, $3, $4, $5)', [d.id, b.title, b.body, b.note || 'Erste Fassung', req.user.id]);
      await audit(req, 'Regelwerk', 'Angelegt', b.title, c);
      return { id: d.id };
    });
  });
  app.patch('/api/rules/:id', async (req) => {
    req.need('rules', 3);
    const b = docBody.parse(req.body || {});
    return tx(async (c) => {
      const d = await c.one('SELECT * FROM rule_docs WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Nicht gefunden');
      const changed = d.body !== b.body || d.title !== b.title;
      const version = changed && b.newVersion ? d.version + 1 : d.version;
      await c.query('UPDATE rule_docs SET title = $2, body = $3, require_ack = $4, version = $5, updated_by = $6, updated_at = now() WHERE id = $1', [d.id, b.title, b.body, b.requireAck, version, req.user.id]);
      if (version !== d.version) await c.query('INSERT INTO rule_doc_versions (doc_id, version, title, body, note, changed_by) VALUES ($1,$2,$3,$4,$5,$6)', [d.id, version, b.title, b.body, b.note, req.user.id]);
      else await c.query('UPDATE rule_doc_versions SET title = $3, body = $4 WHERE doc_id = $1 AND version = $2', [d.id, version, b.title, b.body]);
      if (version !== d.version && b.requireAck) {
        const staff = await c.q(`SELECT id FROM users WHERE status IN ('active','leave') AND rank_id IS NOT NULL AND id <> $1`, [req.user.id]);
        await notify(staff.map((s) => s.id), 'rules', `Neue Fassung: „${b.title}“ (Version ${version}) – bitte lesen und bestätigen`, '#/regelwerk?doc=' + d.id, 'accent', `rules:${d.id}:${version}`);
      }
      await audit(req, 'Regelwerk', version !== d.version ? 'Neue Fassung' : 'Korrektur', `${b.title} · Version ${version}${b.note ? ' · ' + b.note : ''}`, c);
      return { ok: true, version };
    });
  });
  app.delete('/api/rules/:id', async (req) => {
    req.need('rules', 4);
    const d = await one('SELECT title FROM rule_docs WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    await q('DELETE FROM rule_docs WHERE id = $1', [req.params.id]);
    await audit(req, 'Regelwerk', 'Gelöscht', d.title);
    return { ok: true };
  });
  app.post('/api/rules/:id/move', async (req) => {
    req.need('rules', 3);
    const b = z.object({ dir: z.enum(['up', 'down']) }).parse(req.body || {});
    await tx(async (c) => {
      const d = await c.one('SELECT id, position FROM rule_docs WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
      const o = await c.one(`SELECT id, position FROM rule_docs WHERE position ${b.dir === 'up' ? '<' : '>'} $1 ORDER BY position ${b.dir === 'up' ? 'DESC' : 'ASC'} LIMIT 1`, [d.position]);
      if (!o) return;
      await c.query('UPDATE rule_docs SET position = $2 WHERE id = $1', [d.id, o.position]);
      await c.query('UPDATE rule_docs SET position = $2 WHERE id = $1', [o.id, d.position]);
    });
    return { ok: true };
  });
  app.post('/api/rules/:id/ack', async (req) => {
    req.need('rules', 1);
    if (!req.user.rank_id) fail(403, 'Nur für Mitarbeiter.');
    const d = await one('SELECT id, version, title FROM rule_docs WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    await q('INSERT INTO rule_acks (doc_id, user_id, version) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.id, req.user.id, d.version]);
    await audit(req, 'Regelwerk', 'Bestätigt', `${d.title} · Version ${d.version}`);
    return { ok: true };
  });
  app.get('/api/rules/:id/versions', async (req) => {
    req.need('rules', 3);
    return q(`SELECT version, title, body, note, changed_by AS by, local_ts(changed_at) AS at FROM rule_doc_versions WHERE doc_id = $1 ORDER BY version DESC`, [req.params.id]);
  });
}
