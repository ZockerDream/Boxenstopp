// Boxenstopp – geführte Abläufe in der Oberfläche (verändert Daten, nur auf einem Wegwerf-Stack!).
// Aufruf im Playwright-Container: BASE=http://localhost:18190 SHOTS=/work/shots node browser.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:18190';
const PW = process.env.PW || 'Boxenstopp2026!';
const SHOTS = process.env.SHOTS || '';
const problems = [];
let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push('✗ ' + m); };
const browser = await chromium.launch();

async function session(email, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`JS ${email} ${page.url()}: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(BASE + '/#/login');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  return { ctx, page };
}
const go = async (page, h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const waitHash = async (page, prefix) => { for (let i = 0; i < 50; i++) { if (new URL(page.url()).hash.startsWith(prefix)) return true; await page.waitForTimeout(200); } throw new Error('Hash ' + prefix + ' nicht erreicht: ' + page.url()); };
const toast = async (page) => (await page.locator('.toast').last().textContent({ timeout: 4000 }).catch(() => '')) || '';

const { ctx, page } = await session('lena.brandt@rostfrei.rp');
// Neuer Auftrag über das Kennzeichen
await page.click('[data-action=new-order] >> nth=0');
await page.fill('#plateInput', 'DF 7777');
await page.waitForTimeout(100);
ok(await page.locator('#plateResult [data-vehicle]').count() === 1, 'Kennzeichen erkannt');
await page.fill('#orderForm [name=request]', 'Browser-Test: Inspektion');
await page.click('[data-action=create-order]');
await waitHash(page, '#/auftrag/');
ok(true, 'Auftrag angelegt');
await page.waitForTimeout(300);
// Position hinzufügen
const opt = await page.locator('#addItem option', { hasText: 'Inspektion' }).first().getAttribute('value');
await page.selectOption('#addItem', opt);
await page.click('[data-action=add-line]');
await page.waitForTimeout(500);
ok(await page.locator('table.table tbody tr').filter({ hasText: 'Inspektion' }).count() === 1, 'Position im Auftrag');
// Status: Arbeit beginnen → Fertig → Abrechnen
for (const label of ['Arbeit beginnen', 'Fertig melden']) { await page.click(`button:has-text("${label}")`); await page.waitForTimeout(500); }
ok((await page.locator('.page-head .badge').first().textContent()).includes('Fertig'), 'Status Fertig');
await page.click('button:has-text("Abrechnen")');
await page.click('[data-action=confirm-ok]');
await waitHash(page, '#/rechnung/');
ok(await page.locator('.paper').count() === 1, 'Rechnung angezeigt');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_rechnung.png' });
// Zahlung
await page.click('[data-action=payment]');
await page.click('[data-action=form-submit]');
await page.waitForTimeout(600);
ok((await page.locator('.page-head').textContent()).includes('Bezahlt'), 'Rechnung bezahlt');
// Rechte-Matrix: Zelle klicken ändert Stufe
await go(page, '#/berechtigungen');
const cell = page.locator('[data-action=perm-cycle]').nth(30);
const before = await cell.textContent();
await cell.click();
await page.waitForTimeout(600);
const after = await page.locator('[data-action=perm-cycle]').nth(30).textContent();
ok(before !== after, `Recht geändert (${before} → ${after})`);
// Darstellung V2 + Hell + Farbe
await go(page, '#/einstellungen?tab=darstellung');
await page.click('[data-arg="ui:v2"]');
await page.click('[data-arg="mode:light"]');
await page.click('[data-arg="accent:ocean"]');
ok(await page.evaluate(() => document.documentElement.dataset.ui === 'v2' && document.documentElement.dataset.theme === 'light'), 'Darstellung umgeschaltet');
await page.waitForTimeout(900);
await go(page, '#/dashboard');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_v2_light.png' });
await page.reload(); await page.waitForSelector('.sidebar');
ok(await page.evaluate(() => BX.data.me.ui.look && BX.data.me.ui.look.ui === 'v2'), 'Darstellung am Benutzer gespeichert');
await go(page, '#/einstellungen?tab=darstellung'); await page.click('[data-action=look-reset]'); await page.waitForTimeout(800);
// Logo-Vorlage
await go(page, '#/firma');
await page.click('[data-action=logo][data-arg=gauge]');
await page.waitForTimeout(500);
ok(await page.locator('.sidebar .brand-mark svg').count() === 1, 'Logo geändert');
await page.click('[data-action=logo][data-arg=wrench]');
// Dienst
await page.click('[data-action=duty]'); await page.waitForTimeout(500);
ok((await page.locator('.duty-btn').getAttribute('class')).includes('on'), 'Dienst begonnen');
await page.click('[data-action=duty]'); await page.waitForTimeout(500);
// Suche
await page.fill('#globalSearch', 'DF7777');
await page.waitForTimeout(100);
ok(await page.locator('#searchResults a').count() >= 1, 'Suche ohne Leerzeichen findet Kennzeichen');
// Dashboard anpassen
await go(page, '#/dashboard');
const modsBefore = await page.locator('.dash-mod').count();
await page.click('[data-action=dash-edit] >> nth=0');
await page.click('[data-action=dash-hide][data-arg=board]');
await page.waitForTimeout(400);
ok(await page.locator('.dash-mod').count() === modsBefore - 1, 'Modul ausgeblendet');
await page.click('[data-action=dash-add][data-arg=board]');
await page.waitForTimeout(400);
ok(await page.locator('.dash-mod').last().getAttribute('data-mod') === 'board', 'Modul wieder hinzugefügt (am Ende)');
await page.click('[data-action=dash-span][data-arg="revenue:12"]');
await page.waitForTimeout(400);
ok((await page.locator('.dash-mod[data-mod=revenue]').getAttribute('style')).includes('--span:12'), 'Breite geändert');
const first = await page.locator('.dash-mod').nth(1).getAttribute('data-mod');
await page.locator('.dash-mod').nth(1).dragTo(page.locator('.dash-mod').nth(0), { targetPosition: { x: 10, y: 40 } });
await page.waitForTimeout(500);
ok(await page.locator('.dash-mod').nth(0).getAttribute('data-mod') === first, 'Modul per Ziehen verschoben');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_dash_edit.png' });
await page.click('[data-action=dash-edit] >> nth=0');
await page.reload(); await page.waitForSelector('.dash-grid');
ok(await page.locator('.dash-mod').nth(0).getAttribute('data-mod') === first, 'Layout nach Neuladen erhalten');
await page.click('[data-action=dash-edit] >> nth=0'); await page.click('[data-action=dash-reset]'); await page.click('[data-action=confirm-ok]'); await page.waitForTimeout(500);
await page.click('[data-action=dash-edit] >> nth=0');
// Diagramme: Tooltip, Legende, Zeitraum
const col = page.locator('.dash-mod[data-mod=revenue] .col').last();
await col.hover();
await page.waitForTimeout(100);
ok(await page.locator('#chartTip').isVisible() && (await page.locator('#chartTip').textContent()).includes('Umsatz'), 'Tooltip im Umsatzdiagramm');
await page.click('[data-action=chart-range][data-arg="dashRev:30"]');
ok(await page.locator('.dash-mod[data-mod=revenue] .col').count() === 30, 'Zeitraum 30 Tage');
await page.click('.dash-mod[data-mod=revenue] [data-action=chart-toggle]');
ok(await page.locator('.dash-mod[data-mod=revenue] .leg.off').count() === 1, 'Reihe ausgeblendet');
await page.locator('.dash-mod[data-mod=weekly] .bar-group').last().click();
await page.waitForTimeout(300);
ok(new URL(page.url()).hash.startsWith('#/buchungen?von='), 'Klick auf Woche öffnet Buchungen');
await go(page, '#/dashboard');
await page.locator('.dash-mod[data-mod=orderStatus] .leg-row').first().hover();
ok((await page.locator('.dash-mod[data-mod=orderStatus] .dc-label').textContent()) !== 'Aufträge', 'Donut zeigt Segment in der Mitte');
// Fuhrpark: ausgeben und zurückgeben
await go(page, '#/fuhrpark');
const fid = await page.evaluate(() => BX.data.fleet.find((f) => f.status === 'available').id);
await page.click(`[data-action=fleet-out][data-arg="${fid}"]`);
await page.click('[data-action=form-submit]'); await page.waitForTimeout(500);
ok(await page.evaluate((id) => BX.data.fleet.find((f) => f.id === id).status === 'in_use', fid), 'Fahrzeug ausgegeben');
await page.click(`[data-action=fleet-in][data-arg="${fid}"]`);
await page.fill('#bxForm [name=km]', String(await page.evaluate((id) => BX.data.fleet.find((f) => f.id === id).km + 25, fid)));
await page.click('[data-action=form-submit]'); await page.waitForTimeout(500);
ok(await page.evaluate((id) => BX.data.fleet.find((f) => f.id === id).status === 'available', fid), 'Fahrzeug zurück');
await go(page, '#/fuhrpark/' + fid + '?tab=kosten');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_fleet.png' });
// Katalog: Galerie
await go(page, '#/modelle');
await page.locator('.model-card').first().click(); await page.waitForTimeout(200);
await page.click('.gal-main');
ok(await page.locator('.lightbox img').count() === 1, 'Leuchtkasten öffnet');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_lightbox.png' });
await page.keyboard.press('Escape');
// Tuning: Paket → Angebot
const tv = await page.evaluate(() => { const v = BX.data.vehicles.find((x) => x.status === 'active' && !BX.data.customers.find((c) => c.id === x.owner).blocked && x.modelId); return v.id; });
await go(page, '#/tuning?v=' + tv);
await page.locator('.pkg').first().click(); await page.waitForTimeout(200);
ok(await page.locator('.tune-opt.on').count() >= 2, 'Paket wählt Leistungen');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_tuning.png' });
await page.click('[data-action=tune-order][data-arg=quote]');
await waitHash(page, '#/auftrag/');
ok((await page.locator('.page-head .badge').first().textContent()).includes('Angebot'), 'Tuning-Angebot angelegt');
// Regelwerk: Mia bestätigt später; hier Ansicht + Bestätigungen
await go(page, '#/regelwerk?tab=bestaetigungen');
ok(await page.locator('table.table tbody tr').count() >= 5, 'Bestätigungen-Übersicht');
await go(page, '#/regelwerk');
if (SHOTS) await page.screenshot({ path: SHOTS + '/flow_rules.png' });

// Abmelden
await page.click('[data-action=user-menu]');
await page.click('[data-action=logout]');
await page.waitForSelector('input[name=email]');
ok(true, 'Abmelden');
await ctx.close();

// Azubi bestätigt den Firmen-Kodex
const mi = await session('mia.schulz@rostfrei.rp');
ok((await mi.page.locator('.nav a[href="#/regelwerk"] .count').textContent()).trim() === '1', 'Zähler „Regelwerk“ zeigt offene Fassung');
const kid = await mi.page.evaluate(() => BX.data.ruleDocs.find((d) => d.title === 'Firmen-Kodex').id);
await go(mi.page, '#/regelwerk?doc=' + kid);
await mi.page.click('[data-action=rule-ack]'); await mi.page.waitForTimeout(500);
ok(await mi.page.locator('.nav a[href="#/regelwerk"] .count').count() === 0, 'nach Bestätigung kein Zähler');
await mi.ctx.close();

// Azubi: eingeschränkte Navigation
const az = await session('mia.schulz@rostfrei.rp');
const nav = await az.page.locator('.nav a').allTextContents();
ok(!nav.some((t) => /Rechnungen|Steuern|User-Management|Berechtigungen/.test(t)), 'Azubi sieht keine Finanzen/Administration');
await go(az.page, '#/steuern');
ok((await az.page.textContent('main')).includes('Kein Zugriff'), 'Direktaufruf ohne Recht → Kein Zugriff');
await az.ctx.close();

// Handy und Tablet: kein seitliches Scrollen
for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
  const s = await session('lena.brandt@rostfrei.rp', { width: w, height: h });
  for (const r of ['dashboard', 'auftraege', 'kunden', 'preisliste', 'rechnungen', 'steuern', 'berechtigungen', 'users', 'server', 'einstellungen?tab=darstellung', 'fuhrpark', 'modelle', 'tuning', 'regelwerk']) {
    await go(s.page, '#/' + r);
    const sw = await s.page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w + 1, `${w}px #/${r} ohne Überlauf (${sw})`);
  }
  if (SHOTS) { await go(s.page, '#/dashboard'); await s.page.screenshot({ path: `${SHOTS}/flow_${w}.png` }); }
  await s.ctx.close();
}
await browser.close();
console.log(`${passed} bestanden, ${problems.length} Probleme`);
if (problems.length) console.log(problems.join('\n'));
process.exit(problems.length ? 1 : 0);
