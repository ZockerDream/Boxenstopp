// Anmeldung, Ersteinrichtung, Einladungen, Registrierung, eigenes Konto
import { z } from 'zod';
import QRCode from 'qrcode';
import { q, one, tx } from '../db.js';
import { fail, hashPassword, verifyPassword, randomToken, sha256, getSetting, audit, encrypt, decrypt, newTotpSecret, totpVerify, notify } from '../lib.js';
import { installDefaults } from '../defaults.js';
import { config } from '../config.js';

// einfaches Rate-Limit für Routen mit Passwort- oder Codeprüfung
const hits = new Map();
const LOGIN_LIMIT = Number(process.env.RATE_LIMIT_LOGIN || 10);
function rateLimit(req, key, max = 10, windowMs = 60000) {
  const k = key + ':' + req.ip;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  if (arr.length > max) fail(429, 'Zu viele Versuche. Bitte warte eine Minute.');
}

async function pwRule(pw) {
  const sec = await getSetting('security');
  if (!pw || pw.length < (sec.minPassword || 10)) fail(400, `Passwort braucht mindestens ${sec.minPassword || 10} Zeichen.`);
}

async function createSession(reply, req, userId, pending = false) {
  const sec = await getSetting('security');
  const token = randomToken();
  await q(`INSERT INTO sessions (user_id, token_hash, pending_2fa, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval)`,
    [userId, sha256(token), pending, req.ip, String(req.headers['user-agent'] || '').slice(0, 200), String(sec.sessionDays || 7)]);
  reply.setCookie('bx_session', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies, maxAge: (sec.sessionDays || 7) * 86400 });
}

