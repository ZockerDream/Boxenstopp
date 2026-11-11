/* Boxenstopp – Beispieldaten für das Mockup. Alles frei erfunden. */
(function () {
  'use strict';

  // Deterministischer Zufall, damit das Mockup bei jedem Laden gleich aussieht.
  let seed = 20261111;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const TODAY = '2026-11-11';
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  const firm = {
    name: 'Rostfrei Garage', short: 'RFG', address: 'Hafenstraße 12, Industriegebiet Süd', phone: '555-0142',
    hours: 'Mo–So 16:00–02:00', taxRate: 10, taxPeriod: 'Woche', currency: '$',
    invoiceFooter: 'Zahlbar innerhalb von 3 Tagen. Danke für deinen Besuch – fahr vorsichtig!',
  };

  const ranks = [
    { id: 'r1', name: 'Geschäftsführung', pos: 6, pay: 'Fixum $ 4.000 / Woche' },
    { id: 'r2', name: 'Werkstattleitung', pos: 5, pay: '$ 180 / h + 8 % Provision' },
    { id: 'r3', name: 'Meister', pos: 4, pay: '$ 150 / h + 6 % Provision' },
    { id: 'r4', name: 'Mechaniker', pos: 3, pay: '$ 120 / h + 5 % Provision' },
    { id: 'r5', name: 'Azubi', pos: 2, pay: '$ 80 / h' },
    { id: 'r6', name: 'Praktikant', pos: 1, pay: '$ 50 / h' },
  ];

  const groups = [
    { id: 'g1', name: 'Tuning', desc: 'Motor- und Fahrwerkstuning' },
    { id: 'g2', name: 'Abschleppdienst', desc: 'Einsätze vor Ort, Abschleppwagen' },
    { id: 'g3', name: 'Lackiererei', desc: 'Lackierkabine und Folierung' },
    { id: 'g4', name: 'Ausbilder', desc: 'Schulungen und Prüfungen' },
    { id: 'g5', name: 'Buchhaltung', desc: 'Rechnungen, Kasse, Steuern, Lohn' },
  ];

  const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#ec4899', '#84cc16', '#6366f1', '#f97316', '#0ea5e9'];
  const staff = [
    { id: 'u1', name: 'Lena Brandt', rank: 'r1', groups: ['g5', 'g4'], owner: true, sys: ['admin'], staffNo: 'P-001', dutyNo: '01', phone: '555-0101', joined: '2025-03-02', status: 'active' },
    { id: 'u2', name: 'Marco Vogt', rank: 'r2', groups: ['g1', 'g4'], sys: [], staffNo: 'P-002', dutyNo: '02', phone: '555-0102', joined: '2025-03-02', status: 'active' },
    { id: 'u3', name: 'Deniz Aydin', rank: 'r3', groups: ['g1'], sys: [], staffNo: 'P-004', dutyNo: '04', phone: '555-0104', joined: '2025-05-14', status: 'active' },
    { id: 'u4', name: 'Jonas Keller', rank: 'r4', groups: ['g2'], sys: [], staffNo: 'P-006', dutyNo: '06', phone: '555-0106', joined: '2025-07-21', status: 'active' },
    { id: 'u5', name: 'Sophie Hartmann', rank: 'r4', groups: ['g3'], sys: [], staffNo: 'P-007', dutyNo: '07', phone: '555-0107', joined: '2025-08-03', status: 'active' },
    { id: 'u6', name: 'Tim Becker', rank: 'r4', groups: ['g2', 'g1'], sys: [], staffNo: 'P-009', dutyNo: '09', phone: '555-0109', joined: '2025-10-11', status: 'active' },
    { id: 'u7', name: 'Mia Schulz', rank: 'r5', groups: [], sys: [], staffNo: 'P-012', dutyNo: '12', phone: '555-0112', joined: '2026-06-30', status: 'active' },
    { id: 'u8', name: 'Luca Romano', rank: 'r5', groups: ['g3'], sys: [], staffNo: 'P-013', dutyNo: '13', phone: '555-0113', joined: '2026-08-08', status: 'leave' },
    { id: 'u9', name: 'Nora Weiß', rank: 'r6', groups: [], sys: [], staffNo: 'P-015', dutyNo: '15', phone: '555-0115', joined: '2026-10-28', status: 'active' },
    { id: 'u10', name: 'Erik Lange', rank: 'r4', groups: [], sys: [], staffNo: 'P-005', dutyNo: '05', phone: '555-0105', joined: '2025-06-01', status: 'left', left: '2026-09-30' },
    { id: 'u11', name: 'Kai Neumann', rank: null, groups: [], sys: ['support'], staffNo: '–', dutyNo: '–', phone: '–', joined: '2026-01-15', status: 'active' },
  ];
  staff.forEach((s, i) => {
    s.color = COLORS[i % COLORS.length];
    s.email = s.name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(' ', '.') + '@rostfrei.rp';
    s.twofa = ['u1', 'u2', 'u3', 'u11', 'u5'].includes(s.id);
    s.lastLogin = s.status === 'left' ? '2026-09-30 22:14' : addDays(TODAY, -int(0, 3)) + ' ' + String(int(16, 23)).padStart(2, '0') + ':' + String(int(0, 59)).padStart(2, '0');
  });

  // Rechte der Ränge: Stufe 0..4 je Funktion
  const modules = [
    ['staff', 'Mitarbeiter'], ['ranks', 'Ränge & Gruppen'], ['perms', 'Berechtigungen'], ['customers', 'Kunden'], ['vehicles', 'Fahrzeuge'],
    ['orders', 'Aufträge'], ['appointments', 'Termine'], ['callouts', 'Einsätze'], ['catalog', 'Preisliste'], ['stock', 'Lager'],
    ['invoices', 'Rechnungen'], ['accounts', 'Konten & Buchungen'], ['tax', 'Steuern'], ['payroll', 'Lohn & Provision'], ['reports', 'Berichte'],
    ['shifts', 'Dienstplan'], ['trainings', 'Schulungen'], ['licenses', 'Lizenzen'], ['stafffiles', 'Personalakten'], ['board', 'Schwarzes Brett'], ['settings', 'Firmen-Einstellungen'],
  ];
  const L = (s) => Object.fromEntries(modules.map(([k], i) => [k, Number(s[i])]));
  // Reihenfolge wie modules: st ra pe cu ve or ap ca ct sk in ac tx pa re sh tr li sf bo se
  const rankPerms = {
    r1: L('444444444444444444444'),
    r2: L('443444444443334444443'),
    r3: L('220334332332012332230'),
    r4: L('200333332220010111020'),
    r5: L('200221222200010111020'),
    r6: L('200221202000010110020'),
  };
  const groupPerms = {
    g1: { catalog: 3 },
    g2: { callouts: 4 },
    g3: { appointments: 3 },
    g4: { trainings: 4, licenses: 3 },
    g5: { invoices: 4, accounts: 4, tax: 4, payroll: 3, reports: 2 },
  };
  const userPerms = { u6: { invoices: 3 }, u4: { stafffiles: 0 } };
  const flags = [
    { key: 'rabatt.max_prozent', label: 'Max. Rabatt ohne Freigabe', type: 'percent', ranks: { r1: 100, r2: 30, r3: 20, r4: 10, r5: 0, r6: 0 }, groups: { g5: 25 } },
    { key: 'auftrag.preis_aendern', label: 'Vom Preis abweichen', type: 'bool', ranks: { r1: 1, r2: 1, r3: 1, r4: 0, r5: 0, r6: 0 }, groups: {} },
    { key: 'rechnung.storno', label: 'Rechnungen stornieren', type: 'bool', ranks: { r1: 1, r2: 1, r3: 0, r4: 0, r5: 0, r6: 0 }, groups: { g5: 1 } },
    { key: 'kasse.abschluss', label: 'Tagesabschluss', type: 'bool', ranks: { r1: 1, r2: 1, r3: 1, r4: 0, r5: 0, r6: 0 }, groups: { g5: 1 } },
    { key: 'personal.lohn_sehen', label: 'Löhne anderer sehen', type: 'bool', ranks: { r1: 1, r2: 1, r3: 0, r4: 0, r5: 0, r6: 0 }, groups: { g5: 1 } },
  ];

  const vehicleClasses = [
    { id: 'kompakt', name: 'Kompakt' }, { id: 'limo', name: 'Limousine' }, { id: 'sport', name: 'Sport' }, { id: 'super', name: 'Super' },
    { id: 'suv', name: 'SUV' }, { id: 'moto', name: 'Motorrad' }, { id: 'nutz', name: 'Nutzfahrzeug' },
  ];

  const priceGroups = [
    { id: 'pg1', name: 'Standard', pct: 0, isDefault: true },
    { id: 'pg2', name: 'Stammkunde', pct: 10 },
    { id: 'pg3', name: 'Behörde', pct: 20, cats: { c3: 10 } },
    { id: 'pg4', name: 'Mitarbeiter', pct: 30 },
  ];

  const trainings = [
    { id: 't1', name: 'Grundlagen Reparatur', months: 12, test: true, desc: 'Motor, Karosserie, Reifen – Pflicht für alle Mechaniker.' },
    { id: 't2', name: 'Tuning Stufe 1', months: 6, test: true, desc: 'Einfache Leistungssteigerung, Bremsen, Federung.' },
    { id: 't3', name: 'Tuning Stufe 2', months: 6, test: true, desc: 'Motor-Tuning Stufe 2, Turbo-Einbau.' },
    { id: 't4', name: 'Tuning Stufe 3', months: 6, test: false, desc: 'Vollausbau. Praktische Prüfung beim Werkstattleiter.' },
    { id: 't5', name: 'Abschleppen & Sicherung', months: 12, test: true, desc: 'Sicheres Verladen, Einsatzabsicherung.' },
    { id: 't6', name: 'Lackieren & Folieren', months: 12, test: false, desc: 'Lackierkabine, Effektlacke, Folien.' },
    { id: 't7', name: 'Kasse & Kundenservice', months: null, test: true, desc: 'Rechnungen, Zahlungen, Tagesabschluss.' },
  ];
  const licenseTypes = [
    { id: 'lt1', name: 'Abschleppschein', holder: 'member', months: 6 },
    { id: 'lt2', name: 'Führerschein LKW', holder: 'member', months: 24 },
    { id: 'lt3', name: 'Gewerbeschein', holder: 'firm', months: 12 },
    { id: 'lt4', name: 'Abschlepp-Konzession', holder: 'firm', months: 12 },
  ];
  const rankReq = { r4: ['t1'], r3: ['t1', 't2', 't7'], r2: ['t1', 't2', 't3', 't7'], r1: [] };

  const categories = [
    { id: 'c1', name: 'Reparatur' }, { id: 'c2', name: 'Wartung' }, { id: 'c3', name: 'Tuning Motor' }, { id: 'c4', name: 'Tuning Fahrwerk' },
    { id: 'c5', name: 'Optik' }, { id: 'c6', name: 'Lackierung' }, { id: 'c7', name: 'Abschleppen & Einsätze' }, { id: 'c8', name: 'Teileverkauf' },
  ];

  const parts = [
    { id: 'p1', sku: 'T-REIF-01', name: 'Reifen Allround', unit: 'Stk', stock: 22, reserved: 4, min: 16, loc: 'Regal A1', buy: 40, sell: 75 },
    { id: 'p2', sku: 'T-OEL-5L', name: 'Motoröl 5 L', unit: 'Stk', stock: 6, reserved: 2, min: 10, loc: 'Regal B2', buy: 25, sell: 60 },
    { id: 'p3', sku: 'T-TURBO', name: 'Turbolader', unit: 'Stk', stock: 2, reserved: 1, min: 2, loc: 'Lager hinten', buy: 2200, sell: 3500 },
    { id: 'p4', sku: 'T-REPKIT', name: 'Reparaturkit', unit: 'Stk', stock: 14, reserved: 3, min: 5, loc: 'Regal A3', buy: 120, sell: 250 },
    { id: 'p5', sku: 'T-BREMS', name: 'Bremsscheiben Sport (Satz)', unit: 'Satz', stock: 3, reserved: 1, min: 4, loc: 'Regal C1', buy: 600, sell: 1100 },
    { id: 'p6', sku: 'T-LACK-L', name: 'Lack (Liter)', unit: 'L', stock: 30, reserved: 6, min: 10, loc: 'Lackierkabine', buy: 18, sell: 45 },
    { id: 'p7', sku: 'T-XENON', name: 'Xenon-Set', unit: 'Set', stock: 5, reserved: 0, min: 2, loc: 'Regal D2', buy: 250, sell: 480 },
    { id: 'p8', sku: 'T-FEDER', name: 'Sportfedern (Satz)', unit: 'Satz', stock: 4, reserved: 1, min: 2, loc: 'Regal C2', buy: 900, sell: 1600 },
  ];

  // price_kind: flat | labor | part | bundle. surcharge: Aufschlag je Klasse in %, classPrices: feste Preise je Klasse
  const catalog = [
    { id: 'i1', cat: 'c1', name: 'Reparatur Motor', kind: 'flat', unit: 'pauschal', price: 450, surcharge: { sport: 20, super: 50, moto: -30, nutz: 25 }, material: 120, minutes: 20, warranty: 7, parts: [{ part: 'p4', qty: 1 }] },
    { id: 'i2', cat: 'c1', name: 'Reparatur Karosserie komplett', kind: 'flat', unit: 'pauschal', price: 600, surcharge: { super: 50, suv: 15, nutz: 30, moto: -40 }, material: 150, minutes: 25, warranty: 7 },
    { id: 'i3', cat: 'c1', name: 'Arbeitsstunde Mechanik', kind: 'labor', unit: 'Std', price: 120, material: 0, minutes: 60 },
    { id: 'i4', cat: 'c1', name: 'Reifenwechsel (4 Stück)', kind: 'bundle', unit: 'pauschal', price: 340, material: 160, minutes: 15, parts: [{ part: 'p1', qty: 4 }], classPrices: { moto: 190, nutz: 520 } },
    { id: 'i5', cat: 'c2', name: 'Ölwechsel', kind: 'bundle', unit: 'pauschal', price: 150, material: 25, minutes: 10, parts: [{ part: 'p2', qty: 1 }] },
    { id: 'i6', cat: 'c2', name: 'Inspektion', kind: 'flat', unit: 'pauschal', price: 250, material: 20, minutes: 20, warranty: 14 },
    { id: 'i7', cat: 'c3', name: 'Motor-Tuning Stufe 1', kind: 'flat', unit: 'pauschal', price: 2500, classPrices: { super: 4000, moto: 1500 }, material: 600, minutes: 30, req: ['t2'], group: 'g1', tuning: ['Motor', 1], warranty: 30 },
    { id: 'i8', cat: 'c3', name: 'Motor-Tuning Stufe 2', kind: 'flat', unit: 'pauschal', price: 5000, classPrices: { super: 8000, moto: 3000 }, material: 1400, minutes: 45, req: ['t3'], group: 'g1', tuning: ['Motor', 2], warranty: 30 },
    { id: 'i9', cat: 'c3', name: 'Motor-Tuning Stufe 3', kind: 'flat', unit: 'pauschal', price: 9500, classPrices: { super: 15000 }, material: 3000, minutes: 60, req: ['t4'], group: 'g1', tuning: ['Motor', 3], warranty: 30 },
    { id: 'i10', cat: 'c3', name: 'Turbo-Einbau', kind: 'bundle', unit: 'pauschal', price: 7500, material: 2200, minutes: 45, req: ['t3'], group: 'g1', parts: [{ part: 'p3', qty: 1 }], tuning: ['Turbo', 1], warranty: 30 },
    { id: 'i11', cat: 'c4', name: 'Bremsen Stufe 2', kind: 'bundle', unit: 'pauschal', price: 3200, material: 600, minutes: 30, req: ['t2'], parts: [{ part: 'p5', qty: 1 }], tuning: ['Bremsen', 2], warranty: 30 },
    { id: 'i12', cat: 'c4', name: 'Federung Sport', kind: 'bundle', unit: 'pauschal', price: 2800, material: 900, minutes: 30, req: ['t2'], parts: [{ part: 'p8', qty: 1 }], tuning: ['Federung', 2], warranty: 30 },
    { id: 'i13', cat: 'c5', name: 'Scheibentönung', kind: 'flat', unit: 'pauschal', price: 400, material: 60, minutes: 15, tuning: ['Optik', 1] },
    { id: 'i14', cat: 'c5', name: 'Xenon-Scheinwerfer', kind: 'bundle', unit: 'pauschal', price: 650, material: 250, minutes: 15, parts: [{ part: 'p7', qty: 1 }], tuning: ['Optik', 1] },
    { id: 'i15', cat: 'c6', name: 'Lackierung komplett', kind: 'flat', unit: 'pauschal', price: 1800, surcharge: { super: 40, suv: 20, nutz: 50, moto: -40 }, material: 180, minutes: 40, req: ['t6'], group: 'g3', parts: [{ part: 'p6', qty: 4 }] },
    { id: 'i16', cat: 'c6', name: 'Perleffekt-Lack', kind: 'flat', unit: 'pauschal', price: 900, material: 120, minutes: 20, req: ['t6'], group: 'g3' },
    { id: 'i17', cat: 'c7', name: 'Abschleppen Stadt', kind: 'flat', unit: 'pauschal', price: 350, classPrices: { nutz: 700, moto: 200 }, material: 30, minutes: 20, req: ['lt1'], group: 'g2' },
    { id: 'i18', cat: 'c7', name: 'Anfahrtspauschale', kind: 'flat', unit: 'pauschal', price: 150, material: 0, minutes: 10 },
    { id: 'i19', cat: 'c7', name: 'Pannenhilfe vor Ort', kind: 'labor', unit: 'Std', price: 180, material: 0, minutes: 60, group: 'g2' },
    { id: 'i20', cat: 'c8', name: 'Reifen Allround', kind: 'part', unit: 'Stk', part: 'p1', price: 75, material: 40 },
    { id: 'i21', cat: 'c8', name: 'Reparaturkit', kind: 'part', unit: 'Stk', part: 'p4', price: 250, material: 120 },
    { id: 'i22', cat: 'c8', name: 'Motoröl 5 L', kind: 'part', unit: 'Stk', part: 'p2', price: 60, material: 25 },
    { id: 'i23', cat: 'c5', name: 'Neon-Unterbodenbeleuchtung', kind: 'flat', unit: 'pauschal', price: 1200, material: 300, minutes: 20, active: false, note: 'Auf dem Server derzeit verboten' },
  ];
  catalog.forEach((c) => { if (c.active === undefined) c.active = true; c.req = c.req || []; });

  function unitPrice(item, cls) {
    if (item.classPrices && item.classPrices[cls] != null) return item.classPrices[cls];
    const s = (item.surcharge && item.surcharge[cls]) || 0;
    return Math.round(item.price * (1 + s / 100));
  }
  function groupDiscount(pgId, item) {
    const pg = priceGroups.find((p) => p.id === pgId) || priceGroups[0];
    if (pg.cats && pg.cats[item.cat] != null) return pg.cats[item.cat];
    return pg.pct;
  }

  const customerSeed = [
    ['Ava Reyes', 'person', 'pg2'], ['Bastian Kroll', 'person', 'pg1'], ['Carla Neves', 'person', 'pg1'], ['Dario Fontana', 'person', 'pg2'],
    ['Elif Kaya', 'person', 'pg1'], ['Frank Ostermann', 'person', 'pg1'], ['Greta Lindqvist', 'person', 'pg2'], ['Hugo Vance', 'person', 'pg1'],
    ['Ines Moreau', 'person', 'pg1'], ['Jamal Price', 'person', 'pg1'], ['Kira Volkova', 'person', 'pg2'], ['Leon Hart', 'person', 'pg1'],
    ['Maja Sørensen', 'person', 'pg1'], ['Nico Brandauer', 'person', 'pg1'], ['Olga Petrova', 'person', 'pg1'], ['Polizeidepartment', 'authority', 'pg3'],
    ['Rettungsdienst Süd', 'authority', 'pg3'], ['Sunrise Taxi', 'company', 'pg2'], ['Hafenlogistik Kade', 'company', 'pg2'], ['Tim Becker', 'person', 'pg4'],
  ];
  const customers = customerSeed.map(([name, kind, pg], i) => ({
    id: 'k' + (i + 1), name, kind, pg, phone: '555-' + String(2000 + i * 37).slice(-4),
    terms: kind === 'person' ? 0 : 14, tags: [], warning: null, blocked: null, since: addDays(TODAY, -int(20, 400)),
  }));
  customers[7].warning = 'Zahlt nur bar, Rechnungen nicht per Überweisung annehmen';
  customers[13].blocked = 'Zwei offene Rechnungen seit Oktober – erst nach Zahlung wieder annehmen';
  customers[3].tags = ['VIP', 'Tuning'];
  customers[17].tags = ['Flotte'];
  customers[18].tags = ['Flotte', 'Nutzfahrzeuge'];
  customers[15].tags = ['Behörde'];

  const models = [
    ['Kestrel', 'Vireo GT', 'sport'], ['Halden', 'Sedan 500', 'limo'], ['Moravo', 'Ranger X', 'suv'], ['Brixton', 'Mini C', 'kompakt'],
    ['Velan', 'Zephyr R', 'super'], ['Arken', 'Blade 900', 'moto'], ['Tarvos', 'Hauler 3', 'nutz'], ['Halden', 'Cruiser V8', 'limo'],
    ['Kestrel', 'Strada', 'sport'], ['Moravo', 'Atlas', 'suv'], ['Brixton', 'Pulse', 'kompakt'], ['Velan', 'Nyx', 'super'], ['Tarvos', 'Interceptor', 'limo'],
  ];
  const colors = ['Schwarz', 'Weiß', 'Silber', 'Rot', 'Blau', 'Orange', 'Grün matt', 'Gelb', 'Grau metallic', 'Violett'];
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const plate = () => letters[int(0, 22)] + letters[int(0, 22)] + ' ' + int(1000, 9899);
  const ownerOrder = [3, 3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 19, 6, 10, 0];
  const vehicles = ownerOrder.map((ci, i) => {
    let m = pick(models);
    if (customers[ci].kind === 'authority') m = ci === 15 ? ['Tarvos', 'Interceptor', 'limo'] : ['Tarvos', 'Hauler 3', 'nutz'];
    if (ci === 17) m = ['Halden', 'Sedan 500', 'limo'];
    if (ci === 18) m = ['Tarvos', 'Hauler 3', 'nutz'];
    return { id: 'v' + (i + 1), plate: plate(), make: m[0], model: m[1], cls: m[2], color: pick(colors), km: int(4000, 160000), owner: customers[ci].id, status: 'active', vin: 'RF' + int(100000, 999999) + letters[int(0, 22)] };
  });
  vehicles[0] = Object.assign(vehicles[0], { make: 'Kestrel', model: 'Vireo GT', cls: 'sport', color: 'Orange', plate: 'DF 4207', km: 38420 });
  vehicles[1] = Object.assign(vehicles[1], { make: 'Velan', model: 'Zephyr R', cls: 'super', color: 'Schwarz', plate: 'DF 7777', km: 12880 });
  vehicles[29].status = 'scrapped';
  vehicles[12].status = 'stolen';

  const statuses = [
    ['quote', 'Angebot', 'violet'], ['accepted', 'Angenommen', 'info'], ['in_progress', 'In Arbeit', 'accent'], ['waiting_parts', 'Wartet auf Teile', 'warn'],
    ['done', 'Fertig', 'ok'], ['invoiced', 'Abgerechnet', ''], ['picked_up', 'Abgeholt', ''], ['rejected', 'Abgelehnt', 'bad'], ['cancelled', 'Storniert', 'bad'],
  ];
  // Chronologisch: alte Aufträge zuerst. Index 21 ist der Vorzeige-Auftrag RFG-2026-0042.
  const statusPlan = ['cancelled', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'invoiced', 'invoiced', 'invoiced', 'invoiced',
    'done', 'done', 'done', 'waiting_parts', 'waiting_parts', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'accepted', 'accepted',
    'in_progress', 'accepted', 'quote', 'quote', 'quote'];
  const CLOSED = ['cancelled', 'picked_up', 'invoiced'];
  const workers = ['u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];
  const requests = ['Motor stottert beim Anfahren', 'Unfallschaden vorne links', 'Will mehr Leistung', 'Reifen abgefahren', 'Inspektion fällig', 'Neue Farbe, auffällig', 'Bremsen quietschen', 'Abgeschleppt nach Panne', 'Komplettpaket Optik', 'Fahrwerk tiefer'];
  const orders = statusPlan.map((st, i) => {
    const v = vehicles[(i * 7 + 3) % 29];
    const cust = customers.find((c) => c.id === v.owner);
    const n = int(1, 4);
    const used = new Set();
    const assignees = [pick(workers)];
    if (rnd() > 0.6) assignees.push(pick(workers.filter((w) => w !== assignees[0])));
    const items = [];
    for (let j = 0; j < n; j++) {
      let it = pick(catalog.filter((c) => c.active && c.kind !== 'part'));
      if (used.has(it.id)) continue;
      used.add(it.id);
      const qty = it.kind === 'labor' ? int(1, 3) : 1;
      const up = unitPrice(it, v.cls);
      const disc = groupDiscount(cust.pg, it);
      items.push({ item: it.id, name: it.name, kind: it.kind, qty, unit: up, disc, by: pick(assignees) });
    }
    const created = CLOSED.includes(st) ? addDays(TODAY, -Math.round(22 - i * 1.6)) : addDays(TODAY, -Math.max(0, Math.round((25 - i) / 4)) - int(0, 1));
    const due = st === 'quote' ? addDays(TODAY, int(2, 5)) : addDays(created, CLOSED.includes(st) ? int(1, 3) : int(2, 5));
    return {
      id: 'o' + (i + 1), no: 'RFG-2026-' + String(21 + i).padStart(4, '0'), status: st, vehicle: v.id, customer: cust.id, assignees,
      items, created, due, request: pick(requests), bay: pick(['b1', 'b2', 'b3', 'b4', 'b5']),
      mileage: v.km, condition: { Motor: int(20, 100), Karosserie: int(15, 100), Reifen: int(30, 100) },
    };
  });
  // Vorzeige-Auftrag
  const showcase = orders[21];
  Object.assign(showcase, {
    no: 'RFG-2026-0042', status: 'in_progress', vehicle: 'v1', customer: 'k4', assignees: ['u3', 'u7'], bay: 'b2', created: addDays(TODAY, -1), due: addDays(TODAY, 1),
    request: 'Will mehr Leistung und bessere Bremsen für die Rennstrecke', mileage: 38420, condition: { Motor: 82, Karosserie: 64, Reifen: 41 },
    items: [
      { item: 'i8', name: 'Motor-Tuning Stufe 2', kind: 'flat', qty: 1, unit: unitPrice(catalog[7], 'sport'), disc: 10, by: 'u3' },
      { item: 'i11', name: 'Bremsen Stufe 2', kind: 'bundle', qty: 1, unit: 3200, disc: 10, by: 'u7' },
      { item: 'i4', name: 'Reifenwechsel (4 Stück)', kind: 'bundle', qty: 1, unit: 340, disc: 10, by: 'u7' },
      { item: 'i3', name: 'Arbeitsstunde Mechanik', kind: 'labor', qty: 2, unit: 120, disc: 10, by: 'u3' },
    ],
  });
  const lineTotal = (l) => Math.round(l.qty * l.unit * (1 - l.disc / 100));
  const orderTotal = (o) => o.items.reduce((s, l) => s + lineTotal(l), 0);
  const orderGross = (o) => o.items.reduce((s, l) => s + l.qty * l.unit, 0);

  // Rechnungen
  const invoices = [];
  let invNo = 101;
  orders.filter((o) => ['invoiced', 'picked_up'].includes(o.status)).forEach((o, i) => {
    const total = orderTotal(o);
    let status = o.status === 'picked_up' ? 'paid' : pick(['open', 'partial', 'paid']);
    if (i === 1) status = 'overdue';
    const paid = status === 'paid' ? total : status === 'partial' ? Math.round(total / 2) : 0;
    invoices.push({ id: 'inv' + invNo, no: 'RFG-R-2026-' + String(invNo).padStart(4, '0'), order: o.id, customer: o.customer, issued: addDays(o.created, 1), due: addDays(o.created, 4), total, paid, status, method: pick(['Bar', 'Karte', 'Überweisung']) });
    invNo++;
  });
  const extra = [
    { customer: 'k14', total: 1850, status: 'overdue', days: -24 }, { customer: 'k14', total: 920, status: 'overdue', days: -19 },
    { customer: 'k16', total: 6400, status: 'paid', days: -6 }, { customer: 'k18', total: 2380, status: 'paid', days: -4 }, { customer: 'k2', total: 450, status: 'cancelled', days: -8 },
  ];
  extra.forEach((e) => {
    invoices.push({ id: 'inv' + invNo, no: 'RFG-R-2026-' + String(invNo).padStart(4, '0'), order: null, customer: e.customer, issued: addDays(TODAY, e.days), due: addDays(TODAY, e.days + 3), total: e.total, paid: e.status === 'paid' ? e.total : 0, status: e.status, method: 'Bar' });
    invNo++;
  });
  invoices.sort((a, b) => (a.no < b.no ? 1 : -1));

  // Konten, Buchungen
  const accounts = [
    { id: 'a1', name: 'Firmenkonto', kind: 'bank', balance: 48230 },
    { id: 'a2', name: 'Bargeldkasse', kind: 'cash', balance: 3410 },
    { id: 'a3', name: 'Trinkgeldkasse', kind: 'cash', balance: 280 },
    { id: 'a4', name: 'Steuer-Rücklage', kind: 'tax_reserve', balance: 4710 },
  ];
  const txSeed = [
    [0, 'income', 'a2', 5940, 'Rechnung RFG-R-2026-0112', 'Rechnungen', 'invoice', true],
    [0, 'transfer_out', 'a2', 594, 'Steuer-Rücklage 10 % · RFG-R-2026-0112', 'Umbuchung', 'reserve', false],
    [0, 'expense', 'a1', 2200, 'Wareneingang Turbolader', 'Teileeinkauf', 'stock', false],
    [-1, 'income', 'a1', 6400, 'Rechnung RFG-R-2026-0116 · Polizeidepartment', 'Rechnungen', 'invoice', true],
    [-1, 'transfer_out', 'a1', 640, 'Steuer-Rücklage 10 % · RFG-R-2026-0116', 'Umbuchung', 'reserve', false],
    [-1, 'income', 'a3', 120, 'Trinkgeld Woche', 'Trinkgeld', 'manual', false],
    [-2, 'expense', 'a1', 1500, 'Miete Halle (Dauerauftrag)', 'Miete', 'recurring', false],
    [-2, 'income', 'a2', 2380, 'Rechnung RFG-R-2026-0117 · Sunrise Taxi', 'Rechnungen', 'invoice', true],
    [-3, 'expense', 'a1', 1120, 'Steuern KW 45 abgeführt', 'Steuern', 'tax', false],
    [-3, 'expense', 'a1', 450, 'Werkzeug Drehmomentschlüssel', 'Ausstattung', 'manual', false],
    [-4, 'expense', 'a1', 15840, 'Lohnlauf KW 45', 'Löhne', 'payroll', false],
    [-4, 'income', 'a1', 3150, 'Rechnung RFG-R-2026-0109', 'Rechnungen', 'invoice', true],
    [-5, 'expense', 'a1', 300, 'Strafzettel Abschleppwagen', 'Strafen', 'manual', false],
    [-5, 'income', 'a2', 840, 'Rechnung RFG-R-2026-0108', 'Rechnungen', 'invoice', true],
    [-6, 'expense', 'a1', 1250, 'Wareneingang Bremsscheiben', 'Teileeinkauf', 'stock', false],
    [-7, 'income', 'a1', 500, 'Sponsoring Rennevent', 'Sonstiges', 'manual', true],
  ];
  const transactions = txSeed.map(([d, type, acc, amount, title, cat, source, taxable], i) => ({ id: 'tx' + i, date: addDays(TODAY, d), type, account: acc, amount, title, cat, source, taxable, by: pick(['u1', 'u2', 'u3']) }));
  const recurring = [
    { name: 'Miete Halle', amount: 1500, every: 'wöchentlich', next: addDays(TODAY, 5), account: 'a1', cat: 'Miete', active: true },
    { name: 'Versicherung Abschleppwagen', amount: 400, every: 'monatlich', next: '2026-12-01', account: 'a1', cat: 'Versicherung', active: true },
    { name: 'Gewerbeschein-Gebühr', amount: 2500, every: 'jährlich', next: '2027-03-02', account: 'a1', cat: 'Gebühren', active: true },
  ];

  // Steuerzeiträume (wöchentlich)
  const taxPeriods = [
    { id: 'tp46', label: 'KW 46', from: '2026-11-09', to: '2026-11-15', revenue: 14720, rate: 10, status: 'running' },
    { id: 'tp45', label: 'KW 45', from: '2026-11-02', to: '2026-11-08', revenue: 31880, rate: 10, status: 'ready' },
    { id: 'tp44', label: 'KW 44', from: '2026-10-26', to: '2026-11-01', revenue: 11200, rate: 10, status: 'filed', filed: '2026-11-03', by: 'u1' },
    { id: 'tp43', label: 'KW 43', from: '2026-10-19', to: '2026-10-25', revenue: 27450, rate: 10, status: 'filed', filed: '2026-10-27', by: 'u1' },
    { id: 'tp42', label: 'KW 42', from: '2026-10-12', to: '2026-10-18', revenue: 24100, rate: 8, status: 'filed', filed: '2026-10-20', by: 'u1' },
    { id: 'tp41', label: 'KW 41', from: '2026-10-05', to: '2026-10-11', revenue: 19870, rate: 8, status: 'filed', filed: '2026-10-13', by: 'u1' },
  ];
  taxPeriods.forEach((p) => { p.tax = Math.round(p.revenue * p.rate / 100); });
  const taxRateHistory = [{ rate: 10, from: '2026-10-19', by: 'u1' }, { rate: 8, from: '2026-01-01', by: 'u1' }];

  // Dienst
  const onDuty = { u2: '17:42', u3: '18:05', u4: '16:58', u6: '19:20', u7: '18:31' };
  const activity = {};
  staff.filter((s) => s.rank).forEach((s) => {
    activity[s.id] = [int(4, 22), int(4, 22), int(4, 22), int(2, 14)];
  });
  activity.u9 = [0, 0, 3, 5]; activity.u10 = [6, 0, 0, 0]; activity.u8 = [11, 9, 0, 0]; activity.u1 = [14, 18, 16, 9];
  const absences = [
    { user: 'u8', kind: 'Urlaub', from: '2026-11-04', to: '2026-11-18', note: 'Familienurlaub' },
    { user: 'u5', kind: 'Abgemeldet', from: '2026-11-13', to: '2026-11-15', note: 'Prüfungswoche' },
  ];
  const shifts = [
    { user: 'u1', from: addDays(TODAY, -1) + ' 17:10', to: addDays(TODAY, -1) + ' 23:45', h: 6.6, src: 'Stempeluhr' },
    { user: 'u1', from: addDays(TODAY, -2) + ' 18:00', to: addDays(TODAY, -2) + ' 01:20', h: 7.3, src: 'Stempeluhr' },
    { user: 'u1', from: addDays(TODAY, -4) + ' 16:30', to: addDays(TODAY, -4) + ' 20:00', h: 3.5, src: 'Nachtrag (vergessen auszustempeln)' },
  ];

  // Schulungen / Nachweise
  const certs = {};
  const setC = (u, t, until) => { (certs[u] = certs[u] || {})[t] = until; };
  ['u2', 'u3', 'u4', 'u5', 'u6'].forEach((u) => setC(u, 't1', addDays(TODAY, int(60, 300))));
  setC('u10', 't1', addDays(TODAY, -40));
  ['u2', 'u3', 'u6'].forEach((u) => setC(u, 't2', addDays(TODAY, int(40, 160))));
  setC('u4', 't2', addDays(TODAY, 18));
  setC('u2', 't3', addDays(TODAY, 120)); setC('u3', 't3', addDays(TODAY, 75));
  setC('u2', 't4', addDays(TODAY, 21));
  setC('u4', 't5', addDays(TODAY, 200)); setC('u6', 't5', addDays(TODAY, -5));
  setC('u5', 't6', addDays(TODAY, 240)); setC('u8', 't6', addDays(TODAY, 300));
  setC('u2', 't7', null); setC('u3', 't7', null); setC('u1', 't7', null);
  setC('u7', 't1', addDays(TODAY, 330));
  const sessions = [
    { training: 't2', date: addDays(TODAY, 2), time: '19:00', loc: 'Halle 2', trainer: 'u2', participants: ['u7', 'u5', 'u4'] },
    { training: 't1', date: addDays(TODAY, 4), time: '18:30', loc: 'Schulungsraum', trainer: 'u3', participants: ['u9'] },
    { training: 't5', date: addDays(TODAY, 6), time: '20:00', loc: 'Abschlepphof', trainer: 'u4', participants: ['u6'] },
    { training: 't3', date: addDays(TODAY, -6), time: '19:00', loc: 'Halle 2', trainer: 'u2', participants: ['u3', 'u6'], done: true },
  ];

  const licenses = [
    { id: 'l1', type: 'lt1', user: 'u4', no: 'AS-2231', issuer: 'Stadtverwaltung', issued: '2026-07-01', expires: '2027-01-01', status: 'valid' },
    { id: 'l2', type: 'lt1', user: 'u6', no: 'AS-2318', issuer: 'Stadtverwaltung', issued: '2026-05-20', expires: addDays(TODAY, 9), status: 'valid' },
    { id: 'l3', type: 'lt2', user: 'u4', no: 'FL-88412', issuer: 'Fahrschule Mitte', issued: '2025-09-12', expires: '2027-09-12', status: 'valid' },
    { id: 'l4', type: 'lt2', user: 'u2', no: 'FL-80021', issuer: 'Fahrschule Mitte', issued: '2025-04-02', expires: '2027-04-02', status: 'valid' },
    { id: 'l5', type: 'lt1', user: 'u10', no: 'AS-1977', issuer: 'Stadtverwaltung', issued: '2025-11-01', expires: '2026-05-01', status: 'revoked', reason: 'Ausgeschieden, Schein zurückgegeben' },
    { id: 'l6', type: 'lt1', user: 'u7', no: 'AS-2390', issuer: 'Stadtverwaltung', issued: '2026-10-01', expires: '2027-04-01', status: 'suspended', reason: 'Unfall mit Abschleppwagen, Prüfung läuft' },
    { id: 'l7', type: 'lt3', user: null, no: 'GW-RFG-0012', issuer: 'Stadtverwaltung', issued: '2026-03-02', expires: '2027-03-02', status: 'valid' },
    { id: 'l8', type: 'lt4', user: null, no: 'AK-0044', issuer: 'Polizeidepartment', issued: '2025-11-30', expires: addDays(TODAY, 19), status: 'valid' },
  ];

  const staffEntries = [
    { user: 'u7', kind: 'Verwarnung', level: 1, date: '2026-10-18', author: 'u2', text: 'Abschleppwagen ohne Sicherung bewegt. Nachschulung „Abschleppen & Sicherung“ angeordnet.', self: true, expires: '2027-01-18' },
    { user: 'u7', kind: 'Belobigung', date: '2026-11-02', author: 'u3', text: 'Sehr sauber gearbeitet beim Großauftrag Hafenlogistik.', self: true },
    { user: 'u6', kind: 'Gespräch', date: '2026-10-30', author: 'u1', text: 'Zielvereinbarung: Tuning Stufe 2 bis Ende November.', self: false },
    { user: 'u3', kind: 'Beförderung', date: '2026-02-01', author: 'u1', text: 'Mechaniker → Meister', self: true },
    { user: 'u10', kind: 'Austritt', date: '2026-09-30', author: 'u1', text: 'Auf eigenen Wunsch ausgeschieden. Schlüssel und Schein zurückgegeben.', self: false },
  ];

  const boardPosts = [
    { id: 'bp1', title: 'Neue Steuer: 10 % ab KW 43', date: '2026-10-19', author: 'u1', pinned: true, reads: 9, of: 10, text: 'Die Stadt hat den Steuersatz auf **10 %** angehoben. Preise bleiben gleich, das System rechnet automatisch. Rücklage läuft weiter mit.' },
    { id: 'bp2', title: 'Rennevent am Samstag – alle Hände gebraucht', date: '2026-11-09', author: 'u2', pinned: false, reads: 6, of: 10, text: 'Wir stellen den Pannendienst an der Rennstrecke. Bitte im Dienstplan eintragen, wer kann.' },
    { id: 'bp3', title: 'Lager: Motoröl knapp', date: '2026-11-10', author: 'u3', pinned: false, reads: 4, of: 10, text: 'Bitte bei Ölwechseln vorher Bestand prüfen, Lieferung kommt Freitag.' },
  ];

  const bays = [
    { id: 'b1', name: 'Hebebühne 1' }, { id: 'b2', name: 'Hebebühne 2' }, { id: 'b3', name: 'Hebebühne 3' }, { id: 'b4', name: 'Lackierkabine' }, { id: 'b5', name: 'Außenplatz' },
  ];
  const appointments = [
    { day: 0, bay: 'b1', time: '17:00–18:30', title: 'Inspektion', customer: 'k6', order: null },
    { day: 0, bay: 'b2', time: '16:00–21:00', title: 'RFG-2026-0042', customer: 'k4', order: 'o22' },
    { day: 0, bay: 'b4', time: '19:00–22:00', title: 'Lackierung komplett', customer: 'k11', order: null },
    { day: 1, bay: 'b1', time: '18:00–19:00', title: 'Reifenwechsel', customer: 'k18', order: null },
    { day: 1, bay: 'b3', time: '17:30–20:00', title: 'Reparatur Motor', customer: 'k2', order: null },
    { day: 2, bay: 'b2', time: '19:00–21:00', title: 'Bremsen Stufe 2', customer: 'k1', order: null },
    { day: 3, bay: 'b5', time: '16:00–17:00', title: 'Fahrzeugübergabe Flotte', customer: 'k19', order: null },
    { day: 4, bay: 'b1', time: '20:00–22:00', title: 'Turbo-Einbau', customer: 'k7', order: null },
    { day: 4, bay: 'b4', time: '18:00–20:00', title: 'Perleffekt-Lack', customer: 'k13', order: null },
    { day: 5, bay: 'b5', time: '14:00–22:00', title: 'Rennevent Pannendienst', customer: null, order: null },
    { day: -2, bay: 'b1', time: '17:00–19:00', title: 'Ölwechsel', customer: 'k3', order: null },
  ];

  const callouts = [
    { no: 'E-2026-0187', at: TODAY + ' 19:48', loc: 'Autobahnauffahrt Nord, km 12', by: 'Polizeidepartment', customer: 'k16', vehicle: 'v18', driver: 'u4', status: 'en_route', fee: 350 },
    { no: 'E-2026-0186', at: TODAY + ' 18:12', loc: 'Parkplatz Einkaufszentrum', by: 'Kunde', customer: 'k9', vehicle: 'v10', driver: 'u6', status: 'on_site', fee: 150 },
    { no: 'E-2026-0185', at: TODAY + ' 17:30', loc: 'Strandpromenade 4', by: 'Kunde', customer: 'k12', vehicle: null, driver: null, status: 'open', fee: 150 },
    { no: 'E-2026-0184', at: addDays(TODAY, -1) + ' 23:10', loc: 'Bergstraße Kehre 3', by: 'Rettungsdienst Süd', customer: 'k17', vehicle: 'v20', driver: 'u4', status: 'done', fee: 700, order: 'o14' },
    { no: 'E-2026-0183', at: addDays(TODAY, -1) + ' 20:02', loc: 'Hafen Tor 2', by: 'Kunde', customer: 'k19', vehicle: 'v25', driver: 'u6', status: 'done', fee: 700 },
    { no: 'E-2026-0182', at: addDays(TODAY, -2) + ' 21:44', loc: 'Tankstelle Ost', by: 'Kunde', customer: 'k5', vehicle: null, driver: 'u4', status: 'cancelled', fee: 0 },
  ];

  const revenue14 = Array.from({ length: 14 }, (_, i) => ({ date: addDays(TODAY, i - 13), rev: int(1800, 9800), exp: int(300, 3800) }));
  revenue14[13].rev = 8340;
  const weekly8 = ['KW 39', 'KW 40', 'KW 41', 'KW 42', 'KW 43', 'KW 44', 'KW 45', 'KW 46'].map((w, i) => ({ label: w, rev: [21400, 18800, 19870, 24100, 27450, 11200, 31880, 14720][i], exp: [16200, 15100, 17400, 16900, 19800, 14100, 21300, 6040][i] }));

  // Administration
  const systemRoles = [
    { id: 'admin', name: 'Administrator', fixed: true, desc: 'Alle Systemrechte' },
    { id: 'support', name: 'Support', fixed: false, desc: 'Benutzer ansehen, Tickets, Audit-Log' },
    { id: 'user', name: 'Benutzer', fixed: true, desc: 'Keine Systemrechte (Standard)', isDefault: true },
  ];
  const systemPerms = [
    ['user:read', 'Benutzer ansehen'], ['user:create', 'Benutzer anlegen & einladen'], ['user:update', 'Benutzer bearbeiten'], ['user:lock', 'Sperren, Ablauf, 2FA, Sitzungen'],
    ['user:delete', 'Benutzer löschen'], ['role:manage', 'Systemrollen verwalten'], ['server:read', 'Server-Übersicht'], ['server:settings', 'Sicherheit & Einstellungen'],
    ['backup:manage', 'Backups'], ['integration:manage', 'Webhooks & API-Schlüssel'], ['audit:read', 'Audit-Log'], ['ticket:manage', 'Tickets bearbeiten'],
  ];
  const sysRolePerms = { admin: systemPerms.map((p) => p[0]), support: ['user:read', 'server:read', 'audit:read', 'ticket:manage'], user: [] };
  const invitations = [
    { email: 'r.okoye@rostfrei.rp', rank: 'r6', role: 'user', by: 'u2', created: addDays(TODAY, -1), expires: addDays(TODAY, 6) },
    { email: 'p.nowak@rostfrei.rp', rank: 'r4', role: 'user', by: 'u1', created: addDays(TODAY, -9), expires: addDays(TODAY, -2), expired: true },
  ];
  const pendingRegs = [{ name: 'Sam Rivera', email: 'sam.rivera@rostfrei.rp', at: addDays(TODAY, 0) + ' 15:02' }];
  const jobs = [
    { key: 'reminders.daily', label: 'Erinnerungen (Nachweise, Lizenzen, Rechnungen)', every: 'täglich 06:00', last: TODAY + ' 06:00', next: addDays(TODAY, 1) + ' 06:00', status: 'ok' },
    { key: 'recurring.run', label: 'Daueraufträge buchen', every: 'stündlich', last: TODAY + ' 19:00', next: TODAY + ' 20:00', status: 'ok' },
    { key: 'tax.period', label: 'Steuerzeitraum abschließen', every: 'täglich 00:15', last: TODAY + ' 00:15', next: addDays(TODAY, 1) + ' 00:15', status: 'ok' },
    { key: 'stock.check', label: 'Mindestbestand prüfen', every: 'täglich 05:00', last: TODAY + ' 05:00', next: addDays(TODAY, 1) + ' 05:00', status: 'ok' },
    { key: 'activity.weekly', label: 'Aktivitätsübersicht', every: 'Montag 04:00', last: '2026-11-09 04:00', next: '2026-11-16 04:00', status: 'ok' },
    { key: 'shifts.stale', label: 'Offene Schichten > 12 h', every: 'stündlich', last: TODAY + ' 19:00', next: TODAY + ' 20:00', status: 'ok' },
    { key: 'webhooks.deliver', label: 'Discord-Webhooks zustellen', every: 'Warteschlange', last: TODAY + ' 19:48', next: '–', status: 'error', msg: '1 Fehlversuch: HTTP 429 (Rate-Limit), erneuter Versuch in 2 min' },
    { key: 'backup.daily', label: 'Backup', every: 'täglich 03:00', last: TODAY + ' 03:00', next: addDays(TODAY, 1) + ' 03:00', status: 'ok' },
  ];
  const backups = [
    { file: 'boxenstopp-2026-11-11-0300.dump.enc', size: '18,4 MB', at: TODAY + ' 03:00', by: 'Job' },
    { file: 'boxenstopp-2026-11-10-2141.dump.enc', size: '18,1 MB', at: '2026-11-10 21:41', by: 'Lena Brandt' },
    { file: 'boxenstopp-2026-11-10-0300.dump.enc', size: '18,0 MB', at: '2026-11-10 03:00', by: 'Job' },
    { file: 'boxenstopp-2026-11-09-0300.dump.enc', size: '17,8 MB', at: '2026-11-09 03:00', by: 'Job' },
  ];
  const webhooks = [
    { name: '#werkstatt-feed', url: 'https://discord.com/api/webhooks/…/Xk3f', events: ['Auftrag fertig', 'Einsatz neu', 'Lager knapp'], status: 'error', last: TODAY + ' 19:48 · HTTP 429' },
    { name: '#leitung', url: 'https://discord.com/api/webhooks/…/9aQz', events: ['Rechnung überfällig', 'Lizenz läuft ab', 'Steuerzeitraum fällig'], status: 'ok', last: TODAY + ' 06:00 · 204' },
  ];
  const apiKeys = [
    { user: 'u1', name: 'Tabellen-Export', prefix: 'bxs_7Fq2', last: addDays(TODAY, -1), created: '2026-09-02' },
    { user: 'u2', name: 'Stream-Overlay Auftragsboard', prefix: 'bxs_M1cD', last: TODAY, created: '2026-10-14' },
  ];
  const audit = [
    [TODAY + ' 19:51', 'u3', 'Auftrag', 'Position hinzugefügt', 'RFG-2026-0042 · Arbeitsstunde Mechanik × 2'],
    [TODAY + ' 19:40', 'u7', 'Auftrag', 'Rabatt angefragt', 'RFG-2026-0042 · 15 % (erlaubt: 0 %)'],
    [TODAY + ' 18:44', 'u1', 'Preisliste', 'Preis geändert', 'Motor-Tuning Stufe 2: $ 4.800 → $ 5.000 (ab 11.11.2026)'],
    [TODAY + ' 18:02', 'u2', 'Berechtigungen', 'Recht geändert', 'Rang Mechaniker · Termine: Lesen → Lesen & Schreiben'],
    [TODAY + ' 17:15', 'u1', 'Rechnung', 'Storniert', 'RFG-R-2026-0118 · Grund: doppelt erstellt'],
    [TODAY + ' 15:02', null, 'Benutzer', 'Registrierung', 'sam.rivera@rostfrei.rp wartet auf Freigabe'],
    [addDays(TODAY, -1) + ' 23:58', 'u1', 'Kasse', 'Tagesabschluss', 'Bargeldkasse · Differenz −$ 20 (Wechselgeld)'],
    [addDays(TODAY, -1) + ' 22:30', 'u11', 'Benutzer', '2FA zurückgesetzt', 'Mia Schulz'],
    [addDays(TODAY, -2) + ' 20:11', 'u1', 'Steuern', 'Abgeführt', 'KW 45 · $ 3.188'],
    [addDays(TODAY, -3) + ' 21:05', 'u2', 'Mitarbeiter', 'Rang geändert', 'Tim Becker: Azubi → Mechaniker'],
    [addDays(TODAY, -4) + ' 19:00', 'u1', 'Server', 'Einstellung geändert', '2FA-Pflicht: aus → Administratoren'],
    [addDays(TODAY, -5) + ' 18:20', 'u1', 'Lohn', 'Lohnlauf freigegeben', 'KW 45 · $ 15.840'],
  ].map(([at, user, area, action, detail]) => ({ at, user, area, action, detail, ip: '10.0.0.' + int(2, 60) }));
  const tickets = [
    { id: 'T-14', title: 'Rechnung als Bild schneidet Logo ab', status: 'open', by: 'u5', at: addDays(TODAY, -1), comments: 1, page: 'Rechnungen' },
    { id: 'T-13', title: 'Kennzeichen mit Leerzeichen werden nicht gefunden', status: 'in_progress', by: 'u4', at: addDays(TODAY, -3), comments: 3, page: 'Suche' },
    { id: 'T-12', title: 'Dienstplan zeigt Nachtschicht am falschen Tag', status: 'done', by: 'u6', at: addDays(TODAY, -8), comments: 2, page: 'Dienstplan' },
  ];
  const notifications = [
    { text: 'Rabattfreigabe: Mia Schulz möchte 15 % auf RFG-2026-0042', link: '#/auftrag/o22', when: 'vor 12 min', tone: 'accent' },
    { text: 'Neuer Einsatz E-2026-0187 vom Polizeidepartment', link: '#/einsaetze', when: 'vor 15 min', tone: 'info' },
    { text: 'Abschlepp-Konzession läuft in 19 Tagen ab', link: '#/lizenzen?tab=firma', when: 'heute', tone: 'warn' },
    { text: 'Motoröl 5 L unter Mindestbestand (6 / 10)', link: '#/lager', when: 'heute', tone: 'warn' },
    { text: 'Steuerzeitraum KW 45 ist bereit zur Abführung', link: '#/steuern', when: 'gestern', tone: 'info' },
  ];
  const changelog = [
    { v: '0.1.0', date: TODAY, items: [['Neu', 'Klickbares Mockup mit Beispieldaten'], ['Neu', 'User- und Server-Management nach Vorbild des RP-Management-Boards'], ['Geändert', 'Steuern: Festpreise, ein Satz, Abführung je Zeitraum']] },
    { v: '0.0.0', date: TODAY, items: [['Technik', 'Konzept und technische Planung']] },
  ];

  window.BX = window.BX || {};
  window.BX.data = {
    TODAY, addDays, firm, ranks, groups, staff, modules, rankPerms, groupPerms, userPerms, flags, vehicleClasses, priceGroups,
    trainings, licenseTypes, rankReq, categories, parts, catalog, unitPrice, groupDiscount, customers, vehicles, statuses, orders,
    lineTotal, orderTotal, orderGross, invoices, accounts, transactions, recurring, taxPeriods, taxRateHistory, onDuty, activity, absences, shifts,
    certs, sessions, licenses, staffEntries, boardPosts, bays, appointments, callouts, revenue14, weekly8,
    systemRoles, systemPerms, sysRolePerms, invitations, pendingRegs, jobs, backups, webhooks, apiKeys, audit, tickets, notifications, changelog,
  };
})();
