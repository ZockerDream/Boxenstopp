// Administration: User-Management, Systemrollen, Server-Einstellungen, Jobs, Backups, Integrationen, Exporte
import { z } from 'zod';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { q, one, tx } from '../db.js';
import { fail, audit, hashPassword, randomToken, sha256, getSetting, setSetting, encrypt, decrypt, sendWebhook, WEBHOOK_EVENTS, ipMatch } from '../lib.js';
import { SYS_PERMS } from '../authz.js';
import { JOBS, runJob, backupNow } from '../jobs.js';
import { config } from '../config.js';

const uuid = z.string().uuid();
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
const csv = (rows, cols) => '﻿' + [cols.map((c) => c[1]).join(';'), ...rows.map((r) => cols.map((c) => csvCell(r[c[0]])).join(';'))].join('\r\n');

async function lastAdminGuard(c, userId) {
  const admins = await c.q(`SELECT u.id FROM users u JOIN user_system_roles r ON r.user_id = u.id AND r.role_id = 'admin' WHERE u.status = 'active' AND (u.expires_on IS NULL OR u.expires_on >= current_date)`);
  if (admins.length === 1 && admins[0].id === userId) fail(409, 'Das ist der letzte aktive Administrator – erst einen weiteren ernennen.');
}

export default async function adminRoutes(app) {
  // ---------- Benutzer ----------
  app.post('/api/admin/users', async (req) => {
    req.needSys('user:create');
    const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(10, 'mindestens 10 Zeichen'), rank: uuid.nullable().optional(), role: z.string().max(60).default('user') }).parse(req.body || {});
    if (b.role !== 'user') req.needSys('role:manage');
    const id = await tx(async (c) => {
      const no = await c.one(`SELECT 'P-' || lpad((count(*) + 1)::text, 3, '0') AS n FROM users`);
      const u = await c.one('INSERT INTO users (email, name, password_hash, rank_id, staff_no) VALUES ($1, $2, $3, $4, $5) RETURNING id', [b.email, b.name, await hashPassword(b.password), b.rank || null, b.rank ? no.n : ''])
        .catch((e) => { if (e.code === '23505') fail(409, 'Diese E-Mail gibt es schon.'); throw e; });
      if (b.role !== 'user') await c.query('INSERT INTO user_system_roles VALUES ($1, $2)', [u.id, b.role]);
      await audit(req, 'Benutzer', 'Angelegt', b.email, c);
      return u.id;
    });
    return { id };
  });
  app.patch('/api/admin/users/:id', async (req) => {
    const b = z.object({ status: z.enum(['active', 'locked', 'left']).optional(), expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), roles: z.array(z.string().max(60)).max(10).optional(), force2fa: z.boolean().optional(), email: z.string().trim().email().optional(), name: z.string().trim().min(2).max(80).optional() }).strict().parse(req.body || {});
    if (b.status || 'expires' in b || b.force2fa !== undefined) req.needSys('user:lock');
    if (b.roles) req.needSys('role:manage');
    if (b.email || b.name) req.needSys('user:update');
    return tx(async (c) => {
      const u = await c.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Nicht gefunden');
      const isAdmin = await c.one(`SELECT 1 FROM user_system_roles WHERE user_id = $1 AND role_id = 'admin'`, [u.id]);
      if (isAdmin && ((b.status && b.status !== 'active') || (b.expires) || (b.roles && !b.roles.includes('admin')))) await lastAdminGuard(c, u.id);
      if (u.is_owner && b.status && b.status !== 'active') {
        const owners = await c.one(`SELECT count(*)::int AS n FROM users WHERE is_owner AND status = 'active'`);
        if (owners.n <= 1) fail(409, 'Der letzte Inhaber kann nicht gesperrt werden.');
      }
      await c.query(`UPDATE users SET status = coalesce($2, status), expires_on = CASE WHEN $3::boolean THEN $4::date ELSE expires_on END, force_2fa = coalesce($5, force_2fa), email = coalesce($6, email), name = coalesce($7, name),
                     locked_until = CASE WHEN $2 = 'active' THEN NULL ELSE locked_until END, failed_logins = CASE WHEN $2 = 'active' THEN 0 ELSE failed_logins END,
                     left_on = CASE WHEN $2 = 'left' THEN current_date ELSE left_on END WHERE id = $1`,
      [u.id, b.status ?? null, 'expires' in b, b.expires ?? null, b.force2fa ?? null, b.email ?? null, b.name ?? null]);
      if (b.status && b.status !== 'active') await c.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [u.id]);
      if (b.roles) {
        await c.query('DELETE FROM user_system_roles WHERE user_id = $1', [u.id]);
        for (const r of b.roles.filter((x) => x !== 'user')) await c.query('INSERT INTO user_system_roles VALUES ($1, $2)', [u.id, r]);
      }
      await audit(req, 'Benutzer', 'Geändert', `${u.email}${b.status ? ' · ' + b.status : ''}${'expires' in b ? ' · Ablauf ' + (b.expires || 'keiner') : ''}${b.roles ? ' · Rollen ' + b.roles.join(',') : ''}`, c);
      return { ok: true };
    });
  });
  app.post('/api/admin/users/:id/:action', async (req) => {
    const { id, action } = req.params;
    const u = await one('SELECT * FROM users WHERE id = $1', [id]) || fail(404, 'Nicht gefunden');
    if (action === 'reset-2fa') {
      req.needSys('user:lock');
      await q('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [id]);
      await audit(req, 'Benutzer', '2FA zurückgesetzt', u.email);
      return { ok: true };
    }
    if (action === 'revoke-sessions') {
      req.needSys('user:lock');
      await q('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      await audit(req, 'Benutzer', 'Sitzungen beendet', u.email);
      return { ok: true };
    }
    if (action === 'reset-link') {
      req.needSys('user:lock');
      const token = randomToken();
      await q(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '24 hours')`, [sha256(token), id]);
      await audit(req, 'Benutzer', 'Reset-Link erzeugt', u.email);
      return { link: `/#/passwort/${token}` };
    }
    if (action === 'approve') {
      req.needSys('user:update');
      const b = z.object({ rank: uuid }).parse(req.body || {});
      if (u.status !== 'pending') fail(409, 'Wartet nicht auf Freigabe.');
      const no = await one(`SELECT 'P-' || lpad((count(*) FILTER (WHERE rank_id IS NOT NULL) + 1)::text, 3, '0') AS n FROM users`);
      await q(`UPDATE users SET status = 'active', rank_id = $2, staff_no = $3 WHERE id = $1`, [id, b.rank, no.n]);
      await audit(req, 'Benutzer', 'Registrierung freigegeben', u.email);
      return { ok: true };
    }
    return fail(404, 'Unbekannte Aktion');
  });
  app.delete('/api/admin/users/:id', async (req) => {
    req.needSys('user:delete');
    const u = await one('SELECT * FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (!['pending', 'invited'].includes(u.status)) fail(409, 'Aktive oder frühere Mitarbeiter bleiben für Historie und Rechnungen erhalten – auf „Ausgeschieden“ setzen.');
    await q('DELETE FROM users WHERE id = $1', [u.id]);
    await audit(req, 'Benutzer', 'Gelöscht', u.email);
    return { ok: true };
  });
  app.get('/api/admin/users.csv', async (req, reply) => {
    req.needSys('user:read');
    const rows = await q(`SELECT u.name, u.email, u.status, r.name AS rank, u.staff_no, u.totp_enabled AS twofa, local_ts(u.last_login_at) AS last, u.expires_on::text AS expires,
                          coalesce((SELECT string_agg(role_id, ',') FROM user_system_roles WHERE user_id = u.id), 'user') AS roles FROM users u LEFT JOIN ranks r ON r.id = u.rank_id ORDER BY u.name`);
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="benutzer.csv"');
    return csv(rows.map((r) => ({ ...r, twofa: r.twofa ? 'ja' : 'nein' })), [['name', 'Name'], ['email', 'E-Mail'], ['status', 'Status'], ['rank', 'Rang'], ['staff_no', 'Personalnr.'], ['roles', 'Systemrollen'], ['twofa', '2FA'], ['last', 'Letzter Login'], ['expires', 'Zugang bis']]);
  });

  // ---------- Systemrollen ----------
  app.post('/api/admin/roles', async (req) => {
    req.needSys('role:manage');
    const b = z.object({ name: z.string().trim().min(2).max(40), desc: z.string().max(200).default('') }).parse(req.body || {});
    const id = 'r_' + randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x');
    await q('INSERT INTO system_roles (id, name, description) VALUES ($1, $2, $3)', [id, b.name, b.desc]);
    await audit(req, 'Systemrollen', 'Angelegt', b.name);
    return { id };
  });
  app.put('/api/admin/roles/:id/perms', async (req) => {
    req.needSys('role:manage');
    const b = z.object({ perms: z.array(z.enum(SYS_PERMS.map((p) => p[0]))) }).parse(req.body || {});
    const r = await one('SELECT * FROM system_roles WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (r.fixed) fail(409, 'Feste Rollen lassen sich nicht ändern.');
    await tx(async (c) => {
      await c.query('DELETE FROM system_role_perms WHERE role_id = $1', [r.id]);
      for (const p of b.perms) await c.query('INSERT INTO system_role_perms VALUES ($1, $2)', [r.id, p]);
    });
    await audit(req, 'Systemrollen', 'Rechte geändert', `${r.name}: ${b.perms.join(', ')}`);
    return { ok: true };
  });
  app.delete('/api/admin/roles/:id', async (req) => {
    req.needSys('role:manage');
    const r = await one('SELECT * FROM system_roles WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (r.fixed) fail(409, 'Feste Rollen lassen sich nicht löschen.');
    await q('DELETE FROM system_roles WHERE id = $1', [r.id]);
    await audit(req, 'Systemrollen', 'Gelöscht', r.name);
    return { ok: true };
  });

  // ---------- Sicherheit & Einstellungen ----------
  app.put('/api/admin/security', async (req) => {
    req.needSys('server:settings');
    const b = z.object({
      minPassword: z.coerce.number().int().min(8).max(64), maxFailed: z.coerce.number().int().min(3).max(20), lockMinutes: z.coerce.number().int().min(1).max(1440),
      sessionDays: z.coerce.number().int().min(1).max(90), require2fa: z.enum(['off', 'admins', 'all']), allowlist: z.string().max(1000), registration: z.boolean(),
      maintenance: z.boolean(), maintenanceText: z.string().max(200), auditDays: z.coerce.number().int().min(0).max(3650).default(0),
    }).parse(req.body || {});
    const list = b.allowlist.split(/\s+/).filter(Boolean);
    if (list.length && !list.some((e) => ipMatch(req.ip, e))) fail(400, `Deine eigene IP (${req.ip}) muss in der Allowlist stehen, sonst sperrst du dich aus.`);
    await setSetting('security', b);
    await audit(req, 'Server', 'Einstellungen geändert', `2FA ${b.require2fa}, Wartung ${b.maintenance ? 'an' : 'aus'}, Registrierung ${b.registration ? 'an' : 'aus'}`);
    return { ok: true };
  });

  // ---------- Jobs & Backups ----------
  app.get('/api/admin/jobs', async (req) => {
    req.needSys('server:read');
    return Object.entries(JOBS).map(([k, j]) => ({ key: k, label: j.label, every: j.every }));
  });
  app.post('/api/admin/jobs/:key/run', async (req) => {
    req.needSys(req.params.key === 'backup.daily' ? 'backup:manage' : 'server:settings');
    if (!JOBS[req.params.key]) fail(404, 'Unbekannter Job');
    const r = await runJob(req.params.key);
    await audit(req, 'Server', 'Job ausgeführt', `${req.params.key}: ${r.message || ''}`);
    return r;
  });
  app.post('/api/admin/backups', async (req) => {
    req.needSys('backup:manage');
    const f = await backupNow();
    await audit(req, 'Server', 'Backup erstellt', f);
    return { file: f };
  });
  const safeFile = (f) => (/^boxenstopp-[\d-]+\.dump$/.test(f) ? f : fail(400, 'Ungültiger Dateiname'));
  app.get('/api/admin/backups/:file', async (req, reply) => {
    req.needSys('backup:manage');
    const f = safeFile(req.params.file);
    await fsp.access(config.backupDir + '/' + f).catch(() => fail(404, 'Nicht gefunden'));
    await audit(req, 'Server', 'Backup heruntergeladen', f);
    reply.header('Content-Type', 'application/octet-stream').header('Content-Disposition', `attachment; filename="${f}"`);
    return reply.send(fs.createReadStream(config.backupDir + '/' + f));
  });
  app.delete('/api/admin/backups/:file', async (req) => {
    req.needSys('backup:manage');
    const f = safeFile(req.params.file);
    await fsp.unlink(config.backupDir + '/' + f).catch(() => fail(404, 'Nicht gefunden'));
    await audit(req, 'Server', 'Backup gelöscht', f);
    return { ok: true };
  });

  // ---------- Integrationen ----------
  const hookBody = z.object({ name: z.string().trim().min(2).max(60), url: z.string().trim().url().refine((u) => u.startsWith('https://'), 'muss mit https:// beginnen').optional(), events: z.array(z.enum(WEBHOOK_EVENTS)).max(20), active: z.boolean().default(true) });
  app.post('/api/admin/webhooks', async (req) => {
    req.needSys('integration:manage');
    const b = hookBody.parse(req.body || {});
    if (!b.url) fail(400, 'URL fehlt.');
    await q('INSERT INTO webhooks (name, url, events, active) VALUES ($1, $2, $3, $4)', [b.name, encrypt(b.url), b.events, b.active]);
    await audit(req, 'Integrationen', 'Webhook angelegt', b.name);
    return { ok: true };
  });
  app.patch('/api/admin/webhooks/:id', async (req) => {
    req.needSys('integration:manage');
    const b = hookBody.partial().parse(req.body || {});
    await q('UPDATE webhooks SET name = coalesce($2, name), url = coalesce($3, url), events = coalesce($4, events), active = coalesce($5, active) WHERE id = $1', [req.params.id, b.name ?? null, b.url ? encrypt(b.url) : null, b.events ?? null, b.active ?? null]);
    await audit(req, 'Integrationen', 'Webhook geändert', b.name || req.params.id);
    return { ok: true };
  });
  app.delete('/api/admin/webhooks/:id', async (req) => {
    req.needSys('integration:manage');
    await q('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    await audit(req, 'Integrationen', 'Webhook gelöscht', req.params.id);
    return { ok: true };
  });
  app.post('/api/admin/webhooks/:id/test', async (req) => {
    req.needSys('integration:manage');
    const h = await one('SELECT * FROM webhooks WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    let status;
    try { status = String(await sendWebhook(decrypt(h.url), '✅ Testnachricht von Boxenstopp')); } catch (e) { status = 'Fehler: ' + e.message; }
    await q('UPDATE webhooks SET last_status = $2, last_at = now() WHERE id = $1', [h.id, status]);
    return { status };
  });

  // ---------- Audit ----------
  app.get('/api/admin/audit.csv', async (req, reply) => {
    req.needSys('audit:read');
    const rows = await q(`SELECT local_ts(a.at) AS at, u.name AS user, a.area, a.action, a.detail, a.ip FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.at DESC LIMIT 20000`);
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="audit-log.csv"');
    return csv(rows, [['at', 'Zeit'], ['user', 'Benutzer'], ['area', 'Bereich'], ['action', 'Aktion'], ['detail', 'Details'], ['ip', 'IP']]);
  });

  // ---------- Exporte für Mitarbeiter (Werkstatt) ----------
  app.get('/api/export/:what.csv', async (req, reply) => {
    const w = req.params.what;
    let rows, cols;
    if (w === 'kunden') { req.need('customers', 2); rows = await q(`SELECT c.name, c.kind, c.phone, p.name AS pg, array_to_string(c.tags, ', ') AS tags, c.warning, c.blocked FROM customers c LEFT JOIN price_groups p ON p.id = c.price_group_id ORDER BY c.name`); cols = [['name', 'Name'], ['kind', 'Art'], ['phone', 'Telefon'], ['pg', 'Preisgruppe'], ['tags', 'Tags'], ['warning', 'Hinweis'], ['blocked', 'Gesperrt']]; }
    else if (w === 'preisliste') { req.need('catalog', 2); rows = await q(`SELECT k.name AS cat, i.name, i.kind, i.price, i.material, i.warranty, i.active FROM catalog_items i JOIN catalog_categories k ON k.id = i.category_id ORDER BY k.position, i.position, i.name`); cols = [['cat', 'Kategorie'], ['name', 'Leistung'], ['kind', 'Preisart'], ['price', 'Preis'], ['material', 'Material'], ['warranty', 'Garantie (Tage)'], ['active', 'Aktiv']]; }
    else if (w === 'buchungen') { req.need('accounts', 2); rows = await q(`SELECT t.booked_at::text AS d, a.name AS acc, t.type, t.amount, t.title, t.category, t.source, t.taxable FROM transactions t JOIN accounts a ON a.id = t.account_id ORDER BY t.booked_at DESC`); cols = [['d', 'Datum'], ['acc', 'Konto'], ['type', 'Art'], ['amount', 'Betrag'], ['title', 'Titel'], ['category', 'Kategorie'], ['source', 'Quelle'], ['taxable', 'Steuerpflichtig']]; }
    else return fail(404, 'Unbekannt');
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${w}.csv"`);
    return csv(rows, cols);
  });
}
