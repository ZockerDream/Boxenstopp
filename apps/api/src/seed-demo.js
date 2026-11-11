// Demo-Daten für eine Test-Instanz: node src/seed-demo.js
// Nur auf einer LEEREN Datenbank (keine Benutzer). Alle Konten haben das Passwort aus DEMO_PASSWORD (Standard: Boxenstopp2026!).
import { pool, tx, migrate, waitForDb } from './db.js';
import { hashPassword, today, addDays, weekStart, isoWeek, nextNumber, cents } from './lib.js';
import { installDefaults } from './defaults.js';
import { unitPrice, groupDiscount, lineCents } from './pricing.js';
import { computeTaxPeriod, computePayroll, periodBounds } from './calc.js';
import { MODULES } from './authz.js';

const PW = process.env.DEMO_PASSWORD || 'Boxenstopp2026!';
let seed = 20261111;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

await waitForDb();
await migrate();
const T = today();
const ts = (d, hm = '18:00') => `${d} ${hm}`;

await tx(async (c) => {
  const n = await c.one('SELECT count(*)::int AS n FROM users');
  if (n.n > 0) throw new Error('Die Datenbank hat schon Benutzer – Demo-Daten nur auf einer leeren Instanz.');
  const D = await installDefaults(c, { firmName: 'Rostfrei Garage', short: 'RFG', address: 'Hafenstraße 12, Industriegebiet Süd', phone: '555-0142', hours: 'Mo–So 16:00–02:00', taxRate: 8 });
  await c.query(`UPDATE settings SET value = value || '{"publicPricelist": true}' WHERE key = 'features'`);
  await c.query(`UPDATE settings SET value = value || '{"registration": true}' WHERE key = 'security'`);
  const id = (r) => r.id;
  const R = D.ranks;

  // ---------- Gruppen ----------
  const G = {};
  for (const [name, desc] of [['Tuning', 'Motor- und Fahrwerkstuning'], ['Abschleppdienst', 'Einsätze vor Ort, Abschleppwagen'], ['Lackiererei', 'Lackierkabine und Folierung'], ['Ausbilder', 'Schulungen und Prüfungen'], ['Buchhaltung', 'Rechnungen, Kasse, Steuern, Lohn']]) {
    G[name] = id(await c.one('INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id', [name, desc]));
  }
  const gp = { Tuning: { catalog: 3 }, Abschleppdienst: { callouts: 4 }, Lackiererei: { appointments: 3 }, Ausbilder: { trainings: 4, licenses: 3 }, Buchhaltung: { invoices: 4, accounts: 4, tax: 4, payroll: 3, reports: 2 } };
  for (const [g, m] of Object.entries(gp)) for (const [mod, l] of Object.entries(m)) await c.query(`INSERT INTO permissions VALUES ('group', $1, $2, $3)`, [G[g], mod, l]);
  for (const f of ['rechnung.storno', 'kasse.abschluss', 'personal.lohn_sehen']) await c.query(`INSERT INTO permission_flags VALUES ('group', $1, $2, 1)`, [G.Buchhaltung, f]);
  await c.query(`INSERT INTO permission_flags VALUES ('group', $1, 'rabatt.max_prozent', 25)`, [G.Buchhaltung]);

  // ---------- Mitarbeiter ----------
  const hash = await hashPassword(PW);
  const staffSeed = [
    ['Lena Brandt', 'Geschäftsführung', ['Buchhaltung', 'Ausbilder'], true, ['admin'], 'P-001', '01', -620, 'active'],
    ['Marco Vogt', 'Werkstattleitung', ['Tuning', 'Ausbilder'], false, [], 'P-002', '02', -620, 'active'],
    ['Deniz Aydin', 'Meister', ['Tuning'], false, [], 'P-004', '04', -540, 'active'],
    ['Jonas Keller', 'Mechaniker', ['Abschleppdienst'], false, [], 'P-006', '06', -470, 'active'],
    ['Sophie Hartmann', 'Mechaniker', ['Lackiererei'], false, [], 'P-007', '07', -460, 'active'],
    ['Tim Becker', 'Mechaniker', ['Abschleppdienst', 'Tuning'], false, [], 'P-009', '09', -390, 'active'],
    ['Mia Schulz', 'Azubi', [], false, [], 'P-012', '12', -130, 'active'],
    ['Luca Romano', 'Azubi', ['Lackiererei'], false, [], 'P-013', '13', -95, 'leave'],
    ['Nora Weiß', 'Praktikant', [], false, [], 'P-015', '15', -14, 'active'],
    ['Erik Lange', 'Mechaniker', [], false, [], 'P-005', '05', -530, 'left'],
    ['Kai Neumann', null, [], false, ['support'], '', '', -300, 'active'],
  ];
  const U = {};
  for (const [name, rank, groups, owner, roles, staffNo, dutyNo, joined, status] of staffSeed) {
    const email = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(' ', '.') + '@rostfrei.rp';
    const u = await c.one(`INSERT INTO users (email, name, password_hash, status, is_owner, rank_id, staff_no, duty_no, phone, joined_on, left_on, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() - ($12 || ' days')::interval) RETURNING id`,
    [email, name, hash, status, owner, rank ? R[rank] : null, staffNo, dutyNo, '555-01' + (dutyNo || '99'), addDays(T, joined), status === 'left' ? addDays(T, -42) : null, String(-joined)]);
    U[name.split(' ')[0]] = u.id;
    for (const g of groups) await c.query('INSERT INTO group_members VALUES ($1, $2)', [G[g], u.id]);
    for (const r of roles) await c.query('INSERT INTO user_system_roles VALUES ($1, $2)', [u.id, r]);
  }
  await c.query(`INSERT INTO users (email, name, password_hash, status) VALUES ('sam.rivera@rostfrei.rp', 'Sam Rivera', $1, 'pending')`, [hash]);
  await c.query(`INSERT INTO permissions VALUES ('user', $1, 'invoices', 3)`, [U.Tim]);
  await c.query(`INSERT INTO permissions VALUES ('user', $1, 'stafffiles', 0)`, [U.Jonas]);
  await c.query(`INSERT INTO rank_history (user_id, from_rank, to_rank, by_user, reason, at) VALUES ($1, 'Mechaniker', 'Meister', $2, 'Tuning Stufe 2 bestanden', now() - interval '280 days'), ($3, 'Azubi', 'Mechaniker', $4, 'Ausbildung abgeschlossen', now() - interval '3 days')`, [U.Deniz, U.Lena, U.Tim, U.Marco]);

  // ---------- Schulungen & Lizenzarten ----------
  const TR = {};
  for (const [name, months, test, desc] of [
    ['Grundlagen Reparatur', 12, true, 'Motor, Karosserie, Reifen – Pflicht für alle Mechaniker.'], ['Tuning Stufe 1', 6, true, 'Einfache Leistungssteigerung, Bremsen, Federung.'],
    ['Tuning Stufe 2', 6, true, 'Motor-Tuning Stufe 2, Turbo-Einbau.'], ['Tuning Stufe 3', 6, false, 'Vollausbau. Praktische Prüfung beim Werkstattleiter.'],
    ['Abschleppen & Sicherung', 12, true, 'Sicheres Verladen, Einsatzabsicherung.'], ['Lackieren & Folieren', 12, false, 'Lackierkabine, Effektlacke, Folien.'], ['Kasse & Kundenservice', null, true, 'Rechnungen, Zahlungen, Tagesabschluss.']]) {
    TR[name] = id(await c.one('INSERT INTO trainings (name, months, test, description) VALUES ($1, $2, $3, $4) RETURNING id', [name, months, test, desc]));
  }
  for (const [rank, ts2] of [['Mechaniker', ['Grundlagen Reparatur']], ['Meister', ['Grundlagen Reparatur', 'Tuning Stufe 1', 'Kasse & Kundenservice']], ['Werkstattleitung', ['Grundlagen Reparatur', 'Tuning Stufe 1', 'Tuning Stufe 2', 'Kasse & Kundenservice']]]) {
    for (const t of ts2) await c.query('INSERT INTO rank_requirements VALUES ($1, $2)', [R[rank], TR[t]]);
  }
  const LT = {};
  for (const [name, holder, months] of [['Abschleppschein', 'member', 6], ['Führerschein LKW', 'member', 24], ['Gewerbeschein', 'firm', 12], ['Abschlepp-Konzession', 'firm', 12]]) {
    LT[name] = id(await c.one('INSERT INTO license_types (name, holder, months) VALUES ($1, $2, $3) RETURNING id', [name, holder, months]));
  }

  // ---------- Preisgruppen, Teile, Preisliste ----------
  const PG = { Standard: D.pg };
  PG.Stammkunde = id(await c.one(`INSERT INTO price_groups (name, pct) VALUES ('Stammkunde', 10) RETURNING id`));
  PG.Behörde = id(await c.one(`INSERT INTO price_groups (name, pct, cats) VALUES ('Behörde', 20, $1) RETURNING id`, [{ [D.cats['Tuning Motor']]: 10 }]));
  PG.Mitarbeiter = id(await c.one(`INSERT INTO price_groups (name, pct) VALUES ('Mitarbeiter', 30) RETURNING id`));
  const P = {};
  for (const [k, sku, name, unit, stock, min, loc, buy, sell] of [
    ['reifen', 'T-REIF-01', 'Reifen Allround', 'Stk', 26, 16, 'Regal A1', 40, 75], ['oel', 'T-OEL-5L', 'Motoröl 5 L', 'Stk', 8, 10, 'Regal B2', 25, 60],
    ['turbo', 'T-TURBO', 'Turbolader', 'Stk', 3, 2, 'Lager hinten', 2200, 3500], ['kit', 'T-REPKIT', 'Reparaturkit', 'Stk', 17, 5, 'Regal A3', 120, 250],
    ['brems', 'T-BREMS', 'Bremsscheiben Sport (Satz)', 'Satz', 4, 4, 'Regal C1', 600, 1100], ['lack', 'T-LACK-L', 'Lack (Liter)', 'L', 34, 10, 'Lackierkabine', 18, 45],
    ['xenon', 'T-XENON', 'Xenon-Set', 'Set', 5, 2, 'Regal D2', 250, 480], ['feder', 'T-FEDER', 'Sportfedern (Satz)', 'Satz', 5, 2, 'Regal C2', 900, 1600]]) {
    P[k] = id(await c.one('INSERT INTO parts (sku, name, unit, stock, min_stock, location, buy, sell) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [sku, name, unit, stock, min, loc, buy, sell]));
  }
  const C = D.classes, K = D.cats;
  const cl = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [C[k], v]));
  const tr = (n) => 'training:' + TR[n];
  const items = [
    ['Reparatur', 'Reparatur Motor', 'flat', 'pauschal', 450, { surcharge: cl({ Sport: 20, Super: 50, Motorrad: -30, Nutzfahrzeug: 25 }), material: 120, warranty: 7, parts: [{ part: P.kit, qty: 1 }] }],
    ['Reparatur', 'Reparatur Karosserie komplett', 'flat', 'pauschal', 600, { surcharge: cl({ Super: 50, SUV: 15, Nutzfahrzeug: 30, Motorrad: -40 }), material: 150, warranty: 7 }],
    ['Reparatur', 'Arbeitsstunde Mechanik', 'labor', 'Std', 120, {}],
    ['Reparatur', 'Reifenwechsel (4 Stück)', 'bundle', 'pauschal', 340, { class_prices: cl({ Motorrad: 190, Nutzfahrzeug: 520 }), material: 160, parts: [{ part: P.reifen, qty: 4 }] }],
    ['Wartung', 'Ölwechsel', 'bundle', 'pauschal', 150, { material: 25, parts: [{ part: P.oel, qty: 1 }] }],
    ['Wartung', 'Inspektion', 'flat', 'pauschal', 250, { material: 20, warranty: 14 }],
    ['Tuning Motor', 'Motor-Tuning Stufe 1', 'flat', 'pauschal', 2500, { class_prices: cl({ Super: 4000, Motorrad: 1500 }), material: 600, req: [tr('Tuning Stufe 1')], group: G.Tuning, tuning: ['Motor', 1], warranty: 30 }],
    ['Tuning Motor', 'Motor-Tuning Stufe 2', 'flat', 'pauschal', 5000, { class_prices: cl({ Super: 8000, Motorrad: 3000 }), material: 1400, req: [tr('Tuning Stufe 2')], group: G.Tuning, tuning: ['Motor', 2], warranty: 30 }],
    ['Tuning Motor', 'Motor-Tuning Stufe 3', 'flat', 'pauschal', 9500, { class_prices: cl({ Super: 15000 }), material: 3000, req: [tr('Tuning Stufe 3')], group: G.Tuning, tuning: ['Motor', 3], warranty: 30 }],
    ['Tuning Motor', 'Turbo-Einbau', 'bundle', 'pauschal', 7500, { material: 2200, req: [tr('Tuning Stufe 2')], group: G.Tuning, parts: [{ part: P.turbo, qty: 1 }], tuning: ['Turbo', 1], warranty: 30 }],
    ['Tuning Fahrwerk', 'Bremsen Stufe 2', 'bundle', 'pauschal', 3200, { material: 600, req: [tr('Tuning Stufe 1')], parts: [{ part: P.brems, qty: 1 }], tuning: ['Bremsen', 2], warranty: 30 }],
    ['Tuning Fahrwerk', 'Federung Sport', 'bundle', 'pauschal', 2800, { material: 900, req: [tr('Tuning Stufe 1')], parts: [{ part: P.feder, qty: 1 }], tuning: ['Federung', 2], warranty: 30 }],
    ['Optik', 'Scheibentönung', 'flat', 'pauschal', 400, { material: 60, tuning: ['Optik', 1] }],
    ['Optik', 'Xenon-Scheinwerfer', 'bundle', 'pauschal', 650, { material: 250, parts: [{ part: P.xenon, qty: 1 }], tuning: ['Optik', 1] }],
    ['Optik', 'Neon-Unterbodenbeleuchtung', 'flat', 'pauschal', 1200, { material: 300, active: false, note: 'Auf dem Server derzeit verboten' }],
    ['Lackierung', 'Lackierung komplett', 'flat', 'pauschal', 1800, { surcharge: cl({ Super: 40, SUV: 20, Nutzfahrzeug: 50, Motorrad: -40 }), material: 180, req: [tr('Lackieren & Folieren')], group: G.Lackiererei, parts: [{ part: P.lack, qty: 4 }] }],
    ['Lackierung', 'Perleffekt-Lack', 'flat', 'pauschal', 900, { material: 120, req: [tr('Lackieren & Folieren')], group: G.Lackiererei }],
    ['Abschleppen & Einsätze', 'Abschleppen Stadt', 'flat', 'pauschal', 350, { class_prices: cl({ Nutzfahrzeug: 700, Motorrad: 200 }), material: 30, req: ['license:' + LT.Abschleppschein], group: G.Abschleppdienst }],
    ['Abschleppen & Einsätze', 'Anfahrtspauschale', 'flat', 'pauschal', 150, {}],
    ['Abschleppen & Einsätze', 'Pannenhilfe vor Ort', 'labor', 'Std', 180, { group: G.Abschleppdienst }],
    ['Teileverkauf', 'Reifen Allround', 'part', 'Stk', 75, { material: 40, part_id: P.reifen }],
    ['Teileverkauf', 'Reparaturkit', 'part', 'Stk', 250, { material: 120, part_id: P.kit }],
    ['Teileverkauf', 'Motoröl 5 L', 'part', 'Stk', 60, { material: 25, part_id: P.oel }],
  ];
  const I = {};
  for (const [i, [cat, name, kind, unit, price, o]] of items.entries()) {
    const r = await c.one(`INSERT INTO catalog_items (category_id, name, kind, unit, price, surcharge, class_prices, material, warranty, req, group_id, tuning, parts, part_id, active, note, position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [K[cat], name, kind, unit, price, o.surcharge ? JSON.stringify(o.surcharge) : null, o.class_prices ? JSON.stringify(o.class_prices) : null, o.material || 0, o.warranty || 0, o.req || [], o.group || null, o.tuning ? JSON.stringify(o.tuning) : null, o.parts ? JSON.stringify(o.parts) : null, o.part_id || null, o.active !== false, o.note || '', i]);
    I[name] = r;
  }

  // ---------- Kunden & Fahrzeuge ----------
  const custSeed = [['Ava Reyes', 'person', 'Stammkunde'], ['Bastian Kroll', 'person', 'Standard'], ['Carla Neves', 'person', 'Standard'], ['Dario Fontana', 'person', 'Stammkunde'], ['Elif Kaya', 'person', 'Standard'],
    ['Frank Ostermann', 'person', 'Standard'], ['Greta Lindqvist', 'person', 'Stammkunde'], ['Hugo Vance', 'person', 'Standard'], ['Ines Moreau', 'person', 'Standard'], ['Jamal Price', 'person', 'Standard'],
    ['Kira Volkova', 'person', 'Stammkunde'], ['Leon Hart', 'person', 'Standard'], ['Maja Sørensen', 'person', 'Standard'], ['Nico Brandauer', 'person', 'Standard'], ['Olga Petrova', 'person', 'Standard'],
    ['Polizeidepartment', 'authority', 'Behörde'], ['Rettungsdienst Süd', 'authority', 'Behörde'], ['Sunrise Taxi', 'company', 'Stammkunde'], ['Hafenlogistik Kade', 'company', 'Stammkunde'], ['Tim Becker', 'person', 'Mitarbeiter']];
  const CU = [];
  for (const [i, [name, kind, pg]] of custSeed.entries()) {
    const extra = { 3: { tags: ['VIP', 'Tuning'] }, 7: { warning: 'Zahlt nur bar, Rechnungen nicht per Überweisung annehmen' }, 13: { blocked: null }, 15: { tags: ['Behörde'] }, 17: { tags: ['Flotte'] }, 18: { tags: ['Flotte', 'Nutzfahrzeuge'] } }[i] || {};
    CU.push(await c.one(`INSERT INTO customers (name, kind, phone, price_group_id, terms_days, tags, warning, blocked, since) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, kind, '555-' + String(2000 + i * 37).slice(-4), PG[pg], kind === 'person' ? 0 : 14, extra.tags || [], extra.warning || null, extra.blocked || null, addDays(T, -int(20, 400))]));
  }
  const models = [['Kestrel', 'Vireo GT', 'Sport'], ['Halden', 'Sedan 500', 'Limousine'], ['Moravo', 'Ranger X', 'SUV'], ['Brixton', 'Mini C', 'Kompakt'], ['Velan', 'Zephyr R', 'Super'], ['Arken', 'Blade 900', 'Motorrad'],
    ['Tarvos', 'Hauler 3', 'Nutzfahrzeug'], ['Halden', 'Cruiser V8', 'Limousine'], ['Kestrel', 'Strada', 'Sport'], ['Moravo', 'Atlas', 'SUV'], ['Brixton', 'Pulse', 'Kompakt'], ['Velan', 'Nyx', 'Super']];
  const colors = ['Schwarz', 'Weiß', 'Silber', 'Rot', 'Blau', 'Orange', 'Grün matt', 'Gelb', 'Grau metallic', 'Violett'];
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const plates = new Set(['DF 4207', 'DF 7777']);
  const plate = () => { let p; do { p = letters[int(0, 22)] + letters[int(0, 22)] + ' ' + int(1000, 9899); } while (plates.has(p)); plates.add(p); return p; };
  const ownerOrder = [3, 3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 19, 6, 10, 0];
  const V = [];
  for (const [i, ci] of ownerOrder.entries()) {
    let m = pick(models);
    if (ci === 15) m = ['Tarvos', 'Interceptor', 'Limousine'];
    if (ci === 16 || ci === 18) m = ['Tarvos', 'Hauler 3', 'Nutzfahrzeug'];
    if (ci === 17) m = ['Halden', 'Sedan 500', 'Limousine'];
    let p = plate(), km = int(4000, 160000), color = pick(colors);
    if (i === 0) { m = models[0]; p = 'DF 4207'; km = 38420; color = 'Orange'; }
    if (i === 1) { m = models[4]; p = 'DF 7777'; km = 12880; color = 'Schwarz'; }
    const status = i === 29 ? 'scrapped' : i === 12 ? 'stolen' : 'active';
    const v = await c.one(`INSERT INTO vehicles (plate, make, model, class_id, color, vin, km, owner_id, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - interval '200 days') RETURNING *`,
      [p, m[0], m[1], C[m[2]], color, 'RF' + int(100000, 999999), km, CU[ci].id, status]);
    if (i === 0) {
      await c.query(`INSERT INTO vehicle_owner_history (vehicle_id, customer_id, from_at, to_at) VALUES ($1, $2, $3, $4)`, [v.id, CU[7].id, addDays(T, -160), addDays(T, -89)]);
      await c.query(`INSERT INTO vehicle_owner_history (vehicle_id, customer_id, from_at) VALUES ($1, $2, $3)`, [v.id, CU[ci].id, addDays(T, -89)]);
      await c.query(`INSERT INTO vehicle_tuning (vehicle_id, category, level, source) VALUES ($1, 'Motor', 1, 'RFG-2026-0007'), ($1, 'Optik', 1, 'RFG-2026-0011'), ($1, 'Getriebe', 1, 'von Hand · Lena Brandt')`, [v.id]);
    } else {
      await c.query(`INSERT INTO vehicle_owner_history (vehicle_id, customer_id, from_at) VALUES ($1, $2, $3)`, [v.id, CU[ci].id, addDays(T, -200)]);
    }
    V.push(v);
  }

  // ---------- Nachweise & Lizenzen ----------
  const cert = (u, t, until, from = addDays(T, -60), src = 'manual') => c.query('INSERT INTO certificates (user_id, training_id, valid_from, valid_until, source) VALUES ($1,$2,$3,$4,$5)', [U[u], TR[t], from, until, src]);
  for (const u of ['Marco', 'Deniz', 'Jonas', 'Sophie', 'Tim']) await cert(u, 'Grundlagen Reparatur', addDays(T, int(60, 300)));
  await cert('Erik', 'Grundlagen Reparatur', addDays(T, -40), addDays(T, -405));
  for (const u of ['Marco', 'Deniz', 'Tim']) await cert(u, 'Tuning Stufe 1', addDays(T, int(40, 160)));
  await cert('Jonas', 'Tuning Stufe 1', addDays(T, 18));
  await cert('Marco', 'Tuning Stufe 2', addDays(T, 120)); await cert('Deniz', 'Tuning Stufe 2', addDays(T, 75));
  await cert('Marco', 'Tuning Stufe 3', addDays(T, 21));
  await cert('Jonas', 'Abschleppen & Sicherung', addDays(T, 200)); await cert('Tim', 'Abschleppen & Sicherung', addDays(T, -5), addDays(T, -370));
  await cert('Sophie', 'Lackieren & Folieren', addDays(T, 240)); await cert('Luca', 'Lackieren & Folieren', addDays(T, 300));
  for (const u of ['Marco', 'Deniz', 'Lena']) await cert(u, 'Kasse & Kundenservice', null);
  await cert('Mia', 'Grundlagen Reparatur', addDays(T, 330));
  const lic = [['Abschleppschein', 'Jonas', 'AS-2231', 'Stadtverwaltung', -133, 50, 'valid'], ['Abschleppschein', 'Tim', 'AS-2318', 'Stadtverwaltung', -175, 9, 'valid'], ['Führerschein LKW', 'Jonas', 'FL-88412', 'Fahrschule Mitte', -425, 305, 'valid'],
    ['Führerschein LKW', 'Marco', 'FL-80021', 'Fahrschule Mitte', -588, 142, 'valid'], ['Abschleppschein', 'Erik', 'AS-1977', 'Stadtverwaltung', -375, -194, 'revoked', 'Ausgeschieden, Schein zurückgegeben'],
    ['Abschleppschein', 'Mia', 'AS-2390', 'Stadtverwaltung', -41, 141, 'suspended', 'Unfall mit Abschleppwagen, Prüfung läuft'], ['Gewerbeschein', null, 'GW-RFG-0012', 'Stadtverwaltung', -254, 111, 'valid'], ['Abschlepp-Konzession', null, 'AK-0044', 'Polizeidepartment', -346, 19, 'valid']];
  for (const [t, u, no, iss, a, b, st, reason] of lic) await c.query('INSERT INTO licenses (type_id, user_id, no, issuer, issued, expires, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [LT[t], u ? U[u] : null, no, iss, addDays(T, a), addDays(T, b), st, reason || null]);

  // ---------- Schichten (4 Wochen) ----------
  const working = ['Lena', 'Marco', 'Deniz', 'Jonas', 'Sophie', 'Tim', 'Mia', 'Luca', 'Nora', 'Erik'];
  for (const u of working) {
    for (let d = -27; d < 0; d++) {
      const day = addDays(T, d);
      if (u === 'Luca' && d > -10) continue;
      if (u === 'Erik') continue;
      if (u === 'Nora' && d < -13) continue;
      if (rnd() < (u === 'Lena' ? 0.45 : 0.55)) continue;
      const start = int(16, 20), dur = int(2, 6);
      await c.query(`INSERT INTO shifts (user_id, started_at, ended_at) VALUES ($1, $2::timestamp, $2::timestamp + ($3 || ' hours')::interval + interval '17 minutes')`, [U[u], ts(day, String(start).padStart(2, '0') + ':' + String(int(0, 59)).padStart(2, '0')), String(dur)]);
    }
  }
  for (const [u, back] of [['Marco', 140], ['Deniz', 115], ['Jonas', 180], ['Tim', 55], ['Mia', 95]]) await c.query(`INSERT INTO shifts (user_id, started_at) VALUES ($1, now() - ($2 || ' minutes')::interval)`, [U[u], String(back)]);
  await c.query(`INSERT INTO shifts (user_id, started_at, ended_at, source, reason, edited_by) VALUES ($1, $2::timestamp, $2::timestamp + interval '3 hours 30 minutes', 'manual', 'Vergessen auszustempeln', $3)`, [U.Lena, ts(addDays(T, -4), '16:30'), U.Marco]);
  await c.query(`INSERT INTO absences (user_id, kind, from_day, to_day, note) VALUES ($1, 'Urlaub', $2, $3, 'Familienurlaub'), ($4, 'Abgemeldet', $5, $6, 'Prüfungswoche')`, [U.Luca, addDays(T, -7), addDays(T, 7), U.Sophie, addDays(T, 2), addDays(T, 4)]);

  // ---------- Aufträge ----------
  const acc = D.acc;
  const workers = ['Marco', 'Deniz', 'Jonas', 'Sophie', 'Tim', 'Mia'];
  const requests = ['Motor stottert beim Anfahren', 'Unfallschaden vorne links', 'Will mehr Leistung', 'Reifen abgefahren', 'Inspektion fällig', 'Neue Farbe, auffällig', 'Bremsen quietschen', 'Abgeschleppt nach Panne', 'Komplettpaket Optik', 'Fahrwerk tiefer'];
  const plan = ['cancelled', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'invoiced', 'invoiced', 'invoiced', 'invoiced', 'done', 'done', 'done',
    'waiting_parts', 'waiting_parts', 'in_progress', 'in_progress', 'in_progress', 'accepted', 'in_progress', 'accepted', 'accepted', 'quote', 'quote', 'quote'];
  const CLOSED = ['cancelled', 'picked_up', 'invoiced'];
  const labels = { quote: 'Angebot', accepted: 'Angenommen', in_progress: 'In Arbeit', waiting_parts: 'Wartet auf Teile', done: 'Fertig', invoiced: 'Abgerechnet', picked_up: 'Abgeholt', cancelled: 'Storniert' };
  const usable = Object.values(I).filter((x) => x.active && x.kind !== 'part');
  const ordersOut = [];
  let invIdx = 0;
  for (const [i, st] of plan.entries()) {
    const showcase = i === 21;
    const v = showcase ? V[0] : V[(i * 7 + 3) % 29];
    const cust = CU.find((x) => x.id === v.owner_id);
    const pg = await c.one('SELECT * FROM price_groups WHERE id = $1', [cust.price_group_id]);
    const created = showcase ? addDays(T, -1) : CLOSED.includes(st) ? addDays(T, -Math.round(19.5 - i * 1.6)) : addDays(T, -Math.max(0, Math.round((26 - i) / 4)) - int(0, 1));
    const due = st === 'quote' ? addDays(T, int(2, 5)) : addDays(created, CLOSED.includes(st) ? int(1, 3) : int(2, 5));
    const team = showcase ? ['Deniz', 'Mia'] : [pick(workers)];
    if (!showcase && rnd() > 0.6) team.push(pick(workers.filter((w) => w !== team[0])));
    const no = await nextNumber(c, 'order');
    const o = await c.one(`INSERT INTO orders (no, status, customer_id, vehicle_id, price_group_id, request, mileage, condition, due, bay_id, created_by, created_at, cancel_reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamp,$13) RETURNING *`,
    [no, st, cust.id, v.id, cust.price_group_id, showcase ? 'Will mehr Leistung und bessere Bremsen für die Rennstrecke' : pick(requests), v.km, showcase ? { Motor: 82, Karosserie: 64, Reifen: 41 } : { Motor: int(20, 100), Karosserie: int(15, 100), Reifen: int(30, 100) },
      due, pick(Object.values(D.bays)), U[team[0]], ts(created, '17:12'), st === 'cancelled' ? 'Kunde hat abgesagt' : null]);
    for (const t of team) await c.query('INSERT INTO order_assignees VALUES ($1, $2)', [o.id, U[t]]);
    let lines = [];
    if (showcase) {
      lines = [['Motor-Tuning Stufe 2', 1, 'Deniz'], ['Bremsen Stufe 2', 1, 'Mia'], ['Reifenwechsel (4 Stück)', 1, 'Mia'], ['Arbeitsstunde Mechanik', 2, 'Deniz']].map(([n, q2, by]) => [I[n], q2, by]);
    } else {
      const used = new Set();
      for (let j = 0, nn = int(1, 4); j < nn; j++) { const it = pick(usable); if (used.has(it.id)) continue; used.add(it.id); lines.push([it, it.kind === 'labor' ? int(1, 3) : 1, pick(team)]); }
    }
    const takenParts = !['quote', 'accepted', 'in_progress', 'waiting_parts', 'cancelled'].includes(st);
    const its = [];
    for (const [it, qty, by] of lines) {
      const unit = unitPrice(it, v.class_id);
      const disc = groupDiscount(pg, it);
      const parts = it.kind === 'part' && it.part_id ? [{ part: it.part_id, qty }] : it.parts ? it.parts.map((p) => ({ part: p.part, qty: Number(p.qty) * qty })) : null;
      const r = await c.one(`INSERT INTO order_items (order_id, catalog_item_id, name, kind, qty, unit_price, disc, by_user, parts, parts_taken, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamp) RETURNING id`,
        [o.id, it.id, it.name, it.kind, qty, unit, disc, U[by], parts ? JSON.stringify(parts) : null, takenParts && !!parts, ts(created, '18:00')]);
      its.push({ id: r.id, name: it.name, qty, unit, disc, parts, item: it });
      if (parts && ['quote', 'accepted', 'in_progress', 'waiting_parts'].includes(st)) for (const p of parts) await c.query('UPDATE parts SET reserved = reserved + $2 WHERE id = $1', [p.part, p.qty]);
    }
    const ev = ['Angenommen angelegt · km ' + v.km];
    if (!['quote', 'accepted', 'cancelled'].includes(st)) ev.push('In Arbeit');
    if (['done', 'invoiced', 'picked_up'].includes(st)) ev.push('Fertig');
    if (['invoiced', 'picked_up'].includes(st)) ev.push('Abgerechnet');
    if (st === 'picked_up') ev.push('Abgeholt');
    if (st === 'cancelled') ev.push('Storniert · Kunde hat abgesagt');
    if (st === 'waiting_parts') ev.push('Wartet auf Teile');
    for (const [k, e] of ev.entries()) await c.query(`INSERT INTO order_events (order_id, user_id, text, at) VALUES ($1, $2, $3, $4::timestamp + ($5 || ' minutes')::interval)`, [o.id, U[team[0]], e, ts(created, '17:12'), String(k * 37)]);
    if (showcase) {
      await c.query('INSERT INTO order_notes (order_id, author_id, body, at) VALUES ($1, $2, $3, now() - interval \'70 minutes\')', [o.id, U.Deniz, 'Turbo nicht nötig, Stufe 2 reicht für die Strecke. Kunde informiert.']);
      await c.query('INSERT INTO discount_requests (order_item_id, order_id, requested_by, pct, created_at) VALUES ($1, $2, $3, 15, now() - interval \'12 minutes\')', [its[1].id, o.id, U.Mia]);
      for (const u of ['Lena', 'Marco', 'Deniz']) await c.query(`INSERT INTO notifications (user_id, kind, text, link, tone, created_at) VALUES ($1, 'discount', $2, $3, 'accent', now() - interval '12 minutes')`, [U[u], `Rabattfreigabe: Mia Schulz möchte 15 % auf „Bremsen Stufe 2“ (${no})`, '#/auftrag/' + o.id]);
    }
    if (takenParts) for (const it of its) if (it.item.tuning) await c.query(`INSERT INTO vehicle_tuning (vehicle_id, category, level, source) VALUES ($1,$2,$3,$4) ON CONFLICT (vehicle_id, category) DO UPDATE SET level = greatest(vehicle_tuning.level, EXCLUDED.level)`, [v.id, it.item.tuning[0], it.item.tuning[1], no]);
    // Rechnung
    if (['invoiced', 'picked_up'].includes(st)) {
      const issued = addDays(created, 1);
      const totalC = its.reduce((s, l) => s + lineCents(l.qty, l.unit, l.disc), 0);
      const grossC = its.reduce((s, l) => s + lineCents(l.qty, l.unit, 0), 0);
      const invNo = await nextNumber(c, 'invoice');
      const snap = { firm: { name: 'Rostfrei Garage', address: 'Hafenstraße 12, Industriegebiet Süd', phone: '555-0142', footer: 'Zahlbar innerhalb von 3 Tagen. Danke für deinen Besuch – fahr vorsichtig!', logo: { kind: 'preset', preset: 'wrench' } }, customer: { name: cust.name, kind: cust.kind, phone: cust.phone, priceGroup: pg.name }, vehicle: { plate: v.plate, make: v.make, model: v.model }, ref: no, lines: its.map((l) => ({ name: l.name, qty: l.qty, unit: l.unit, disc: l.disc, total: lineCents(l.qty, l.unit, l.disc) / 100 })), gross: grossC / 100, discount: (grossC - totalC) / 100, total: totalC / 100 };
      let status = st === 'picked_up' ? 'paid' : ['open', 'partial', 'open', 'paid'][invIdx % 4];
      invIdx++;
      const terms = cust.terms_days || 3;
      const inv = await c.one(`INSERT INTO invoices (no, order_id, customer_id, issued, due, total, status, snapshot, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9::timestamp) RETURNING id`,
        [invNo, o.id, cust.id, issued, addDays(issued, terms), (totalC / 100).toFixed(2), snap, U.Lena, ts(issued, '19:00')]);
      const payC = status === 'paid' ? totalC : status === 'partial' ? Math.round(totalC / 200) * 100 : 0;
      if (payC > 0) {
        const account = rnd() < 0.5 ? acc.Bargeldkasse : acc.Firmenkonto;
        const method = account === acc.Bargeldkasse ? 'Bar' : pick(['Karte', 'Überweisung']);
        const pd = (() => { const d = addDays(issued, status === 'paid' ? int(0, 4) : int(0, 2)); return d > T ? T : d; })();
        await c.query('INSERT INTO invoice_payments (invoice_id, amount, method, account_id, at, by_user) VALUES ($1,$2,$3,$4,$5,$6)', [inv.id, (payC / 100).toFixed(2), method, account, pd, U.Lena]);
        await c.query('UPDATE invoices SET paid = $2, status = $3 WHERE id = $1', [inv.id, (payC / 100).toFixed(2), payC >= totalC ? 'paid' : 'partial']);
        await c.query(`INSERT INTO transactions (account_id, type, amount, title, category, source, source_id, booked_at, created_by) VALUES ($1,'income',$2,$3,'Rechnungen','invoice',$4,$5,$6)`, [account, (payC / 100).toFixed(2), `Rechnung ${invNo} · ${cust.name}`, inv.id, pd, U.Lena]);
        const rate = pd >= addDays(T, -23) ? 10 : 8;
        const share = (Math.round(payC * rate / 100) / 100).toFixed(2);
        await c.query(`INSERT INTO transactions (account_id, type, amount, title, category, source, booked_at) VALUES ($1,'transfer_out',$2,$3,'Umbuchung','reserve',$4), ($5,'transfer_in',$2,$3,'Umbuchung','reserve',$4)`, [account, share, `Steuer-Rücklage · ${invNo}`, pd, acc['Steuer-Rücklage']]);
      }
    }
    ordersOut.push({ ...o, its });
  }

  // Freie Rechnungen (überfällig) für den gesperrten Kunden
  for (const [days, amount] of [[-24, 1850], [-19, 920]]) {
    const invNo = await nextNumber(c, 'invoice');
    const cust = CU[13];
    await c.query(`INSERT INTO invoices (no, customer_id, issued, due, total, status, snapshot, created_by) VALUES ($1,$2,$3,$4,$5,'open',$6,$7)`,
      [invNo, cust.id, addDays(T, days), addDays(T, days + 3), amount, { firm: { name: 'Rostfrei Garage', address: 'Hafenstraße 12, Industriegebiet Süd', phone: '555-0142', footer: 'Zahlbar innerhalb von 3 Tagen.' }, customer: { name: cust.name, kind: 'person', phone: cust.phone, priceGroup: 'Standard' }, vehicle: null, ref: '', lines: [{ name: 'Reparatur Karosserie komplett + Abschleppen', qty: 1, unit: amount, disc: 0, total: amount }], gross: amount, discount: 0, total: amount }, U.Lena]);
  }
  await c.query(`UPDATE customers SET blocked = 'Zwei offene Rechnungen seit Oktober – erst nach Zahlung wieder annehmen' WHERE id = $1`, [CU[13].id]);

  // ---------- Buchungen, Daueraufträge ----------
  const tx2 = (d, type, account, amount, title, cat, source = 'manual', taxable = false) => c.query(`INSERT INTO transactions (account_id, type, amount, title, category, source, taxable, booked_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [account, type, amount, title, cat, source, taxable, addDays(T, d), U.Lena]);
  await tx2(-60, 'income', acc.Firmenkonto, 60000, 'Startkapital Gesellschafter', 'Einlage');
  await tx2(-58, 'income', acc.Bargeldkasse, 2000, 'Wechselgeld Startbestand', 'Einlage');
  await tx2(-58, 'transfer_out', acc.Firmenkonto, 1500, 'Startbestand Steuer-Rücklage', 'Umbuchung', 'transfer');
  await tx2(-58, 'transfer_in', acc['Steuer-Rücklage'], 1500, 'Startbestand Steuer-Rücklage', 'Umbuchung', 'transfer');
  for (const w of [-28, -21, -14, -7]) await tx2(w, 'expense', acc.Firmenkonto, 1500, 'Miete Halle (Dauerauftrag)', 'Miete', 'recurring');
  await tx2(-20, 'expense', acc.Firmenkonto, 2200, 'Wareneingang Turbolader', 'Teileeinkauf', 'stock');
  await tx2(-6, 'expense', acc.Firmenkonto, 1250, 'Wareneingang Bremsscheiben', 'Teileeinkauf', 'stock');
  await tx2(-3, 'expense', acc.Firmenkonto, 450, 'Werkzeug Drehmomentschlüssel', 'Ausstattung');
  await tx2(-5, 'expense', acc.Firmenkonto, 300, 'Strafzettel Abschleppwagen', 'Strafen');
  await tx2(-8, 'income', acc.Firmenkonto, 500, 'Sponsoring Rennevent', 'Sonstiges', 'manual', true);
  await c.query(`INSERT INTO recurring_rules (name, account_id, type, amount, category, every, next_run) VALUES ('Miete Halle', $1, 'expense', 1500, 'Miete', 'weekly', $2), ('Versicherung Abschleppwagen', $1, 'expense', 400, 'Versicherung', 'monthly', $3), ('Gewerbeschein-Gebühr', $1, 'expense', 2500, 'Gebühren', 'yearly', $4)`,
    [acc.Firmenkonto, addDays(T, 0 + 7 - ((new Date(T).getDay() + 6) % 7)), addDays(T, 20), addDays(T, 111)]);
  await c.query(`INSERT INTO cash_closings (account_id, day, expected, counted, reason, by_user) VALUES ($1, $2, 3430, 3410, 'Wechselgeld', $3)`, [acc.Bargeldkasse, addDays(T, -1), U.Lena]);

  // Steuer: Satz 8 % seit Jahresbeginn, 10 % seit 23 Tagen
  await c.query('UPDATE tax_rates SET valid_from = $1, by_user = $2', [T.slice(0, 4) + '-01-01', U.Lena]);
  await c.query('INSERT INTO tax_rates (rate, valid_from, by_user) VALUES (10, $1, $2)', [addDays(T, -23), U.Lena]);
  await c.query(`INSERT INTO board_posts (title, body, pinned, author_id, at) VALUES ($1, $2, true, $3, $4::timestamp)`, ['Neue Steuer: 10 % ab ' + addDays(T, -23).split('-').reverse().join('.'), 'Die Stadt hat den Steuersatz auf **10 %** angehoben. Preise bleiben gleich, das System rechnet automatisch. Rücklage läuft weiter mit.', U.Lena, ts(addDays(T, -23), '20:00')]);
  await c.query(`INSERT INTO board_posts (title, body, author_id, at) VALUES ('Rennevent am Samstag – alle Hände gebraucht', 'Wir stellen den Pannendienst an der Rennstrecke. Bitte im Dienstplan eintragen, wer kann.', $1, now() - interval '2 days'), ('Lager: Motoröl knapp', 'Bitte bei Ölwechseln vorher Bestand prüfen, Lieferung kommt Freitag.', $2, now() - interval '1 day')`, [U.Marco, U.Deniz]);
  const posts = await c.q('SELECT id FROM board_posts');
  for (const [k, p] of posts.entries()) for (const u of Object.values(U).slice(0, [9, 6, 4][k] || 3)) await c.query('INSERT INTO board_reads (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [p.id, u]);

  // ---------- Schulungstermine ----------
  const sess = [['Tuning Stufe 1', 2, '19:00', 'Halle 2', 'Marco', ['Mia', 'Sophie', 'Jonas'], false], ['Grundlagen Reparatur', 4, '18:30', 'Schulungsraum', 'Deniz', ['Nora'], false],
    ['Abschleppen & Sicherung', 6, '20:00', 'Abschlepphof', 'Jonas', ['Tim'], false], ['Tuning Stufe 2', -6, '19:00', 'Halle 2', 'Marco', ['Deniz', 'Tim'], true]];
  for (const [t, d, time, loc, trainer, parts, done] of sess) {
    const s = await c.one('INSERT INTO training_sessions (training_id, day, time, location, trainer_id, done) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [TR[t], addDays(T, d), time, loc, U[trainer], done]);
    for (const p of parts) await c.query('INSERT INTO training_participants (session_id, user_id, result) VALUES ($1, $2, $3)', [s.id, U[p], done ? (p === 'Tim' ? 'failed' : 'passed') : 'registered']);
  }

  // ---------- Personalakten ----------
  const se = [['Mia', 'Verwarnung', 1, -24, 'Marco', 'Abschleppwagen ohne Sicherung bewegt. Nachschulung „Abschleppen & Sicherung“ angeordnet.', true, addDays(T, 68)], ['Mia', 'Belobigung', null, -9, 'Deniz', 'Sehr sauber gearbeitet beim Großauftrag Hafenlogistik.', true, null],
    ['Tim', 'Gespräch', null, -12, 'Lena', 'Zielvereinbarung: Tuning Stufe 2 bis Ende des Monats.', false, null], ['Erik', 'Austritt', null, -42, 'Lena', 'Auf eigenen Wunsch ausgeschieden. Schlüssel und Schein zurückgegeben.', false, null]];
  for (const [u, kind, level, d, a, text, self, exp] of se) await c.query('INSERT INTO staff_entries (user_id, kind, level, day, author_id, text, self_visible, expires) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [U[u], kind, level, addDays(T, d), U[a], text, self, exp]);

  // ---------- Termine & Einsätze ----------
  const showcaseOrder = ordersOut[21];
  const appts = [[0, 'Hebebühne 1', '17:00–18:30', 'Inspektion', 5, null], [0, 'Hebebühne 2', '16:00–21:00', showcaseOrder.no, 3, showcaseOrder.id], [0, 'Lackierkabine', '19:00–22:00', 'Lackierung komplett', 10, null],
    [1, 'Hebebühne 1', '18:00–19:00', 'Reifenwechsel', 17, null], [1, 'Hebebühne 3', '17:30–20:00', 'Reparatur Motor', 1, null], [2, 'Hebebühne 2', '19:00–21:00', 'Bremsen Stufe 2', 0, null],
    [3, 'Außenplatz', '16:00–17:00', 'Fahrzeugübergabe Flotte', 18, null], [4, 'Hebebühne 1', '20:00–22:00', 'Turbo-Einbau', 6, null], [4, 'Lackierkabine', '18:00–20:00', 'Perleffekt-Lack', 12, null], [-2, 'Hebebühne 1', '17:00–19:00', 'Ölwechsel', 2, null]];
  for (const [d, bay, time, title, ci, oid] of appts) await c.query('INSERT INTO appointments (day, time, bay_id, title, customer_id, order_id) VALUES ($1,$2,$3,$4,$5,$6)', [addDays(T, d), time, D.bays[bay], title, CU[ci].id, oid]);
  const co = [[-0.05, 'Autobahnauffahrt Nord, km 12', 'Polizeidepartment', 15, 17, 'Jonas', 'en_route', 'Abschleppen Stadt'], [-0.1, 'Parkplatz Einkaufszentrum', 'Kunde', 8, 9, 'Tim', 'on_site', 'Anfahrtspauschale'],
    [-0.15, 'Strandpromenade 4', 'Kunde', 11, null, null, 'open', 'Anfahrtspauschale'], [-1, 'Bergstraße Kehre 3', 'Rettungsdienst Süd', 16, 19, 'Jonas', 'done', 'Abschleppen Stadt'], [-1.2, 'Hafen Tor 2', 'Kunde', 18, 24, 'Tim', 'done', 'Abschleppen Stadt'], [-2, 'Tankstelle Ost', 'Kunde', 4, null, 'Jonas', 'cancelled', 'Anfahrtspauschale']];
  for (const [d, loc, by, ci, vi, drv, st, item] of co) {
    const no = await nextNumber(c, 'callout');
    const it = I[item];
    const fee = vi !== null ? unitPrice(it, V[vi].class_id) : Number(it.price);
    await c.query(`INSERT INTO callouts (no, at, location, requested_by, customer_id, vehicle_id, driver_id, status, fee, catalog_item_id) VALUES ($1, now() + ($2 || ' hours')::interval, $3,$4,$5,$6,$7,$8,$9,$10)`, [no, String(Math.round(d * 24)), loc, by, CU[ci].id, vi !== null ? V[vi].id : null, drv ? U[drv] : null, st, st === 'cancelled' ? 0 : fee, it.id]);
  }

  // ---------- Tickets, Benachrichtigungen, Audit ----------
  await c.query(`INSERT INTO tickets (title, body, page, status, by_user, at) VALUES ('Rechnung als PDF schneidet Logo ab', 'Beim Drucken ist das Logo halb weg.', 'Rechnungen', 'open', $1, now() - interval '1 day'), ('Kennzeichen mit Leerzeichen werden nicht gefunden', 'Suche nach „DF4207“ findet nichts.', 'Suche', 'in_progress', $2, now() - interval '3 days'), ('Dienstplan zeigt Nachtschicht am falschen Tag', '', 'Dienstplan', 'done', $3, now() - interval '8 days')`, [U.Sophie, U.Jonas, U.Tim]);
  for (const u of ['Lena', 'Marco']) {
    await c.query(`INSERT INTO notifications (user_id, kind, text, link, tone) VALUES ($1, 'license', 'Abschlepp-Konzession (Firma) läuft in 19 Tagen ab', '#/lizenzen?tab=firma', 'warn'), ($1, 'stock', 'Motoröl 5 L unter Mindestbestand (8 / 10)', '#/lager', 'warn')`, [U[u]]);
  }
  await c.query(`INSERT INTO audit_log (user_id, area, action, detail, ip, at) VALUES ($1, 'Server', 'Demo-Daten', 'Test-Instanz mit Beispieldaten gefüllt', '127.0.0.1', now())`, [U.Lena]);

  // Lagerbestand-Bewegungen als Historie
  for (const [k, qty, kind, reason, d] of [['turbo', 2, 'in', 'Lieferung Teilehandel', -20], ['brems', 2, 'in', 'Lieferung Teilehandel', -6], ['kit', -1, 'adjust', 'Beschädigt beim Einbau', -2]]) {
    await c.query(`INSERT INTO stock_movements (part_id, qty, kind, reason, by_user, at) VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval)`, [P[k], qty, kind, reason, U.Deniz, String(d)]);
  }
});

// Steuern abführen und Lohnläufe für ältere Wochen (nach dem Commit, damit die Berechnung die Daten sieht)
const { q, one } = await import('./db.js');
const users = await q(`SELECT id FROM users WHERE email = 'lena.brandt@rostfrei.rp'`);
const lena = users[0].id;
const reserve = (await one(`SELECT id FROM accounts WHERE kind = 'tax_reserve'`)).id;
const bank = (await one(`SELECT id FROM accounts WHERE name = 'Firmenkonto'`)).id;
for (const back of [4, 3, 2]) {
  const p = periodBounds('week', addDays(weekStart(T), -7 * back));
  const r = await computeTaxPeriod(p.from, p.to);
  let tId = null;
  if (r.taxC > 0) tId = (await one(`INSERT INTO transactions (account_id, type, amount, title, category, source, booked_at, created_by) VALUES ($1, 'expense', $2, $3, 'Steuern', 'tax', $4, $5) RETURNING id`, [reserve, (r.taxC / 100).toFixed(2), `Steuern ${p.label} abgeführt`, addDays(p.to, 2), lena])).id;
  await q('INSERT INTO tax_periods (period_from, period_to, revenue, tax, filed_by, filed_at, account_id, transaction_id) VALUES ($1,$2,$3,$4,$5,$6::date + 2,$7,$8)', [p.from, p.to, (r.revenueC / 100).toFixed(2), (r.taxC / 100).toFixed(2), lena, p.to, reserve, tId]);
}
for (const back of [3, 2]) {
  const p = periodBounds('week', addDays(weekStart(T), -7 * back));
  const lines = await computePayroll(p.from, p.to);
  const total = lines.reduce((s, l) => s + cents(l.total), 0);
  const run = await one('INSERT INTO payroll_runs (period_from, period_to, total, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5::date + 1) RETURNING id', [p.from, p.to, (total / 100).toFixed(2), lena, p.to]);
  for (const l of lines) {
    const u = await one('SELECT name FROM users WHERE id = $1', [l.user]);
    const t = await one(`INSERT INTO transactions (account_id, type, amount, title, category, source, booked_at, created_by) VALUES ($1,'expense',$2,$3,'Löhne','payroll',$4,$5) RETURNING id`, [bank, l.total.toFixed(2), `Lohn ${p.label} · ${u.name}`, addDays(p.to, 1), lena]);
    await q('INSERT INTO payroll_lines (run_id, user_id, hours, hourly, commission_base, commission, fixed, total, transaction_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [run.id, l.user, l.hours, l.hourly, l.base, l.commission, l.fixed, l.total, t.id]);
  }
}
console.log(`Demo-Daten angelegt. Anmeldung z. B. mit lena.brandt@rostfrei.rp (Inhaberin + Admin) – Passwort: ${PW}`);
console.log('Weitere Konten: marco.vogt@, deniz.aydin@, tim.becker@, mia.schulz@, nora.weiss@, kai.neumann@rostfrei.rp (gleiches Passwort)');
await pool.end();
void MODULES; void isoWeek;
