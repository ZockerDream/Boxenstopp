// Boxenstopp – API-Ablauftest gegen einen Wegwerf-Stack mit Demo-Daten (verändert Daten!).
// Aufruf: BASE=http://localhost:18190 node tests/e2e/api.mjs
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:18190';
const PW = process.env.PW || 'Boxenstopp2026!';
let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) { passed++; } else { failed++; console.log('  ✗', msg); } };
const section = (s) => console.log('▶', s);

function client() {
  let cookie = '';
  const call = async (method, path, body, raw) => {
    const r = await fetch(BASE + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    if (raw) return r;
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j };
  };
  return { call, get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p) };
}
async function login(email, code) {
  const c = client();
  const r = await c.post('/api/auth/login', { email, password: PW, ...(code ? { code } : {}) });
  return { c, r };
}
const totp = (secret) => {
  const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = [];
  for (const ch of secret) { v = (v << 5) | B.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(ctr).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
};

section('Gesundheit, Setup gesperrt');
const anon = client();
ok((await anon.get('/api/health')).status === 200, 'health');
ok((await anon.get('/api/state')).status === 401, 'state ohne Login → 401');
ok((await anon.post('/api/setup', { firmName: 'X', short: 'XX', name: 'Y', email: 'y@y.de', password: 'abcdefghijk' })).status === 409, 'Setup nach Einrichtung → 409');
const csp = (await anon.call('GET', '/', undefined, true)).headers.get('content-security-policy') || '';
ok(csp.includes("script-src 'self'") && !csp.includes('unsafe-eval'), 'CSP gesetzt');

const { c: lena, r: lr } = await login('lena.brandt@rostfrei.rp');
ok(lr.status === 200, 'Login Lena');
const { c: mia } = await login('mia.schulz@rostfrei.rp');
const { c: kai } = await login('kai.neumann@rostfrei.rp');
const S = (await lena.get('/api/state')).body;
const byName = (n) => S.staff.find((s) => s.name.startsWith(n)).id;
const item = (n) => S.catalog.find((i) => i.name === n);
const part = (n) => S.parts.find((p) => p.name === n);
const acc = (k) => S.accounts.find((a) => a.kind === k);

section('Auftrag mit neuem Fahrzeug und neuem Kunden');
const plate = 'QA ' + Math.floor(1000 + Math.random() * 8999);
let r = await lena.post('/api/orders', { newVehicle: { plate, make: 'Kestrel', model: 'Testwagen', cls: S.vehicleClasses.find((c) => c.name === 'Sport').id, ownerName: 'Testkunde QA' }, request: 'Testauftrag', mileage: 1234, assignees: [byName('Deniz'), byName('Mia')] });
ok(r.status === 200 && r.body.id, 'Auftrag angelegt ' + JSON.stringify(r.body));
const oid = r.body.id;
const reifenBefore = part('Reifen Allround');
r = await lena.post(`/api/orders/${oid}/items`, { item: item('Reifenwechsel (4 Stück)').id, by: byName('Deniz') });
ok(r.status === 200, 'Position Reifenwechsel');
r = await lena.post(`/api/orders/${oid}/items`, { item: item('Motor-Tuning Stufe 2').id, by: byName('Mia') });
ok(r.status === 200 && /Qualifikation fehlt/.test(r.body.warning || ''), 'Qualifikationswarnung für Mia');
let st = (await lena.get('/api/state')).body;
let o = st.orders.find((x) => x.id === oid);
ok(o.items.length === 2 && o.items[1].unit === 5000, 'Preis Sport-Klasse 5000');
ok(st.parts.find((p) => p.id === reifenBefore.id).reserved === reifenBefore.reserved + 4, 'Reifen reserviert');

section('Rabattfreigabe');
r = await mia.post(`/api/orders/${oid}/items`, { item: item('Inspektion').id, by: byName('Mia'), disc: 25 });
ok(r.status === 200 && /Freigabe angefragt/.test(r.body.warning || ''), 'Mia fragt 25 % an');
st = (await lena.get('/api/state')).body;
const dr = st.discountRequests.find((d) => d.order === oid);
ok(!!dr, 'Freigabe sichtbar');
r = await lena.post(`/api/orders/${oid}/status`, { to: 'invoiced' });
ok(r.status === 409, 'Abrechnen nur aus „Fertig“');
r = await mia.post(`/api/discounts/${dr.id}`, { approve: true });
ok(r.status === 403, 'Mia kann eigene Anfrage nicht freigeben');
r = await lena.post(`/api/discounts/${dr.id}`, { approve: true });
ok(r.status === 200, 'Lena gibt frei');

section('Status, Teile, Rechnung');
ok((await lena.post(`/api/orders/${oid}/status`, { to: 'in_progress' })).status === 200, 'In Arbeit');
ok((await lena.post(`/api/orders/${oid}/status`, { to: 'done' })).status === 200, 'Fertig');
st = (await lena.get('/api/state')).body;
ok(st.parts.find((p) => p.id === reifenBefore.id).stock === reifenBefore.stock - 4, 'Reifen entnommen');
ok(st.tuning.some((t) => t.vehicle === st.orders.find((x) => x.id === oid).vehicle && t.category === 'Motor' && t.level === 2), 'Tuning-Stand fortgeschrieben');
r = await lena.post(`/api/orders/${oid}/status`, { to: 'invoiced' });
ok(r.status === 200 && r.body.invoice, 'Rechnung erstellt');
const invId = r.body.invoice.id;
ok((await lena.post(`/api/orders/${oid}/items`, { item: item('Inspektion').id, by: byName('Deniz') })).status === 409, 'Abgerechneter Auftrag gesperrt');
st = (await lena.get('/api/state')).body;
const inv = st.invoices.find((i) => i.id === invId);
ok(inv.total === 340 + 5000 + 187.5 && inv.snapshot.lines.length === 3, 'Rechnungssumme 5527,50 (Standard-Kunde, Inspektion −25 %) ' + inv.total);

section('Zahlung mit Steuer-Rücklage, Storno');
const reserveBefore = acc('tax_reserve').balance;
r = await lena.post(`/api/invoices/${invId}/payments`, { amount: 99999, method: 'Bar', account: acc('cash').id });
ok(r.status === 400, 'Überzahlung abgelehnt');
r = await lena.post(`/api/invoices/${invId}/payments`, { amount: 1000, method: 'Bar', account: acc('cash').id });
ok(r.status === 200, 'Teilzahlung');
r = await lena.post(`/api/invoices/${invId}/payments`, { amount: 4527.5, method: 'Karte', account: acc('bank').id });
ok(r.status === 200, 'Restzahlung');
st = (await lena.get('/api/state')).body;
ok(st.invoices.find((i) => i.id === invId).status === 'paid', 'Rechnung bezahlt');
ok(Math.abs(st.accounts.find((a) => a.kind === 'tax_reserve').balance - reserveBefore - 552.75) < 0.02, 'Rücklage +10 % ' + (st.accounts.find((a) => a.kind === 'tax_reserve').balance - reserveBefore));
ok((await mia.post(`/api/invoices/${invId}/cancel`, { reason: 'Test' })).status === 403, 'Mia darf nicht stornieren');
r = await lena.post(`/api/invoices/${invId}/cancel`, { reason: 'Testfall Storno' });
ok(r.status === 200, 'Storno');
st = (await lena.get('/api/state')).body;
ok(st.invoices.find((i) => i.id === invId).status === 'cancelled' && st.invoices.some((i) => i.cancels === invId && i.status === 'credit'), 'Gegenrechnung');
ok(st.orders.find((x) => x.id === oid).status === 'done', 'Auftrag zurück auf Fertig');
ok(Math.abs(st.accounts.find((a) => a.kind === 'tax_reserve').balance - reserveBefore) < 0.02, 'Rücklage zurückgebucht');

section('Stempeluhr, Steuer, Lohn');
r = await lena.post('/api/shifts/clock');
ok(r.status === 200 && r.body.onDuty, 'Dienst beginnen');
r = await lena.post('/api/shifts/clock');
ok(r.status === 200 && !r.body.onDuty, 'Dienst beenden');
const ready = st.taxPeriods.find((p) => p.status === 'ready');
if (ready) {
  r = await lena.post('/api/tax/file', { from: ready.from });
  ok(r.status === 200, 'Steuern abgeführt ' + JSON.stringify(r.body));
  ok((await lena.post('/api/tax/file', { from: ready.from })).status === 409, 'doppelt abführen → 409');
  ok((await lena.post('/api/tax/rates', { rate: 12, from: ready.from })).status === 409, 'Satz für abgeführten Zeitraum gesperrt');
}
ok((await lena.post('/api/tax/file', { from: st.taxPeriods[0].from })).status === 409, 'laufenden Zeitraum nicht abführbar');
if (st.payroll.draft) {
  r = await lena.post('/api/payroll/approve', { from: st.payroll.period.from, adjust: { [byName('Mia')]: 50 } });
  ok(r.status === 200 && r.body.total > 0, 'Lohnlauf freigegeben ' + JSON.stringify(r.body));
  ok((await lena.post('/api/payroll/approve', { from: st.payroll.period.from })).status === 409, 'Lohnlauf doppelt → 409');
}

section('Rechte');
ok((await mia.post('/api/orders', { vehicle: S.vehicles[2].id })).status === 403, 'Azubi darf keinen Auftrag anlegen');
const ms = (await mia.get('/api/state')).body;
ok(ms.orders.every((x) => x.assignees.includes(ms.me.id)), 'Azubi sieht nur eigene Aufträge');
ok(ms.invoices.length === 0 && ms.accounts.length === 0 && !ms.audit, 'Azubi sieht keine Finanzen und kein Audit');
ok((await mia.put('/api/permissions', { type: 'user', id: ms.me.id, module: 'invoices', level: 4 })).status === 403, 'Rechte selbst erhöhen → 403');
ok((await kai.get('/api/admin/jobs')).status === 200, 'Support liest Jobs');
ok((await kai.put('/api/admin/security', S.security || {})).status === 403 || (await kai.put('/api/admin/security', {})).status === 403, 'Support ändert keine Sicherheit');
ok((await kai.post('/api/orders', {})).status === 403, 'Support ohne Rang hat keine Werkstattrechte');
const marco = (await login('marco.vogt@rostfrei.rp')).c;
ok((await marco.patch('/api/staff/' + byName('Lena'), { phone: '1' })).status === 403, 'Werkstattleitung ändert keine Inhaberin');
ok((await marco.put('/api/permissions', { type: 'rank', id: S.ranks.find((x) => x.name === 'Werkstattleitung').id, module: 'tax', level: 4 })).status === 403, 'eigenen Rang nicht ändern');
ok((await lena.patch('/api/admin/users/' + byName('Lena'), { status: 'locked' })).status === 409, 'letzter Administrator geschützt');

section('Einladung, 2FA, Sperre');
r = await lena.post('/api/staff/invite', { email: 'neu' + Date.now() + '@rostfrei.rp', name: 'Neu', rank: S.ranks.find((x) => x.name === 'Praktikant').id });
ok(r.status === 200 && r.body.link, 'Einladung');
const token = r.body.link.split('/').pop();
const nc = client();
ok((await nc.get('/api/auth/invite/' + token)).status === 200, 'Einladung gültig');
ok((await nc.post('/api/auth/invite/' + token, { name: 'Neu Ling', password: 'kurz' })).status === 400, 'Passwortregel');
ok((await nc.post('/api/auth/invite/' + token, { name: 'Neu Ling', password: PW })).status === 200, 'Einladung angenommen');
ok((await nc.get('/api/state')).status === 200, 'neuer Benutzer angemeldet');
ok((await nc.post('/api/auth/invite/' + token, { name: 'Noch Einer', password: PW })).status === 404, 'Einladung nur einmal');
const { c: nora } = await login('nora.weiss@rostfrei.rp');
r = await nora.post('/api/me/2fa/setup');
if (r.status === 409) console.log('  (2FA war schon aktiv – Stack nicht frisch)');
ok(r.status === 200 && r.body.secret && r.body.qr.startsWith('data:image/png'), '2FA-Setup');
ok((await nora.post('/api/me/2fa/enable', { code: totp(r.body.secret) })).status === 200, '2FA eingeschaltet');
ok((await login('nora.weiss@rostfrei.rp')).r.body.need2fa === true, 'Login verlangt Code');
ok((await login('nora.weiss@rostfrei.rp', totp(r.body.secret))).r.status === 200, 'Login mit Code');
for (let i = 0; i < 5; i++) await client().post('/api/auth/login', { email: 'luca.romano@rostfrei.rp', password: 'falsch' });
ok((await login('luca.romano@rostfrei.rp')).r.status === 423, 'Sperre nach Fehlversuchen');

section('Administration');
r = await lena.post('/api/admin/backups');
ok(r.status === 200 && r.body.file, 'Backup erstellt');
const dl = await lena.call('GET', '/api/admin/backups/' + r.body.file, undefined, true);
ok(dl.status === 200 && Number(dl.headers.get('content-length') || 1) > 0, 'Backup-Download');
ok((await lena.del('/api/admin/backups/' + r.body.file)).status === 200, 'Backup gelöscht');
ok((await lena.get('/api/admin/backups/..%2F..%2Fetc%2Fpasswd')).status === 400, 'Pfad-Trick abgelehnt');
ok((await lena.post('/api/admin/jobs/recurring.run/run')).body.ok === true, 'Job ausführen');
for (const p of ['/api/admin/users.csv', '/api/admin/audit.csv', '/api/export/kunden.csv', '/api/export/preisliste.csv', '/api/export/buchungen.csv']) {
  const x = await lena.call('GET', p, undefined, true);
  ok(x.status === 200 && (x.headers.get('content-type') || '').includes('text/csv'), 'CSV ' + p);
}
ok((await mia.call('GET', '/api/export/buchungen.csv', undefined, true)).status === 403, 'CSV Buchungen für Azubi gesperrt');
ok((await anon.get('/api/public/pricelist')).status === 200, 'öffentliche Preisliste');
r = await lena.post('/api/me/api-keys', { name: 'Test' });
ok(r.status === 200 && r.body.key.startsWith('bxs_'), 'API-Schlüssel');
const ak = await fetch(BASE + '/api/state', { headers: { authorization: 'Bearer ' + r.body.key } });
ok(ak.status === 200, 'Lesen mit API-Schlüssel');
const akw = await fetch(BASE + '/api/r/customers', { method: 'POST', headers: { authorization: 'Bearer ' + r.body.key, 'content-type': 'application/json' }, body: '{"name":"X"}' });
ok(akw.status === 401, 'API-Schlüssel kann nicht schreiben');

section('Validierung');
r = await lena.post('/api/r/customers', { name: '' });
ok(r.status === 400 && /Name/.test(r.body.message), 'Pflichtfeld mit deutscher Meldung: ' + r.body.message);
r = await lena.post('/api/r/vehicles', { plate: S.vehicles[0].plate.replace(' ', '') });
ok(r.status === 409, 'Kennzeichen doppelt (ohne Leerzeichen) → 409');
r = await lena.del('/api/r/categories/' + S.categories[0].id);
ok(r.status === 409, 'benutzte Kategorie nicht löschbar');

section('Fuhrpark');
let fs = (await lena.get('/api/state')).body;
const truck = fs.fleet.find((f) => f.status === 'available');
r = await mia.post(`/api/fleet/${truck.id}/checkout`, { driver: byName('Jonas'), km: truck.km });
ok(r.status === 403, 'Azubi gibt nicht für andere aus');
r = await lena.post(`/api/fleet/${truck.id}/checkout`, { km: truck.km - 5 });
ok(r.status === 400, 'Kilometerstand darf nicht sinken');
r = await lena.post(`/api/fleet/${truck.id}/checkout`, { km: truck.km, note: 'Test' });
ok(r.status === 200, 'Ausgabe');
ok((await lena.post(`/api/fleet/${truck.id}/checkout`, {})).status === 409, 'doppelte Ausgabe → 409');
r = await lena.post(`/api/fleet/${truck.id}/checkin`, { km: truck.km + 42, note: 'zurück' });
ok(r.status === 200, 'Rückgabe');
r = await lena.post(`/api/fleet/${truck.id}/entry`, { kind: 'service', text: 'Ölwechsel', amount: 250, account: acc('bank').id, nextDue: '2030-01-01', nextKm: truck.km + 10000 });
ok(r.status === 200, 'Service mit Kosten');
fs = (await lena.get('/api/state')).body;
const t2 = fs.fleet.find((f) => f.id === truck.id);
ok(t2.km === truck.km + 42 && t2.serviceDue === '2030-01-01' && t2.status === 'available', 'Fahrzeugdaten fortgeschrieben');
ok(fs.transactions.some((t) => t.source === 'fleet' && t.amount === 250), 'Fuhrpark-Kosten gebucht');

section('Bilder');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const mdl = fs.models[0];
ok((await mia.post('/api/images', { ownerType: 'model', ownerId: mdl.id, data: png })).status === 403, 'Azubi lädt keine Katalogbilder hoch');
ok((await lena.post('/api/images', { ownerType: 'model', ownerId: mdl.id, data: 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64') })).status === 400, 'Fake-PNG abgelehnt');
ok((await lena.post('/api/images', { ownerType: 'model', ownerId: mdl.id, data: 'data:image/svg+xml;base64,PHN2Zz4=' })).status === 400, 'SVG-Upload abgelehnt');
r = await lena.post('/api/images', { ownerType: 'model', ownerId: mdl.id, data: png, caption: 'Test' });
ok(r.status === 200, 'Bild hochgeladen');
const imgRes = await lena.call('GET', '/api/images/' + r.body.id, undefined, true);
ok(imgRes.status === 200 && imgRes.headers.get('content-type') === 'image/png' && /sandbox/.test(imgRes.headers.get('content-security-policy') || ''), 'Bild ausgeliefert mit Sandbox-CSP');
ok((await anon.get('/api/images/' + r.body.id)).status === 401, 'Bilder nur angemeldet');
ok((await lena.patch('/api/images/' + r.body.id, { cover: true })).status === 200, 'Titelbild setzen');
ok((await lena.del('/api/images/' + r.body.id)).status === 200, 'Bild löschen');

section('Tuning');
const pkg = fs.tuningPackages.find((p) => p.name === 'Street-Paket');
const veh = fs.vehicles.find((v) => v.status === 'active' && !fs.customers.find((c) => c.id === v.owner).blocked && fs.vehicleClasses.find((c) => c.id === v.cls).name === 'Sport');
r = await lena.post('/api/tuning/order', { vehicle: veh.id, items: [], packages: [pkg.id], status: 'quote', by: byName('Deniz') });
ok(r.status === 200 && r.body.no, 'Angebot aus Paket ' + JSON.stringify(r.body));
fs = (await lena.get('/api/state')).body;
const to = fs.orders.find((o) => o.id === r.body.id);
ok(to && to.status === 'quote' && to.items.length === pkg.items.length, 'alle Paketleistungen übernommen');
ok(to && to.items.every((i) => i.disc >= pkg.discount), 'Paketrabatt angewendet');
ok((await mia.post('/api/tuning/order', { vehicle: veh.id, items: [pkg.items[0]] })).status === 403, 'Azubi legt keinen Tuning-Auftrag an');

section('Regelwerk');
const kodex = fs.ruleDocs.find((d) => d.title === 'Firmen-Kodex');
const ms2 = (await mia.get('/api/state')).body;
ok(ms2.ruleDocs.length === 3 && (ms2.myAcks[kodex.id] || 0) < kodex.version, 'Mia sieht offene Fassung');
ok((await mia.patch('/api/rules/' + kodex.id, { title: 'X', body: 'Y' })).status === 403, 'Azubi ändert kein Regelwerk');
ok((await mia.post(`/api/rules/${kodex.id}/ack`)).status === 200, 'Mia bestätigt');
ok(((await mia.get('/api/state')).body.myAcks[kodex.id]) === kodex.version, 'Bestätigung gespeichert');
r = await lena.patch('/api/rules/' + kodex.id, { title: kodex.title, body: kodex.body + '\n\n## Neu\nTest', note: 'Test', newVersion: true });
ok(r.status === 200 && r.body.version === kodex.version + 1, 'neue Fassung');
ok(((await mia.get('/api/state')).body.myAcks[kodex.id]) < kodex.version + 1, 'neue Fassung muss neu bestätigt werden');
const ks = (await kai.get('/api/state')).body;
ok(ks.ruleDocs.length === 0, 'Support ohne Rang sieht kein Regelwerk');
ok((await kai.post(`/api/rules/${kodex.id}/ack`)).status === 403, 'Support kann nicht bestätigen');
r = await lena.get(`/api/rules/${kodex.id}/versions`);
ok(r.status === 200 && r.body.length === kodex.version + 1, 'Versionsverlauf');

section('Dashboard-Layout');
const ui = { ...(fs.me.ui || {}), dashboard: { order: ['revenue', 'kpis'], hidden: ['board'], spans: { revenue: 12 } } };
ok((await mia.patch('/api/me', { ui })).status === 200, 'Layout speichern');
const dash = (await mia.get('/api/state')).body.me.ui.dashboard;
ok(dash && dash.order.join() === 'revenue,kpis' && dash.hidden.join() === 'board' && dash.spans.revenue === 12, 'Layout am Benutzer');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
