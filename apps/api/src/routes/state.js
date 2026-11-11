// GET /api/state – alles, was die Oberfläche braucht, gefiltert nach den Rechten des Benutzers.
import fs from 'node:fs/promises';
import { q, one } from '../db.js';
import { today, addDays, weekStart, isoWeek, getSetting, hm, sha256 } from '../lib.js';
import { MODULES, FLAGS, SYS_PERMS, explain, flagOf, sysPerms } from '../authz.js';
import { taxPeriods, taxRates, computePayroll, balances, periodBounds } from '../calc.js';
import { config, ENV_PUBLIC } from '../config.js';

const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#ec4899', '#84cc16', '#6366f1', '#f97316', '#0ea5e9', '#eab308'];
const num = (v) => (v === null || v === undefined ? null : Number(v));
const iso = (t) => (t ? new Date(t).toISOString() : null);
const local = (t) => (t ? new Date(t).toLocaleString('sv-SE', { timeZone: config.tz }).slice(0, 16) : null);

export async function buildState(req) {
  const me = req.user;
  const A = req.A;
  const L = (m) => req.level(m);
  const TODAY = today();
  const [firm, logo, features, taxS] = await Promise.all([getSetting('firm'), getSetting('logo'), getSetting('features'), getSetting('tax')]);
  const S = { TODAY, version: config.version };
  S.firm = { ...firm, features, taxPeriod: taxS.period === 'month' ? 'Monat' : 'Woche', reserveAccount: taxS.reserveAccount, payrollAccount: taxS.payrollAccount };
  S.logo = logo;

  // ---------- Personal ----------
  S.ranks = (await q('SELECT id, name, position AS pos, pay FROM ranks ORDER BY position DESC'));
  S.groups = await q('SELECT id, name, description AS desc FROM groups ORDER BY name');
  const users = await q('SELECT * FROM users ORDER BY created_at, name');
  const seeStaff = L('staff') >= 2 || req.sys('user:read');
  S.staff = users.map((u, i) => {
    const base = { id: u.id, name: u.name, rank: u.rank_id, groups: A.groupsOf[u.id] || [], owner: u.is_owner, color: COLORS[i % COLORS.length], status: u.status, staffNo: u.staff_no, dutyNo: u.duty_no, sys: A.rolesOf[u.id] || [] };
    if (seeStaff || u.id === me.id) Object.assign(base, { email: u.email, phone: u.phone, joined: u.joined_on, left: u.left_on, twofa: u.totp_enabled, force2fa: u.force_2fa, lastLogin: local(u.last_login_at), expires: u.expires_on, payModel: u.pay_model, locked: !!(u.locked_until && new Date(u.locked_until) > new Date()) });
    return base;
  }).filter((u) => u.status !== 'pending' || req.sys('user:read'));
  S.rankHistory = L('stafffiles') >= 2 ? await q('SELECT user_id AS user, from_rank AS "from", to_rank AS "to", by_user AS by, reason, at::date::text AS date FROM rank_history ORDER BY at DESC') : [];

  const levels = Object.fromEntries(MODULES.map((m) => [m, L(m)]));
  // Funktionsschalter blenden Module aus
  if (!features.stock) levels.stock = 0;
  if (!features.callouts) levels.callouts = 0;
  if (!features.appointments) levels.appointments = 0;
  S.me = {
    id: me.id, owner: me.is_owner, levels, flags: Object.fromEntries(Object.keys(FLAGS).map((f) => [f, flagOf(A, me, f)])), sys: sysPerms(A, me),
    ui: me.ui || {}, twofa: me.totp_enabled, needs2fa: false,
  };
  const sec = await getSetting('security');
  S.me.needs2fa = !me.totp_enabled && (me.force_2fa || sec.require2fa === 'all' || (sec.require2fa === 'admins' && S.me.sys.length > 0));

  if (L('perms') >= 1 || L('ranks') >= 1) {
    S.rankPerms = Object.fromEntries(S.ranks.map((r) => [r.id, Object.fromEntries(MODULES.map((m) => [m, (A.rank[r.id] && A.rank[r.id][m]) || 0]))]));
    S.groupPerms = Object.fromEntries(S.groups.map((g) => [g.id, A.group[g.id] || {}]));
    S.userPerms = A.user;
    S.flags = Object.entries(FLAGS).map(([key, f]) => ({ key, label: f.label, type: f.type, ranks: Object.fromEntries(S.ranks.map((r) => [r.id, (A.fRank[r.id] || {})[key]])), groups: Object.fromEntries(Object.entries(A.fGroup).filter(([, v]) => v[key] !== undefined).map(([g, v]) => [g, v[key]])), users: Object.fromEntries(Object.entries(A.fUser).filter(([, v]) => v[key] !== undefined).map(([u, v]) => [u, v[key]])) }));
    const srcLabel = (u, e) => {
      if (e.source.startsWith('Gruppe:')) { const g = S.groups.find((x) => x.id === e.source.slice(7)); return 'Gruppe ' + (g ? g.name : '?'); }
      if (e.source === 'Rang') return 'Rang ' + ((S.ranks.find((r) => r.id === u.rank_id) || {}).name || '');
      return e.source;
    };
    S.explain = Object.fromEntries(users.filter((u) => u.rank_id).map((u) => [u.id, {
      levels: Object.fromEntries(MODULES.map((m) => { const e = explain(A, u, m); return [m, { level: e.level, source: srcLabel(u, e) }]; })),
      flags: Object.fromEntries(Object.keys(FLAGS).map((f) => [f, flagOf(A, u, f)])),
    }]));
  }

  // ---------- Stammdaten ----------
  S.vehicleClasses = await q('SELECT id, name, position AS pos FROM vehicle_classes ORDER BY position, name');
  S.priceGroups = (await q('SELECT id, name, pct, cats, is_default AS "isDefault" FROM price_groups ORDER BY pct, name')).map((g) => ({ ...g, pct: num(g.pct) }));
  S.categories = await q('SELECT id, name, position AS pos FROM catalog_categories ORDER BY position, name');
  S.trainings = await q('SELECT id, name, description AS desc, months, test, active FROM trainings ORDER BY name');
  S.licenseTypes = await q('SELECT id, name, holder, months FROM license_types ORDER BY name');
  S.rankReq = {};
  for (const r of await q('SELECT rank_id, training_id FROM rank_requirements')) (S.rankReq[r.rank_id] ||= []).push(r.training_id);
  S.bays = await q('SELECT id, name, position AS pos, active FROM bays ORDER BY position, name');
  const needCatalog = L('catalog') >= 1 || L('orders') >= 1 || L('callouts') >= 1;
  S.catalog = needCatalog ? (await q('SELECT * FROM catalog_items ORDER BY position, name')).map((c) => ({
    id: c.id, cat: c.category_id, name: c.name, kind: c.kind, unit: c.unit, price: num(c.price), surcharge: c.surcharge, classPrices: c.class_prices,
    material: L('catalog') >= 2 ? num(c.material) : null, minutes: c.minutes, warranty: c.warranty, req: c.req.map((r) => r.split(':')[1]), reqRaw: c.req, group: c.group_id, tuning: c.tuning, parts: c.parts, part: c.part_id, active: c.active, note: L('catalog') >= 2 ? c.note : '', pos: c.position,
  })) : [];
  S.parts = (L('stock') >= 1 || L('orders') >= 1) ? (await q('SELECT * FROM parts ORDER BY name')).map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, stock: num(p.stock), reserved: num(p.reserved), min: num(p.min_stock), loc: p.location, buy: L('stock') >= 2 ? num(p.buy) : null, sell: num(p.sell), active: p.active })) : [];
  S.stockMovements = L('stock') >= 2 ? await q(`SELECT m.id, local_ts(m.at) AS at, m.part_id AS part, m.qty::float AS qty, m.kind, m.ref, m.reason, m.by_user AS by FROM stock_movements m ORDER BY m.at DESC LIMIT 300`).catch(() => []) : [];

  // ---------- Kunden & Fahrzeuge ----------
  const needCust = ['customers', 'orders', 'invoices', 'appointments', 'callouts', 'vehicles'].some((m) => L(m) >= 1);
  S.customers = needCust ? (await q('SELECT * FROM customers ORDER BY name')).map((c) => ({ id: c.id, name: c.name, kind: c.kind, phone: c.phone, pg: c.price_group_id, terms: c.terms_days, tags: c.tags, warning: c.warning, blocked: c.blocked, since: c.since, archived: c.archived })) : [];
  S.customerEntries = L('customers') >= 1 ? await q('SELECT id, customer_id AS customer, author_id AS author, at, body FROM customer_entries ORDER BY at DESC') : [];
  S.vehicles = needCust ? (await q('SELECT * FROM vehicles ORDER BY plate')).map((v) => ({ id: v.id, plate: v.plate, make: v.make, model: v.model, cls: v.class_id, color: v.color, vin: v.vin, km: v.km, owner: v.owner_id, status: v.status, created: v.created_at, modelId: v.model_id })) : [];
  S.ownerHistory = L('vehicles') >= 1 ? await q('SELECT vehicle_id AS vehicle, customer_id AS customer, from_at::text AS "from", to_at::text AS "to" FROM vehicle_owner_history ORDER BY from_at DESC') : [];
  S.tuning = L('vehicles') >= 1 ? await q('SELECT vehicle_id AS vehicle, category, level, source, updated_at::date::text AS date FROM vehicle_tuning') : [];

  // ---------- Aufträge ----------
  const ol = L('orders');
  let orders = [];
  if (ol >= 1) {
    orders = await q(`SELECT o.*, coalesce(array_agg(a.user_id) FILTER (WHERE a.user_id IS NOT NULL), '{}') AS assignees FROM orders o
                      LEFT JOIN order_assignees a ON a.order_id = o.id GROUP BY o.id ORDER BY o.created_at`);
    if (ol === 1) orders = orders.filter((o) => o.assignees.includes(me.id));
  }
  const oids = orders.map((o) => o.id);
  const items = oids.length ? await q('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY created_at', [oids]) : [];
  const events = oids.length ? await q('SELECT order_id, at, user_id, text FROM order_events WHERE order_id = ANY($1) ORDER BY at', [oids]) : [];
  const notes = oids.length ? await q('SELECT id, order_id, author_id, at, body FROM order_notes WHERE order_id = ANY($1) ORDER BY at DESC', [oids]) : [];
  S.orders = orders.map((o) => ({
    id: o.id, no: o.no, status: o.status, vehicle: o.vehicle_id, customer: o.customer_id, pgId: o.price_group_id, assignees: o.assignees, request: o.request, mileage: o.mileage, condition: o.condition,
    due: o.due, bay: o.bay_id, created: local(o.created_at).slice(0, 10), createdAt: local(o.created_at), cancelReason: o.cancel_reason,
    items: items.filter((i) => i.order_id === o.id).map((i) => ({ id: i.id, item: i.catalog_item_id, name: i.name, kind: i.kind, qty: num(i.qty), unit: num(i.unit_price), disc: num(i.disc), by: i.by_user, parts: i.parts, taken: i.parts_taken })),
    events: events.filter((e) => e.order_id === o.id).map((e) => ({ at: local(e.at), user: e.user_id, text: e.text })),
    notes: notes.filter((n) => n.order_id === o.id).map((n) => ({ id: n.id, author: n.author_id, at: local(n.at), body: n.body })),
  }));
  S.discountRequests = oids.length ? (await q(`SELECT id, order_id AS "order", order_item_id AS item, requested_by AS by, pct::float, status, local_ts(created_at) AS at FROM discount_requests WHERE order_id = ANY($1) AND status = 'open'`, [oids])) : [];

  // ---------- Rechnungen & Finanzen ----------
  const il = L('invoices');
  let invoices = [];
  if (il >= 1) {
    invoices = await q('SELECT * FROM invoices ORDER BY issued DESC, no DESC');
    if (il === 1) invoices = invoices.filter((i) => oids.includes(i.order_id));
  }
  const pays = invoices.length ? await q('SELECT id, invoice_id, amount::float, method, account_id, at::text, by_user FROM invoice_payments WHERE invoice_id = ANY($1) ORDER BY created_at', [invoices.map((i) => i.id)]) : [];
  S.invoices = invoices.map((i) => {
    const st = i.status === 'credit' ? 'credit' : i.status === 'cancelled' ? 'cancelled' : (['open', 'partial'].includes(i.status) && i.due < TODAY) ? 'overdue' : i.status;
    const p = pays.filter((x) => x.invoice_id === i.id);
    return { id: i.id, no: i.no, order: i.order_id, callout: i.callout_id, customer: i.customer_id, issued: i.issued, due: i.due, total: num(i.total), paid: num(i.paid), status: st, cancels: i.cancels_id, cancelReason: i.cancel_reason, snapshot: i.snapshot, payments: p.map((x) => ({ amount: x.amount, method: x.method, account: x.account_id, at: x.at, by: x.by_user })), method: p.length ? p[p.length - 1].method : '' };
  });
  const al = L('accounts');
  const bal = await balances();
  const accs = await q('SELECT id, name, kind, archived FROM accounts ORDER BY CASE kind WHEN \'bank\' THEN 0 WHEN \'cash\' THEN 1 WHEN \'other\' THEN 2 ELSE 3 END, name');
  S.accounts = (al >= 2 || L('tax') >= 2) ? accs.map((a) => ({ ...a, balance: bal[a.id] || 0 })) : (il >= 3 || L('stock') >= 3 || L('payroll') >= 3) ? accs.map((a) => ({ ...a, balance: null })) : [];
  S.transactions = al >= 2 ? await q(`SELECT id, booked_at::text AS date, type, account_id AS account, amount::float, title, category AS cat, source, taxable, created_by AS by FROM transactions ORDER BY booked_at DESC, created_at DESC LIMIT 1000`) : [];
  S.recurring = al >= 2 ? await q(`SELECT id, name, amount::float, type, every, next_run::text AS next, account_id AS account, category AS cat, active, taxable FROM recurring_rules ORDER BY name`) : [];
  S.closings = al >= 2 ? await q(`SELECT c.id, c.day::text AS date, c.account_id AS account, c.expected::float, c.counted::float, c.reason, c.by_user AS by FROM cash_closings c ORDER BY day DESC LIMIT 30`) : [];
  if (L('tax') >= 1) { S.taxPeriods = await taxPeriods(8); S.taxRateHistory = await taxRates(); }
  else { S.taxPeriods = []; S.taxRateHistory = (await taxRates()).slice(0, 1); }
  S.firm.taxRate = (S.taxRateHistory.find((r) => r.from <= TODAY) || { rate: 0 }).rate;

  // Umsatz der letzten 14 Tage und 8 Wochen (Zahlungseingänge bzw. Ausgaben)
  if (il >= 2 || al >= 2 || L('reports') >= 1) {
    const from90 = addDays(TODAY, -89);
    const daily = Object.fromEntries((await q('SELECT at::text AS d, sum(amount)::float AS v FROM invoice_payments WHERE at >= $1 GROUP BY at', [from90])).map((r) => [r.d, r.v]));
    const dexp = Object.fromEntries((await q(`SELECT booked_at::text AS d, sum(amount)::float AS v FROM transactions WHERE type = 'expense' AND booked_at >= $1 GROUP BY 1`, [from90])).map((r) => [r.d, r.v]));
    S.revenue90 = Array.from({ length: 90 }, (_, i) => { const d = addDays(from90, i); return { date: d, rev: daily[d] || 0, exp: dexp[d] || 0 }; });
    S.revenue14 = S.revenue90.slice(-14);
    const ws = weekStart(TODAY);
    const from8 = addDays(ws, -7 * 25);
    const rev = Object.fromEntries((await q(`SELECT date_trunc('week', at)::date::text AS w, sum(amount)::float AS v FROM invoice_payments WHERE at >= $1 GROUP BY 1`, [from8])).map((r) => [r.w, r.v]));
    const exp = Object.fromEntries((await q(`SELECT date_trunc('week', booked_at)::date::text AS w, sum(amount)::float AS v FROM transactions WHERE type = 'expense' AND booked_at >= $1 GROUP BY 1`, [from8])).map((r) => [r.w, r.v]));
    S.weekly26 = Array.from({ length: 26 }, (_, i) => { const w = addDays(from8, i * 7); return { label: 'KW ' + isoWeek(w), from: w, to: addDays(w, 6), rev: rev[w] || 0, exp: exp[w] || 0 }; });
    S.weekly8 = S.weekly26.slice(-8);
  } else { S.revenue14 = []; S.revenue90 = []; S.weekly8 = []; S.weekly26 = []; }

  // ---------- Lohn ----------
  if (L('payroll') >= 1) {
    const prev = periodBounds('week', addDays(weekStart(TODAY), -1));
    const done = await one('SELECT id FROM payroll_runs WHERE period_from = $1', [prev.from]);
    const seeAll = req.flag('personal.lohn_sehen');
    let draft = done ? null : await computePayroll(prev.from, prev.to);
    if (draft && !seeAll) draft = draft.filter((l) => l.user === me.id);
    const runs = await q('SELECT id, period_from::text AS "from", period_to::text AS "to", total::float, approved_by AS by, approved_at::date::text AS at FROM payroll_runs ORDER BY period_from DESC LIMIT 12');
    let lines = await q('SELECT run_id AS run, user_id AS user, hours::float, hourly::float, commission_base::float AS base, commission::float, fixed::float, adjust::float, total::float FROM payroll_lines WHERE run_id = ANY($1)', [runs.map((r) => r.id)]);
    if (!seeAll) lines = lines.filter((l) => l.user === me.id);
    S.payroll = { period: { ...prev, label: prev.label }, draft, approved: !!done, runs: runs.map((r) => ({ ...r, label: 'KW ' + isoWeek(r.from), lines: lines.filter((l) => l.run === r.id) })), seeAll };
  }

  // ---------- Dienst ----------
  const open = await q('SELECT user_id, started_at FROM shifts WHERE ended_at IS NULL');
  S.onDuty = Object.fromEntries(open.map((s) => [s.user_id, hm(s.started_at)]));
  const sl = L('shifts');
  const ws = weekStart(TODAY);
  S.activityWeeks = [3, 2, 1, 0].map((k) => 'KW ' + isoWeek(addDays(ws, -7 * k)));
  const act = await q(`SELECT user_id, date_trunc('week', started_at AT TIME ZONE $2)::date::text AS w, sum(extract(epoch FROM coalesce(ended_at, now()) - started_at) / 3600)::float AS h
                       FROM shifts WHERE started_at >= $1::date GROUP BY 1, 2`, [addDays(ws, -21), config.tz]);
  S.activity = {};
  for (const u of users.filter((x) => x.rank_id)) {
    if (sl < 2 && u.id !== me.id) continue;
    S.activity[u.id] = [3, 2, 1, 0].map((k) => { const w = addDays(ws, -7 * k); const r = act.find((a) => a.user_id === u.id && a.w === w); return r ? Math.round(r.h * 10) / 10 : 0; });
  }
  S.shifts = (await q(`SELECT id, user_id AS user, local_ts(started_at) AS "from", local_ts(ended_at) AS "to", round((extract(epoch FROM coalesce(ended_at, now()) - started_at) / 3600)::numeric, 1)::float AS h, source, reason
                       FROM shifts WHERE ($1 OR user_id = $2) AND started_at > now() - interval '45 days' ORDER BY started_at DESC LIMIT 300`, [sl >= 2, me.id]));
  S.absences = sl >= 1 ? await q(`SELECT id, user_id AS user, kind, from_day::text AS "from", to_day::text AS "to", note FROM absences WHERE to_day >= current_date - 30 AND ($1 OR user_id = $2) ORDER BY from_day`, [sl >= 2, me.id]) : [];

  // ---------- Schulungen, Lizenzen, Personalakten, Brett ----------
  const tl = L('trainings');
  S.certs = {};
  const certRows = await q(`SELECT DISTINCT ON (user_id, training_id) user_id, training_id, valid_until::text AS until, source FROM certificates
                            WHERE ($1 OR user_id = $2) ORDER BY user_id, training_id, (valid_until IS NULL) DESC, valid_until DESC`, [tl >= 2 || L('staff') >= 2, me.id]);
  for (const c of certRows) (S.certs[c.user_id] ||= {})[c.training_id] = c.until;
  S.certSources = Object.fromEntries(certRows.map((c) => [c.user_id + ':' + c.training_id, c.source]));
  S.sessions = tl >= 1 ? (await q(`SELECT s.id, s.training_id AS training, s.day::text AS date, s.time, s.location AS loc, s.trainer_id AS trainer, s.done,
      coalesce(json_agg(json_build_object('user', p.user_id, 'result', p.result)) FILTER (WHERE p.user_id IS NOT NULL), '[]') AS parts
      FROM training_sessions s LEFT JOIN training_participants p ON p.session_id = s.id GROUP BY s.id ORDER BY s.day DESC LIMIT 100`)).map((s) => ({ ...s, participants: (tl >= 2 ? s.parts : s.parts.filter((p) => p.user === me.id)) })) : [];
  const ll = L('licenses');
  S.licenses = (await q(`SELECT id, type_id AS type, user_id AS user, no, issuer, issued::text, expires::text, status, reason FROM licenses ORDER BY expires NULLS LAST`))
    .filter((l) => ll >= 2 || L('staff') >= 2 || (l.user === me.id));
  S.staffEntries = (await q(`SELECT id, user_id AS user, kind, level, day::text AS date, author_id AS author, text, self_visible AS self, expires::text FROM staff_entries ORDER BY day DESC`))
    .filter((e) => L('stafffiles') >= 2 || (e.user === me.id && e.self));
  S.boardPosts = L('board') >= 1 ? await q(`SELECT p.id, p.title, p.body AS text, p.pinned, p.author_id AS author, p.at::date::text AS date,
      (SELECT count(*)::int FROM board_reads r WHERE r.post_id = p.id) AS reads,
      EXISTS (SELECT 1 FROM board_reads r WHERE r.post_id = p.id AND r.user_id = $1) AS "readByMe"
      FROM board_posts p ORDER BY p.pinned DESC, p.at DESC LIMIT 50`, [me.id]) : [];
  S.activeStaffCount = users.filter((u) => u.rank_id && ['active', 'leave'].includes(u.status)).length;

  // ---------- Termine, Einsätze ----------
  S.appointments = L('appointments') >= 1 ? await q(`SELECT id, day::text AS date, time, bay_id AS bay, title, customer_id AS customer, order_id AS "order", note FROM appointments WHERE day >= current_date - 60 ORDER BY day, time`) : [];
  S.callouts = L('callouts') >= 1 ? (await q(`SELECT id, no, local_ts(at) AS at, location AS loc, requested_by AS by, customer_id AS customer, vehicle_id AS vehicle, driver_id AS driver, status, fee::float, order_id AS "order", invoice_id AS invoice, fleet_id AS fleet FROM callouts ORDER BY at DESC LIMIT 200`)) : [];

  // ---------- Fahrzeug-Katalog, Bilder, Fuhrpark, Tuning, Regelwerk ----------
  const seeModels = ['models', 'vehicles', 'fleet', 'orders', 'tuning'].some((m) => L(m) >= 1);
  S.models = seeModels ? await q(`SELECT id, make, model, class_id AS cls, body, price::float, seats, top_speed AS "topSpeed", drive, fuel, description, tuning_note AS "tuningNote", active FROM vehicle_models ORDER BY make, model`) : [];
  const fl = L('fleet');
  S.fleet = fl >= 1 || L('callouts') >= 1 ? (await q(`SELECT id, name, plate, kind, model_id AS "modelId", make, model, status, driver_id AS driver, km, service_due::text AS "serviceDue", service_km AS "serviceKm", insurance_until::text AS "insuranceUntil", purchase_price::float AS "purchasePrice", purchased_on::text AS "purchasedOn", note FROM fleet_vehicles ORDER BY status = 'retired', name`)) : [];
  S.fleetLog = fl >= 1 ? (await q(`SELECT id, fleet_id AS fleet, user_id AS "user", kind, local_ts(started_at) AS started, local_ts(ended_at) AS ended, km_start AS "kmStart", km_end AS "kmEnd", amount::float, text, local_ts(at) AS at FROM fleet_log ORDER BY at DESC LIMIT 500`)).filter((x) => fl >= 2 || x.user === me.id) : [];
  S.images = (seeModels || fl >= 1) ? await q(`SELECT id, owner_type AS "ownerType", owner_id AS "ownerId", caption, position, is_cover AS cover, size FROM images ORDER BY owner_id, position`) : [];
  S.tuningPackages = (L('tuning') >= 1 || L('orders') >= 1) ? await q(`SELECT id, name, description, items, discount::float, active, position AS pos FROM tuning_packages ORDER BY position, name`) : [];
  if (L('rules') >= 1 && (me.rank_id || L('rules') >= 3)) {
    S.ruleDocs = await q(`SELECT id, title, body, version, require_ack AS "requireAck", position AS pos, updated_by AS "updatedBy", local_ts(updated_at) AS "updatedAt" FROM rule_docs ORDER BY position, title`);
    S.myAcks = Object.fromEntries((await q('SELECT doc_id, max(version) AS v FROM rule_acks WHERE user_id = $1 GROUP BY doc_id', [me.id])).map((r) => [r.doc_id, r.v]));
    S.ruleAcks = L('rules') >= 3 ? await q(`SELECT a.doc_id AS doc, a.user_id AS "user", max(a.version) AS version, local_ts(max(a.at)) AS at FROM rule_acks a GROUP BY a.doc_id, a.user_id`) : [];
  } else { S.ruleDocs = []; S.myAcks = {}; S.ruleAcks = []; }

  // ---------- Benachrichtigungen, eigenes Konto ----------
  S.notifications = await q(`SELECT id, text, link, tone, local_ts(created_at) AS at, read_at IS NOT NULL AS read FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`, [me.id]);
  S.mySessions = await q(`SELECT id, ip, user_agent AS ua, local_ts(last_seen_at) AS seen, token_hash = $2 AS current FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() AND NOT pending_2fa ORDER BY last_seen_at DESC`, [me.id, req.cookies.bx_session ? sha256(req.cookies.bx_session) : '']);
  S.myApiKeys = await q(`SELECT id, name, prefix, created_at::date::text AS created, last_used_at::date::text AS last FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at`, [me.id]);
  S.myTickets = await q(`SELECT t.id, t.no, t.title, t.status, t.page, t.at::date::text AS at, (SELECT count(*)::int FROM ticket_comments c WHERE c.ticket_id = t.id) AS comments FROM tickets t WHERE by_user = $1 ORDER BY at DESC`, [me.id]);

  // ---------- Administration ----------
  const sys = S.me.sys;
  S.systemPerms = SYS_PERMS;
  if (sys.includes('user:read')) {
    S.systemRoles = await q('SELECT id, name, description AS desc, fixed, is_default AS "isDefault" FROM system_roles ORDER BY fixed DESC, name');
    S.sysRolePerms = Object.fromEntries(S.systemRoles.map((r) => [r.id, r.id === 'admin' ? SYS_PERMS.map((p) => p[0]) : (A.rolePerms[r.id] || [])]));
    S.invitations = await q(`SELECT id, email, name, rank_id AS rank, role_id AS role, created_by AS by, created_at::date::text AS created, expires_at::date::text AS expires, expires_at < now() AS expired FROM invitations WHERE used_at IS NULL ORDER BY created_at DESC`);
  }
  if (sys.includes('server:read')) {
    S.jobs = await q(`SELECT DISTINCT ON (job) job, local_ts(started_at) AS last, status, message FROM job_runs ORDER BY job, started_at DESC`);
    S.backups = await listBackups();
    S.env = ENV_PUBLIC();
    const lastMig = await one('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
    const dbSize = await one('SELECT pg_size_pretty(pg_database_size(current_database())) AS s');
    S.overview = {
      activeUsers: users.filter((u) => u.status === 'active').length, pending: users.filter((u) => u.status === 'pending').length,
      sessions: (await one('SELECT count(*)::int AS n, count(DISTINCT user_id)::int AS u FROM sessions WHERE revoked_at IS NULL AND expires_at > now() AND last_seen_at > now() - interval \'30 minutes\'')),
      dbSize: dbSize.s, migration: lastMig ? lastMig.name : '', uptime: Math.round(process.uptime()),
      logins14: await q(`SELECT at::date::text AS d, count(*)::int AS n FROM audit_log WHERE action = 'Anmeldung' AND at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`),
    };
  }
  if (sys.includes('server:settings')) S.security = sec;
  if (sys.includes('integration:manage')) {
    S.webhooks = (await q('SELECT id, name, url, events, active, last_status, local_ts(last_at) AS last_at FROM webhooks ORDER BY name')).map((w) => ({ ...w, url: '•••' + (w.url || '').slice(-6) }));
    S.apiKeys = await q(`SELECT k.id, k.user_id AS user, k.name, k.prefix, k.created_at::date::text AS created, k.last_used_at::date::text AS last FROM api_keys k WHERE revoked_at IS NULL ORDER BY created_at`);
  }
  if (sys.includes('audit:read')) S.audit = await q(`SELECT local_ts(at) AS at, user_id AS user, area, action, detail, ip FROM audit_log ORDER BY at DESC LIMIT 500`);
  if (sys.includes('ticket:manage')) S.tickets = await q(`SELECT t.id, t.no, t.title, t.body, t.page, t.status, t.by_user AS by, t.at::date::text AS at, (SELECT count(*)::int FROM ticket_comments c WHERE c.ticket_id = t.id) AS comments FROM tickets t ORDER BY t.at DESC`);
  return S;
}

export async function listBackups() {
  try {
    const files = (await fs.readdir(config.backupDir)).filter((f) => f.endsWith('.dump'));
    const out = [];
    for (const f of files) { const st = await fs.stat(config.backupDir + '/' + f); out.push({ file: f, size: st.size, at: local(st.mtime) }); }
    return out.sort((a, b) => (a.file < b.file ? 1 : -1));
  } catch { return []; }
}

export default async function stateRoutes(app) {
  app.get('/api/state', async (req) => buildState(req));
}
export { iso };
