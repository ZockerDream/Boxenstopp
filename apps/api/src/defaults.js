// Grunddaten einer neuen Firma (Ersteinrichtung und Demo-Daten)
import { MODULES } from './authz.js';
import { setSetting } from './lib.js';

// Rechtevorlagen; Reihenfolge wie MODULES
export const TEMPLATES = {
  Leitung: '4434444444433344444434444',
  Meister: '2203343323320123322303332',
  Mechaniker: '2003333322200101110202232',
  Azubi: '2002212222000101110202222',
  Praktikant: '2002212020000101100201222',
  Buchhaltung: '2002200002444322200202202',
  'Nur lesen': '2222222222222222222222222',
  'keine Rechte': '0000000000000000000000002',
};
export const tplLevels = (name) => Object.fromEntries(MODULES.map((m, i) => [m, Number((TEMPLATES[name] || TEMPLATES['keine Rechte'])[i])]));

const RANKS = [
  ['Geschäftsführung', 6, 'Leitung', { hourly: 0, commission: 0, fixed: 4000 }, { 'rabatt.max_prozent': 100, 'auftrag.preis_aendern': 1, 'rechnung.storno': 1, 'kasse.abschluss': 1, 'personal.lohn_sehen': 1 }],
  ['Werkstattleitung', 5, 'Leitung', { hourly: 180, commission: 8, fixed: 0 }, { 'rabatt.max_prozent': 30, 'auftrag.preis_aendern': 1, 'rechnung.storno': 1, 'kasse.abschluss': 1, 'personal.lohn_sehen': 1 }],
  ['Meister', 4, 'Meister', { hourly: 150, commission: 6, fixed: 0 }, { 'rabatt.max_prozent': 20, 'auftrag.preis_aendern': 1, 'kasse.abschluss': 1 }],
  ['Mechaniker', 3, 'Mechaniker', { hourly: 120, commission: 5, fixed: 0 }, { 'rabatt.max_prozent': 10 }],
  ['Azubi', 2, 'Azubi', { hourly: 80, commission: 0, fixed: 0 }, {}],
  ['Praktikant', 1, 'Praktikant', { hourly: 50, commission: 0, fixed: 0 }, {}],
];

export async function setRankPerms(c, rankId, template) {
  const lv = tplLevels(template);
  for (const [m, l] of Object.entries(lv)) {
    await c.query(`INSERT INTO permissions (target_type, target_id, module, level) VALUES ('rank', $1, $2, $3)
                   ON CONFLICT (target_type, target_id, module) DO UPDATE SET level = EXCLUDED.level`, [rankId, m, l]);
  }
}

export async function installDefaults(c, { firmName, short, address = '', phone = '', hours = '', taxRate = 10 }) {
  await setSetting('firm', { name: firmName, short, address, phone, hours, invoiceFooter: 'Zahlbar innerhalb von 3 Tagen. Danke für deinen Besuch – fahr vorsichtig!', termsDays: 3 }, c);
  const ranks = {};
  for (const [name, pos, tpl, pay, flags] of RANKS) {
    const r = await c.one('INSERT INTO ranks (name, position, pay) VALUES ($1, $2, $3) RETURNING id', [name, pos, pay]);
    ranks[name] = r.id;
    await setRankPerms(c, r.id, tpl);
    for (const [f, v] of Object.entries(flags)) await c.query(`INSERT INTO permission_flags VALUES ('rank', $1, $2, $3)`, [r.id, f, v]);
  }
  const classes = {};
  for (const [i, n] of ['Kompakt', 'Limousine', 'Sport', 'Super', 'SUV', 'Motorrad', 'Nutzfahrzeug'].entries()) {
    classes[n] = (await c.one('INSERT INTO vehicle_classes (name, position) VALUES ($1, $2) RETURNING id', [n, i])).id;
  }
  const cats = {};
  for (const [i, n] of ['Reparatur', 'Wartung', 'Tuning Motor', 'Tuning Fahrwerk', 'Optik', 'Lackierung', 'Abschleppen & Einsätze', 'Teileverkauf'].entries()) {
    cats[n] = (await c.one('INSERT INTO catalog_categories (name, position) VALUES ($1, $2) RETURNING id', [n, i])).id;
  }
  const pg = (await c.one(`INSERT INTO price_groups (name, pct, is_default) VALUES ('Standard', 0, true) RETURNING id`)).id;
  const acc = {};
  for (const [n, k] of [['Firmenkonto', 'bank'], ['Bargeldkasse', 'cash'], ['Steuer-Rücklage', 'tax_reserve']]) {
    acc[n] = (await c.one('INSERT INTO accounts (name, kind) VALUES ($1, $2) RETURNING id', [n, k])).id;
  }
  await setSetting('tax', { period: 'week', reserveAccount: acc['Steuer-Rücklage'], payrollAccount: acc['Firmenkonto'] }, c);
  await c.query('INSERT INTO tax_rates (rate, valid_from) VALUES ($1, $2)', [taxRate, '2000-01-01']);
  const bays = {};
  for (const [i, n] of ['Hebebühne 1', 'Hebebühne 2', 'Hebebühne 3', 'Lackierkabine', 'Außenplatz'].entries()) {
    bays[n] = (await c.one('INSERT INTO bays (name, position) VALUES ($1, $2) RETURNING id', [n, i])).id;
  }
  return { ranks, classes, cats, pg, acc, bays };
}
