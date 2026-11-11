// Boxenstopp API + Auslieferung der Oberfläche
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fstatic from '@fastify/static';
import { ZodError } from 'zod';
import { config } from './config.js';
import { waitForDb, migrate, one, q } from './db.js';
import { HttpError, sha256, getSetting, ipMatch } from './lib.js';
import { attachAuthz } from './authz.js';
import { registerResources } from './resources.js';
import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import workshopRoutes from './routes/workshop.js';
import financeRoutes from './routes/finance.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

const app = Fastify({ logger: { level: 'warn' }, trustProxy: config.trustProxy, bodyLimit: 6 * 1024 * 1024 });
await app.register(cookie);

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
app.addHook('onSend', async (req, reply, payload) => {
  reply.header('Content-Security-Policy', CSP);
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'same-origin');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  else reply.header('Cache-Control', 'no-cache'); // statische Dateien: immer kurz beim Server nachfragen (ETag)
  return payload;
});

// Fehler einheitlich auf Deutsch
const LABELS = { name: 'Name', plate: 'Kennzeichen', email: 'E-Mail', password: 'Passwort', amount: 'Betrag', price: 'Preis', title: 'Titel', date: 'Datum', from: 'Von', to: 'Bis' };
app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    const field = i.path.length ? (LABELS[i.path[0]] || i.path.join('.')) : 'Eingabe';
    return reply.code(400).send({ error: 'validation', message: `${field}: ${i.message}` });
  }
  if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code || 'error', message: err.message });
  if (err.code === '23505') return reply.code(409).send({ error: 'duplicate', message: err.constraint === 'vehicles_plate_uq' ? 'Dieses Kennzeichen ist schon vergeben.' : 'Das gibt es schon.' });
  if (err.code === '23503') return reply.code(409).send({ error: 'in_use', message: 'Wird noch verwendet und kann deshalb nicht gelöscht werden.' });
  if (err.code === 'P0001') return reply.code(409).send({ error: 'immutable', message: 'Abgeschlossene Daten lassen sich nicht mehr ändern.' });
  if (err.code === '23514') return reply.code(400).send({ error: 'check', message: 'Ungültiger Wert.' });
  if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'bad_request', message: err.message });
  req.log.error(err);
  console.error(err);
  return reply.code(500).send({ error: 'server', message: 'Interner Fehler. Bitte melde das unter „Fehler melden“.' });
});

// Sitzung bzw. API-Schlüssel auflösen
const PUBLIC = [/^\/api\/health$/, /^\/api\/auth\//, /^\/api\/setup$/, /^\/api\/public\//];
app.addHook('preHandler', async (req, reply) => {
  if (!req.url.startsWith('/api/')) return;
  const path = req.url.split('?')[0];
  let user = null;
  const token = req.cookies.bx_session;
  if (token) {
    const s = await one(`SELECT s.id AS sid, s.last_seen_at, s.pending_2fa, u.* FROM sessions s JOIN users u ON u.id = s.user_id
                         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [sha256(token)]);
    if (s && !s.pending_2fa) {
      user = s;
      if (Date.now() - new Date(s.last_seen_at).getTime() > 5 * 60 * 1000) {
        const sec = await getSetting('security');
        await q(`UPDATE sessions SET last_seen_at = now(), expires_at = now() + ($2 || ' days')::interval WHERE id = $1`, [s.sid, String(sec.sessionDays || 7)]);
      }
    }
  } else if (req.method === 'GET' && /^Bearer bxs_/.test(req.headers.authorization || '')) {
    const key = req.headers.authorization.slice(7);
    const k = await one('SELECT k.id AS kid, u.* FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = $1 AND k.revoked_at IS NULL', [sha256(key)]);
    if (k) { user = k; user.viaApiKey = true; await q('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [k.kid]); }
  }
  if (user && (['left', 'locked', 'pending', 'invited'].includes(user.status) || (user.expires_on && user.expires_on < new Date().toISOString().slice(0, 10)))) user = null;
  req.user = user;
  if (PUBLIC.some((r) => r.test(path))) return;
  if (!user) return reply.code(401).send({ error: 'auth', message: 'Bitte melde dich an.' });
  await attachAuthz(req);
  const sec = await getSetting('security');
  if (sec.maintenance && !req.sys('server:settings')) return reply.code(503).send({ error: 'maintenance', message: sec.maintenanceText || 'Wartungsmodus' });
  if (path.startsWith('/api/admin/') && sec.allowlist && sec.allowlist.trim()) {
    const ok = sec.allowlist.split(/\s+/).filter(Boolean).some((e) => ipMatch(req.ip, e));
    if (!ok) return reply.code(403).send({ error: 'ip', message: 'Deine IP ist für die Administration nicht freigegeben.' });
  }
});



app.get('/api/health', async () => ({ ok: true, version: config.version }));
await app.register(authRoutes);
await app.register(stateRoutes);
await app.register(workshopRoutes);
await app.register(financeRoutes);
await app.register(staffRoutes);
await app.register(adminRoutes);
registerResources(app);

await app.register(fstatic, { root: config.publicDir, prefix: '/', index: ['index.html'], cacheControl: false });
app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'Gibt es nicht.' });
  return reply.sendFile('index.html');
});

await waitForDb();
const last = await migrate();
console.log(`Boxenstopp ${config.version} · Migration ${last} · Port ${config.port}`);
if (!config.encryptionKey) console.warn('WARNUNG: ENCRYPTION_KEY fehlt – 2FA und Webhooks funktionieren nicht.');
if (!config.trustProxy) console.warn('Hinweis: TRUST_PROXY ist aus. Hinter einem Reverse-Proxy sehen Login-Sperre und Audit-Log sonst nur dessen IP.');
await app.listen({ port: config.port, host: '0.0.0.0' });
