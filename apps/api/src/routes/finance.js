// Zahlungen, Storno, Buchungen, Umbuchungen, Tagesabschluss, Steuern, Lohnlauf, Lager
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { fail, audit, getSetting, today, cents, isoWeek, notify, fireWebhooks } from '../lib.js';
import { computeTaxPeriod, computePayroll, periodBounds, taxRates } from '../calc.js';
import { moveStock } from './workshop.js';

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = z.coerce.number().positive('muss größer 0 sein').max(1e9);
const fmt = (n) => '$ ' + Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

async function closed(c, accountId, d) {
  const r = await c.one('SELECT 1 FROM cash_closings WHERE account_id = $1 AND day = $2', [accountId, d]);
  if (r) fail(409, 'Für diese Kasse ist der Tag schon abgeschlossen – bitte mit heutigem Datum buchen.');
}
async function book(c, req, { account, type, amount, title, category = 'Sonstiges', source = 'manual', sourceId = null, taxable = false, date = today() }) {
  await closed(c, account, date);
  return c.one(`INSERT INTO transactions (account_id, type, amount, title, category, source, source_id, taxable, booked_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [account, type, Number(amount).toFixed(2), title, category, source, sourceId, taxable, date, req.user ? req.user.id : null]);
}
export { book };

async function rateToday() {
  const r = await taxRates();
  return (r.find((x) => x.from <= today()) || { rate: 0 }).rate;
}
async function reserveShare(c, req, fromAccount, amountAbs, title, back = false) {
  const features = await getSetting('features', c);
  const tax = await getSetting('tax', c);
  if (!features.taxReserve || !tax.reserveAccount || tax.reserveAccount === fromAccount) return;
  const share = Math.round(cents(amountAbs) * (await rateToday()) / 100) / 100;
  if (share <= 0) return;
  const [src, dst] = back ? [tax.reserveAccount, fromAccount] : [fromAccount, tax.reserveAccount];
  await book(c, req, { account: src, type: 'transfer_out', amount: share, title, category: 'Umbuchung', source: 'reserve' });
  await book(c, req, { account: dst, type: 'transfer_in', amount: share, title, category: 'Umbuchung', source: 'reserve' });
}

export default async function financeRoutes(app) {
  // ---------- Zahlungen ----------
  app.post('/api/invoices/:id/payments', async (req) => {
    req.need('invoices', 3);
    const b = z.object({ amount, method: z.enum(['Bar', 'Karte', 'Überweisung']), account: uuid, date: day.optional() }).parse(req.body || {});
    return tx(async (c) => {
      const inv = await c.one('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Rechnung nicht gefunden');
      if (!['open', 'partial'].includes(inv.status)) fail(409, 'Diese Rechnung nimmt keine Zahlung an.');
      const openC = cents(inv.total) - cents(inv.paid);
      if (cents(b.amount) > openC) fail(400, `Höchstens ${fmt(openC / 100)} offen.`);
      const d = b.date || today();
      await c.query('INSERT INTO invoice_payments (invoice_id, amount, method, account_id, at, by_user) VALUES ($1,$2,$3,$4,$5,$6)', [inv.id, b.amount.toFixed(2), b.method, b.account, d, req.user.id]);
      const paidC = cents(inv.paid) + cents(b.amount);
      await c.query('UPDATE invoices SET paid = $2, status = $3 WHERE id = $1', [inv.id, (paidC / 100).toFixed(2), paidC >= cents(inv.total) ? 'paid' : 'partial']);
      const cust = inv.snapshot.customer ? inv.snapshot.customer.name : '';
      await book(c, req, { account: b.account, type: 'income', amount: b.amount, title: `Rechnung ${inv.no}${cust ? ' · ' + cust : ''}`, category: 'Rechnungen', source: 'invoice', sourceId: inv.id, date: d });
      await reserveShare(c, req, b.account, b.amount, `Steuer-Rücklage · ${inv.no}`);
      await audit(req, 'Rechnung', 'Zahlung', `${inv.no} · ${fmt(b.amount)} · ${b.method}`, c);
      return { ok: true };
    });
  });

  // ---------- Storno per Gegenrechnung ----------
  app.post('/api/invoices/:id/cancel', async (req) => {
    req.need('invoices', 3);
    if (!req.flag('rechnung.storno')) fail(403, 'Dir fehlt das Einzelrecht „Rechnungen stornieren“.');
    const b = z.object({ reason: z.string().trim().min(3, 'Grund angeben').max(300) }).parse(req.body || {});
    return tx(async (c) => {
      const inv = await c.one('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]) || fail(404, 'Rechnung nicht gefunden');
      if (!['open', 'partial', 'paid'].includes(inv.status)) fail(409, 'Diese Rechnung kann nicht storniert werden.');
      const { nextNumber } = await import('../lib.js');
      const no = await nextNumber(c, 'invoice');
      const snap = { ...inv.snapshot, ref: `Storno zu ${inv.no}`, lines: inv.snapshot.lines.map((l) => ({ ...l, total: -l.total })), gross: -inv.snapshot.gross, discount: -inv.snapshot.discount, total: -inv.snapshot.total, reason: b.reason };
      const credit = await c.one(`INSERT INTO invoices (no, order_id, callout_id, customer_id, total, paid, status, cancels_id, cancel_reason, snapshot, created_by) VALUES ($1,$2,$3,$4,$5,0,'credit',$6,$7,$8,$9) RETURNING id`,
        [no, inv.order_id, inv.callout_id, inv.customer_id, (-Number(inv.total)).toFixed(2), inv.id, b.reason, snap, req.user.id]);
      if (Number(inv.paid) > 0) {
        const last = await c.one('SELECT account_id FROM invoice_payments WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1', [inv.id]);
        await c.query('INSERT INTO invoice_payments (invoice_id, amount, method, account_id, by_user) VALUES ($1, $2, $3, $4, $5)', [inv.id, (-Number(inv.paid)).toFixed(2), 'Erstattung', last.account_id, req.user.id]);
        await book(c, req, { account: last.account_id, type: 'expense', amount: inv.paid, title: `Erstattung ${inv.no} (Storno ${no})`, category: 'Erstattungen', source: 'refund', sourceId: inv.id });
        await reserveShare(c, req, last.account_id, inv.paid, `Rücklage zurück · Storno ${inv.no}`, true);
      }
      await c.query(`UPDATE invoices SET status = 'cancelled', cancel_reason = $2 WHERE id = $1`, [inv.id, b.reason]);
      if (inv.order_id) {
        await c.query(`UPDATE orders SET status = 'done' WHERE id = $1 AND status IN ('invoiced','picked_up')`, [inv.order_id]);
        await c.query('INSERT INTO order_events (order_id, user_id, text) VALUES ($1, $2, $3)', [inv.order_id, req.user.id, `Rechnung ${inv.no} storniert (${no}) · zurück auf „Fertig“`]);
      }
      if (inv.callout_id) await c.query('UPDATE callouts SET invoice_id = NULL WHERE id = $1', [inv.callout_id]);
      await audit(req, 'Rechnung', 'Storniert', `${inv.no} · Gegenrechnung ${no} · ${b.reason}`, c);
      return { credit: credit.id };
    });
  });

  // ---------- Buchungen ----------
  app.post('/api/transactions', async (req) => {
    req.need('accounts', 3);
    const b = z.object({ type: z.enum(['income', 'expense']), account: uuid, amount, title: z.string().trim().min(2).max(120), category: z.string().trim().max(40).default('Sonstiges'), date: day.optional(), taxable: z.boolean().default(false) }).parse(req.body || {});
    return tx(async (c) => {
      const r = await book(c, req, { ...b, taxable: b.type === 'income' && b.taxable, date: b.date || today() });
      await audit(req, 'Buchungen', b.type === 'income' ? 'Einnahme' : 'Ausgabe', `${b.title} · ${fmt(b.amount)}`, c);
      return { id: r.id };
    });
  });
  app.delete('/api/transactions/:id', async (req) => {
    req.need('accounts', 4);
    return tx(async (c) => {
      const t = await c.one('SELECT * FROM transactions WHERE id = $1', [req.params.id]) || fail(404, 'Nicht gefunden');
      if (t.source !== 'manual') fail(409, 'Nur manuelle Buchungen lassen sich löschen; der Rest kommt aus Rechnungen, Lohn, Steuern oder Lager.');
      await closed(c, t.account_id, t.booked_at);
      if (t.taxable) {
        const f = await c.one('SELECT 1 FROM tax_periods WHERE $1 BETWEEN period_from AND period_to', [t.booked_at]);
        if (f) fail(409, 'Der Steuerzeitraum ist schon abgeführt.');
      }
      await c.query('DELETE FROM transactions WHERE id = $1', [t.id]);
      await audit(req, 'Buchungen', 'Gelöscht', `${t.title} · ${fmt(t.amount)}`, c);
      return { ok: true };
    });
  });
  app.post('/api/transfers', async (req) => {
    req.need('accounts', 3);
    const b = z.object({ from: uuid, to: uuid, amount, title: z.string().trim().max(120).default('Umbuchung') }).parse(req.body || {});
    if (b.from === b.to) fail(400, 'Quelle und Ziel sind gleich.');
    return tx(async (c) => {
      await book(c, req, { account: b.from, type: 'transfer_out', amount: b.amount, title: b.title, category: 'Umbuchung', source: 'transfer' });
      await book(c, req, { account: b.to, type: 'transfer_in', amount: b.amount, title: b.title, category: 'Umbuchung', source: 'transfer' });
      await audit(req, 'Konten', 'Umbuchung', `${fmt(b.amount)} · ${b.title}`, c);
      return { ok: true };
    });
  });

  // ---------- Tagesabschluss ----------
  app.post('/api/closings', async (req) => {
    if (!req.flag('kasse.abschluss')) fail(403, 'Dir fehlt das Einzelrecht „Tagesabschluss“.');
    const b = z.object({ account: uuid, counted: z.coerce.number().min(0).max(1e9), reason: z.string().trim().max(300).default(''), date: day.optional() }).parse(req.body || {});
    const d = b.date || today();
    return tx(async (c) => {
      await closed(c, b.account, d);
      const r = await c.one(`SELECT coalesce(sum(CASE WHEN type IN ('income','transfer_in') THEN amount ELSE -amount END), 0) AS b FROM transactions WHERE account_id = $1 AND booked_at <= $2`, [b.account, d]);
      const diffC = cents(b.counted) - cents(r.b);
      if (diffC !== 0 && !b.reason) fail(400, 'Bei einer Differenz bitte einen Grund angeben.');
      if (diffC !== 0) await book(c, req, { account: b.account, type: diffC > 0 ? 'income' : 'expense', amount: Math.abs(diffC) / 100, title: `Kassendifferenz ${d.split('-').reverse().join('.')}: ${b.reason}`, category: 'Kassendifferenz', source: 'closing', date: d });
      await c.query('INSERT INTO cash_closings (account_id, day, expected, counted, reason, by_user) VALUES ($1,$2,$3,$4,$5,$6)', [b.account, d, r.b, b.counted.toFixed(2), b.reason, req.user.id]);
      await audit(req, 'Kasse', 'Tagesabschluss', `Differenz ${fmt(diffC / 100)}${b.reason ? ' · ' + b.reason : ''}`, c);
      return { ok: true, diff: diffC / 100 };
    });
  });

  // ---------- Steuern ----------
  app.post('/api/tax/file', async (req) => {
    req.need('tax', 4);
    const b = z.object({ from: day, account: uuid.optional() }).parse(req.body || {});
    const tax = await getSetting('tax');
    const p = periodBounds(tax.period === 'month' ? 'month' : 'week', b.from);
    if (p.from !== b.from) fail(400, 'Ungültiger Zeitraum.');
    if (p.to >= today()) fail(409, 'Der Zeitraum läuft noch.');
    return tx(async (c) => {
      const ex = await c.one('SELECT 1 FROM tax_periods WHERE period_from = $1', [p.from]);
      if (ex) fail(409, 'Schon abgeführt.');
      const r = await computeTaxPeriod(p.from, p.to);
      const account = b.account || tax.reserveAccount || fail(400, 'Kein Konto für die Abführung.');
      let tId = null;
      if (r.taxC > 0) tId = (await book(c, req, { account, type: 'expense', amount: r.taxC / 100, title: `Steuern ${p.label} abgeführt`, category: 'Steuern', source: 'tax' })).id;
      await c.query('INSERT INTO tax_periods (period_from, period_to, revenue, tax, filed_by, account_id, transaction_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [p.from, p.to, (r.revenueC / 100).toFixed(2), (r.taxC / 100).toFixed(2), req.user.id, account, tId]);
      await audit(req, 'Steuern', 'Abgeführt', `${p.label} · ${fmt(r.taxC / 100)}`, c);
      return { ok: true, tax: r.taxC / 100 };
    });
  });
  app.post('/api/tax/rates', async (req) => {
    req.need('tax', 4);
    const b = z.object({ rate: z.coerce.number().min(0).max(100), from: day }).parse(req.body || {});
    const f = await one('SELECT max(period_to)::text AS t FROM tax_periods');
    if (f && f.t && b.from <= f.t) fail(409, 'Für abgeführte Zeiträume lässt sich der Satz nicht mehr ändern.');
    await q('INSERT INTO tax_rates (rate, valid_from, by_user) VALUES ($1, $2, $3) ON CONFLICT (valid_from) DO UPDATE SET rate = EXCLUDED.rate, by_user = EXCLUDED.by_user', [b.rate, b.from, req.user.id]);
    await audit(req, 'Steuern', 'Satz geändert', `${b.rate} % ab ${b.from}`);
    return { ok: true };
  });

  // ---------- Lohnlauf ----------
  app.post('/api/payroll/approve', async (req) => {
    req.need('payroll', 4);
    const b = z.object({ from: day, adjust: z.record(z.string(), z.coerce.number().min(-1e7).max(1e7)).default({}), account: uuid.optional() }).parse(req.body || {});
    const p = periodBounds('week', b.from);
    if (p.from !== b.from || p.to >= today()) fail(409, 'Nur abgeschlossene Wochen.');
    const tax = await getSetting('tax');
    const account = b.account || tax.payrollAccount || fail(400, 'Kein Lohnkonto eingestellt.');
    const lines = await computePayroll(p.from, p.to);
    return tx(async (c) => {
      const ex = await c.one('SELECT 1 FROM payroll_runs WHERE period_from = $1', [p.from]);
      if (ex) fail(409, 'Dieser Lohnlauf ist schon freigegeben.');
      let totalC = 0;
      const rows = [];
      for (const l of lines) {
        const adj = cents(b.adjust[l.user] || 0);
        const tC = Math.max(0, cents(l.total) + adj);
        totalC += tC;
        rows.push({ ...l, adj, tC });
      }
      const run = await c.one('INSERT INTO payroll_runs (period_from, period_to, total, approved_by) VALUES ($1, $2, $3, $4) RETURNING id', [p.from, p.to, (totalC / 100).toFixed(2), req.user.id]);
      for (const r of rows) {
        const u = await c.one('SELECT name FROM users WHERE id = $1', [r.user]);
        const t = r.tC > 0 ? await book(c, req, { account, type: 'expense', amount: r.tC / 100, title: `Lohn ${p.label} · ${u.name}`, category: 'Löhne', source: 'payroll' }) : null;
        await c.query('INSERT INTO payroll_lines (run_id, user_id, hours, hourly, commission_base, commission, fixed, adjust, total, transaction_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [run.id, r.user, r.hours, r.hourly, r.base, r.commission, r.fixed, (r.adj / 100).toFixed(2), (r.tC / 100).toFixed(2), t && t.id]);
      }
      await audit(req, 'Lohn', 'Lohnlauf freigegeben', `${p.label} · ${fmt(totalC / 100)}`, c);
      return { ok: true, total: totalC / 100 };
    });
  });

  // ---------- Lager ----------
  app.post('/api/stock/in', async (req) => {
    req.need('stock', 3);
    const b = z.object({ part: uuid, qty: z.coerce.number().positive().max(100000), buy: z.coerce.number().min(0).max(1e8).optional(), account: uuid.nullable().optional(), note: z.string().max(120).default('') }).parse(req.body || {});
    return tx(async (c) => {
      const p = await c.one('SELECT * FROM parts WHERE id = $1 FOR UPDATE', [b.part]) || fail(404, 'Teil nicht gefunden');
      const buy = b.buy ?? Number(p.buy);
      await c.query('UPDATE parts SET stock = stock + $2, buy = $3 WHERE id = $1', [p.id, b.qty, buy]);
      await c.query(`INSERT INTO stock_movements (part_id, qty, kind, reason, by_user) VALUES ($1, $2, 'in', $3, $4)`, [p.id, b.qty, b.note || 'Wareneingang', req.user.id]);
      if (b.account) {
        req.need('accounts', 3);
        await book(c, req, { account: b.account, type: 'expense', amount: Math.round(b.qty * buy * 100) / 100, title: `Wareneingang ${p.name} × ${b.qty}`, category: 'Teileeinkauf', source: 'stock', sourceId: p.id });
      }
      await audit(req, 'Lager', 'Wareneingang', `${p.name} +${b.qty}`, c);
      return { ok: true };
    });
  });
  app.post('/api/stock/adjust', async (req) => {
    req.need('stock', 3);
    const b = z.object({ part: uuid, counted: z.coerce.number().min(0).max(1e6).optional(), qty: z.coerce.number().min(-1e6).max(1e6).optional(), reason: z.string().trim().min(2, 'Grund angeben').max(160) }).parse(req.body || {});
    return tx(async (c) => {
      const p = await c.one('SELECT * FROM parts WHERE id = $1 FOR UPDATE', [b.part]) || fail(404, 'Teil nicht gefunden');
      const diff = b.counted !== undefined ? b.counted - Number(p.stock) : (b.qty || 0);
      if (!diff) return { ok: true, diff: 0 };
      await c.query('UPDATE parts SET stock = stock + $2 WHERE id = $1', [p.id, diff]);
      await c.query('INSERT INTO stock_movements (part_id, qty, kind, reason, by_user) VALUES ($1, $2, $3, $4, $5)', [p.id, diff, b.counted !== undefined ? 'inventory' : 'adjust', b.reason, req.user.id]);
      await audit(req, 'Lager', b.counted !== undefined ? 'Inventur' : 'Korrektur', `${p.name} ${diff > 0 ? '+' : ''}${diff} · ${b.reason}`, c);
      if (Number(p.stock) + diff < Number(p.min_stock)) fireWebhooks('Lager knapp', `${p.name}: ${Number(p.stock) + diff} ${p.unit}`);
      return { ok: true, diff };
    });
  });
}
export { isoWeek, notify };
