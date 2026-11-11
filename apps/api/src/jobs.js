// Hintergrundjobs. Laufen im Worker nach Zeitplan oder per „Jetzt ausführen“.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { q, one, tx } from './db.js';
import { config } from './config.js';
import { today, addDays, notify, fireWebhooks, getSetting } from './lib.js';
import { loadAuthz, levelOf } from './authz.js';

const nextDate = (d, every) => {
  const x = new Date(d + 'T12:00:00Z');
  if (every === 'weekly') x.setUTCDate(x.getUTCDate() + 7);
  if (every === 'monthly') x.setUTCMonth(x.getUTCMonth() + 1);
  if (every === 'yearly') x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x.toISOString().slice(0, 10);
};

async function usersWith(mod, min) {
  const A = await loadAuthz();
  const users = await q(`SELECT * FROM users WHERE status = 'active'`);
  return users.filter((u) => levelOf(A, u, mod) >= min).map((u) => u.id);
}

export const JOBS = {
  'recurring.run': {
    label: 'Daueraufträge buchen', every: 'stündlich', due: (last) => !last || Date.now() - last > 3600e3,
    run: async () => {
      let n = 0;
      for (;;) {
        const did = await tx(async (c) => {
          const r = await c.one(`SELECT * FROM recurring_rules WHERE active AND next_run <= $1 ORDER BY next_run LIMIT 1 FOR UPDATE SKIP LOCKED`, [today()]);
          if (!r) return false;
          const closedDay = await c.one('SELECT 1 FROM cash_closings WHERE account_id = $1 AND day = $2', [r.account_id, r.next_run]);
          await c.query(`INSERT INTO transactions (account_id, type, amount, title, category, source, source_id, taxable, booked_at) VALUES ($1,$2,$3,$4,$5,'recurring',$6,$7,$8)`,
            [r.account_id, r.type, r.amount, `${r.name} (Dauerauftrag)`, r.category, r.id, r.taxable && r.type === 'income', closedDay ? today() : r.next_run]);
          await c.query('UPDATE recurring_rules SET next_run = $2 WHERE id = $1', [r.id, nextDate(r.next_run, r.every)]);
          return true;
        });
        if (!did) break;
        if (++n > 500) break;
      }
      return `${n} Buchungen`;
    },
  },
  'reminders.daily': {
    label: 'Erinnerungen (Nachweise, Lizenzen, Rechnungen, Steuern)', every: 'täglich 06:00', due: dailyAt(6),
    run: async () => {
      const t = today();
      let n = 0;
      const certs = await q(`SELECT DISTINCT ON (c.user_id, c.training_id) c.user_id, c.training_id, c.valid_until::text AS until, t.name FROM certificates c JOIN trainings t ON t.id = c.training_id
                             JOIN users u ON u.id = c.user_id AND u.status = 'active' ORDER BY c.user_id, c.training_id, (c.valid_until IS NULL) DESC, c.valid_until DESC`);
      for (const c of certs) {
        if (!c.until) continue;
        if (c.until === addDays(t, 30) || c.until === addDays(t, -1)) {
          await notify([c.user_id], 'cert', c.until < t ? `Nachweis „${c.name}“ ist abgelaufen` : `Nachweis „${c.name}“ läuft in 30 Tagen ab`, '#/schulungen', 'warn', `cert:${c.user_id}:${c.training_id}:${c.until}:${c.until < t ? 'x' : '30'}`); n++;
        }
      }
      const lic = await q(`SELECT l.id, l.user_id, l.no, l.expires::text AS exp, t.name, t.holder FROM licenses l JOIN license_types t ON t.id = l.type_id WHERE l.status = 'valid' AND l.expires IS NOT NULL AND l.expires <= $1`, [addDays(t, 30)]);
      const lm = await usersWith('licenses', 4);
      for (const l of lic) {
        const who = l.user_id ? [l.user_id, ...lm] : lm;
        await notify(who, 'license', `${l.name}${l.user_id ? '' : ' (Firma)'} ${l.exp < t ? 'ist abgelaufen' : 'läuft am ' + l.exp.split('-').reverse().join('.') + ' ab'}`, l.user_id ? '#/lizenzen' : '#/lizenzen?tab=firma', 'warn', `lic:${l.id}:${l.exp < t ? 'x' : 'soon'}`);
        if (!l.user_id && l.exp === addDays(t, 30)) fireWebhooks('Lizenz läuft ab', `${l.name} am ${l.exp}`);
        n++;
      }
      const inv = await q(`SELECT id, no, due::text FROM invoices WHERE status IN ('open','partial') AND due < $1`, [t]);
      const im = await usersWith('invoices', 3);
      for (const i of inv) { await notify(im, 'invoice', `Rechnung ${i.no} ist überfällig`, '#/rechnung/' + i.id, 'bad', 'inv:' + i.id); n++; }
      if (inv.length) fireWebhooks('Rechnung überfällig', `${inv.length} überfällige Rechnung(en)`);
      return `${n} Hinweise`;
    },
  },
  'stock.check': {
    label: 'Mindestbestand prüfen', every: 'täglich 05:00', due: dailyAt(5),
    run: async () => {
      const low = await q('SELECT id, name, stock::float, min_stock::float AS min, unit FROM parts WHERE active AND stock < min_stock');
      const who = await usersWith('stock', 3);
      for (const p of low) await notify(who, 'stock', `${p.name} unter Mindestbestand (${p.stock} / ${p.min})`, '#/lager', 'warn', `stock:${p.id}:${today()}`);
      if (low.length) fireWebhooks('Lager knapp', low.map((p) => `${p.name}: ${p.stock} ${p.unit}`).join(', '));
      return `${low.length} knapp`;
    },
  },
  'shifts.stale': {
    label: 'Offene Schichten über 12 Stunden', every: 'stündlich', due: (last) => !last || Date.now() - last > 3600e3,
    run: async () => {
      const s = await q(`SELECT s.id, u.id AS uid, u.name FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.ended_at IS NULL AND s.started_at < now() - interval '12 hours'`);
      const who = await usersWith('shifts', 3);
      for (const x of s) await notify([x.uid, ...who], 'shift', `${x.name} ist seit über 12 Stunden eingestempelt`, '#/dienstplan', 'warn', 'shift:' + x.id);
      return `${s.length} offen`;
    },
  },
  'tax.reminder': {
    label: 'Steuerzeitraum fällig', every: 'täglich 07:00', due: dailyAt(7),
    run: async () => {
      const { taxPeriods } = await import('./calc.js');
      const ready = (await taxPeriods(4)).filter((p) => p.status === 'ready' && p.tax > 0);
      const who = await usersWith('tax', 4);
      for (const p of ready) await notify(who, 'tax', `Steuern ${p.label} bereit zur Abführung ($ ${p.tax})`, '#/steuern', 'info', 'tax:' + p.from);
      if (ready.length) fireWebhooks('Steuerzeitraum fällig', ready.map((p) => p.label).join(', '));
      return `${ready.length} fällig`;
    },
  },
  'backup.daily': {
    label: 'Backup', every: 'täglich 03:00', due: dailyAt(3),
    run: async () => {
      const f = await backupNow();
      const old = (await fs.readdir(config.backupDir)).filter((x) => x.endsWith('.dump'));
      let removed = 0;
      for (const o of old) {
        const st = await fs.stat(config.backupDir + '/' + o);
        if (Date.now() - st.mtimeMs > config.backupRetentionDays * 86400e3) { await fs.unlink(config.backupDir + '/' + o); removed++; }
      }
      return `${f}${removed ? ` · ${removed} alte gelöscht` : ''}`;
    },
  },
  cleanup: {
    label: 'Aufräumen (Sitzungen, Benachrichtigungen, Audit)', every: 'täglich 04:00', due: dailyAt(4),
    run: async () => {
      const sec = await getSetting('security');
      await q(`DELETE FROM sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`);
      await q(`DELETE FROM notifications WHERE created_at < now() - interval '90 days'`);
      if (sec.auditDays) await q(`DELETE FROM audit_log WHERE at < now() - ($1 || ' days')::interval`, [String(sec.auditDays)]);
      await q(`DELETE FROM job_runs WHERE started_at < now() - interval '30 days'`);
      return 'ok';
    },
  },
};

