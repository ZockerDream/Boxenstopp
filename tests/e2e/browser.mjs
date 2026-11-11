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
// Abmelden
await page.click('[data-action=user-menu]');
await page.click('[data-action=logout]');
await page.waitForSelector('input[name=email]');
ok(true, 'Abmelden');
await ctx.close();

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
  for (const r of ['dashboard', 'auftraege', 'kunden', 'preisliste', 'rechnungen', 'steuern', 'berechtigungen', 'users', 'server', 'einstellungen?tab=darstellung']) {
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
