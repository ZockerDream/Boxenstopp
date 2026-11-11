// Hilfsfunktionen: Fehler, Krypto, TOTP, Datum, Geld, Nummernkreise, Audit, Benachrichtigungen, Webhooks
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { q, one } from './db.js';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt);

// ---------- Fehler ----------
export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, message, code) => { throw new HttpError(status, message, code); };

// ---------- Passwörter, Tokens ----------
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, n, salt, key] = stored.split('$');
  const want = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: Number(n), r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(want, got);
}
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// AES-256-GCM für Geheimnisse (TOTP, Webhook-URLs)
function encKey() {
  if (!config.encryptionKey) throw new HttpError(500, 'ENCRYPTION_KEY fehlt in der .env');
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}
export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}
export function decrypt(blob) {
  if (!blob) return null;
  const [, iv, tag, data] = blob.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

// ---------- TOTP (RFC 6238, SHA1, 30 s, 6 Stellen) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  let bits = 0, value = 0; const out = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totpCode(secret, t = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}
export function totpVerify(secret, code) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some((w) => totpCode(secret, Date.now() + w * 30000) === c);
}
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

// ---------- Datum ----------
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: config.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: config.tz, hour: '2-digit', minute: '2-digit' });
export const today = () => dayFmt.format(new Date());
export const dayOf = (d) => dayFmt.format(new Date(d));
export const hm = (d) => timeFmt.format(new Date(d));
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekStart = (iso) => { const d = new Date(iso + 'T12:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; return addDays(iso, -wd); };
export function isoWeek(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
}

// ---------- Geld (Cent, nie Float rechnen) ----------
export const cents = (v) => Math.round(Number(v) * 100);
export const fromCents = (c) => (c / 100).toFixed(2);
export const lineTotalCents = (qty, unit, disc) => Math.round(Number(qty) * cents(unit) * (1 - Number(disc) / 100));

// ---------- Nummernkreise (lückenlos, in derselben Transaktion) ----------
export async function nextNumber(c, kind) {
  const year = Number(today().slice(0, 4));
  const r = await c.one(
    `INSERT INTO number_sequences (kind, year, last) VALUES ($1, $2, 1)
     ON CONFLICT (kind, year) DO UPDATE SET last = number_sequences.last + 1 RETURNING last`, [kind, year]);
  const firm = await getSetting('firm', c);
  const short = (firm && firm.short) || 'BXS';
  const n = String(r.last).padStart(4, '0');
  if (kind === 'order') return `${short}-${year}-${n}`;
  if (kind === 'invoice') return `${short}-R-${year}-${n}`;
  if (kind === 'callout') return `E-${year}-${n}`;
  return `${kind}-${year}-${n}`;
}

// ---------- Einstellungen ----------
export async function getSetting(key, c) {
  const r = c ? await c.one('SELECT value FROM settings WHERE key = $1', [key]) : await one('SELECT value FROM settings WHERE key = $1', [key]);
  return r ? r.value : null;
}
export async function setSetting(key, value, c) {
  const sql = 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
  return c ? c.query(sql, [key, value]) : q(sql, [key, value]);
}

// ---------- Audit ----------
export async function audit(req, area, action, detail = '', c) {
  const sql = 'INSERT INTO audit_log (user_id, area, action, detail, ip) VALUES ($1, $2, $3, $4, $5)';
  const p = [req && req.user ? req.user.id : null, area, action, String(detail).slice(0, 1000), req ? req.ip : null];
  return c ? c.query(sql, p) : q(sql, p);
}

// ---------- Benachrichtigungen ----------
export async function notify(userIds, kind, text, link = '', tone = 'info', dedupe = null) {
  for (const uid of new Set(userIds.filter(Boolean))) {
    await q(`INSERT INTO notifications (user_id, kind, text, link, tone, dedupe) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (user_id, dedupe) WHERE dedupe IS NOT NULL DO NOTHING`, [uid, kind, text, link, tone, dedupe]);
  }
}

// ---------- Webhooks (ausgehend, Discord-kompatibel) ----------
export const WEBHOOK_EVENTS = ['Auftrag fertig', 'Rechnung erstellt', 'Einsatz neu', 'Dienstbeginn/-ende', 'Lager knapp', 'Lizenz läuft ab', 'Rechnung überfällig', 'Steuerzeitraum fällig', 'Ankündigung'];
export async function sendWebhook(url, content) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(content).slice(0, 1900), username: 'Boxenstopp' }), signal: AbortSignal.timeout(8000) });
  return r.status;
}
export function fireWebhooks(event, content) {
  (async () => {
    const hooks = await q('SELECT * FROM webhooks WHERE active AND $1 = ANY(events)', [event]);
    for (const h of hooks) {
      let status;
      try { status = String(await sendWebhook(decrypt(h.url), `**${event}** · ${content}`)); } catch (e) { status = 'Fehler: ' + e.message; }
      await q('UPDATE webhooks SET last_status = $2, last_at = now() WHERE id = $1', [h.id, status]);
    }
  })().catch((e) => console.error('Webhook', e.message));
}

// ---------- IP-Allowlist ----------
export function ipMatch(ip, entry) {
  const clean = (ip || '').replace(/^::ffff:/, '');
  if (!entry.includes('/')) return clean === entry;
  const [net, bits] = entry.split('/');
  const toInt = (s) => s.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return false;
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (toInt(clean) & mask) === (toInt(net) & mask);
}
