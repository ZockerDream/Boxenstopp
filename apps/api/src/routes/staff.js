// Mitarbeiter, Ränge, Rechte, Stempeluhr, Schulungen, Einstellungen, Tickets, öffentliche Preisliste
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { fail, audit, randomToken, sha256, getSetting, setSetting, addDays, today, fireWebhooks, hm } from '../lib.js';
import { MODULES, FLAGS, assertWithin } from '../authz.js';
import { setRankPerms, TEMPLATES } from '../defaults.js';

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pay = z.object({ hourly: z.coerce.number().min(0).max(1e6), commission: z.coerce.number().min(0).max(100), fixed: z.coerce.number().min(0).max(1e7) });

async function myRankPos(req) {
  if (req.user.is_owner) return Infinity;
  const r = req.user.rank_id ? await one('SELECT position FROM ranks WHERE id = $1', [req.user.rank_id]) : null;
  return r ? r.position : 0;
}
async function rankPos(id) { const r = id ? await one('SELECT position FROM ranks WHERE id = $1', [id]) : null; return r ? r.position : 0; }

export default async function staffRoutes(app) {
  // ---------- Mitarbeiter (fachlich) ----------
  app.patch('/api/staff/:id', async (req) => {
    req.need('staff', 3);
    const b = z.object({ rank: uuid.optional(), groups: z.array(uuid).max(20).optional(), staffNo: z.string().max(20).optional(), dutyNo: z.string().max(20).optional(), phone: z.string().max(40).optional(), status: z.enum(['active', 'leave', 'left']).optional(), payModel: pay.nullable().optional(), joined: day.optional(), reason: z.string().max(200).optional() }).strict().parse(req.body || {});
    const u = await one('SELECT * FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    const mine = await myRankPos(req);
    if (!req.user.is_owner) {
      if (u.id === req.user.id) fail(403, 'Dich selbst ändert jemand über dir.');
      if (u.is_owner || (await rankPos(u.rank_id)) >= mine) fail(403, 'Du verwaltest nur Mitarbeiter unter deinem Rang.');
      if (b.rank && (await rankPos(b.rank)) >= mine) fail(403, 'Du kannst niemanden auf deinen Rang oder höher setzen.');
    }
    if (b.payModel !== undefined && !req.flag('personal.lohn_sehen')) fail(403, 'Lohnmodelle ändern braucht „Löhne anderer sehen“.');
    if (b.status === 'left' && u.is_owner) fail(409, 'Inhaber können nicht ausscheiden.');
    return tx(async (c) => {
      if (b.rank && b.rank !== u.rank_id) {
        const from = u.rank_id ? (await c.one('SELECT name, position FROM ranks WHERE id = $1', [u.rank_id])) : null;
        const to = await c.one('SELECT name, position FROM ranks WHERE id = $1', [b.rank]);
        await c.query('INSERT INTO rank_history (user_id, from_rank, to_rank, by_user, reason) VALUES ($1,$2,$3,$4,$5)', [u.id, from && from.name, to.name, req.user.id, b.reason || null]);
        await c.query(`INSERT INTO staff_entries (user_id, kind, author_id, text, self_visible) VALUES ($1, $2, $3, $4, true)`, [u.id, !from || to.position > from.position ? 'Beförderung' : 'Degradierung', req.user.id, `${from ? from.name : '–'} → ${to.name}${b.reason ? ' · ' + b.reason : ''}`]);
      }
      if (b.status === 'left' && u.status !== 'left') {
        await c.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [u.id]);
        await c.query(`UPDATE shifts SET ended_at = greatest(started_at + interval '1 minute', now()) WHERE user_id = $1 AND ended_at IS NULL`, [u.id]);
      }
      await c.query(`UPDATE users SET rank_id = coalesce($2, rank_id), staff_no = coalesce($3, staff_no), duty_no = coalesce($4, duty_no), phone = coalesce($5, phone),
                     status = coalesce($6, status), left_on = CASE WHEN $6 = 'left' THEN current_date WHEN $6 IS NOT NULL THEN NULL ELSE left_on END,
                     pay_model = CASE WHEN $7::boolean THEN $8::jsonb ELSE pay_model END, joined_on = coalesce($9, joined_on) WHERE id = $1`,
      [u.id, b.rank ?? null, b.staffNo ?? null, b.dutyNo ?? null, b.phone ?? null, b.status ?? null, b.payModel !== undefined, b.payModel ? JSON.stringify(b.payModel) : null, b.joined ?? null]);
      if (b.groups) {
        await c.query('DELETE FROM group_members WHERE user_id = $1', [u.id]);
        for (const g of b.groups) await c.query('INSERT INTO group_members VALUES ($1, $2)', [g, u.id]);
      }
      await audit(req, 'Mitarbeiter', 'Geändert', `${u.name}${b.rank && b.rank !== u.rank_id ? ' · Rang geändert' : ''}${b.status ? ' · ' + b.status : ''}`, c);
      return { ok: true };
    });
  });

  app.post('/api/staff/invite', async (req) => {
    if (!(req.level('staff') >= 3 || req.sys('user:create'))) fail(403, 'Einladen braucht „Mitarbeiter: Lesen & Schreiben“.');
    const b = z.object({ email: z.string().trim().email(), name: z.string().trim().max(80).default(''), rank: uuid, role: z.string().max(60).default('user'), group: uuid.nullable().optional(), days: z.coerce.number().int().min(1).max(30).default(7) }).parse(req.body || {});
    if (b.role !== 'user') req.needSys('user:create');
    if (!req.user.is_owner && (await rankPos(b.rank)) >= (await myRankPos(req))) fail(403, 'Du lädst nur unter deinem Rang ein.');
    const ex = await one('SELECT 1 FROM users WHERE email = $1', [b.email]);
    if (ex) fail(409, 'Für diese E-Mail gibt es schon ein Konto.');
    const token = randomToken();
    await q('INSERT INTO invitations (email, name, rank_id, role_id, group_id, token_hash, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || \' days\')::interval, $8)', [b.email, b.name, b.rank, b.role, b.group || null, sha256(token), String(b.days), req.user.id]);
    await audit(req, 'Benutzer', 'Eingeladen', b.email);
    return { link: `/#/einladung/${token}` };
  });
  app.delete('/api/invitations/:id', async (req) => {
    if (!(req.level('staff') >= 3 || req.sys('user:create'))) fail(403, 'Dafür fehlt dir das Recht.');
    await q('DELETE FROM invitations WHERE id = $1 AND used_at IS NULL', [req.params.id]);
    await audit(req, 'Benutzer', 'Einladung widerrufen', req.params.id);
    return { ok: true };
  });

  // ---------- Ränge ----------
  app.post('/api/ranks', async (req) => {
    req.need('ranks', 4);
    const b = z.object({ name: z.string().trim().min(2).max(40), below: uuid, template: z.enum(Object.keys(TEMPLATES)).default('keine Rechte'), pay: pay.default({ hourly: 0, commission: 0, fixed: 0 }), req: z.array(uuid).max(10).default([]) }).parse(req.body || {});
    const below = await one('SELECT position FROM ranks WHERE id = $1', [b.below]) || fail(404, 'Rang nicht gefunden');
    // Der neue Rang kommt direkt unter „below“; Nicht-Inhaber dürfen nur unter dem eigenen Rang anlegen
    if (!req.user.is_owner && below.position >= (await myRankPos(req))) fail(403, 'Neue Ränge nur unter deinem eigenen.');
    return tx(async (c) => {
      await c.query('UPDATE ranks SET position = position + 1 WHERE position >= $1', [below.position]);
      const r = await c.one('INSERT INTO ranks (name, position, pay) VALUES ($1, $2, $3) RETURNING id', [b.name, below.position, b.pay]);
      if (!req.user.is_owner) for (const [m, l] of Object.entries(TEMPLATES[b.template].split('').map(Number).reduce((o, v, i) => ({ ...o, [MODULES[i]]: v }), {}))) assertWithin(req, m, l);
      await setRankPerms(c, r.id, b.template);
      for (const t of b.req) await c.query('INSERT INTO rank_requirements VALUES ($1, $2)', [r.id, t]);
      await audit(req, 'Ränge', 'Angelegt', `${b.name} (Vorlage ${b.template})`, c);
      return { id: r.id };
    });
  });
  app.patch('/api/ranks/:id', async (req) => {
    req.need('ranks', 4);
    const b = z.object({ name: z.string().trim().min(2).max(40).optional(), pay: pay.optional(), req: z.array(uuid).max(10).optional() }).strict().parse(req.body || {});
    if (!req.user.is_owner && (await rankPos(req.params.id)) >= (await myRankPos(req))) fail(403, 'Nur Ränge unter deinem eigenen.');
    return tx(async (c) => {
      await c.query('UPDATE ranks SET name = coalesce($2, name), pay = coalesce($3, pay) WHERE id = $1', [req.params.id, b.name ?? null, b.pay ? JSON.stringify(b.pay) : null]);
      if (b.req) { await c.query('DELETE FROM rank_requirements WHERE rank_id = $1', [req.params.id]); for (const t of b.req) await c.query('INSERT INTO rank_requirements VALUES ($1, $2)', [req.params.id, t]); }
      await audit(req, 'Ränge', 'Geändert', b.name || req.params.id, c);
      return { ok: true };
    });
  });
  app.post('/api/ranks/:id/move', async (req) => {
    req.need('ranks', 4);
    const b = z.object({ dir: z.enum(['up', 'down']) }).parse(req.body || {});
    return tx(async (c) => {
      const r = await c.one('SELECT * FROM ranks WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
      const other = await c.one(`SELECT * FROM ranks WHERE position ${b.dir === 'up' ? '>' : '<'} $1 ORDER BY position ${b.dir === 'up' ? 'ASC' : 'DESC'} LIMIT 1`, [r.position]) || fail(409, 'Geht nicht weiter.');
      const mine = await myRankPos(req);
      if (!req.user.is_owner && (r.position >= mine || other.position >= mine)) fail(403, 'Nur Ränge unter deinem eigenen.');
      await c.query('UPDATE ranks SET position = $2 WHERE id = $1', [r.id, other.position]);
      await c.query('UPDATE ranks SET position = $2 WHERE id = $1', [other.id, r.position]);
      await audit(req, 'Ränge', 'Verschoben', `${r.name} ${b.dir === 'up' ? 'nach oben' : 'nach unten'}`, c);
      return { ok: true };
    });
  });
  app.delete('/api/ranks/:id', async (req) => {
    req.need('ranks', 4);
    const n = await one('SELECT count(*)::int AS n FROM users WHERE rank_id = $1', [req.params.id]);
    if (n.n) fail(409, 'Ein Rang mit Mitgliedern lässt sich nicht löschen.');
    if (!req.user.is_owner && (await rankPos(req.params.id)) >= (await myRankPos(req))) fail(403, 'Nur Ränge unter deinem eigenen.');
    await tx(async (c) => {
      await c.query(`DELETE FROM permissions WHERE target_type = 'rank' AND target_id = $1`, [req.params.id]);
      await c.query(`DELETE FROM permission_flags WHERE target_type = 'rank' AND target_id = $1`, [req.params.id]);
      await c.query('DELETE FROM ranks WHERE id = $1', [req.params.id]);
    });
    await audit(req, 'Ränge', 'Gelöscht', req.params.id);
    return { ok: true };
  });
  app.delete('/api/groups/:id/perms', async (req) => {
    req.need('ranks', 4);
    await q(`DELETE FROM permissions WHERE target_type = 'group' AND target_id = $1`, [req.params.id]);
    await q(`DELETE FROM permission_flags WHERE target_type = 'group' AND target_id = $1`, [req.params.id]);
    return { ok: true };
  });

  // ---------- Rechte ----------
  app.put('/api/permissions', async (req) => {
    req.need('perms', 3);
    const b = z.object({ type: z.enum(['rank', 'group', 'user']), id: uuid, module: z.enum(MODULES), level: z.number().int().min(0).max(4).nullable() }).parse(req.body || {});
    if (!req.user.is_owner) {
      if ((b.type === 'user' && b.id === req.user.id) || (b.type === 'rank' && b.id === req.user.rank_id) || (b.type === 'group' && (req.A.groupsOf[req.user.id] || []).includes(b.id))) fail(403, 'Deine eigenen Rechte ändert jemand anderes.');
      if (b.type === 'rank' && (await rankPos(b.id)) >= (await myRankPos(req))) fail(403, 'Nur Ränge unter deinem eigenen.');
      if (b.level !== null) assertWithin(req, b.module, b.level);
    }
    if (b.level === null) {
      if (b.type === 'rank') fail(400, 'Ränge haben immer eine Stufe.');
      await q('DELETE FROM permissions WHERE target_type = $1 AND target_id = $2 AND module = $3', [b.type, b.id, b.module]);
    } else {
      await q(`INSERT INTO permissions VALUES ($1, $2, $3, $4) ON CONFLICT (target_type, target_id, module) DO UPDATE SET level = EXCLUDED.level`, [b.type, b.id, b.module, b.level]);
    }
    await audit(req, 'Berechtigungen', 'Recht geändert', `${b.type} ${b.id.slice(0, 8)} · ${b.module} → ${b.level === null ? 'nicht gesetzt' : b.level}`);
    return { ok: true };
  });
  app.put('/api/flags', async (req) => {
    req.need('perms', 4);
    const b = z.object({ type: z.enum(['rank', 'group', 'user']), id: uuid, flag: z.enum(Object.keys(FLAGS)), value: z.number().min(0).max(100).nullable() }).parse(req.body || {});
    if (!req.user.is_owner && b.value !== null && b.value > Number(req.flag(b.flag))) fail(403, 'Du kannst nicht mehr vergeben, als du selbst hast.');
    if (b.value === null) await q('DELETE FROM permission_flags WHERE target_type = $1 AND target_id = $2 AND flag = $3', [b.type, b.id, b.flag]);
    else await q(`INSERT INTO permission_flags VALUES ($1, $2, $3, $4) ON CONFLICT (target_type, target_id, flag) DO UPDATE SET value = EXCLUDED.value`, [b.type, b.id, b.flag, b.value]);
    await audit(req, 'Berechtigungen', 'Einzelrecht geändert', `${b.flag} → ${b.value}`);
    return { ok: true };
  });

  // ---------- Stempeluhr ----------
  app.post('/api/shifts/clock', async (req) => {
    if (!req.user.rank_id) fail(403, 'Ohne Rang gibt es keinen Dienst.');
    return tx(async (c) => {
      const open = await c.one('SELECT * FROM shifts WHERE user_id = $1 AND ended_at IS NULL FOR UPDATE', [req.user.id]);
      if (open) {
        if (Date.now() - new Date(open.started_at).getTime() > 24 * 3600 * 1000) {
          await c.query('DELETE FROM shifts WHERE id = $1', [open.id]);
          fail(409, 'Die Schicht lief über 24 Stunden und wurde verworfen. Bitte als Nachtrag eintragen lassen.');
        }
        await c.query('UPDATE shifts SET ended_at = greatest(now(), started_at + interval \'1 minute\') WHERE id = $1', [open.id]);
        fireWebhooks('Dienstbeginn/-ende', `${req.user.name} beendet den Dienst`);
        return { onDuty: false };
      }
      const s = await c.one('INSERT INTO shifts (user_id, started_at) VALUES ($1, now()) RETURNING started_at', [req.user.id]);
      fireWebhooks('Dienstbeginn/-ende', `${req.user.name} beginnt den Dienst`);
      return { onDuty: true, since: hm(s.started_at) };
    });
  });
  app.post('/api/shifts', async (req) => {
    req.need('shifts', 3);
    const b = z.object({ user: uuid, from: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/), reason: z.string().trim().min(3, 'Grund angeben').max(200) }).parse(req.body || {});
    const tz = (await import('../config.js')).config.tz;
    const r = await one(`INSERT INTO shifts (user_id, started_at, ended_at, source, reason, edited_by) VALUES ($1, ($2::timestamp AT TIME ZONE $5), ($3::timestamp AT TIME ZONE $5), 'manual', $4, $6) RETURNING id, ended_at - started_at AS d`, [b.user, b.from.replace('T', ' '), b.to.replace('T', ' '), b.reason, tz, req.user.id]);
    await audit(req, 'Dienstplan', 'Nachtrag', `${b.from} – ${b.to} · ${b.reason}`);
    return { id: r.id };
  });
  app.delete('/api/shifts/:id', async (req) => {
    req.need('shifts', 4);
    await q('DELETE FROM shifts WHERE id = $1', [req.params.id]);
    await audit(req, 'Dienstplan', 'Schicht gelöscht', req.params.id);
    return { ok: true };
  });

  // ---------- Schulungen ----------
  app.post('/api/sessions/:id/register', async (req) => {
    req.need('trainings', 1);
    const b = z.object({ on: z.boolean() }).parse(req.body || {});
    const s = await one('SELECT * FROM training_sessions WHERE id = $1', [req.params.id]) || fail(404, 'Termin nicht gefunden');
    if (s.done || s.day < today()) fail(409, 'Der Termin ist vorbei.');
    if (b.on) await q(`INSERT INTO training_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [s.id, req.user.id]);
    else await q(`DELETE FROM training_participants WHERE session_id = $1 AND user_id = $2 AND result = 'registered'`, [s.id, req.user.id]);
    return { ok: true };
  });
  app.post('/api/sessions/:id/participants', async (req) => {
    req.need('trainings', 3);
    const b = z.object({ users: z.array(uuid).max(50) }).parse(req.body || {});
    for (const u of b.users) await q('INSERT INTO training_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, u]);
    return { ok: true };
  });
  app.post('/api/sessions/:id/results', async (req) => {
    req.need('trainings', 3);
    const b = z.object({ results: z.record(z.string().uuid(), z.enum(['registered', 'passed', 'failed', 'no_show'])) }).parse(req.body || {});
    return tx(async (c) => {
      const s = await c.one('SELECT s.*, t.months, t.name FROM training_sessions s JOIN trainings t ON t.id = s.training_id WHERE s.id = $1', [req.params.id]) || fail(404, 'Termin nicht gefunden');
      for (const [u, r] of Object.entries(b.results)) {
        await c.query(`INSERT INTO training_participants (session_id, user_id, result) VALUES ($1, $2, $3) ON CONFLICT (session_id, user_id) DO UPDATE SET result = EXCLUDED.result`, [s.id, u, r]);
        await c.query(`DELETE FROM certificates WHERE user_id = $1 AND training_id = $2 AND source = $3`, [u, s.training_id, 'session:' + s.id]);
        if (r === 'passed') {
          await c.query('INSERT INTO certificates (user_id, training_id, valid_from, valid_until, source) VALUES ($1, $2, $3, $4, $5)', [u, s.training_id, s.day, s.months ? addMonths(s.day, s.months) : null, 'session:' + s.id]);
        }
      }
      await c.query('UPDATE training_sessions SET done = true WHERE id = $1', [s.id]);
      await audit(req, 'Schulungen', 'Ergebnisse', `${s.name} · ${s.day}`, c);
      return { ok: true };
    });
  });
  app.post('/api/certificates', async (req) => {
    req.need('trainings', 3);
    const b = z.object({ user: uuid, training: uuid, from: day.optional() }).parse(req.body || {});
    const t = await one('SELECT * FROM trainings WHERE id = $1', [b.training]) || fail(404, 'Schulung nicht gefunden');
    const from = b.from || today();
    await q('INSERT INTO certificates (user_id, training_id, valid_from, valid_until, source) VALUES ($1, $2, $3, $4, $5)', [b.user, b.training, from, t.months ? addMonths(from, t.months) : null, 'manual']);
    await audit(req, 'Schulungen', 'Nachweis eingetragen', t.name);
    return { ok: true };
  });
  app.delete('/api/certificates', async (req) => {
    req.need('trainings', 4);
    const b = z.object({ user: uuid, training: uuid }).parse(req.query || {});
    await q('DELETE FROM certificates WHERE user_id = $1 AND training_id = $2', [b.user, b.training]);
    await audit(req, 'Schulungen', 'Nachweis entfernt', b.training);
    return { ok: true };
  });
  app.post('/api/licenses/:id/extend', async (req) => {
    req.need('licenses', 3);
    const l = await one('SELECT l.*, t.months FROM licenses l JOIN license_types t ON t.id = l.type_id WHERE l.id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (!l.months) fail(409, 'Diese Lizenzart hat keine Standard-Gültigkeit.');
    const base = l.expires && l.expires > today() ? l.expires : today();
    await q('UPDATE licenses SET expires = $2 WHERE id = $1', [l.id, addMonths(base, l.months)]);
    await audit(req, 'Lizenzen', 'Verlängert', l.no);
    return { ok: true };
  });

  app.post('/api/board/:id/read', async (req) => {
    req.need('board', 1);
    await q('INSERT INTO board_reads (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, req.user.id]);
    return { ok: true };
  });
  app.post('/api/board/:id/announce', async (req) => {
    req.need('board', 3);
    const p = await one('SELECT title FROM board_posts WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    const users = await q(`SELECT id FROM users WHERE status = 'active' AND id <> $1`, [req.user.id]);
    const { notify } = await import('../lib.js');
    await notify(users.map((u) => u.id), 'board', `Neue Ankündigung: ${p.title}`, '#/brett', 'info', 'board:' + req.params.id);
    fireWebhooks('Ankündigung', p.title);
    return { ok: true };
  });

  // ---------- Einstellungen ----------
  app.put('/api/settings/firm', async (req) => {
    req.need('settings', 3);
    const b = z.object({ name: z.string().trim().min(2).max(80), short: z.string().trim().min(2).max(6).regex(/^[A-Za-z0-9]+$/), address: z.string().max(160).default(''), phone: z.string().max(40).default(''), hours: z.string().max(80).default(''), invoiceFooter: z.string().max(400).default(''), termsDays: z.coerce.number().int().min(0).max(60).default(3) }).parse(req.body || {});
    await setSetting('firm', { ...b, short: b.short.toUpperCase() });
    await audit(req, 'Firmen-Einstellungen', 'Stammdaten', b.name);
    return { ok: true };
  });
  app.put('/api/settings/logo', async (req) => {
    req.need('settings', 3);
    const b = z.object({ kind: z.enum(['preset', 'image']), preset: z.string().max(20).default('wrench'), data: z.string().max(720000).nullable().default(null) }).parse(req.body || {});
    if (b.kind === 'image' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.data || '')) fail(400, 'Logo muss PNG, JPEG oder WebP sein (SVG ist aus Sicherheitsgründen nicht erlaubt).');
    await setSetting('logo', b.kind === 'preset' ? { kind: 'preset', preset: b.preset, data: null } : b);
    await audit(req, 'Firmen-Einstellungen', 'Logo geändert', b.kind);
    return { ok: true };
  });
  app.put('/api/settings/features', async (req) => {
    req.need('settings', 4);
    const b = z.object({ stock: z.boolean(), callouts: z.boolean(), appointments: z.boolean(), taxReserve: z.boolean(), publicPricelist: z.boolean(), fourEyes: z.boolean(), qualHard: z.boolean() }).parse(req.body || {});
    await setSetting('features', b);
    await audit(req, 'Firmen-Einstellungen', 'Funktionen', JSON.stringify(b));
    return { ok: true };
  });
  app.put('/api/settings/tax', async (req) => {
    req.need('tax', 4);
    const b = z.object({ period: z.enum(['week', 'month']), reserveAccount: uuid.nullable(), payrollAccount: uuid.nullable() }).parse(req.body || {});
    const filed = await one('SELECT count(*)::int AS n FROM tax_periods');
    const cur = await getSetting('tax');
    if (filed.n && cur.period !== b.period) fail(409, 'Der Steuerzeitraum lässt sich nach der ersten Abführung nicht mehr wechseln.');
    await setSetting('tax', b);
    await audit(req, 'Steuern', 'Einstellungen', b.period);
    return { ok: true };
  });

  // ---------- Tickets ----------
  app.post('/api/tickets', async (req) => {
    const b = z.object({ title: z.string().trim().min(3).max(120), body: z.string().max(5000).default(''), page: z.string().max(40).default('') }).parse(req.body || {});
    const t = await one('INSERT INTO tickets (title, body, page, by_user) VALUES ($1, $2, $3, $4) RETURNING id, no', [b.title, b.body, b.page, req.user.id]);
    const managers = await q(`SELECT DISTINCT ur.user_id FROM user_system_roles ur LEFT JOIN system_role_perms p ON p.role_id = ur.role_id WHERE ur.role_id = 'admin' OR p.perm = 'ticket:manage'`);
    const { notify } = await import('../lib.js');
    await notify(managers.map((m) => m.user_id), 'ticket', `Neues Ticket T-${t.no}: ${b.title}`, '#/tickets', 'info');
    return { id: t.id, no: t.no };
  });
  app.patch('/api/tickets/:id', async (req) => {
    req.needSys('ticket:manage');
    const b = z.object({ status: z.enum(['open', 'in_progress', 'done', 'rejected']) }).parse(req.body || {});
    await q('UPDATE tickets SET status = $2 WHERE id = $1', [req.params.id, b.status]);
    return { ok: true };
  });
  app.delete('/api/tickets/:id', async (req) => {
    const t = await one('SELECT by_user FROM tickets WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (t.by_user !== req.user.id) req.needSys('ticket:manage');
    await q('DELETE FROM tickets WHERE id = $1', [req.params.id]);
    return { ok: true };
  });
  app.get('/api/tickets/:id/comments', async (req) => {
    const t = await one('SELECT by_user FROM tickets WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (t.by_user !== req.user.id) req.needSys('ticket:manage');
    return q('SELECT c.id, c.body, c.author_id AS author, local_ts(c.at) AS at FROM ticket_comments c WHERE ticket_id = $1 ORDER BY at', [req.params.id]);
  });
  app.post('/api/tickets/:id/comments', async (req) => {
    const t = await one('SELECT by_user, no FROM tickets WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (t.by_user !== req.user.id) req.needSys('ticket:manage');
    const b = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body || {});
    await q('INSERT INTO ticket_comments (ticket_id, author_id, body) VALUES ($1, $2, $3)', [req.params.id, req.user.id, b.body]);
    if (t.by_user && t.by_user !== req.user.id) { const { notify } = await import('../lib.js'); await notify([t.by_user], 'ticket', `Antwort auf dein Ticket T-${t.no}`, '#/fehler', 'info'); }
    return { ok: true };
  });

  // ---------- Öffentliche Preisliste ----------
  app.get('/api/public/pricelist', async () => {
    const f = await getSetting('features');
    if (!f.publicPricelist) fail(404, 'Die öffentliche Preisliste ist ausgeschaltet.');
    const firm = await getSetting('firm');
    return {
      firm: { name: firm.name, address: firm.address, phone: firm.phone, hours: firm.hours }, logo: await getSetting('logo'),
      classes: await q('SELECT id, name FROM vehicle_classes ORDER BY position'),
      categories: await q('SELECT id, name FROM catalog_categories ORDER BY position'),
      items: (await q('SELECT id, category_id AS cat, name, kind, price::float, surcharge, class_prices AS "classPrices", warranty FROM catalog_items WHERE active ORDER BY position, name')),
    };
  });
}

export function addMonths(iso, m) {
  const d = new Date(iso + 'T12:00:00Z');
  const dd = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + Number(m));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dd, last));
  return d.toISOString().slice(0, 10);
}
