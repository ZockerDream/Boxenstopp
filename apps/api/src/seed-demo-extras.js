// Ergänzt eine bestehende Demo-Instanz (aus 0.2.0) um die Demo-Daten von 0.3.0:
// Fahrzeug-Katalog mit Bildern, Fuhrpark, Tuning-Pakete, Regelwerk. Läuft nur, wenn der Katalog noch leer ist.
import { pool, q, one, waitForDb, migrate } from './db.js';
import { today } from './lib.js';
import { seedExtras } from './seed-extras.js';

await waitForDb();
await migrate();
if ((await one('SELECT count(*)::int AS n FROM vehicle_models')).n > 0) { console.log('Der Fahrzeug-Katalog ist nicht leer – nichts geändert.'); process.exit(0); }
const U = Object.fromEntries((await q('SELECT id, name FROM users')).map((u) => [u.name.split(' ')[0], u.id]));
// Lena kann umbenannt sein: dann gilt der erste Inhaber
if (!U.Lena) { const o = await one('SELECT id FROM users WHERE is_owner ORDER BY created_at LIMIT 1'); if (o) U.Lena = o.id; }
for (const n of ['Lena', 'Marco', 'Deniz', 'Jonas', 'Sophie', 'Tim', 'Mia']) if (!U[n]) { console.log('Das ist keine Demo-Instanz (Benutzer ' + n + ' fehlt) – nichts geändert.'); process.exit(1); }
const classes = Object.fromEntries((await q('SELECT id, name FROM vehicle_classes')).map((c) => [c.name, c.id]));
await seedExtras({ T: today(), U, CU: [], D: { classes } });
console.log('Demo-Daten für Katalog, Fuhrpark, Tuning-Pakete und Regelwerk ergänzt.');
await pool.end();