export default async function authRoutes(app) {
  app.get('/api/auth/status', async (req) => {
    const users = await one('SELECT count(*)::int AS n FROM users');
    const sec = await getSetting('security');
    const firm = await getSetting('firm');
    const logo = await getSetting('logo');
    return { setup: users.n === 0, registration: !!sec.registration, maintenance: !!sec.maintenance, maintenanceText: sec.maintenanceText, firmName: firm.name, logo, loggedIn: !!req.user };
  });

  app.post('/api/setup', async (req, reply) => {
    rateLimit(req, 'setup', 5);
    if ((await one('SELECT count(*)::int AS n FROM users')).n > 0) fail(409, 'Die Einrichtung ist schon abgeschlossen.');
    const b = z.object({ firmName: z.string().trim().min(2).max(80), short: z.string().trim().min(2).max(6).regex(/^[A-Za-z0-9]+$/, 'nur Buchstaben und Ziffern'), name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string() }).parse(req.body || {});
    await pwRule(b.password);
    const hash = await hashPassword(b.password);
    const userId = await tx(async (c) => {
      await c.query('LOCK TABLE users IN EXCLUSIVE MODE');
      const n = await c.one('SELECT count(*)::int AS n FROM users');
      if (n.n > 0) fail(409, 'Die Einrichtung ist schon abgeschlossen.');
      const d = await installDefaults(c, { firmName: b.firmName, short: b.short.toUpperCase() });
      const u = await c.one(`INSERT INTO users (email, name, password_hash, is_owner, rank_id, staff_no, duty_no) VALUES ($1, $2, $3, true, $4, 'P-001', '01') RETURNING id`, [b.email, b.name, hash, d.ranks['Geschäftsführung']]);
      await c.query(`INSERT INTO user_system_roles (user_id, role_id) VALUES ($1, 'admin')`, [u.id]);
      await c.query(`INSERT INTO audit_log (user_id, area, action, detail, ip) VALUES ($1, 'Server', 'Ersteinrichtung', $2, $3)`, [u.id, b.firmName, req.ip]);
      return u.id;
    });
    await createSession(reply, req, userId);
    return { ok: true };
  });

  app.post('/api/auth/login', async (req, reply) => {
    rateLimit(req, 'login', LOGIN_LIMIT);
    const b = z.object({ email: z.string().trim().max(200), password: z.string().max(500), code: z.string().max(20).optional() }).parse(req.body || {});
    const sec = await getSetting('security');
    const u = await one('SELECT * FROM users WHERE email = $1', [b.email]);
    const bad = async () => {
      if (u) {
        const n = u.failed_logins + 1;
        await q(`UPDATE users SET failed_logins = $2::int, locked_until = CASE WHEN $2::int >= $3::int THEN now() + ($4::text || ' minutes')::interval ELSE locked_until END WHERE id = $1`, [u.id, n, sec.maxFailed || 5, String(sec.lockMinutes || 15)]);
      }
      fail(401, 'E-Mail oder Passwort falsch.');
    };
    if (!u || !u.password_hash) return bad();
    if (u.locked_until && new Date(u.locked_until) > new Date()) fail(423, 'Zu viele Fehlversuche – das Konto ist kurz gesperrt.');
    if (!(await verifyPassword(b.password, u.password_hash))) return bad();
    if (u.status === 'pending') fail(403, 'Dein Konto wartet noch auf Freigabe.');
    if (['left', 'locked'].includes(u.status)) fail(403, 'Dein Zugang ist gesperrt.');
    if (u.expires_on && u.expires_on < new Date().toISOString().slice(0, 10)) fail(403, 'Dein Zugang ist abgelaufen.');
    if (u.totp_enabled) {
      if (!b.code) return { need2fa: true };
      if (!totpVerify(decrypt(u.totp_secret), b.code)) return bad();
    }
    await q('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
    await createSession(reply, req, u.id);
    await audit({ user: u, ip: req.ip }, 'Benutzer', 'Anmeldung', u.email);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies.bx_session) await q('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha256(req.cookies.bx_session)]);
    reply.clearCookie('bx_session', { path: '/' });
    return { ok: true };
  });

  app.post('/api/auth/register', async (req) => {
    rateLimit(req, 'register', 5);
    const sec = await getSetting('security');
    if (!sec.registration) fail(403, 'Selbstregistrierung ist ausgeschaltet. Frag nach einer Einladung.');
    const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string() }).parse(req.body || {});
    await pwRule(b.password);
    await q(`INSERT INTO users (email, name, password_hash, status) VALUES ($1, $2, $3, 'pending')`, [b.email, b.name, await hashPassword(b.password)]).catch((e) => { if (e.code === '23505') fail(409, 'Diese E-Mail ist schon registriert.'); throw e; });
    const admins = await q(`SELECT user_id FROM user_system_roles WHERE role_id = 'admin'`);
    await notify(admins.map((a) => a.user_id), 'registration', `Registrierung wartet auf Freigabe: ${b.name}`, '#/users', 'accent');
    await audit({ user: null, ip: req.ip }, 'Benutzer', 'Registrierung', b.email);
    return { ok: true };
  });

  app.get('/api/auth/invite/:token', async (req) => {
    const i = await one(`SELECT i.email, i.name, r.name AS rank FROM invitations i LEFT JOIN ranks r ON r.id = i.rank_id WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`, [sha256(req.params.token)]);
    return i || fail(404, 'Einladung ungültig oder abgelaufen.');
  });
  app.post('/api/auth/invite/:token', async (req, reply) => {
    rateLimit(req, 'invite', 10);
    const b = z.object({ name: z.string().trim().min(2).max(80), password: z.string() }).parse(req.body || {});
    await pwRule(b.password);
    const hash = await hashPassword(b.password);
    const uid = await tx(async (c) => {
      const i = await c.one('SELECT * FROM invitations WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE', [sha256(req.params.token)]) || fail(404, 'Einladung ungültig oder abgelaufen.');
      const no = await c.one(`SELECT 'P-' || lpad((count(*) + 1)::text, 3, '0') AS n FROM users`);
      const u = await c.one(`INSERT INTO users (email, name, password_hash, rank_id, staff_no) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [i.email, b.name, hash, i.rank_id, no.n])
        .catch((e) => { if (e.code === '23505') fail(409, 'Für diese E-Mail gibt es schon ein Konto.'); throw e; });
      if (i.role_id && i.role_id !== 'user') await c.query('INSERT INTO user_system_roles VALUES ($1, $2)', [u.id, i.role_id]);
      if (i.group_id) await c.query('INSERT INTO group_members VALUES ($1, $2)', [i.group_id, u.id]);
      await c.query('UPDATE invitations SET used_at = now() WHERE id = $1', [i.id]);
      await c.query(`INSERT INTO audit_log (user_id, area, action, detail, ip) VALUES ($1, 'Benutzer', 'Einladung angenommen', $2, $3)`, [u.id, i.email, req.ip]);
      return u.id;
    });
    await createSession(reply, req, uid);
    return { ok: true };
  });

  app.post('/api/auth/reset/:token', async (req) => {
    rateLimit(req, 'reset', 10);
    const b = z.object({ password: z.string() }).parse(req.body || {});
    await pwRule(b.password);
    const hash = await hashPassword(b.password);
    await tx(async (c) => {
      const r = await c.one('SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE', [sha256(req.params.token)]) || fail(404, 'Link ungültig oder abgelaufen.');
      await c.query('UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1', [r.user_id, hash]);
      await c.query('UPDATE password_resets SET used_at = now() WHERE token_hash = $1', [r.token_hash]);
      await c.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [r.user_id]);
    });
    return { ok: true };
  });

  // ---------- eigenes Konto ----------
  app.patch('/api/me', async (req) => {
    const b = z.object({ name: z.string().trim().min(2).max(80).optional(), phone: z.string().trim().max(40).optional(), ui: z.record(z.string(), z.any()).optional() }).strict().parse(req.body || {});
    if (b.ui && JSON.stringify(b.ui).length > 5_500_000) fail(400, 'Hintergrundbild zu groß.');
    await q('UPDATE users SET name = coalesce($2, name), phone = coalesce($3, phone), ui = coalesce($4, ui) WHERE id = $1', [req.user.id, b.name ?? null, b.phone ?? null, b.ui ? JSON.stringify(b.ui) : null]);
    return { ok: true };
  });
  app.post('/api/me/password', async (req) => {
    rateLimit(req, 'pw', 10);
    const b = z.object({ current: z.string(), password: z.string() }).parse(req.body || {});
    if (!(await verifyPassword(b.current, req.user.password_hash))) fail(400, 'Aktuelles Passwort ist falsch.');
    await pwRule(b.password);
    await q('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, await hashPassword(b.password)]);
    await q('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL', [req.user.id, sha256(req.cookies.bx_session || '')]);
    await audit(req, 'Benutzer', 'Passwort geändert', req.user.email);
    return { ok: true };
  });
  app.post('/api/me/2fa/setup', async (req) => {
    if (req.user.totp_enabled) fail(409, '2FA ist schon aktiv.');
    const secret = newTotpSecret();
    await q('UPDATE users SET totp_secret = $2 WHERE id = $1', [req.user.id, encrypt(secret)]);
    const firm = await getSetting('firm');
    const uri = `otpauth://totp/${encodeURIComponent('Boxenstopp:' + req.user.email)}?secret=${secret}&issuer=${encodeURIComponent('Boxenstopp ' + (firm.name || ''))}`;
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  });
  app.post('/api/me/2fa/enable', async (req) => {
    rateLimit(req, '2fa', 10);
    const b = z.object({ code: z.string() }).parse(req.body || {});
    const u = await one('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
    if (!u.totp_secret || !totpVerify(decrypt(u.totp_secret), b.code)) fail(400, 'Code stimmt nicht. Uhrzeit am Handy prüfen.');
    await q('UPDATE users SET totp_enabled = true WHERE id = $1', [req.user.id]);
    await audit(req, 'Benutzer', '2FA eingeschaltet', req.user.email);
    return { ok: true };
  });
  app.post('/api/me/2fa/disable', async (req) => {
    rateLimit(req, '2fa', 10);
    const b = z.object({ password: z.string() }).parse(req.body || {});
    if (!(await verifyPassword(b.password, req.user.password_hash))) fail(400, 'Passwort ist falsch.');
    await q('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [req.user.id]);
    await audit(req, 'Benutzer', '2FA ausgeschaltet', req.user.email);
    return { ok: true };
  });
  app.post('/api/me/sessions/:id/revoke', async (req) => {
    await q('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    return { ok: true };
  });
  app.post('/api/me/sessions/revoke-others', async (req) => {
    await q('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL', [req.user.id, sha256(req.cookies.bx_session || '')]);
    return { ok: true };
  });
  app.post('/api/me/api-keys', async (req) => {
    const b = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body || {});
    const key = 'bxs_' + randomToken(24);
    await q('INSERT INTO api_keys (user_id, name, prefix, key_hash) VALUES ($1, $2, $3, $4)', [req.user.id, b.name, key.slice(0, 8), sha256(key)]);
    await audit(req, 'Integrationen', 'API-Schlüssel erstellt', b.name);
    return { key };
  });
  app.post('/api/me/api-keys/:id/revoke', async (req) => {
    const own = await one('SELECT user_id FROM api_keys WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
    if (own.user_id !== req.user.id) req.needSys('integration:manage');
    await q('UPDATE api_keys SET revoked_at = now() WHERE id = $1', [req.params.id]);
    await audit(req, 'Integrationen', 'API-Schlüssel widerrufen', req.params.id);
    return { ok: true };
  });
  app.post('/api/me/notifications/read', async (req) => {
    await q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    return { ok: true };
  });
}
