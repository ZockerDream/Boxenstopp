// Berechnungen: Steuerzeiträume, Lohnlauf, Kontostände. Geld in Cent.
import { q } from './db.js';
import { today, addDays, weekStart, isoWeek, cents, fromCents, lineTotalCents, getSetting } from './lib.js';

// ---------- Steuer ----------
export async function taxRates() {
  return q('SELECT rate::float AS rate, valid_from::text AS from, by_user FROM tax_rates ORDER BY valid_from DESC');
}
const rateAt = (rates, day) => (rates.find((r) => r.from <= day) || { rate: 0 }).rate;

export function periodBounds(kind, day) {
  if (kind === 'month') {
    const from = day.slice(0, 8) + '01';
    const d = new Date(from + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    return { from, to: d.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(from + 'T12:00:00Z')) };
  }
  const from = weekStart(day);
  return { from, to: addDays(from, 6), label: 'KW ' + isoWeek(from) };
}

// Steuerpflichtiger Umsatz je Tag: Rechnungszahlungen (Erstattungen negativ) + als steuerpflichtig markierte manuelle Einnahmen
export async function taxableByDay(from, to) {
  const rows = await q(`
    SELECT day::text, sum(c)::bigint AS c FROM (
      SELECT at AS day, round(amount * 100) AS c FROM invoice_payments WHERE at BETWEEN $1 AND $2
      UNION ALL
      SELECT booked_at, round(amount * 100) FROM transactions WHERE taxable AND type = 'income' AND source IN ('manual','recurring') AND booked_at BETWEEN $1 AND $2
    ) x GROUP BY day`, [from, to]);
  return Object.fromEntries(rows.map((r) => [r.day, Number(r.c)]));
}

export async function computeTaxPeriod(from, to) {
  const rates = await taxRates();
  const byDay = await taxableByDay(from, to);
  let revenue = 0, tax = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const c = byDay[d] || 0;
    revenue += c;
    tax += Math.round(c * rateAt(rates, d) / 100);
  }
  return { revenueC: revenue, taxC: Math.max(0, tax), rate: rateAt(rates, to > today() ? today() : to) };
}

export async function taxPeriods(n = 8) {
  const tax = await getSetting('tax');
  const kind = tax.period === 'month' ? 'month' : 'week';
  const filed = Object.fromEntries((await q('SELECT period_from::text AS f, revenue, tax, filed_at, filed_by FROM tax_periods')).map((r) => [r.f, r]));
  const out = [];
  let day = today();
  for (let i = 0; i < n; i++) {
    const b = periodBounds(kind, day);
    const f = filed[b.from];
    const running = b.to >= today();
    let revenueC, taxC, rate;
    if (f) { revenueC = cents(f.revenue); taxC = cents(f.tax); rate = revenueC ? Math.round(taxC / revenueC * 1000) / 10 : 0; }
    else ({ revenueC, taxC, rate } = await computeTaxPeriod(b.from, b.to));
    out.push({ id: b.from, label: b.label, from: b.from, to: b.to, revenue: revenueC / 100, tax: taxC / 100, rate, status: f ? 'filed' : running ? 'running' : 'ready', filed: f ? new Date(f.filed_at).toISOString().slice(0, 10) : null, by: f ? f.filed_by : null });
    day = addDays(b.from, -1);
  }
  return out;
}

// ---------- Lohn ----------
export async function computePayroll(from, to) {
  const users = await q(`SELECT u.id, u.name, u.pay_model, r.pay AS rank_pay FROM users u JOIN ranks r ON r.id = u.rank_id
                         WHERE u.status IN ('active','leave') OR (u.status = 'left' AND u.left_on >= $1) ORDER BY r.position DESC, u.name`, [from]);
  const hours = Object.fromEntries((await q(`
    SELECT user_id, sum(extract(epoch FROM (least(coalesce(ended_at, now()), ($2::date + 1)::timestamptz) - greatest(started_at, $1::date::timestamptz))) / 3600)::float AS h
    FROM shifts WHERE ended_at IS NOT NULL AND started_at < ($2::date + 1)::timestamptz AND ended_at > $1::date::timestamptz GROUP BY user_id`, [from, to])).map((r) => [r.user_id, r.h]));
  const items = await q(`
    SELECT oi.by_user, oi.qty, oi.unit_price, oi.disc FROM order_items oi
    JOIN invoices i ON i.order_id = oi.order_id AND i.status IN ('open','partial','paid') AND i.cancels_id IS NULL
    WHERE i.issued BETWEEN $1 AND $2 AND oi.by_user IS NOT NULL`, [from, to]);
  const base = {};
  for (const it of items) base[it.by_user] = (base[it.by_user] || 0) + lineTotalCents(it.qty, it.unit_price, it.disc);
  const weeks = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000 + 1) / 7);
  return users.map((u) => {
    const pay = Object.assign({ hourly: 0, commission: 0, fixed: 0 }, u.rank_pay || {}, u.pay_model || {});
    const h = Math.round((hours[u.id] || 0) * 100) / 100;
    const hourlyC = Math.round(h * cents(pay.hourly));
    const baseC = base[u.id] || 0;
    const commC = Math.round(baseC * Number(pay.commission) / 100);
    const fixedC = Math.round(cents(pay.fixed) * weeks);
    return { user: u.id, hours: h, rate: Number(pay.hourly), comm: Number(pay.commission), base: baseC / 100, hourly: hourlyC / 100, commission: commC / 100, fixed: fixedC / 100, total: (hourlyC + commC + fixedC) / 100 };
  }).filter((l) => l.total > 0 || l.hours > 0);
}

// ---------- Kontostände ----------
export async function balances() {
  const rows = await q(`SELECT a.id, coalesce(sum(CASE WHEN t.type IN ('income','transfer_in') THEN t.amount ELSE -t.amount END), 0) AS b
                        FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id GROUP BY a.id`);
  return Object.fromEntries(rows.map((r) => [r.id, Number(r.b)]));
}

export { fromCents };
