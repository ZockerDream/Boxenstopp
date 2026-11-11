// Datenbankzugriff: Pool, Transaktionen, Migrationen
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

// date und numeric als Strings lassen (keine Zeitzonen- oder Float-Überraschungen)
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ ...config.db, max: 10, options: `-c timezone=${config.tz}` });

export async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}
export async function one(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}

// Führt fn(client) in einer Transaktion aus; client.q/client.one wie oben
export async function tx(fn) {
  const c = await pool.connect();
  c.q = async (s, p = []) => (await c.query(s, p)).rows;
  c.one = async (s, p = []) => (await c.query(s, p)).rows[0] || null;
  try {
    await c.query('BEGIN');
    const res = await fn(c);
    await c.query('COMMIT');
    return res;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function waitForDb(seconds = 60) {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    try { await pool.query('SELECT 1'); return; } catch (e) {
      if (e.code === '28P01' || e.code === '3D000') {
        throw new Error(`Datenbank lehnt die Anmeldung ab (${e.message}). DB_USER, DB_PASSWORD und DB_NAME werden nur beim ersten Start in ein leeres Volume übernommen.`);
      }
      if (Date.now() > until) throw new Error('Datenbank nicht erreichbar: ' + e.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function migrate(dir = new URL('../migrations', import.meta.url).pathname) {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(424242)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(dir)).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(dir, f), 'utf8');
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await c.query('COMMIT');
        console.log('Migration angewendet:', f);
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`Migration ${f} fehlgeschlagen: ${e.message}`);
      }
    }
    return files[files.length - 1];
  } finally {
    await c.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    c.release();
  }
}
