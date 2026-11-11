// Boxenstopp – Browser-Crawl: meldet sich als mehrere Rollen an, öffnet jede Seite und jeden Tab,
// sammelt JS-Fehler, Server-Fehler und sichtbare „undefined“/„NaN“. Nur lesend.
// Aufruf (im Playwright-Container mit --network host): BASE=http://localhost:9099 node crawl.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:9099';
const PW = process.env.PW || 'Boxenstopp2026!';
const USERS = (process.env.USERS || 'lena.brandt,marco.vogt,mia.schulz,kai.neumann').split(',');
const SHOTS = process.env.SHOTS || '';
const routes = ['dashboard', 'auftraege', 'auftraege?view=liste', 'termine', 'einsaetze', 'kunden', 'kunden?archiv=1', 'fahrzeuge', 'preisliste', 'preisliste?tab=klassen', 'preisliste?tab=gruppen', 'preisliste?tab=kunde',
  'lager', 'lager?tab=bewegungen', 'finanzen', 'rechnungen', 'rechnungen?status=offen', 'buchungen', 'buchungen?tab=dauer', 'konten', 'steuern', 'lohn', 'berichte',
  'dienstplan', 'dienstplan?tab=aktivitaet', 'dienstplan?tab=schichten', 'dienstplan?tab=abwesend', 'schulungen', 'schulungen?tab=termine', 'schulungen?tab=nachweise', 'lizenzen', 'lizenzen?tab=firma', 'lizenzen?tab=arten',
  'qualifikationen', 'personalakten', 'brett', 'mitarbeiter', 'raenge', 'berechtigungen', 'berechtigungen?tab=gruppen', 'berechtigungen?tab=personen', 'berechtigungen?tab=einzel', 'berechtigungen?tab=wer',
  'firma', 'firma?tab=steuer', 'firma?tab=klassen', 'firma?tab=funktionen', 'users', 'users?tab=rollen', 'users?tab=einladungen', 'server', 'server?tab=sicherheit', 'server?tab=system', 'server?tab=integrationen', 'server?tab=audit',
  'tickets', 'fehler', 'hilfe', 'changelog', 'einstellungen', 'einstellungen?tab=sicherheit', 'einstellungen?tab=darstellung', 'einstellungen?tab=sitzungen', 'einstellungen?tab=api', 'einstellungen?tab=rechte'];

const browser = await chromium.launch();
const problems = [];
let pages = 0;
for (const who of USERS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${who} JS ${page.url()}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403/.test(m.text())) problems.push(`${who} console ${page.url()}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${who} HTTP ${r.status()} ${r.url()}`); });
  await page.goto(BASE + '/#/login');
  await page.fill('input[name=email]', who + '@rostfrei.rp');
  await page.fill('input[name=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  // Detailseiten aus den Daten
  const ids = await page.evaluate(() => ({ o: (BX.data.orders || []).slice(-3).map((x) => x.id), k: (BX.data.customers || []).slice(0, 2).map((x) => x.id), v: (BX.data.vehicles || []).slice(0, 2).map((x) => x.id), i: (BX.data.invoices || []).slice(0, 3).map((x) => x.id), s: (BX.data.staff || []).filter((x) => x.rank).slice(0, 3).map((x) => x.id) }));
  const all = routes.concat(ids.o.map((x) => 'auftrag/' + x), ids.k.flatMap((x) => ['kunde/' + x, 'kunde/' + x + '?tab=rechnungen', 'kunde/' + x + '?tab=eintraege']), ids.v.flatMap((x) => ['fahrzeug/' + x, 'fahrzeug/' + x + '?tab=tuning', 'fahrzeug/' + x + '?tab=garantie']), ids.i.map((x) => 'rechnung/' + x), ids.s.map((x) => 'personalakten?u=' + x), ids.s.map((x) => 'berechtigungen?tab=wer&u=' + x));
  for (const r of all) {
    await page.evaluate((h) => { location.hash = h; }, '#/' + r);
    await page.waitForTimeout(40);
    pages++;
    const txt = await page.textContent('main').catch(() => '');
    const m = (txt || '').match(/.{0,50}(undefined|NaN|\[object Object\]|Fehler beim Anzeigen).{0,50}/);
    if (m) problems.push(`${who} #/${r}: „${m[0]}“`);
    if (SHOTS && who === USERS[0] && /^(dashboard|auftraege|auftrag\/|preisliste$|rechnung\/|steuern|lohn|qualifikationen|berechtigungen$|users$|server$|einstellungen\?tab=darstellung)/.test(r)) await page.screenshot({ path: `${SHOTS}/${who}_${r.replace(/[\/?=&]/g, '_').slice(0, 60)}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`${pages} Seitenaufrufe, ${USERS.length} Rollen`);
console.log(problems.length ? [...new Set(problems)].join('\n') : 'KEINE PROBLEME');
process.exit(problems.length ? 1 : 0);
