// Demo-Daten für 0.3.0: Fahrzeug-Katalog mit Bildern, Fuhrpark, Tuning-Pakete, Regelwerk.
// Wird von seed-demo.js aufgerufen; Bilder sind gezeichnete SVGs (nur der Seed darf SVG speichern).
import { q, one } from './db.js';
import { addDays } from './lib.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHAPES = {
  coupe: 'M60 300 L120 300 Q140 250 200 245 L300 190 Q360 165 470 168 L560 175 Q640 200 690 245 L740 255 Q765 262 765 290 L765 305 L60 305 Z',
  sedan: 'M50 300 L60 260 Q70 245 130 240 L230 185 Q260 170 330 168 L520 170 Q570 172 620 230 L720 245 Q760 252 760 285 L760 305 L50 305 Z',
  suv: 'M50 305 L50 230 Q55 215 90 210 L180 150 Q200 135 260 133 L560 133 Q610 135 640 170 L700 215 Q760 222 760 260 L760 305 Z',
  compact: 'M90 305 L90 260 Q100 240 150 235 L240 170 Q270 150 340 150 L500 152 Q560 158 600 210 L680 228 Q720 238 720 275 L720 305 Z',
  truck: 'M40 305 L40 160 L330 160 L330 120 Q335 110 350 110 L500 110 Q540 112 560 150 L610 210 L740 215 Q765 218 765 250 L765 305 Z',
  bike: 'M200 290 L300 220 L420 215 L470 180 L520 185 L500 220 L600 240 L630 290 L560 290 L470 250 L330 255 L280 290 Z',
};
const WHEELS = { bike: [[230, 300, 48], [600, 300, 48]], truck: [[150, 305, 52], [280, 305, 52], [640, 305, 52]], default: [[180, 305, 48], [600, 305, 48]] };
export function carSvg({ make, model, body, color, bg1, bg2, view = 'Seitenansicht' }) {
  const shape = SHAPES[body] || SHAPES.sedan;
  const wheels = WHEELS[body] || WHEELS.default;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".45"/><stop offset=".35" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
<rect width="800" height="450" fill="url(#bg)"/>
<ellipse cx="410" cy="350" rx="340" ry="22" fill="#000" opacity=".35"/>
<path d="${shape}" fill="${color}"/><path d="${shape}" fill="url(#paint)"/>
${body === 'bike' ? '' : `<path d="${shape}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`}
${wheels.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#111"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#9ca3af"/><circle cx="${x}" cy="${y}" r="${r * 0.15}" fill="#333"/>`).join('')}
<text x="32" y="58" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="34" font-weight="800" fill="#fff">${esc(make)} ${esc(model)}</text>
<text x="32" y="92" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="20" fill="#fff" opacity=".75">${esc(view)}</text>
<text x="768" y="430" text-anchor="end" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14" fill="#fff" opacity=".5">Boxenstopp Demo</text>
</svg>`;
}

const MODELS = [
  ['Porsche', '718 Cayman GTS 4.0', 'Sport', 'coupe', 105000, 2, 293, 'Heck', 'Benzin', 'Leichter Sportwagen mit Mittelmotor. Beliebt bei Tunern, sehr gut für Rennstrecken.', 'Motor bis Stufe 3, Turbo empfohlen ab Stufe 2.', ['#f97316', '#ef4444']],
  ['BMW', 'M4 Competition Coupé', 'Sport', 'coupe', 98000, 4, 290, 'Heck', 'Benzin', 'Alltagstauglicher Sportler mit vier Sitzen.', 'Federung Sport lohnt sich.', ['#2563eb', '#e5e7eb']],
  ['Škoda', 'Superb 2.0 TDI', 'Limousine', 'sedan', 48000, 5, 232, 'Front', 'Diesel', 'Die Taxi-Limousine schlechthin. Robust, günstig in der Wartung.', 'Selten getunt, oft Inspektion und Reifen.', ['#eab308', '#111827']],
  ['Mercedes-Benz', 'S 580 4MATIC', 'Limousine', 'sedan', 150000, 5, 250, 'Allrad', 'Benzin', 'Große V8-Limousine, beliebt bei Fraktionen.', 'Panzerung möglich.', ['#111827', '#6b7280']],
  ['Toyota', 'Land Cruiser 250', 'SUV', 'suv', 72000, 7, 165, 'Allrad', 'Diesel', 'Geländegängiger SUV mit viel Platz.', 'Fahrwerk höherlegen statt tiefer.', ['#4d7c0f', '#d4d4d8']],
  ['Land Rover', 'Range Rover P550e', 'SUV', 'suv', 160000, 5, 242, 'Allrad', 'Hybrid', 'Luxus-SUV mit Plug-in-Hybridantrieb.', '', ['#e5e7eb', '#0f172a']],
  ['Volkswagen', 'Polo 1.0 TSI', 'Kompakt', 'compact', 24000, 5, 187, 'Front', 'Benzin', 'Stadtflitzer, günstig im Unterhalt.', '', ['#22c55e', '#f43f5e']],
  ['Renault', '5 E-Tech Electric', 'Kompakt', 'compact', 33000, 5, 150, 'Front', 'Elektro', 'Elektrischer Kleinwagen.', 'Kein Motor-Tuning möglich (Elektro).', ['#06b6d4', '#a855f7']],
  ['Lamborghini', 'Huracán EVO', 'Super', 'coupe', 240000, 2, 325, 'Allrad', 'Benzin', 'Supersportwagen mit V10-Mittelmotor. Teile teuer, Lieferzeit beachten.', 'Preise der Klasse Super gelten.', ['#111827', '#f59e0b']],
  ['McLaren', '750S', 'Super', 'coupe', 300000, 2, 332, 'Heck', 'Benzin', 'Extrem flach, Vorsicht auf der Hebebühne.', '', ['#7c3aed', '#e5e7eb']],
  ['Honda', 'CBR1000RR-R Fireblade', 'Motorrad', 'bike', 29000, 2, 299, 'Kette', 'Benzin', 'Supersportler auf zwei Rädern.', 'Motorrad-Preise beachten.', ['#dc2626', '#111827']],
  ['MAN', 'TGL 12.250 Plateau', 'Nutzfahrzeug', 'truck', 95000, 3, 90, 'Heck', 'Diesel', 'Schwerer Abschleppwagen mit Plateau. Basis unseres Abschleppdienstes.', '', ['#f59e0b', '#64748b']],
  ['Dodge', 'Charger Pursuit', 'Limousine', 'sedan', 55000, 5, 240, 'Allrad', 'Benzin', 'Einsatzfahrzeug der Behörden. Nur für berechtigte Kunden.', 'Keine Optik-Änderungen an Behördenfahrzeugen.', ['#1e3a8a', '#f8fafc']],
];
const BG = [['#0f172a', '#334155'], ['#1f2937', '#78350f'], ['#082f49', '#0f766e'], ['#3b0764', '#831843']];

const DOCS = [
  ['Dienstverordnung', 1, `# Dienstverordnung der Rostfrei Garage

Diese Verordnung gilt für alle Mitarbeiter ab dem ersten Diensttag. Verstöße werden in der Personalakte vermerkt.

## 1. Dienstbeginn und Dienstende
- Der Dienst beginnt mit **„Dienst beginnen“** in Boxenstopp und endet mit „Dienst beenden“.
- Wer vergisst auszustempeln, meldet sich bei der Werkstattleitung – Nachträge nur mit Grund.
- Abwesenheiten (Urlaub, Prüfungen, Krankheit) trägst du selbst im Dienstplan ein.

## 2. Arbeitskleidung und Auftreten
- Im Dienst trägst du die Firmenkleidung (orange Overall oder Firmenshirt).
- Gegenüber Kunden sind wir freundlich und sachlich – auch bei Behörden.

## 3. Aufträge
1. Jedes Fahrzeug wird über Boxenstopp angenommen – **kein Auftrag ohne Eintrag**.
2. Positionen nur aus der Preisliste. Rabatte über deinem Limit gehen zur Freigabe.
3. Leistungen, für die dir eine Schulung fehlt, führst du nicht aus.
4. Vor „Fertig melden“ Probefahrt und Sichtprüfung.

## 4. Kasse und Geld
- Bargeld kommt sofort in die Bargeldkasse und wird als Zahlung gebucht.
- Trinkgeld gehört in die Trinkgeldkasse und wird wöchentlich verteilt.
- Der Tagesabschluss macht, wer das Recht dazu hat.

## 5. Firmenfahrzeuge
- Firmenfahrzeuge werden in Boxenstopp **ausgegeben und zurückgegeben** (mit Kilometerstand).
- Schäden meldest du sofort bei der Rückgabe.
- Privatfahrten sind nicht erlaubt.

## 6. Abschleppdienst
- Nur mit gültigem Abschleppschein.
- Einsätze werden vor der Abfahrt angelegt, Fahrer und Fahrzeug eingetragen.

> Bei Fragen wende dich an die Werkstattleitung.`],
  ['Firmen-Kodex', 2, `# Firmen-Kodex

Wir sind eine ehrliche Werkstatt. Dieser Kodex beschreibt, wofür die Rostfrei Garage steht.

## Unsere Werte
- **Ehrlichkeit:** Wir berechnen nur, was wir gemacht haben – zu den Preisen der Preisliste.
- **Qualität:** Lieber einmal richtig als zweimal schnell.
- **Respekt:** Gegenüber Kunden, Kollegen und Behörden.
- **Neutralität:** Wir reparieren für jeden – Konflikte bleiben vor dem Tor.

## Was wir nicht tun
- Keine Arbeiten an gestohlen gemeldeten Fahrzeugen. Bei Verdacht: Werkstattleitung informieren.
- Kein Entfernen von Fahrgestellnummern oder Kennzeichen-Tausch ohne Papiere.
- Keine Schwarzgeschäfte, keine Barzahlung ohne Rechnung.
- Keine Weitergabe von Kundendaten.

## Verschwiegenheit
Was in der Werkstatt besprochen wird, bleibt in der Werkstatt. Das gilt auch nach dem Austritt.

## Konsequenzen
Verstöße gegen den Kodex führen zu einer Verwarnung, im Wiederholungsfall zur Kündigung.

*Neu in Version 2:* Abschnitt „Was wir nicht tun“ um Kennzeichen-Tausch ergänzt.`],
  ['Preis- und Rabattrichtlinie', 1, `# Preis- und Rabattrichtlinie

## Grundsatz
Es gelten die **Festpreise der Preisliste**. Der Preis richtet sich nach der Fahrzeugklasse.

## Rabatte
| Gruppe | Rabatt |
|---|---|
| Stammkunden | 10 % |
| Behörden | 20 % (Tuning 10 %) |
| Mitarbeiter | 30 % |

Darüber hinaus nur mit Freigabe über Boxenstopp.

## Kulanz
Bei Garantiefällen innerhalb der Garantiezeit arbeiten wir kostenlos nach. Die Entscheidung trifft der Meister.`],
];

export async function seedExtras({ T, U, CU, D }) {
  const lena = U.Lena;
  // Fahrzeug-Katalog mit Bildern
  const M = {};
  for (const [i, [make, model, cls, body, price, seats, speed, drive, fuel, desc, tnote, colors]] of MODELS.entries()) {
    const m = await one(`INSERT INTO vehicle_models (make, model, class_id, body, price, seats, top_speed, drive, fuel, description, tuning_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [make, model, D.classes[cls], { coupe: 'Coupé', sedan: 'Limousine', suv: 'SUV', compact: 'Kleinwagen', truck: 'Abschleppwagen', bike: 'Motorrad' }[body], price, seats, speed, drive, fuel, desc, tnote]);
    M[make + ' ' + model] = m.id;
    for (const [j, color] of colors.entries()) {
      const bg = BG[(i + j) % BG.length];
      const svg = carSvg({ make, model, body, color, bg1: bg[0], bg2: bg[1], view: j === 0 ? 'Seitenansicht' : 'Farbvariante' });
      await q('INSERT INTO images (owner_type, owner_id, mime, data, size, caption, position, is_cover, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        ['model', m.id, 'image/svg+xml', Buffer.from(svg), svg.length, j === 0 ? 'Werksfarbe' : 'Farbvariante', j, j === 0, lena]);
    }
  }
  await q(`UPDATE vehicles v SET model_id = m.id FROM vehicle_models m WHERE m.make = v.make AND m.model = v.model`);

  // Fuhrpark der Werkstatt
  const F = {};
  const fleet = [
    ['Abschlepper 1', 'RF 1001', 'Abschleppwagen', 'MAN TGL 12.250 Plateau', 'in_use', U.Jonas, 48210, addDays(T, 26), 55000, addDays(T, 120), 74000, addDays(T, -300)],
    ['Abschlepper 2', 'RF 1002', 'Abschleppwagen', 'MAN TGL 12.250 Plateau', 'available', null, 31980, addDays(T, 5), 35000, addDays(T, 120), 74000, addDays(T, -120)],
    ['Servicewagen', 'RF 2001', 'Servicewagen', 'Toyota Land Cruiser 250', 'available', null, 22740, addDays(T, 48), 30000, addDays(T, 10), 88000, addDays(T, -200)],
    ['Chefwagen', 'RF 7777', 'Dienstwagen', 'Lamborghini Huracán EVO', 'workshop', null, 9120, addDays(T, 90), 15000, addDays(T, 200), 420000, addDays(T, -60)],
  ];
  for (const [name, plate, kind, mm, status, driver, km, sd, skm, iu, price, bought] of fleet) {
    const [make, model] = MODELS.map((x) => [x[0], x[1]]).find(([a, b]) => a + ' ' + b === mm);
    const f = await one(`INSERT INTO fleet_vehicles (name, plate, kind, model_id, make, model, status, driver_id, km, service_due, service_km, insurance_until, purchase_price, purchased_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [name, plate, kind, M[mm], make, model, status, driver, km, sd, skm, iu, price, bought]);
    F[name] = f.id;
  }
  const bank = (await one(`SELECT id FROM accounts WHERE name = 'Firmenkonto'`)).id;
  const log = async (fleetName, user, kind, daysAgo, o = {}) => {
    let tId = null;
    if (o.amount) tId = (await one(`INSERT INTO transactions (account_id, type, amount, title, category, source, source_id, booked_at, created_by) VALUES ($1,'expense',$2,$3,'Fuhrpark','fleet',$4,$5,$6) RETURNING id`, [bank, o.amount, `${o.title} ${fleetName}`, F[fleetName], addDays(T, -daysAgo), user])).id;
    await q(`INSERT INTO fleet_log (fleet_id, user_id, kind, started_at, ended_at, km_start, km_end, amount, transaction_id, text, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() - ($11 || ' days')::interval)`,
      [F[fleetName], user, kind, o.start ? new Date(Date.now() - daysAgo * 86400e3 - 3 * 3600e3) : null, o.end ? new Date(Date.now() - daysAgo * 86400e3) : null, o.kmStart ?? null, o.kmEnd ?? null, o.amount ?? null, tId, o.text || '', String(daysAgo)]);
  };
  let km = 47100;
  for (const d of [20, 16, 12, 9, 6, 3]) {
    const u = d % 2 ? U.Tim : U.Jonas;
    const drive = 120 + d * 13;
    await log('Abschlepper 1', u, 'checkout', d + 0.2, { start: true, kmStart: km, text: 'Abschleppdienst' });
    await log('Abschlepper 1', u, 'checkin', d, { start: true, end: true, kmStart: km, kmEnd: km + drive });
    km += drive;
  }
  await log('Abschlepper 1', U.Jonas, 'checkout', 0.1, { start: true, kmStart: 48210, text: 'Einsatz Autobahnauffahrt Nord' });
  await log('Abschlepper 1', U.Jonas, 'fuel', 9, { amount: 180, title: 'Tanken', text: 'Diesel voll' });
  await log('Abschlepper 2', U.Marco, 'service', 40, { amount: 650, title: 'Service', text: 'Ölwechsel, Bremsen geprüft', kmEnd: 30100 });
  await log('Servicewagen', U.Deniz, 'checkout', 2.2, { start: true, kmStart: 22580, text: 'Teile holen' });
  await log('Servicewagen', U.Deniz, 'checkin', 2, { start: true, end: true, kmStart: 22580, kmEnd: 22740 });
  await log('Chefwagen', U.Lena, 'damage', 1, { text: 'Steinschlag Frontscheibe, Spiegel links locker' });
  await q(`UPDATE callouts SET fleet_id = $1 WHERE status = 'en_route'`, [F['Abschlepper 1']]);
  await q(`UPDATE callouts SET fleet_id = $1 WHERE status IN ('on_site','done')`, [F['Abschlepper 2']]);

  // Tuning-Pakete
  const I = Object.fromEntries((await q('SELECT id, name FROM catalog_items')).map((r) => [r.name, r.id]));
  const pk = [['Street-Paket', 'Alltagstaugliche Leistungssteigerung mit besseren Bremsen und straffem Fahrwerk.', ['Motor-Tuning Stufe 1', 'Bremsen Stufe 2', 'Federung Sport', 'Scheibentönung'], 10],
    ['Track-Paket', 'Für die Rennstrecke: Stufe 2, Turbo, Bremsen und Fahrwerk.', ['Motor-Tuning Stufe 2', 'Turbo-Einbau', 'Bremsen Stufe 2', 'Federung Sport'], 12],
    ['Optik-Paket', 'Sichtbar anders: Xenon, Tönung, Perleffekt-Lack.', ['Xenon-Scheinwerfer', 'Scheibentönung', 'Perleffekt-Lack'], 8]];
  for (const [i, [name, desc, items, disc]] of pk.entries()) await q('INSERT INTO tuning_packages (name, description, items, discount, position) VALUES ($1,$2,$3,$4,$5)', [name, desc, items.map((n) => I[n]), disc, i]);

  // Regelwerk
  for (const [i, [title, version, body]] of DOCS.entries()) {
    const d = await one('INSERT INTO rule_docs (title, body, version, position, updated_by, updated_at) VALUES ($1,$2,$3,$4,$5, now() - ($6 || \' days\')::interval) RETURNING id', [title, body, version, i, lena, String(version === 2 ? 3 : 60)]);
    for (let v = 1; v <= version; v++) await q('INSERT INTO rule_doc_versions (doc_id, version, title, body, note, changed_by, changed_at) VALUES ($1,$2,$3,$4,$5,$6, now() - ($7 || \' days\')::interval)', [d.id, v, title, v === version ? body : body.replace(/\n\*Neu in Version 2:.*$/s, '').replace(' oder Kennzeichen-Tausch ohne Papiere', ''), v === 1 ? 'Erste Fassung' : 'Kennzeichen-Tausch ergänzt', lena, String(v === version && version === 2 ? 3 : 60)]);
    const ackers = version === 2 ? ['Lena', 'Marco'] : ['Lena', 'Marco', 'Deniz', 'Jonas', 'Sophie', 'Tim', 'Mia'];
    for (const n of ackers) await q('INSERT INTO rule_acks (doc_id, user_id, version) VALUES ($1, $2, $3)', [d.id, U[n], version]);
    if (version === 2) for (const n of ['Deniz', 'Jonas', 'Sophie', 'Tim', 'Mia']) await q('INSERT INTO rule_acks (doc_id, user_id, version, at) VALUES ($1, $2, 1, now() - interval \'50 days\')', [d.id, U[n]]);
  }
  void CU;
}
