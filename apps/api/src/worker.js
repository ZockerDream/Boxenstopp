// Worker: führt die Jobs nach Zeitplan aus (Prüfung jede Minute)
import { waitForDb, q, pool } from './db.js';
import { JOBS, runJob } from './jobs.js';

await waitForDb();
// Warten, bis die API die Migrationen angewendet hat
for (let i = 0; i < 120; i++) {
  const r = await q(`SELECT to_regclass('public.job_runs') AS t`);
  if (r[0].t) break;
  await new Promise((res) => setTimeout(res, 1000));
}
console.log('Boxenstopp-Worker gestartet:', Object.keys(JOBS).join(', '));

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const [key, job] of Object.entries(JOBS)) {
      const last = await q(`SELECT started_at FROM job_runs WHERE job = $1 ORDER BY started_at DESC LIMIT 1`, [key]);
      const t = last[0] ? new Date(last[0].started_at).getTime() : null;
      if (job.due(t)) {
        const r = await runJob(key);
        console.log(new Date().toISOString(), key, r.ok ? 'ok' : 'FEHLER', r.message || '');
      }
    }
  } catch (e) {
    console.error('Worker:', e.message);
  } finally {
    busy = false;
  }
}
await tick();
setInterval(tick, 60 * 1000);
process.on('SIGTERM', async () => { await pool.end().catch(() => {}); process.exit(0); });
