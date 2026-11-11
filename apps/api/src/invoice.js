// Rechnungen anlegen (aus Auftrag oder Einsatz) mit eingefrorenem Snapshot
import { nextNumber, getSetting, addDays, today, fireWebhooks } from './lib.js';
import { lineCents } from './pricing.js';

export async function createInvoice(c, req, { orderId = null, calloutId = null, customerId, vehicle = null, lines, ref = '' }) {
  const firm = await getSetting('firm', c);
  const logo = await getSetting('logo', c);
  const cust = customerId ? await c.one('SELECT * FROM customers WHERE id = $1', [customerId]) : null;
  const pg = cust && cust.price_group_id ? await c.one('SELECT name FROM price_groups WHERE id = $1', [cust.price_group_id]) : null;
  const totalC = lines.reduce((s, l) => s + lineCents(l.qty, l.unit, l.disc), 0);
  const grossC = lines.reduce((s, l) => s + lineCents(l.qty, l.unit, 0), 0);
  const no = await nextNumber(c, 'invoice');
  const terms = cust && cust.terms_days ? cust.terms_days : (firm.termsDays ?? 3);
  const snapshot = {
    firm: { name: firm.name, address: firm.address, phone: firm.phone, footer: firm.invoiceFooter, logo },
    customer: cust ? { name: cust.name, kind: cust.kind, phone: cust.phone, priceGroup: pg ? pg.name : '' } : null,
    vehicle, ref,
    lines: lines.map((l) => ({ name: l.name, qty: Number(l.qty), unit: Number(l.unit), disc: Number(l.disc), total: lineCents(l.qty, l.unit, l.disc) / 100 })),
    gross: grossC / 100, discount: (grossC - totalC) / 100, total: totalC / 100,
  };
  const inv = await c.one(`INSERT INTO invoices (no, order_id, callout_id, customer_id, issued, due, total, status, snapshot, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, no`,
  [no, orderId, calloutId, customerId, today(), addDays(today(), terms), (totalC / 100).toFixed(2), totalC === 0 ? 'paid' : 'open', snapshot, req.user.id]);
  await c.query(`INSERT INTO audit_log (user_id, area, action, detail, ip) VALUES ($1, 'Rechnung', 'Erstellt', $2, $3)`, [req.user.id, `${no} · $ ${(totalC / 100).toFixed(2)}`, req.ip]);
  fireWebhooks('Rechnung erstellt', `${no} · ${cust ? cust.name : ''} · $ ${(totalC / 100).toFixed(2)}`);
  return inv;
}