function dailyAt(hour) {
  return (last) => {
    const now = new Date();
    const h = Number(new Intl.DateTimeFormat('de-DE', { timeZone: config.tz, hour: '2-digit', hour12: false }).format(now));
    if (h < hour) return false;
    return !last || today() !== new Date(last).toLocaleString('sv-SE', { timeZone: config.tz }).slice(0, 10);
  };
}

export async function runJob(key) {
  const job = JOBS[key];
  if (!job) throw new Error('Unbekannter Job ' + key);
  const r = await one(`INSERT INTO job_runs (job) VALUES ($1) RETURNING id`, [key]);
  try {
    const msg = await job.run();
    await q(`UPDATE job_runs SET finished_at = now(), status = 'ok', message = $2 WHERE id = $1`, [r.id, String(msg || '')]);
    return { ok: true, message: msg };
  } catch (e) {
    await q(`UPDATE job_runs SET finished_at = now(), status = 'error', message = $2 WHERE id = $1`, [r.id, e.message.slice(0, 500)]);
    return { ok: false, message: e.message };
  }
}

export async function backupNow() {
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: config.tz }).replace(/[: ]/g, '-').slice(0, 16);
  const file = `boxenstopp-${stamp}.dump`;
  await new Promise((resolve, reject) => {
    const p = spawn('pg_dump', ['-Fc', '-h', config.db.host, '-p', String(config.db.port), '-U', config.db.user, '-d', config.db.database, '-f', config.backupDir + '/' + file], { env: { ...process.env, PGPASSWORD: config.db.password } });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('pg_dump: ' + err.slice(0, 300)))));
  });
  return file;
}
