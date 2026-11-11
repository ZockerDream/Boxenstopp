/* Boxenstopp – Seiten: Dashboard, Aufträge, Termine, Einsätze, Kunden, Fahrzeuge, Preisliste, Lager */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = (BX.pages = BX.pages || {});
  const A = (BX.actions = BX.actions || {});
  const S = () => BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, plate, person, avatar, note, bar } = U;

  const OPEN = ['accepted', 'in_progress', 'waiting_parts', 'done'];
  const me = () => U.user(D.me.id);
  const lvl = (m) => D.me.levels[m] || 0;
  const flag = (k) => D.me.flags[k];
  const today = () => D.TODAY;
  const activeStaff = () => D.staff.filter((s) => s.rank && ['active', 'leave'].includes(s.status));
  const custOpts = () => D.customers.filter((c) => !c.archived).map((c) => [c.id, c.name]);
  const vehOpts = () => D.vehicles.filter((v) => v.status !== 'scrapped').map((v) => [v.id, `${v.plate} · ${v.make} ${v.model}`]);
  const clsName = (id) => (U.cls(id) || { name: '–' }).name;
  const pgOf = (c) => U.pg(c.pg) || { name: 'Standard', pct: 0 };

  // Fehlende Qualifikationen (Anzeige; der Server prüft beim Speichern)
  function missingQual(userId, it) {
    if (!it || !it.req || !it.req.length) return [];
    return it.reqRaw.filter((r) => {
      const [kind, id] = r.split(':');
      if (kind === 'license') return !D.licenses.some((l) => l.user === userId && l.type === id && l.status === 'valid' && (!l.expires || U.daysUntil(l.expires) >= 0));
      const c = D.certs[userId] && D.certs[userId][id];
      return c === undefined || (c !== null && U.daysUntil(c) < 0);
    }).map((r) => { const [k, id] = r.split(':'); return k === 'license' ? (U.ltype(id) || {}).name : (U.training(id) || {}).name; });
  }
  BX.missingQual = missingQual;

  // ================= Dashboard (anpassbar) =================
  // Module: Reihenfolge, Breite (4/6/8/12 von 12 Spalten) und Ausblenden je Benutzer in users.ui.dashboard
  const fin = () => lvl('invoices') >= 2 || lvl('accounts') >= 2 || lvl('reports') >= 1;
  const DASH = {
    kpis: { title: 'Kennzahlen', spans: [6, 8, 12], ok: () => true },
    revenue: { title: 'Umsatz', spans: [4, 6, 8, 12], ok: () => (D.revenue90 || []).length > 0 },
    duty: { title: 'Im Dienst', spans: [4, 6, 8, 12], ok: () => true },
    todo: { title: 'Handlungsbedarf', spans: [4, 6, 8, 12], ok: () => true },
    bays: { title: 'Heute auf den Bühnen', spans: [4, 6, 8, 12], ok: () => lvl('appointments') >= 1 },
    callouts: { title: 'Offene Einsätze', spans: [4, 6, 8, 12], ok: () => lvl('callouts') >= 1 },
    weekly: { title: 'Umsatz & Ausgaben je Woche', spans: [6, 8, 12], ok: () => (D.weekly26 || []).length > 0 },
    orderStatus: { title: 'Aufträge nach Status', spans: [4, 6, 8, 12], ok: () => lvl('orders') >= 2 },
    myOrders: { title: 'Meine Aufträge', spans: [4, 6, 8, 12], ok: () => lvl('orders') >= 1 },
    fleet: { title: 'Fuhrpark', spans: [4, 6, 8, 12], ok: () => lvl('fleet') >= 1 && (D.fleet || []).length > 0 },
    rules: { title: 'Regelwerk', spans: [4, 6, 8, 12], ok: () => (D.ruleDocs || []).length > 0 },
    categories: { title: 'Umsatz nach Kategorie', spans: [4, 6, 8, 12], ok: () => fin() && lvl('orders') >= 2 },
    stock: { title: 'Lager knapp', spans: [4, 6, 8, 12], ok: () => lvl('stock') >= 1 },
    board: { title: 'Schwarzes Brett', spans: [4, 6, 8, 12], ok: () => (D.boardPosts || []).length > 0 },
  };
  const DEFAULT_LAYOUT = [['kpis', 12], ['revenue', 8], ['duty', 4], ['todo', 4], ['bays', 4], ['callouts', 4], ['weekly', 8], ['orderStatus', 4], ['fleet', 8], ['rules', 4], ['myOrders', 6], ['board', 6], ['categories', 4], ['stock', 4]];
  const SPAN_LABELS = { 4: 'Schmal', 6: 'Halb', 8: 'Breit', 12: 'Ganz' };
  function dashLayout() {
    const usable = (id) => DASH[id] && DASH[id].ok();
    const defaults = Object.fromEntries(DEFAULT_LAYOUT);
    const saved = D.me.ui && D.me.ui.dashboard;
    if (!saved) return { shown: DEFAULT_LAYOUT.filter(([id]) => usable(id)).map(([id, span]) => ({ id, span })), hidden: [] };
    const order = (saved.order || []).filter(usable);
    const hidden = (saved.hidden || []).filter((id) => usable(id) && !order.includes(id));
    DEFAULT_LAYOUT.forEach(([id]) => { if (usable(id) && !order.includes(id) && !hidden.includes(id)) order.push(id); });
    const fit = (id, sp) => (DASH[id].spans.includes(sp) ? sp : defaults[id]);
    return { shown: order.map((id) => ({ id, span: fit(id, (saved.spans || {})[id] || defaults[id]) })), hidden };
  }
  const dashCurrent = () => { const l = dashLayout(); return { order: l.shown.map((m) => m.id), hidden: l.hidden, spans: Object.fromEntries(l.shown.map((m) => [m.id, m.span])) }; };
  async function dashSave(dashboard) {
    const before = D.me.ui;
    D.me.ui = Object.assign({}, D.me.ui || {}, { dashboard });
    if (!dashboard) delete D.me.ui.dashboard;
    S().keepScroll = true; BX.render();
    try { await BX.api('PATCH', '/api/me', { ui: D.me.ui }); } catch (e) { D.me.ui = before; BX.render(); BX.toast(e.message, 'bad'); }
  }
  const dashMove = (id, target, after) => {
    const l = dashCurrent();
    const order = l.order.filter((x) => x !== id);
    let idx = target === null ? order.length : order.indexOf(target);
    if (idx < 0) return;
    if (after) idx += 1;
    order.splice(idx, 0, id);
    dashSave({ ...l, order });
  };
  Object.assign(A, {
    'dash-edit': () => { S().dashEdit = !S().dashEdit; S().keepScroll = true; BX.render(); },
    'dash-hide': (id) => { const l = dashCurrent(); dashSave({ order: l.order.filter((x) => x !== id), hidden: [...l.hidden, id], spans: l.spans }); },
    'dash-add': (id) => { const l = dashCurrent(); dashSave({ order: [...l.order, id], hidden: l.hidden.filter((x) => x !== id), spans: l.spans }); },
    'dash-span': (arg) => { const [id, sp] = arg.split(':'); const l = dashCurrent(); l.spans[id] = Number(sp); dashSave(l); },
    'dash-step': (arg) => { const [id, dir] = arg.split(':'); const l = dashCurrent(); const i = l.order.indexOf(id); const j = i + (dir === 'l' ? -1 : 1); if (j < 0 || j >= l.order.length) return; [l.order[i], l.order[j]] = [l.order[j], l.order[i]]; dashSave(l); },
    'dash-reset': () => BX.confirm('Dashboard zurücksetzen', 'Reihenfolge, Breiten und ausgeblendete Module gehen auf den Standard zurück.', 'Zurücksetzen', () => dashSave(null), false),
  });
  // Module per Ziehen verschieben (nur im Bearbeiten-Modus)
  if (!BX._dashDnD) {
    BX._dashDnD = true;
    document.addEventListener('dragstart', (e) => { const m = e.target.closest && e.target.closest('.dash-grid.editing .dash-mod'); if (!m) return; e.dataTransfer.setData('text/plain', 'dash:' + m.dataset.mod); e.dataTransfer.effectAllowed = 'move'; m.classList.add('dragging'); });
    document.addEventListener('dragover', (e) => { const m = e.target.closest && e.target.closest('.dash-grid.editing .dash-mod'); if (!m) return; e.preventDefault(); document.querySelectorAll('.dash-mod.drop-before,.dash-mod.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); const r = m.getBoundingClientRect(); m.classList.add(e.clientX > r.left + r.width / 2 ? 'drop-after' : 'drop-before'); });
    document.addEventListener('dragend', () => document.querySelectorAll('.dash-mod').forEach((x) => x.classList.remove('dragging', 'drop-before', 'drop-after')));
    document.addEventListener('drop', (e) => {
      const m = e.target.closest && e.target.closest('.dash-grid.editing .dash-mod'); if (!m) return;
      const data = e.dataTransfer.getData('text/plain'); if (!data.startsWith('dash:')) return;
      e.preventDefault(); e.stopPropagation();
      const id = data.slice(5); if (id === m.dataset.mod) return;
      dashMove(id, m.dataset.mod, m.classList.contains('drop-after'));
    }, true);
  }

  function dashBodies() {
    const openOrders = (D.orders || []).filter((o) => OPEN.includes(o.status));
    const openInv = (D.invoices || []).filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    const accs = D.accounts || [];
    const cash = accs.filter((a) => a.kind !== 'tax_reserve' && a.balance !== null).reduce((s, a) => s + a.balance, 0);
    const reserveAcc = accs.find((a) => a.kind === 'tax_reserve');
    const r90 = D.revenue90 || [];
    const todayRev = r90.length ? r90[89].rev : 0, yday = r90.length ? r90[88].rev : 0;
    const openTaxDue = (D.taxPeriods || []).filter((p) => p.status !== 'filed').reduce((s, p) => s + p.tax, 0);
    const list = (html, empty) => `<div class="list">${html || `<div class="empty">${empty}</div>`}</div>`;
    return {
      kpis: () => `<div class="grid g-6 kpi-grid">${[
        fin() ? kpi('Umsatz heute', money(todayRev), `${todayRev >= yday ? '▲' : '▼'} ${money(Math.abs(todayRev - yday))} zu gestern`, { accent: true, dir: todayRev >= yday ? 'up' : 'down', icon: 'coins' }) : '',
        (D.weekly26 || []).length ? kpi('Umsatz ' + D.weekly26[25].label, money(D.weekly26[25].rev), 'Zahlungseingänge', { icon: 'chart' }) : '',
        lvl('orders') >= 1 ? kpi(lvl('orders') === 1 ? 'Meine Aufträge' : 'Offene Aufträge', openOrders.length, `${openOrders.filter((o) => o.status === 'done').length} fertig zur Abholung`, { icon: 'wrench' }) : '',
        lvl('invoices') >= 2 ? kpi('Offene Rechnungen', money(openInv.reduce((s, i) => s + i.total - i.paid, 0)), `${openInv.length} Rechnungen · ${openInv.filter((i) => i.status === 'overdue').length} überfällig`, { icon: 'file', dir: 'down' }) : '',
        accs.length && accs[0].balance !== null ? kpi('Kassenstand', money(cash), 'alle Konten ohne Rücklage', { icon: 'wallet' }) : '',
        reserveAcc && reserveAcc.balance !== null ? kpi('Steuer-Rücklage', money(reserveAcc.balance), `Steuer offen: ${money(openTaxDue)}`, { icon: 'percent', dir: reserveAcc.balance >= openTaxDue ? 'up' : 'down' }) : '',
        kpi('Im Dienst', Object.keys(D.onDuty).length, `von ${D.activeStaffCount} Mitarbeitern`, { icon: 'clock' }),
        lvl('callouts') >= 1 ? kpi('Offene Einsätze', (D.callouts || []).filter((c) => ['open', 'en_route', 'on_site'].includes(c.status)).length, '', { icon: 'truck' }) : '',
      ].filter(Boolean).slice(0, 6).join('')}</div>`,
      revenue: () => {
        const days = Number(U.chartRange('dashRev', 14));
        const data = r90.slice(-days).map((d) => ({ label: U.shortDate(d.date), rev: d.rev, exp: d.exp }));
        const sum = data.reduce((s, d) => s + d.rev, 0);
        return { head: U.rangeSeg('dashRev', [[7, '7 T'], [14, '14 T'], [30, '30 T'], [90, '90 T']], days), sub: `${money(sum)} in ${days} Tagen`, html: U.areaChart(data, { id: 'dashRev', label: 'Umsatz', series: [{ key: 'rev', label: 'Umsatz', color: 'var(--accent)' }, { key: 'exp', label: 'Ausgaben', color: 'var(--info)' }] }) };
      },
      duty: () => ({ sub: `${Object.keys(D.onDuty).length} von ${D.activeStaffCount}`, flush: true, head: lvl('shifts') >= 1 ? `<a class="btn sm ghost" href="#/dienstplan">Dienstplan</a>` : '', html: list(Object.entries(D.onDuty).map(([u, since]) => { const x = U.user(u); return x ? `<div class="list-item">${avatar(x)}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">${esc(x.rank ? U.rank(x.rank).name : '')} · seit ${esc(since)}</div></div>${badge('im Dienst', 'ok', true)}</div>` : ''; }).join(''), 'Gerade niemand im Dienst') }),
      todo: () => {
        const exp = [];
        Object.entries(D.certs || {}).forEach(([u, m]) => Object.entries(m).forEach(([t, until]) => { const usr = U.user(u); if (until && usr && usr.status !== 'left' && U.daysUntil(until) <= 30) exp.push({ u, label: (U.training(t) || {}).name, until }); }));
        (D.licenses || []).filter((l) => l.status === 'valid' && l.expires && U.daysUntil(l.expires) <= 30).forEach((l) => exp.push({ u: l.user, label: (U.ltype(l.type) || {}).name, until: l.expires, firm: !l.user }));
        const ready = (D.taxPeriods || []).find((p) => p.status === 'ready' && p.tax > 0);
        const fleetDue = (D.fleet || []).filter((f) => f.status !== 'retired' && ((f.serviceDue && U.daysUntil(f.serviceDue) <= 7) || (f.serviceKm && f.km >= f.serviceKm)));
        const html = [
          ...BX.openRules().map((d) => `<a class="list-item" href="#/regelwerk?doc=${d.id}"><span class="badge accent">Regelwerk</span><div class="grow"><div class="title">${esc(d.title)} bestätigen</div><div class="meta">Version ${d.version}</div></div></a>`),
          ...(D.discountRequests || []).map((d) => { const o = U.byId(D.orders, d.order); const it = o && o.items.find((x) => x.id === d.item); return `<a class="list-item" href="#/auftrag/${d.order}"><span class="badge accent">Freigabe</span><div class="grow"><div class="title">Rabatt ${d.pct} % auf ${esc(o ? o.no : '')}</div><div class="meta">${esc(it ? it.name : '')} · ${esc((U.user(d.by) || {}).name || '')}</div></div></a>`; }),
          ...openInv.filter((i) => i.status === 'overdue').slice(0, 3).map((i) => `<a class="list-item" href="#/rechnung/${i.id}"><span class="badge bad">Überfällig</span><div class="grow"><div class="title">${esc(i.no)} · ${money(i.total - i.paid)}</div><div class="meta">${esc((U.cust(i.customer) || {}).name || '')} · fällig ${date(i.due)}</div></div></a>`),
          ...fleetDue.map((f) => `<a class="list-item" href="#/fuhrpark/${f.id}"><span class="badge warn">Fuhrpark</span><div class="grow"><div class="title">${esc(f.name)}: Service</div><div class="meta">${f.serviceDue ? 'fällig ' + date(f.serviceDue) : ''}${f.serviceKm ? ' · bei ' + f.serviceKm.toLocaleString('de-DE') + ' km' : ''}</div></div></a>`),
          ...(D.parts || []).filter((p) => p.active && p.stock < p.min).map((p) => `<a class="list-item" href="#/lager"><span class="badge warn">Lager</span><div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">Bestand ${p.stock} · Mindestbestand ${p.min}</div></div></a>`),
          ...exp.sort((a, b) => (a.until < b.until ? -1 : 1)).slice(0, 5).map((e) => { const v = U.validity(e.until); return `<a class="list-item" href="#/${e.firm ? 'lizenzen?tab=firma' : 'qualifikationen'}"><span class="badge ${v.tone}">${e.firm ? 'Firma' : 'Nachweis'}</span><div class="grow"><div class="title">${esc(e.label)}${e.u ? ' · ' + esc((U.user(e.u) || {}).name || '') : ''}</div><div class="meta">${v.label}</div></div></a>`; }),
          ready && lvl('tax') >= 2 ? `<a class="list-item" href="#/steuern"><span class="badge info">Steuern</span><div class="grow"><div class="title">${esc(ready.label)} bereit zur Abführung</div><div class="meta">${money(ready.tax)}</div></div></a>` : '',
        ].join('');
        return { flush: true, html: list(html, 'Alles erledigt 👍') };
      },
      bays: () => ({ flush: true, head: `<a class="btn sm ghost" href="#/termine">Termine</a>`, html: list((D.appointments || []).filter((a) => a.date === today()).map((a) => `<div class="list-item"><div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${esc((U.byId(D.bays, a.bay) || {}).name || '')} · ${esc(a.time)}${a.customer ? ' · ' + esc((U.cust(a.customer) || {}).name || '') : ''}</div></div>${a.order ? `<a class="btn sm" href="#/auftrag/${a.order}">Auftrag</a>` : ''}</div>`).join(''), 'Keine Termine heute') }),
      callouts: () => ({ flush: true, head: `<a class="btn sm ghost" href="#/einsaetze">Alle</a>`, html: list((D.callouts || []).filter((c) => ['open', 'en_route', 'on_site'].includes(c.status)).map((c) => `<a class="list-item" href="#/einsaetze"><div class="grow"><div class="title">${esc(c.no)} · ${esc(c.loc)}</div><div class="meta">${esc(c.by)} · ${esc(c.at.slice(11))} Uhr${c.driver ? ' · ' + esc(U.user(c.driver).name) : ''}${c.fleet ? ' · ' + esc((U.byId(D.fleet, c.fleet) || {}).name || '') : ''}</div></div>${calloutBadge(c.status)}</a>`).join(''), 'Keine offenen Einsätze') }),
      weekly: () => {
        const n = Number(U.chartRange('dashWeek', 8));
        const data = D.weekly26.slice(-n);
        return { head: U.rangeSeg('dashWeek', [[8, '8 Wo'], [13, 'Quartal'], [26, 'Halbjahr']], n), sub: 'Klick auf eine Woche öffnet die Buchungen', html: U.barChart(data, { id: 'dashWeek', label: 'Umsatz und Ausgaben je Woche', series: [{ key: 'rev', label: 'Umsatz', color: 'var(--accent)' }, { key: 'exp', label: 'Ausgaben', color: 'var(--border-strong)' }], extraTip: (d) => 'Ergebnis: ' + money(d.rev - d.exp), href: lvl('accounts') >= 2 ? (d) => `#/buchungen?von=${d.from}&bis=${d.to}` : null }) };
      },
      orderStatus: () => {
        const data = D.statuses.slice(0, 6).map(([k, l]) => ({ label: l, v: (D.orders || []).filter((o) => o.status === k).length, href: '#/auftraege?view=liste&status=' + k })).filter((d) => d.v);
        return { html: data.length ? U.donut(data, { id: 'dashStatus', fmt: (v) => String(v), center: 'Aufträge', centerValue: String(data.reduce((s, d) => s + d.v, 0)), label: 'Aufträge nach Status' }) : '<div class="empty">Keine Aufträge</div>' };
      },
      myOrders: () => ({ flush: true, head: `<a class="btn sm ghost" href="#/auftraege?mine=1">Alle</a>`, html: list((D.orders || []).filter((o) => OPEN.includes(o.status) && o.assignees.includes(D.me.id)).slice(0, 8).map((o) => `<a class="list-item" href="#/auftrag/${o.id}"><span class="mono" style="font-size:12px">${esc(o.no)}</span>${plate((U.veh(o.vehicle) || {}).plate || '?')}<div class="grow" style="font-size:13px">${esc((U.veh(o.vehicle) || {}).model || '')}</div>${U.statusBadge(o.status)}</a>`).join(''), 'Keine offenen Aufträge für dich') }),
      fleet: () => ({ head: `<a class="btn sm ghost" href="#/fuhrpark">Fuhrpark</a>`, html: `<div class="fleet-mini">${D.fleet.filter((f) => f.status !== 'retired').map((f) => `<a class="fleet-chip" href="#/fuhrpark/${f.id}">${BX.coverImg('fleet', f.id, f.modelId, 'thumb')}<div><b>${esc(f.name)}</b><div class="meta">${esc(f.plate)}</div>${BX.fleetBadge(f)}${f.driver ? `<div class="meta">${esc((U.user(f.driver) || {}).name || '')}</div>` : ''}</div></a>`).join('')}</div>` }),
      rules: () => {
        const open = BX.openRules();
        return { flush: true, head: `<a class="btn sm ghost" href="#/regelwerk">Öffnen</a>`, html: list(D.ruleDocs.map((d) => { const ok = !d.requireAck || (D.myAcks[d.id] || 0) >= d.version; return `<a class="list-item" href="#/regelwerk?doc=${d.id}">${icon('id', 'width="16" height="16"')}<div class="grow"><div class="title">${esc(d.title)}</div><div class="meta">Version ${d.version} · ${date(d.updatedAt)}</div></div>${ok ? badge('bestätigt', 'ok', true) : badge('bitte lesen', 'accent', true)}</a>`; }).join(''), '') + (open.length ? '' : '') };
      },
      categories: () => {
        const byCat = {};
        (D.orders || []).filter((o) => ['invoiced', 'picked_up'].includes(o.status)).forEach((o) => o.items.forEach((l) => { const it = U.item(l.item); const k = it ? (U.cat(it.cat) || { name: 'Sonstiges' }).name : 'Freie Positionen'; byCat[k] = (byCat[k] || 0) + D.lineTotal(l); }));
        const data = Object.entries(byCat).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v).slice(0, 7);
        return { html: data.length ? U.donut(data, { id: 'dashCat', label: 'Umsatz nach Kategorie' }) : '<div class="empty">Noch keine Daten</div>' };
      },
      stock: () => ({ flush: true, head: `<a class="btn sm ghost" href="#/lager">Lager</a>`, html: list((D.parts || []).filter((p) => p.active && p.stock < p.min * 1.3).sort((a, b) => a.stock / Math.max(1, a.min) - b.stock / Math.max(1, b.min)).map((p) => `<div class="list-item"><div class="grow"><div class="title">${esc(p.name)}</div>${bar(Math.min(100, p.stock / Math.max(1, p.min * 2) * 100), p.stock < p.min ? 'bad' : 'warn')}</div><b class="num">${p.stock} / ${p.min}</b></div>`).join(''), 'Alles ausreichend vorrätig') }),
      board: () => { const p = D.boardPosts[0]; return { head: `<a class="btn sm ghost" href="#/brett">Alle</a>`, html: `<div class="title" style="font-weight:600">${esc(p.title)}</div><p class="muted" style="margin-top:4px">${U.md(p.text)}</p><div class="row between"><small>${esc((U.user(p.author) || {}).name || '')} · ${date(p.date)}</small>${badge(`gelesen ${p.reads}/${D.activeStaffCount}`, 'info')}</div>` }; },
    };
  }

  P.dashboard = function () {
    const editing = !!S().dashEdit;
    const { shown, hidden } = dashLayout();
    const bodies = dashBodies();
    const hour = Number(new Date().toLocaleString('de-DE', { hour: '2-digit', hour12: false }));
    const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
    const mods = shown.map(({ id, span }, i) => {
      let b = bodies[id]();
      if (typeof b === 'string') b = { html: b };
      const tools = editing ? `<div class="dash-tools"><span class="grip" title="Ziehen zum Verschieben">${icon('grid', 'width="14" height="14"')}</span><button class="btn sm ghost" ${i === 0 ? 'disabled' : ''} data-action="dash-step" data-arg="${id}:l" title="Nach vorne">‹</button><button class="btn sm ghost" ${i === shown.length - 1 ? 'disabled' : ''} data-action="dash-step" data-arg="${id}:r" title="Nach hinten">›</button><div class="seg seg-sm">${DASH[id].spans.map((sp) => `<button type="button" class="${sp === span ? 'active' : ''}" data-action="dash-span" data-arg="${id}:${sp}" title="${SPAN_LABELS[sp]}">${sp}</button>`).join('')}</div><button class="btn sm ghost" data-action="dash-hide" data-arg="${id}" title="Ausblenden">${icon('x', 'width="14" height="14"')}</button></div>` : '';
      const inner = id === 'kpis' ? b.html : card(esc(DASH[id].title), b.html, { flush: b.flush, sub: b.sub, actions: b.head || '' });
      return `<section class="dash-mod" data-mod="${id}" style="--span:${span}" ${editing ? 'draggable="true"' : ''}>${tools}${inner}</section>`;
    }).join('');
    const tray = editing ? `<div class="card dash-tray mb"><div class="grow"><b>Dashboard anpassen</b><div class="muted" style="font-size:12px">Module ziehen oder mit ‹ › verschieben, Breite wählen (4 = schmal … 12 = ganze Breite), mit ✕ ausblenden. Wird sofort für dich gespeichert.</div></div><div class="chips">${hidden.map((id) => `<button type="button" class="btn sm" data-action="dash-add" data-arg="${id}">${icon('plus', 'width="14" height="14"')}${esc(DASH[id].title)}</button>`).join('') || '<span class="faint" style="font-size:12px">Keine ausgeblendeten Module</span>'}</div><div class="row">${btn('Standard', { cls: 'sm ghost', action: 'dash-reset' })}${btn('Fertig', { cls: 'sm primary', icon: 'check', action: 'dash-edit' })}</div></div>` : '';
    return pageHead(`${greet}, ${esc(me().name.split(' ')[0])}`, `${U.weekday(today())}, ${date(today())} · ${esc(D.firm.name)}`, (lvl('orders') >= 3 ? btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'new-order' }) : '') + (lvl('callouts') >= 3 ? btn('Neuer Einsatz', { icon: 'truck', action: 'new-callout' }) : '') + btn(editing ? 'Fertig' : 'Anpassen', { cls: editing ? 'primary' : '', icon: 'gear', action: 'dash-edit' })) +
      tray + `<div class="dash-grid ${editing ? 'editing' : ''}">${mods || '<div class="empty">Alle Module sind ausgeblendet. Unter „Anpassen“ kannst du sie wieder hinzufügen.</div>'}</div>`;
  };

  // ================= Aufträge =================
  function orderCard(o) {
    const v = U.veh(o.vehicle) || {}, c = U.cust(o.customer) || {};
    const late = OPEN.includes(o.status) && o.status !== 'done' && o.due && U.daysUntil(o.due) < 0;
    return `<a class="kcard" href="#/auftrag/${o.id}" draggable="true" data-order="${o.id}">
      <div class="top"><span class="no">${esc(o.no)}</span>${plate(v.plate || '?')}</div>
      <div class="veh">${esc(v.make || '')} ${esc(v.model || '')}</div>
      <div class="cust">${esc(c.name || '')}${c.warning ? ' ⚠' : ''}</div>
      <div class="foot"><span class="avatars">${o.assignees.map((a) => avatar(U.user(a), 'sm')).join('')}</span><span class="due ${late ? 'late' : ''}">${late ? 'überfällig · ' : ''}${o.due ? U.shortDate(o.due) : ''}</span><b>${money(D.orderTotal(o))}</b></div>
    </a>`;
  }
  P.auftraege = function (params, q) {
    const view = q.view || S().orderView || 'board';
    S().orderView = view;
    const own = lvl('orders') === 1 || q.mine === '1';
    let list = D.orders.slice();
    if (own) list = list.filter((o) => o.assignees.includes(D.me.id));
    if (q.status) list = list.filter((o) => o.status === q.status);
    const seg = `<div class="seg"><a href="#/auftraege?view=board${q.mine ? '&mine=1' : ''}" class="${view === 'board' ? 'active' : ''}">Board</a><a href="#/auftraege?view=liste${q.mine ? '&mine=1' : ''}" class="${view === 'liste' ? 'active' : ''}">Liste</a></div>`;
    const mine = lvl('orders') > 1 ? `<div class="seg"><a href="#/auftraege?view=${view}" class="${!q.mine ? 'active' : ''}">Alle</a><a href="#/auftraege?view=${view}&mine=1" class="${q.mine ? 'active' : ''}">Meine</a></div>` : '';
    const head = pageHead('Aufträge', lvl('orders') === 1 ? 'Du siehst nur Aufträge, an denen du arbeitest (Stufe „Eigene“).' : 'Ziehe Karten in eine andere Spalte, um den Status zu ändern.', seg + mine + (lvl('orders') >= 3 ? btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'new-order' }) : ''));
    if (view === 'liste') {
      const rows = list.sort((a, b) => (a.no < b.no ? 1 : -1)).map((o) => {
        const v = U.veh(o.vehicle) || {}, c = U.cust(o.customer) || {};
        return { _href: '#/auftrag/' + o.id, _dim: ['cancelled', 'rejected'].includes(o.status), _filter: [o.no, v.plate, v.make, v.model, c.name].join(' '), no: `<span class="mono">${esc(o.no)}</span>`, veh: `${plate(v.plate || '?')} <span class="sub">${esc(v.make || '')} ${esc(v.model || '')}</span>`, cust: esc(c.name || ''), status: U.statusBadge(o.status), team: `<span class="avatars">${o.assignees.map((a) => avatar(U.user(a), 'sm')).join('')}</span>`, created: date(o.created), due: date(o.due), total: money(D.orderTotal(o)) };
      });
      return head + (q.status ? `<div class="mb">${note(`Gefiltert: <b>${esc(U.statusMeta(q.status).label)}</b> · <a class="link" href="#/auftraege?view=liste">alle zeigen</a>`, 'info')}</div>` : '') + card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Suchen: Nummer, Kennzeichen, Kunde …" data-action="filter" data-target="#orderTable"></div>` + table([
        { key: 'no', label: 'Nummer' }, { key: 'veh', label: 'Fahrzeug' }, { key: 'cust', label: 'Kunde' }, { key: 'status', label: 'Status' }, { key: 'team', label: 'Bearbeiter' }, { key: 'created', label: 'Angelegt' }, { key: 'due', label: 'Fertig bis' }, { key: 'total', label: 'Summe', num: true },
      ], rows, { id: 'orderTable', empty: 'Noch keine Aufträge' }));
    }
    const cols = ['quote', 'accepted', 'in_progress', 'waiting_parts', 'done', 'invoiced'];
    const colors = { quote: 'var(--violet)', accepted: 'var(--info)', in_progress: 'var(--accent)', waiting_parts: 'var(--warn)', done: 'var(--ok)', invoiced: 'var(--faint)' };
    const board = cols.map((k) => {
      let items = list.filter((o) => o.status === k);
      if (k === 'invoiced') items = items.slice(-8);
      return `<div class="kcol" data-drop="${k}"><div class="kcol-head"><span class="d" style="background:${colors[k]}"></span>${esc(U.statusMeta(k).label)}<span class="count">${list.filter((o) => o.status === k).length}</span></div><div class="kcol-body">${items.map(orderCard).join('') || '<div class="empty" style="padding:16px;font-size:12px">Leer</div>'}</div></div>`;
    }).join('');
    const hidden = list.filter((o) => ['picked_up', 'cancelled', 'rejected'].includes(o.status)).length;
    return head + `<div class="kanban">${board}</div><p class="muted mt">${hidden} abgeholte bzw. stornierte Aufträge sind im Board ausgeblendet · <a class="link" href="#/auftraege?view=liste">Liste zeigen</a></p>`;
  };

  // Neuer Auftrag: Kennzeichen tippen → Fahrzeug, Halter, Klasse, Preisgruppe
  A['new-order'] = (arg) => {
    const pre = arg ? U.veh(arg) : null;
    const staffOpts = activeStaff().filter((s) => s.status === 'active').map((s) => [s.id, s.name]);
    BX.openModal({
      title: 'Neuer Auftrag', wide: true,
      body: `<form class="form" id="orderForm">
        ${U.field('Kennzeichen', `<input class="input mono" name="plate" id="plateInput" placeholder="z. B. DF 4207" data-input="plate-lookup" autocomplete="off" style="font-size:18px;letter-spacing:.06em" value="${esc(pre ? pre.plate : '')}" required>`, { hint: 'Tippen genügt – Fahrzeug, Halter, Klasse und Preisgruppe werden übernommen.' })}
        <div id="plateResult"></div>
        <div id="newVehicle" class="form cols-2 hidden">
          ${U.field('Modell aus dem Katalog', U.select([['', '– frei eingeben –']].concat((D.models || []).filter((m) => m.active).map((m) => [m.id, m.make + ' ' + m.model])), '', 'name="modelId"'), { full: true })}
          ${U.field('Hersteller', U.input('', { attrs: 'name="make"' }))}${U.field('Modell', U.input('', { attrs: 'name="model"' }))}
          ${U.field('Fahrzeugklasse', U.select(D.vehicleClasses.map((c) => [c.id, c.name]), D.vehicleClasses[1] && D.vehicleClasses[1].id, 'name="cls"'))}${U.field('Farbe', U.input('', { attrs: 'name="color"' }))}
          ${U.field('Halter (bestehender Kunde)', U.select([['', '– neuer Kunde –']].concat(custOpts()), '', 'name="owner"'))}${U.field('… oder neuer Kunde', U.input('', { attrs: 'name="ownerName"', ph: 'Name des neuen Kunden' }))}
        </div>
        <div class="form cols-2">
          ${U.field('Kundenwunsch', '<textarea class="input" name="request" placeholder="Was soll gemacht werden?"></textarea>', { full: true })}
          ${U.field('Kilometerstand', U.input('', { type: 'number', attrs: 'name="mileage" min="0"' }))}${U.field('Fertig bis', U.input(D.addDays(today(), 1), { type: 'date', attrs: 'name="due"' }))}
          ${U.field('Stellplatz', U.select([['', '–']].concat(D.bays.filter((b) => b.active).map((b) => [b.id, b.name])), '', 'name="bay"'))}${U.field('Status', U.select([['accepted', 'Angenommen'], ['quote', 'Angebot / Kostenvoranschlag']], 'accepted', 'name="status"'))}
          ${U.field('Bearbeiter', `<div class="chips" style="gap:8px">${staffOpts.map(([id, n]) => `<label class="chip-tag" style="cursor:pointer;padding:5px 10px"><input type="checkbox" data-multi="assignees" value="${id}" ${id === D.me.id ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`, { full: true })}
          ${U.field('Zustand bei Annahme (%)', `<div class="row">${['Motor', 'Karosserie', 'Reifen'].map((k) => `<label class="row" style="gap:6px">${k} <input class="input" type="number" min="0" max="100" name="cond_${k}" value="100" style="width:80px"></label>`).join('')}</div>`, { full: true })}
        </div></form>`,
      foot: `<button class="btn" data-action="modal-close">Abbrechen</button><button class="btn primary" data-action="create-order">Auftrag anlegen</button>`,
    });
    if (pre) A['plate-lookup'](pre.plate);
  };
  A['plate-lookup'] = (value) => {
    const q = value.replace(/\s/g, '').toLowerCase();
    const out = document.getElementById('plateResult');
    const nv = document.getElementById('newVehicle');
    if (!out) return;
    if (q.length < 2) { out.innerHTML = ''; nv.classList.add('hidden'); return; }
    const v = D.vehicles.find((x) => x.status !== 'scrapped' && x.plate.replace(/\s/g, '').toLowerCase() === q);
    const near = D.vehicles.filter((x) => x.status !== 'scrapped' && x.plate.replace(/\s/g, '').toLowerCase().startsWith(q)).slice(0, 5);
    if (!v) {
      nv.classList.toggle('hidden', !!near.length && q.length < 5);
      out.innerHTML = near.length ? `<div class="chips">${near.map((x) => `<button type="button" class="chip-tag" data-action="pick-plate" data-arg="${esc(x.plate)}">${esc(x.plate)} · ${esc(x.make)} ${esc(x.model)}</button>`).join('')}</div>` : U.note('Unbekanntes Kennzeichen – es wird ein <b>neues Fahrzeug</b> angelegt.', 'warn');
      if (!near.length) nv.classList.remove('hidden');
      return;
    }
    nv.classList.add('hidden');
    const c = U.cust(v.owner) || {}, g = pgOf(c);
    out.innerHTML = `<div class="card" style="padding:12px 14px" data-vehicle="${v.id}"><div class="row between">${plate(v.plate, true)}${badge(clsName(v.cls), 'accent')}</div><div class="row between" style="margin-top:10px"><div><b>${esc(v.make)} ${esc(v.model)}</b><div class="muted">${esc(v.color)} · ${Number(v.km).toLocaleString('de-DE')} km</div></div><div class="right"><b>${esc(c.name || '–')}</b><div class="muted">Preisgruppe ${esc(g.name)}${g.pct ? ' −' + g.pct + ' %' : ''}</div></div></div>${c.warning ? `<div class="mt">${note(esc(c.warning), 'warn')}</div>` : ''}${c.blocked ? `<div class="mt">${note('<b>Kunde gesperrt:</b> ' + esc(c.blocked), 'bad', 'lock')}</div>` : ''}</div>`;
    const km = document.querySelector('#orderForm [name=mileage]');
    if (km && !km.value) km.value = v.km;
  };
  A['pick-plate'] = (p) => { const i = document.getElementById('plateInput'); i.value = p; A['plate-lookup'](p); };
  A['create-order'] = async (arg, btnEl) => {
    const f = document.getElementById('orderForm');
    const v = BX.readForm(f);
    const card2 = f.querySelector('[data-vehicle]');
    const body = { request: v.request, mileage: v.mileage || 0, due: v.due || null, bay: v.bay || null, status: v.status, assignees: v.assignees, condition: { Motor: v.cond_Motor ?? 100, Karosserie: v.cond_Karosserie ?? 100, Reifen: v.cond_Reifen ?? 100 } };
    if (card2) body.vehicle = card2.dataset.vehicle;
    else {
      if (!v.plate) { document.getElementById('modalErr').innerHTML = note('Kennzeichen fehlt.', 'bad'); return; }
      const mm = (D.models || []).find((x) => x.id === v.modelId);
      body.newVehicle = { plate: v.plate, make: mm ? mm.make : v.make, model: mm ? mm.model : v.model, cls: mm && mm.cls ? mm.cls : (v.cls || null), color: v.color, modelId: v.modelId || null };
      if (v.owner) body.newVehicle.owner = v.owner; else body.newVehicle.ownerName = v.ownerName;
    }
    btnEl.disabled = true;
    try {
      const r = await BX.api('POST', '/api/orders', body);
      BX.closeModal();
      BX.toast('Auftrag angelegt', 'ok');
      await BX.load();
      location.hash = '#/auftrag/' + r.id;
    } catch (e) { btnEl.disabled = false; document.getElementById('modalErr').innerHTML = note(esc(e.message), 'bad'); }
  };

  const NEXT = {
    quote: [['accepted', 'Angebot angenommen', 'check'], ['rejected', 'Abgelehnt', 'x']],
    accepted: [['in_progress', 'Arbeit beginnen', 'play']],
    in_progress: [['done', 'Fertig melden', 'check'], ['waiting_parts', 'Wartet auf Teile', 'box']],
    waiting_parts: [['in_progress', 'Teile da – weiter', 'play']],
    done: [['invoiced', 'Abrechnen → Rechnung', 'file'], ['in_progress', 'Zurück in Arbeit', 'wrench']],
    invoiced: [['picked_up', 'Abgeholt', 'car']],
  };
  A['order-status'] = async (arg) => {
    const [id, to] = arg.split(':');
    const o = U.byId(D.orders, id);
    if (to === 'cancelled' || to === 'rejected') return BX.prompt(to === 'cancelled' ? 'Auftrag stornieren' : 'Angebot abgelehnt', 'Grund', to === 'cancelled' ? 'Stornieren' : 'Speichern', async (reason) => { await BX.api('POST', `/api/orders/${id}/status`, { to, reason }); return `${o.no}: ${U.statusMeta(to).label}`; }, { danger: true });
    if (to === 'invoiced') {
      return BX.confirm('Abrechnen', `Für <b>${esc(o.no)}</b> wird eine Rechnung über <b>${money(D.orderTotal(o))}</b> erstellt. Danach ist der Auftrag gesperrt.`, 'Rechnung erstellen', async () => {
        const r = await BX.call('POST', `/api/orders/${id}/status`, { to }, (x) => `Rechnung ${x.invoice.no} erstellt`);
        if (r && r.invoice) location.hash = '#/rechnung/' + r.invoice.id;
      }, false);
    }
    await BX.call('POST', `/api/orders/${id}/status`, { to }, `${o.no}: ${U.statusMeta(to).label}`);
  };
  A['add-line'] = async (orderId) => {
    const it = U.item(document.getElementById('addItem').value);
    const body = { item: it.id, by: document.getElementById('addBy').value, qty: Number(document.getElementById('addQty').value) || 1 };
    const disc = document.getElementById('addDisc').value;
    if (disc !== '') body.disc = Number(disc);
    const unit = document.getElementById('addUnit');
    if (unit && unit.value !== '') body.unit = Number(unit.value);
    await BX.call('POST', `/api/orders/${orderId}/items`, body, `${it.name} hinzugefügt`);
  };
  A['add-free-line'] = (orderId) => BX.form({ title: 'Freie Position', fields: [{ name: 'name', label: 'Bezeichnung', required: true, full: true }, { name: 'unit', label: 'Einzelpreis', type: 'number', step: '0.01', required: true }, { name: 'qty', label: 'Menge', type: 'number', value: 1, step: '0.5' }, { name: 'disc', label: 'Rabatt %', type: 'number', value: 0 }, { name: 'by', label: 'Ausgeführt von', type: 'select', options: activeStaff().map((s) => [s.id, s.name]), value: D.me.id }],
    submit: async (v) => { await BX.api('POST', `/api/orders/${orderId}/items`, v); return 'Position hinzugefügt'; } });
  A['line-preview'] = () => {
    const sel = document.getElementById('addItem'); if (!sel) return;
    const it = U.item(sel.value), o = U.byId(D.orders, sel.dataset.order), v = U.veh(o.vehicle);
    const p = D.unitPrice(it, v.cls), d = D.groupDiscount(o.pgId || (U.cust(o.customer) || {}).pg, it);
    const miss = missingQual(document.getElementById('addBy').value, it);
    document.getElementById('addInfo').innerHTML = `Preis für <b>${esc(clsName(v.cls))}</b>: <b>${money(p)}</b>${it.kind === 'labor' ? ' / Std' : ''} · ${d ? 'Preisgruppe −' + d + ' %' : 'kein Gruppenrabatt'}${it.parts && it.parts.length ? ' · Teile: ' + it.parts.map((x) => `${x.qty}× ${esc((U.part(x.part) || {}).name || '')}`).join(', ') : ''}${miss.length ? ` · <span style="color:var(--bad)">${icon('alert', 'width="12" height="12"')} Qualifikation fehlt: ${esc(miss.join(', '))}${D.firm.features.qualHard ? ' (gesperrt)' : ''}</span>` : ''}`;
    document.getElementById('addDisc').placeholder = String(d);
  };
  A['del-line'] = (arg) => { const [id, item] = arg.split(':'); BX.confirm('Position entfernen', 'Die Position wird entfernt, reservierte Teile werden freigegeben.', 'Entfernen', () => BX.call('DELETE', `/api/orders/${id}/items/${item}`, undefined, 'Position entfernt')); };
  A.discount = (arg) => { const [id, ok] = arg.split(':'); return BX.call('POST', `/api/discounts/${id}`, { approve: ok === '1' }, ok === '1' ? 'Rabatt freigegeben' : 'Rabatt abgelehnt'); };
  A['order-note'] = async (orderId) => { const t = document.getElementById('noteText'); if (!t.value.trim()) return; await BX.call('POST', `/api/orders/${orderId}/notes`, { body: t.value }, 'Notiz gespeichert'); };
  A['edit-order'] = (id) => {
    const o = U.byId(D.orders, id);
    BX.form({ title: 'Auftrag bearbeiten · ' + o.no, fields: [
      { name: 'request', label: 'Kundenwunsch', type: 'textarea', value: o.request, full: true }, { name: 'due', label: 'Fertig bis', type: 'date', value: o.due }, { name: 'bay', label: 'Stellplatz', type: 'select', options: [['', '–']].concat(D.bays.map((b) => [b.id, b.name])), value: o.bay || '' },
      { name: 'mileage', label: 'Kilometerstand', type: 'number', value: o.mileage }, ...(lvl('orders') >= 3 ? [{ name: 'assignees', label: 'Bearbeiter', type: 'multi', options: activeStaff().map((s) => [s.id, s.name]), value: o.assignees, full: true }] : []),
    ], submit: async (v) => { if (v.assignees && !v.assignees.length) delete v.assignees; v.bay = v.bay || null; v.due = v.due || null; await BX.api('PATCH', '/api/orders/' + id, v); return 'Gespeichert'; } });
  };

  P.auftrag = function (params) {
    const o = U.byId(D.orders, params[0]);
    if (!o) return pageHead('Auftrag nicht gefunden', 'Vielleicht fehlt dir das Recht.', btn('Zur Übersicht', { href: '#/auftraege' }));
    const v = U.veh(o.vehicle) || {}, c = U.cust(o.customer) || {}, group = U.pg(o.pgId) || pgOf(c);
    const locked = ['invoiced', 'picked_up', 'cancelled', 'rejected'].includes(o.status);
    const canEdit = lvl('orders') >= 3 || (lvl('orders') === 1 && o.assignees.includes(D.me.id));
    const steps = ['quote', 'accepted', 'in_progress', 'done', 'invoiced', 'picked_up'];
    const curIdx = steps.indexOf(o.status === 'waiting_parts' ? 'in_progress' : o.status);
    const stepper = `<div class="card mb"><div class="stepper">${steps.map((s, i) => `<div class="step ${i < curIdx ? 'done' : ''} ${i === curIdx ? 'current' : ''}"><b>${esc(U.statusMeta(s).label)}</b>${i === curIdx && o.status === 'waiting_parts' ? 'wartet auf Teile' : i <= curIdx && curIdx >= 0 ? '✓' : ''}</div>`).join('')}</div></div>`;
    const reqs = (D.discountRequests || []).filter((d) => d.order === o.id);
    const rows = o.items.map((l) => {
      const it = U.item(l.item);
      const miss = missingQual(l.by, it);
      const partsInfo = l.parts ? l.parts.map((p) => { const pt = U.part(p.part); if (!pt) return ''; const free = pt.stock - pt.reserved; return `<span class="sub">${icon('box', 'width="11" height="11"')} ${p.qty}× ${esc(pt.name)}${l.taken ? ' · entnommen' : ` · reserviert · frei ${free}${free < 0 ? ' ⚠' : ''}`}</span>`; }).join('') : '';
      const rq = reqs.find((d) => d.item === l.id);
      return {
        name: `${esc(l.name)} ${U.kindBadge(l.kind)}${partsInfo}${miss.length ? `<span class="sub" style="color:var(--bad)">${icon('alert', 'width="11" height="11"')} Qualifikation fehlt: ${esc(miss.join(', '))}</span>` : ''}${rq ? `<span class="sub" style="color:var(--accent)">Freigabe für ${rq.pct} % angefragt</span>` : ''}`,
        qty: l.qty + (l.kind === 'labor' ? ' Std' : ''), unit: money(l.unit), disc: l.disc ? `−${l.disc} %` : '–', by: person(U.user(l.by)), total: money(D.lineTotal(l)),
        x: !locked && canEdit && !l.taken ? `<button class="btn sm ghost" data-action="del-line" data-arg="${o.id}:${l.id}" title="Entfernen">${icon('x')}</button>` : '',
      };
    });
    const gross = D.orderGross(o), total = D.orderTotal(o);
    const avail = D.catalog.filter((i) => i.active);
    const staff = o.assignees.concat(activeStaff().filter((s) => s.status === 'active' && !o.assignees.includes(s.id)).map((s) => s.id));
    const addRow = !locked && canEdit ? `<div class="row mt" style="align-items:flex-end">
      <div class="field" style="flex:2;min-width:220px"><label>Leistung aus der Preisliste</label><select class="input" id="addItem" data-order="${o.id}" data-change="line-preview">${D.categories.map((cg) => `<optgroup label="${esc(cg.name)}">${avail.filter((i) => i.cat === cg.id).map((i) => `<option value="${i.id}">${esc(i.name)} – ${money(D.unitPrice(i, v.cls))}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field" style="width:80px"><label>Menge</label><input class="input" id="addQty" type="number" min="0.5" step="0.5" value="1"></div>
      <div class="field" style="width:90px"><label>Rabatt %</label><input class="input" id="addDisc" type="number" min="0" max="100"></div>
      ${flag('auftrag.preis_aendern') ? `<div class="field" style="width:110px"><label>Preis abw.</label><input class="input" id="addUnit" type="number" step="0.01" placeholder="Liste"></div>` : ''}
      <div class="field" style="flex:1;min-width:160px"><label>Ausgeführt von</label>${U.select(staff.map((id) => [id, (U.user(id) || {}).name]), o.assignees[0] || D.me.id, 'id="addBy" data-change="line-preview"')}</div>
      ${btn('Hinzufügen', { cls: 'primary', icon: 'plus', action: 'add-line', arg: o.id })}${flag('auftrag.preis_aendern') ? btn('Frei', { action: 'add-free-line', arg: o.id, title: 'Freie Position' }) : ''}
    </div><p class="muted" id="addInfo" style="margin-top:8px;font-size:12px"></p><p class="faint" style="font-size:12px">Rabatt leer = Preisgruppe (${esc(group.name)}${group.pct ? ' −' + group.pct + ' %' : ', kein Rabatt'}). Dein Limit ohne Freigabe: ${flag('rabatt.max_prozent')} %. Mehr löst eine Freigabe-Anfrage aus.</p>` : '';
    setTimeout(() => A['line-preview'] && A['line-preview'](), 0);

    const actions = (canEdit ? (NEXT[o.status] || []).filter(([to]) => to !== 'invoiced' || lvl('invoices') >= 3).map(([to, label, ic], i) => btn(label, { cls: i === 0 ? 'primary' : '', icon: ic, action: 'order-status', arg: o.id + ':' + to })).join('') : '') +
      (!locked && canEdit ? btn('Bearbeiten', { icon: 'gear', action: 'edit-order', arg: o.id }) + btn('Stornieren', { cls: 'danger', action: 'order-status', arg: o.id + ':cancelled' }) : '') + btn('Drucken', { icon: 'print', action: 'print' });
    const inv = (D.invoices || []).filter((i) => i.order === o.id);
    const discountNotes = reqs.map((d) => { const it = o.items.find((x) => x.id === d.item); const can = lvl('orders') >= 3 && Number(flag('rabatt.max_prozent')) >= d.pct && (d.by !== D.me.id || D.me.owner); return note(`<b>Rabattfreigabe angefragt:</b> ${esc((U.user(d.by) || {}).name || '')} möchte ${d.pct} % auf „${esc(it ? it.name : '')}“ geben. ${can ? `<div class="row" style="margin-top:8px">${btn('Freigeben', { cls: 'sm primary', action: 'discount', arg: d.id + ':1' })}${btn('Ablehnen', { cls: 'sm', action: 'discount', arg: d.id + ':0' })}</div>` : '<span class="muted">Wartet auf jemanden mit ausreichendem Limit.</span>'}`, 'warn'); }).join('');
    const timeline = o.events.slice().reverse().map((e) => `<div class="tl-item"><div class="when">${date(e.at)}</div><div class="what">${esc(e.text)}</div><div class="muted">${esc((U.user(e.user) || {}).name || '')}</div></div>`).join('');
    const cond = Object.entries(o.condition || {}).map(([k, val]) => `<div class="meter"><span>${esc(k)}</span>${bar(val, val < 40 ? 'bad' : val < 70 ? 'warn' : 'ok')}<span class="num">${val} %</span></div>`).join('');
    const notes = o.notes.map((n) => `<div class="list-item">${avatar(U.user(n.author))}<div class="grow"><div class="title">${esc((U.user(n.author) || {}).name || '')} <span class="muted" style="font-weight:400">· ${date(n.at)}</span></div><div>${U.md(n.body)}</div></div></div>`).join('');

    return pageHead(`${esc(o.no)} ${U.statusBadge(o.status)}`, esc(o.request || '') + (o.cancelReason ? ` · <span style="color:var(--bad)">Grund: ${esc(o.cancelReason)}</span>` : ''), actions, `<a href="#/auftraege">Aufträge</a> / ${esc(o.no)}`) + stepper + (discountNotes ? `<div class="stack mb">${discountNotes}</div>` : '') +
      (inv.length ? `<div class="mb">${note('Rechnung: ' + inv.map((i) => `<a class="link mono" href="#/rechnung/${i.id}">${esc(i.no)}</a> ${U.invBadge(i.status)}`).join(' · '), 'info', 'file')}</div>` : '') +
      `<div class="grid g-side">
        <div class="stack">
          ${card('Positionen', table([{ key: 'name', label: 'Leistung' }, { key: 'qty', label: 'Menge', num: true }, { key: 'unit', label: 'Einzelpreis', num: true }, { key: 'disc', label: 'Rabatt', num: true }, { key: 'by', label: 'Ausgeführt von' }, { key: 'total', label: 'Gesamt', num: true }, { key: 'x', label: '' }], rows, {
            foot: ['Gesamtpreis', '', '', gross - total ? `<span class="muted" style="font-weight:500">−${money(gross - total)}</span>` : '', '', money(total), ''], empty: 'Noch keine Positionen',
          }) + `<div style="padding:0 16px 14px">${addRow}</div>`, { flush: true, sub: `Festpreise · Steuer (${D.firm.taxRate} %) wird im Steuerzeitraum aus dem Umsatz berechnet`, actions: locked ? badge('gesperrt', '', false) : '' })}
          ${card('Interne Notizen', `<div class="list">${notes || '<div class="empty">Noch keine Notizen</div>'}</div>${canEdit ? `<div style="padding:12px 16px"><textarea class="input" id="noteText" placeholder="Notiz hinzufügen … (**fett** möglich)"></textarea><div class="row mt">${btn('Speichern', { cls: 'sm primary', action: 'order-note', arg: o.id })}</div></div>` : ''}`, { flush: true })}
        </div>
        <div class="stack">
          ${card('Fahrzeug', `<div class="row between">${plate(v.plate || '?', true)}${badge(clsName(v.cls), 'accent')}</div><div style="margin-top:10px;font-weight:600">${esc(v.make || '')} ${esc(v.model || '')}</div><div class="muted">${esc(v.color || '')} · km bei Annahme ${Number(o.mileage).toLocaleString('de-DE')}</div>${cond ? '<hr>' + cond : ''}`, { actions: lvl('vehicles') >= 1 ? `<a class="btn sm ghost" href="#/fahrzeug/${v.id}">Akte</a>` : '' })}
          ${card('Kunde', `<div class="title" style="font-weight:650">${esc(c.name || '')}</div><div class="muted">${esc(U.custKind[c.kind] || '')} · Tel. ${esc(c.phone || '')}</div><div class="row" style="margin-top:8px">${badge('Preisgruppe ' + group.name, 'info')}${(c.tags || []).map(U.chip).join('')}</div>${c.warning ? `<div class="mt">${note(esc(c.warning), 'warn')}</div>` : ''}`, { actions: lvl('customers') >= 1 ? `<a class="btn sm ghost" href="#/kunde/${c.id}">Akte</a>` : '' })}
          ${card('Ablauf', `<div class="meta muted">Bearbeiter</div>${o.assignees.map((a) => person(U.user(a))).join('<br>')}<div class="row between mt"><span class="muted">Stellplatz</span><b>${esc((U.byId(D.bays, o.bay) || { name: '–' }).name)}</b></div><div class="row between" style="margin-top:6px"><span class="muted">Fertig bis</span><b>${date(o.due)}</b></div><hr><div class="timeline">${timeline}</div>`)}
        </div>
      </div>`;
  };

  // ================= Termine =================
  P.termine = function () {
    const off = S().weekOffset || 0;
    const ws = (() => { const d = new Date(today() + 'T12:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; return D.addDays(today(), -wd + off * 7); })();
    const days = Array.from({ length: 7 }, (_, i) => D.addDays(ws, i));
    const canW = lvl('appointments') >= 3;
    let grid = `<div class="week"><div class="wh"></div>${days.map((d) => `<div class="wh ${d === today() ? 'today' : ''}">${U.weekday(d)} ${U.shortDate(d)}</div>`).join('')}`;
    D.bays.filter((b) => b.active).forEach((b) => {
      grid += `<div class="bay">${esc(b.name)}</div>`;
      days.forEach((d) => {
        const appts = D.appointments.filter((a) => a.bay === b.id && a.date === d);
        grid += `<div class="cell ${d === today() ? 'today' : ''}">${appts.map((a) => `<a class="appt ${a.order ? 'order' : ''}" ${a.order ? `href="#/auftrag/${a.order}"` : canW ? `data-action="appt" data-arg="${a.id}" role="button" tabindex="0"` : ''}><b>${esc(a.time)}</b>${esc(a.title)}${a.customer ? `<br><span class="muted">${esc((U.cust(a.customer) || {}).name || '')}</span>` : ''}</a>`).join('')}${canW ? `<button class="btn sm ghost" style="width:100%;justify-content:center;opacity:.5" data-action="new-appt" data-arg="${d}:${b.id}" title="Termin anlegen">+</button>` : ''}</div>`;
      });
    });
    grid += '</div>';
    const iso = (() => { const d = new Date(ws + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - y) / 86400000 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); })();
    return pageHead('Termine', `KW ${iso} · ${date(days[0])} – ${date(days[6])} · Belegung der Hebebühnen und Stellplätze`, `<div class="seg"><button data-action="week" data-arg="-1">‹</button><button data-action="week" data-arg="0" class="${off === 0 ? 'active' : ''}">Diese Woche</button><button data-action="week" data-arg="1">›</button></div>` + (canW ? btn('Neuer Termin', { cls: 'primary', icon: 'plus', action: 'new-appt' }) : '') + (lvl('appointments') >= 4 ? btn('Stellplätze', { icon: 'gear', action: 'bays' }) : '')) +
      `<div class="table-wrap">${grid}</div><div class="legend mt"><span><span class="appt order" style="display:inline-block;width:14px;height:10px;margin:0;padding:0"></span>mit Auftrag</span><span><span class="appt" style="display:inline-block;width:14px;height:10px;margin:0;padding:0"></span>Termin – anklicken zum Bearbeiten oder um einen Auftrag anzulegen</span></div>`;
  };
  A.week = (arg) => { S().weekOffset = arg === '0' ? 0 : (S().weekOffset || 0) + Number(arg); BX.render(); };
  const apptFields = (a = {}) => [
    { name: 'title', label: 'Titel', value: a.title, required: true, full: true }, { name: 'date', label: 'Datum', type: 'date', value: a.date || today(), required: true }, { name: 'time', label: 'Zeit', value: a.time || '18:00–19:00' },
    { name: 'bay', label: 'Stellplatz', type: 'select', options: D.bays.filter((b) => b.active).map((b) => [b.id, b.name]), value: a.bay }, { name: 'customer', label: 'Kunde', type: 'select', options: [['', '–']].concat(custOpts()), value: a.customer || '' }, { name: 'note', label: 'Notiz', value: a.note, full: true },
  ];
  A['new-appt'] = (arg) => { const [d, b] = (arg || '').split(':'); BX.form({ title: 'Neuer Termin', fields: apptFields({ date: d, bay: b }), submit: async (v) => { v.customer = v.customer || null; await BX.api('POST', '/api/r/appointments', v); return 'Termin angelegt'; } }); };
  A.appt = (id) => {
    const a = U.byId(D.appointments, id);
    BX.form({ title: 'Termin bearbeiten', fields: apptFields(a).concat([{ name: 'html', type: 'html', full: true, html: `<div class="row">${btn('Löschen', { cls: 'danger sm', action: 'appt-del', arg: id })}${a.customer && lvl('orders') >= 3 ? btn('Auftrag dazu anlegen', { cls: 'sm', action: 'appt-order', arg: id }) : ''}</div>` }]), submit: async (v) => { delete v.html; v.customer = v.customer || null; await BX.api('PATCH', '/api/r/appointments/' + id, v); return 'Gespeichert'; } });
  };
  A['appt-del'] = (id) => { BX.closeModal(); return BX.call('DELETE', '/api/r/appointments/' + id, undefined, 'Termin gelöscht'); };
  A['appt-order'] = (id) => { const a = U.byId(D.appointments, id); const v = D.vehicles.find((x) => x.owner === a.customer && x.status === 'active'); BX.closeModal(); A['new-order'](v ? v.id : ''); };
  A.bays = () => BX.form({ title: 'Stellplätze', cols: 1, fields: D.bays.map((b, i) => ({ name: 'b_' + b.id, label: 'Stellplatz ' + (i + 1), value: b.name })).concat([{ name: 'neu', label: 'Neuer Stellplatz', ph: 'z. B. Hebebühne 4' }]),
    submit: async (v) => { for (const b of D.bays) if (v['b_' + b.id] && v['b_' + b.id] !== b.name) await BX.api('PATCH', '/api/r/bays/' + b.id, { name: v['b_' + b.id] }); if (v.neu) await BX.api('POST', '/api/r/bays', { name: v.neu, pos: D.bays.length }); return 'Gespeichert'; } });

  // ================= Einsätze =================
  const CS = { open: ['Offen', 'bad'], en_route: ['Unterwegs', 'warn'], on_site: ['Vor Ort', 'info'], done: ['Erledigt', 'ok'], cancelled: ['Abgebrochen', ''] };
  function calloutBadge(s) { return badge(CS[s][0], CS[s][1], true); }
  BX.calloutBadge = calloutBadge;
  P.einsaetze = function () {
    const canW = lvl('callouts') >= 3;
    const drivers = activeStaff().filter((s) => s.status === 'active');
    const rows = D.callouts.map((c) => {
      const v = c.vehicle ? U.veh(c.vehicle) : null;
      const inv = c.invoice ? U.byId(D.invoices || [], c.invoice) : null;
      const final = c.invoice || c.order || c.status === 'cancelled';
      return {
        _dim: c.status === 'cancelled', no: `<span class="mono">${esc(c.no)}</span>`, at: date(c.at), loc: `${icon('pin', 'width="12" height="12"')} ${esc(c.loc)}`, by: `${esc(c.by)}<span class="sub">${esc((U.cust(c.customer) || {}).name || '')}</span>`,
        veh: (v ? plate(v.plate) : '<span class="faint">–</span>') + (c.fleet ? `<span class="sub">${icon('truck', 'width="11" height="11"')} ${esc((U.byId(D.fleet || [], c.fleet) || {}).name || '')}</span>` : ''),
        driver: canW && !final ? U.select([['', '– zuweisen –']].concat(drivers.map((s) => [s.id, s.name])), c.driver || '', `data-change="callout-driver" data-id="${c.id}" style="min-width:140px"`) : c.driver ? person(U.user(c.driver)) : '–',
        status: canW && !final ? U.select(Object.entries(CS).map(([k, [l]]) => [k, l]), c.status, `data-change="callout-status" data-id="${c.id}"`) : calloutBadge(c.status), fee: c.fee ? money(c.fee) : '–',
        act: c.order ? `<a class="btn sm" href="#/auftrag/${c.order}">Auftrag</a>` : inv ? `<a class="btn sm" href="#/rechnung/${inv.id}">${esc(inv.no)}</a>` : c.invoice ? badge('abgerechnet', 'ok') : canW && c.status !== 'cancelled' ? `<div class="row" style="gap:4px;flex-wrap:nowrap">${lvl('invoices') >= 3 ? btn('Abrechnen', { cls: 'sm', action: 'callout-invoice', arg: c.id }) : ''}${lvl('orders') >= 3 ? btn('→ Auftrag', { cls: 'sm', action: 'callout-order', arg: c.id }) : ''}${btn('', { cls: 'sm ghost', icon: 'gear', action: 'callout-edit', arg: c.id, title: 'Fahrzeug / Gebühr' })}</div>` : '',
      };
    });
    const week = D.callouts.filter((c) => U.daysUntil(c.at.slice(0, 10)) > -7 && c.status !== 'cancelled');
    return pageHead('Einsätze', 'Abschlepp- und Pannendienst vor Ort', canW ? btn('Neuer Einsatz', { cls: 'primary', icon: 'plus', action: 'new-callout' }) : '') +
      `<div class="grid g-4 mb">${kpi('Offen', D.callouts.filter((c) => c.status === 'open').length, 'ohne Fahrer unterwegs', { icon: 'alert' })}${kpi('Unterwegs / vor Ort', D.callouts.filter((c) => ['en_route', 'on_site'].includes(c.status)).length, '', { icon: 'truck' })}${kpi('Erledigt (7 Tage)', week.filter((c) => c.status === 'done').length, '', { icon: 'check' })}${kpi('Gebühren (7 Tage)', money(week.reduce((s, c) => s + c.fee, 0)), week.length + ' Einsätze', { icon: 'coins' })}</div>` +
      card('', table([{ key: 'no', label: 'Nummer' }, { key: 'at', label: 'Zeit' }, { key: 'loc', label: 'Ort' }, { key: 'by', label: 'Auftraggeber' }, { key: 'veh', label: 'Fahrzeug' }, { key: 'driver', label: 'Fahrer' }, { key: 'status', label: 'Status' }, { key: 'fee', label: 'Gebühr', num: true }, { key: 'act', label: '' }], rows, { empty: 'Noch keine Einsätze' }), { flush: true });
  };
  A['new-callout'] = () => BX.form({ title: 'Neuer Einsatz', fields: [
    { name: 'location', label: 'Ort', required: true, full: true, ph: 'z. B. Autobahnauffahrt Nord, km 12' }, { name: 'by', label: 'Auftraggeber', type: 'select', options: ['Kunde', 'Polizeidepartment', 'Rettungsdienst', 'Eigen'], value: 'Kunde' },
    { name: 'customer', label: 'Kunde (für die Rechnung)', type: 'select', options: [['', '–']].concat(custOpts()) }, { name: 'vehicle', label: 'Fahrzeug (falls bekannt)', type: 'select', options: [['', '–']].concat(vehOpts()) },
    { name: 'driver', label: 'Fahrer', type: 'select', options: [['', '– später –']].concat(activeStaff().filter((s) => s.status === 'active').map((s) => [s.id, s.name])) },
    ...((D.fleet || []).length ? [{ name: 'fleet', label: 'Firmenfahrzeug', type: 'select', options: [['', '–']].concat(D.fleet.filter((f) => f.status !== 'retired').map((f) => [f.id, `${f.name} (${f.plate})${f.status !== 'available' ? ' · ' + (f.status === 'in_use' ? 'im Einsatz' : 'Werkstatt') : ''}`])), value: (D.fleet.find((f) => f.status === 'available' && /abschlepp/i.test(f.kind)) || {}).id || '' }] : []),
    { name: 'item', label: 'Leistung', type: 'select', options: D.catalog.filter((i) => i.active && D.categories.find((c) => c.id === i.cat && /abschlepp|einsatz/i.test(c.name))).map((i) => [i.id, i.name + ' – ' + money(i.price)]).concat(D.catalog.filter((i) => i.active && !D.categories.find((c) => c.id === i.cat && /abschlepp|einsatz/i.test(c.name))).map((i) => [i.id, i.name])), full: true },
  ], submit: async (v) => { ['customer', 'vehicle', 'driver', 'item', 'fleet'].forEach((k) => { v[k] = v[k] || null; }); await BX.api('POST', '/api/callouts', v); return 'Einsatz angelegt'; } });
  A['callout-driver'] = (val, el) => BX.call('PATCH', '/api/callouts/' + el.dataset.id, { driver: val || null, ...(val ? { status: 'en_route' } : {}) }, 'Fahrer zugewiesen');
  A['callout-status'] = (val, el) => BX.call('PATCH', '/api/callouts/' + el.dataset.id, { status: val }, 'Status geändert');
  A['callout-invoice'] = (id) => BX.confirm('Einsatz abrechnen', 'Es wird eine Rechnung mit der Einsatzgebühr erstellt.', 'Abrechnen', async () => { const r = await BX.call('POST', `/api/callouts/${id}/invoice`, {}, (x) => `Rechnung ${x.invoice.no} erstellt`); if (r) location.hash = '#/rechnung/' + r.invoice.id; }, false);
  A['callout-order'] = async (id) => { const r = await BX.call('POST', `/api/callouts/${id}/order`, {}, 'Auftrag angelegt'); if (r) location.hash = '#/auftrag/' + r.id; };
  A['callout-edit'] = (id) => { const c = U.byId(D.callouts, id); BX.form({ title: 'Einsatz ' + c.no, fields: [{ name: 'vehicle', label: 'Fahrzeug', type: 'select', options: [['', '–']].concat(vehOpts()), value: c.vehicle || '' }, ...(flag('auftrag.preis_aendern') ? [{ name: 'fee', label: 'Gebühr', type: 'number', step: '0.01', value: c.fee }] : [])], submit: async (v) => { v.vehicle = v.vehicle || null; await BX.api('PATCH', '/api/callouts/' + id, v); return 'Gespeichert'; } }); };

  // ================= Kunden =================
  function custStats(c) {
    const inv = (D.invoices || []).filter((i) => i.customer === c.id && !['cancelled', 'credit'].includes(i.status));
    return { revenue: inv.reduce((s, i) => s + i.paid, 0), open: inv.reduce((s, i) => s + (i.total - i.paid), 0), vehicles: D.vehicles.filter((v) => v.owner === c.id && v.status !== 'scrapped').length, orders: (D.orders || []).filter((o) => o.customer === c.id).length };
  }
  const custFields = (c = {}) => [
    { name: 'name', label: 'Name', value: c.name, required: true }, { name: 'kind', label: 'Art', type: 'select', options: Object.entries(U.custKind), value: c.kind || 'person' },
    { name: 'phone', label: 'Telefon (RP)', value: c.phone }, { name: 'pg', label: 'Preisgruppe', type: 'select', options: D.priceGroups.map((g) => [g.id, g.name + (g.pct ? ' −' + g.pct + ' %' : '')]), value: c.pg || (D.priceGroups.find((g) => g.isDefault) || {}).id },
    { name: 'terms', label: 'Zahlungsziel (Tage)', type: 'number', value: c.terms ?? 0, min: 0 }, { name: 'tags', label: 'Tags (mit Komma)', value: (c.tags || []).join(', ') },
    { name: 'warning', label: 'Hinweis', value: c.warning, full: true, ph: 'z. B. nur Barzahlung' }, { name: 'blocked', label: 'Sperre (Grund)', value: c.blocked, full: true, hint: 'Gesperrte Kunden bekommen keine neuen Aufträge' },
  ];
  const custBody = (v) => ({ ...v, tags: (v.tags || '').split(',').map((t) => t.trim()).filter(Boolean), terms: v.terms || 0, pg: v.pg || null });
  A['new-customer'] = () => BX.form({ title: 'Neuer Kunde', fields: custFields(), submit: async (v) => { const r = await BX.api('POST', '/api/r/customers', custBody(v)); setTimeout(() => { location.hash = '#/kunde/' + r.id; }); return 'Kunde angelegt'; } });
  A['edit-customer'] = (id) => BX.form({ title: 'Kunde bearbeiten', fields: custFields(U.cust(id)), submit: async (v) => { await BX.api('PATCH', '/api/r/customers/' + id, custBody(v)); return 'Gespeichert'; } });
  A['archive-customer'] = (id) => { const c = U.cust(id); return BX.call('PATCH', '/api/r/customers/' + id, { archived: !c.archived }, c.archived ? 'Wiederhergestellt' : 'Archiviert'); };
  A['cust-entry'] = async (id) => { const t = document.getElementById('entryText'); if (!t.value.trim()) return; await BX.call('POST', '/api/r/customerEntries', { customer: id, body: t.value }, 'Eintrag gespeichert'); };
  P.kunden = function (params, q) {
    const arch = q.archiv === '1';
    const rows = D.customers.filter((c) => !!c.archived === arch).map((c) => {
      const st = custStats(c);
      return { _href: '#/kunde/' + c.id, _filter: c.name + ' ' + c.phone + ' ' + c.tags.join(' '), name: `<b>${esc(c.name)}</b>${c.blocked ? ' ' + badge('gesperrt', 'bad') : c.warning ? ' ' + badge('Hinweis', 'warn') : ''}<span class="sub">Tel. ${esc(c.phone)}</span>`, kind: esc(U.custKind[c.kind]), pg: badge(pgOf(c).name, pgOf(c).pct ? 'info' : ''), tags: `<div class="chips">${c.tags.map(U.chip).join('')}</div>`, veh: st.vehicles, rev: money(st.revenue), open: st.open > 0 ? `<span style="color:var(--bad)">${money(st.open)}</span>` : '–' };
    });
    return pageHead('Kunden', `${D.customers.filter((c) => !c.archived).length} Kundenakten`, `<div class="seg"><a href="#/kunden" class="${!arch ? 'active' : ''}">Aktiv</a><a href="#/kunden?archiv=1" class="${arch ? 'active' : ''}">Archiv</a></div>` + (lvl('customers') >= 2 ? `<a class="btn" href="/api/export/kunden.csv">${icon('download')}CSV</a>` : '') + (lvl('customers') >= 3 ? btn('Neuer Kunde', { cls: 'primary', icon: 'plus', action: 'new-customer' }) : '')) +
      card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Suchen: Name, Telefon, Tag …" data-action="filter" data-target="#custTable"></div>` + table([{ key: 'name', label: 'Kunde' }, { key: 'kind', label: 'Art' }, { key: 'pg', label: 'Preisgruppe' }, { key: 'tags', label: 'Tags' }, { key: 'veh', label: 'Fahrzeuge', num: true }, { key: 'rev', label: 'Umsatz', num: true }, { key: 'open', label: 'Offen', num: true }], rows, { id: 'custTable', empty: 'Keine Kunden' }));
  };
  P.kunde = function (params, q) {
    const c = U.cust(params[0]);
    if (!c) return pageHead('Kunde nicht gefunden', '', btn('Zurück', { href: '#/kunden' }));
    const tab = q.tab || 'uebersicht';
    const st = custStats(c);
    const vehicles = D.vehicles.filter((v) => v.owner === c.id);
    const orders = (D.orders || []).filter((o) => o.customer === c.id).sort((a, b) => (a.no < b.no ? 1 : -1));
    const invs = (D.invoices || []).filter((i) => i.customer === c.id);
    const entriesList = D.customerEntries.filter((e) => e.customer === c.id);
    const base = '#/kunde/' + c.id;
    const vehTable = table([{ key: 'p', label: 'Kennzeichen' }, { key: 'm', label: 'Fahrzeug' }, { key: 'c', label: 'Klasse' }, { key: 's', label: 'Status' }], vehicles.map((v) => ({ _href: '#/fahrzeug/' + v.id, p: plate(v.plate), m: esc(v.make + ' ' + v.model), c: esc(clsName(v.cls)), s: vehStatus(v.status) })), { empty: 'Keine Fahrzeuge' });
    const ordTable = table([{ key: 'no', label: 'Nummer' }, { key: 'v', label: 'Fahrzeug' }, { key: 's', label: 'Status' }, { key: 'd', label: 'Datum' }, { key: 't', label: 'Summe', num: true }], orders.map((o) => ({ _href: '#/auftrag/' + o.id, no: `<span class="mono">${esc(o.no)}</span>`, v: plate((U.veh(o.vehicle) || {}).plate || '?'), s: U.statusBadge(o.status), d: date(o.created), t: money(D.orderTotal(o)) })), { empty: 'Keine Aufträge' });
    const invTable = table([{ key: 'no', label: 'Nummer' }, { key: 'd', label: 'Datum' }, { key: 's', label: 'Status' }, { key: 't', label: 'Betrag', num: true }, { key: 'o', label: 'Offen', num: true }], invs.map((i) => ({ _href: '#/rechnung/' + i.id, no: `<span class="mono">${esc(i.no)}</span>`, d: date(i.issued), s: U.invBadge(i.status), t: money(i.total), o: i.total - i.paid > 0 && !['cancelled', 'credit'].includes(i.status) ? money(i.total - i.paid) : '–' })), { empty: 'Keine Rechnungen' });
    const entries = `<div class="list">${entriesList.map((e) => `<div class="list-item">${avatar(U.user(e.author))}<div class="grow"><div class="title">${esc((U.user(e.author) || {}).name || '')} <span class="muted" style="font-weight:400">· ${date(String(e.at).slice(0, 10))}</span></div><div>${U.md(e.body)}</div></div></div>`).join('') || '<div class="empty">Noch keine Einträge</div>'}</div>${lvl('customers') >= 3 ? `<div style="padding:12px 16px"><textarea class="input" id="entryText" placeholder="Eintrag hinzufügen …"></textarea><div class="row mt">${btn('Speichern', { cls: 'primary sm', action: 'cust-entry', arg: c.id })}</div></div>` : ''}`;
    let body;
    if (tab === 'uebersicht') body = `<div class="grid g-4 mb">${kpi('Umsatz gesamt', money(st.revenue), 'bezahlt', { icon: 'coins' })}${kpi('Offen', money(st.open), '', { icon: 'file' })}${kpi('Fahrzeuge', st.vehicles, '', { icon: 'car' })}${kpi('Aufträge', st.orders, '', { icon: 'wrench' })}</div><div class="grid g-2">${card('Fahrzeuge', vehTable, { flush: true })}${card('Letzte Einträge', entries, { flush: true })}</div>`;
    else if (tab === 'fahrzeuge') body = card('', vehTable, { flush: true });
    else if (tab === 'auftraege') body = card('', ordTable, { flush: true });
    else if (tab === 'rechnungen') body = card('', invTable, { flush: true });
    else body = card('', entries, { flush: true });
    return pageHead(esc(c.name) + (c.archived ? ' ' + badge('archiviert', '') : ''), `${esc(U.custKind[c.kind])} · Tel. ${esc(c.phone)} · Kunde seit ${date(c.since)} · Zahlungsziel ${c.terms ? c.terms + ' Tage' : 'sofort'}`,
      (lvl('customers') >= 3 ? btn('Bearbeiten', { icon: 'gear', action: 'edit-customer', arg: c.id }) + btn(c.archived ? 'Wiederherstellen' : 'Archivieren', { action: 'archive-customer', arg: c.id }) : '') + (lvl('vehicles') >= 3 ? btn('Fahrzeug', { icon: 'plus', action: 'new-vehicle', arg: c.id }) : '') + (lvl('orders') >= 3 && vehicles.length ? btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'new-order', arg: vehicles[0].id }) : ''), `<a href="#/kunden">Kunden</a> / ${esc(c.name)}`) +
      `<div class="row mb">${badge('Preisgruppe ' + pgOf(c).name + (pgOf(c).pct ? ' · −' + pgOf(c).pct + ' %' : ''), 'info')}${c.tags.map(U.chip).join('')}</div>` +
      (c.blocked ? `<div class="mb">${note('<b>Gesperrt:</b> ' + esc(c.blocked), 'bad', 'lock')}</div>` : '') + (c.warning ? `<div class="mb">${note('<b>Hinweis:</b> ' + esc(c.warning), 'warn')}</div>` : '') +
      U.tabs(base, [['uebersicht', 'Übersicht'], ['fahrzeuge', 'Fahrzeuge', vehicles.length], ['auftraege', 'Aufträge', orders.length], ['rechnungen', 'Rechnungen', invs.length], ['eintraege', 'Einträge', entriesList.length]], tab) + body;
  };

  // ================= Fahrzeuge =================
  function vehStatus(s) { return s === 'active' ? badge('Aktiv', 'ok', true) : s === 'stolen' ? badge('Gestohlen gemeldet', 'bad', true) : badge('Verschrottet', '', true); }
  const vehFields = (v = {}) => [
    { name: 'modelId', label: 'Modell aus dem Fahrzeug-Katalog', type: 'select', options: [['', '– frei eingeben –']].concat((D.models || []).filter((m) => m.active || m.id === v.modelId).map((m) => [m.id, `${m.make} ${m.model}`])), value: v.modelId || '', full: true, hint: 'füllt Hersteller, Modell und Klasse' },
    { name: 'plate', label: 'Kennzeichen', value: v.plate, required: true, mono: true }, { name: 'owner', label: 'Halter', type: 'select', options: [['', '–']].concat(custOpts()), value: v.owner || '' },
    { name: 'make', label: 'Hersteller', value: v.make }, { name: 'model', label: 'Modell', value: v.model },
    { name: 'cls', label: 'Fahrzeugklasse', type: 'select', options: D.vehicleClasses.map((c) => [c.id, c.name]), value: v.cls }, { name: 'color', label: 'Farbe', value: v.color },
    { name: 'km', label: 'Kilometerstand', type: 'number', value: v.km ?? 0 }, { name: 'vin', label: 'Fahrgestellnummer', value: v.vin },
    ...(v.id ? [{ name: 'status', label: 'Status', type: 'select', options: [['active', 'Aktiv'], ['stolen', 'Gestohlen gemeldet'], ['scrapped', 'Verschrottet']], value: v.status }] : []),
  ];
  const vehBody = (v) => { const m = (D.models || []).find((x) => x.id === v.modelId); return { ...v, modelId: v.modelId || null, make: m ? m.make : v.make, model: m ? m.model : v.model, cls: m && m.cls ? m.cls : (v.cls || null), owner: v.owner || null, km: v.km || 0 }; };
  A['new-vehicle'] = (owner) => BX.form({ title: 'Neues Fahrzeug', fields: vehFields({ owner }), submit: async (v) => { const r = await BX.api('POST', '/api/r/vehicles', vehBody(v)); setTimeout(() => { location.hash = '#/fahrzeug/' + r.id; }); return 'Fahrzeug angelegt'; } });
  A['edit-vehicle'] = (id) => BX.form({ title: 'Fahrzeug bearbeiten', fields: vehFields(U.veh(id)), intro: note('Ein anderer Halter wird als Halterwechsel in der Historie vermerkt.', 'info'), submit: async (v) => { await BX.api('PATCH', '/api/r/vehicles/' + id, vehBody(v)); return 'Gespeichert'; } });
  const TUNING = ['Motor', 'Turbo', 'Bremsen', 'Getriebe', 'Federung', 'Panzerung', 'Optik'];
  A['edit-tuning'] = (id) => {
    const cur = Object.fromEntries(D.tuning.filter((t) => t.vehicle === id).map((t) => [t.category, t.level]));
    BX.form({ title: 'Tuning-Stand korrigieren', fields: TUNING.map((t) => ({ name: t, label: t, type: 'select', options: [[0, 'Serie'], [1, 'Stufe 1'], [2, 'Stufe 2'], [3, 'Stufe 3'], [4, 'Stufe 4'], [5, 'Stufe 5']], value: cur[t] || 0 })),
      submit: async (v) => { for (const t of TUNING) if (Number(v[t]) !== (cur[t] || 0)) await BX.api('PUT', `/api/vehicles/${id}/tuning`, { category: t, level: Number(v[t]) }); return 'Tuning-Stand gespeichert'; } });
  };
  P.fahrzeuge = function () {
    const rows = D.vehicles.map((v) => {
      const c = U.cust(v.owner) || {};
      const last = (D.orders || []).filter((o) => o.vehicle === v.id).sort((a, b) => (a.created < b.created ? 1 : -1))[0];
      return { _href: '#/fahrzeug/' + v.id, _dim: v.status === 'scrapped', _filter: [v.plate, v.plate.replace(/\s/g, ''), v.make, v.model, c.name, v.color].join(' '), p: plate(v.plate), m: `<b>${esc(v.make)} ${esc(v.model)}</b><span class="sub">${esc(v.color)}</span>`, c: esc(clsName(v.cls)), o: esc(c.name || '–'), km: Number(v.km).toLocaleString('de-DE'), last: last ? date(last.created) : '–', s: vehStatus(v.status) };
    });
    return pageHead('Fahrzeuge', `${D.vehicles.filter((v) => v.status !== 'scrapped').length} Fahrzeugakten`, lvl('vehicles') >= 3 ? btn('Neues Fahrzeug', { cls: 'primary', icon: 'plus', action: 'new-vehicle' }) : '') +
      card('', `<div class="row mb"><input class="input mono" style="max-width:320px" placeholder="Kennzeichen, Modell, Halter …" data-action="filter" data-target="#vehTable"></div>` + table([{ key: 'p', label: 'Kennzeichen' }, { key: 'm', label: 'Fahrzeug' }, { key: 'c', label: 'Klasse' }, { key: 'o', label: 'Halter' }, { key: 'km', label: 'km', num: true }, { key: 'last', label: 'Letzter Besuch' }, { key: 's', label: 'Status' }], rows, { id: 'vehTable', empty: 'Keine Fahrzeuge' }));
  };
  P.fahrzeug = function (params, q) {
    const v = U.veh(params[0]);
    if (!v) return pageHead('Fahrzeug nicht gefunden', '', btn('Zurück', { href: '#/fahrzeuge' }));
    const c = U.cust(v.owner) || {};
    const tab = q.tab || 'historie';
    const base = '#/fahrzeug/' + v.id;
    const orders = (D.orders || []).filter((o) => o.vehicle === v.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const hist = D.ownerHistory.filter((h) => h.vehicle === v.id);
    const tuning = Object.fromEntries(D.tuning.filter((t) => t.vehicle === v.id).map((t) => [t.category, t]));
    let body;
    if (tab === 'historie') {
      const ev = [...orders.map((o) => ({ d: o.createdAt, html: `<div class="what"><a class="link" href="#/auftrag/${o.id}">${esc(o.no)}</a> ${U.statusBadge(o.status)}</div><div class="muted">${esc(o.items.map((l) => l.name).join(', ') || o.request)} · ${money(D.orderTotal(o))} · km ${Number(o.mileage).toLocaleString('de-DE')}</div>` })),
        ...hist.map((h) => ({ d: h.from + ' 00:00', muted: true, html: `<div class="what">Halter: ${esc((U.cust(h.customer) || {}).name || '–')}</div><div class="muted">${date(h.from)} – ${h.to ? date(h.to) : 'heute'}</div>` }))].sort((a, b) => (a.d < b.d ? 1 : -1));
      body = card('Historie', ev.length ? `<div class="timeline">${ev.map((e) => `<div class="tl-item ${e.muted ? 'muted' : ''}"><div class="when">${date(e.d.slice(0, 10))}</div>${e.html}</div>`).join('')}</div>` : '<div class="empty">Noch keine Einträge</div>');
    } else if (tab === 'tuning') {
      body = card('Tuning-Stand', `<div class="grid g-3">${TUNING.map((k) => { const t = tuning[k]; const val = t ? t.level : 0; return `<div class="card" style="padding:12px 14px"><div class="row between"><b>${esc(k)}</b>${val ? badge('Stufe ' + val, 'accent') : badge('Serie', '')}</div><div class="row" style="gap:4px;margin-top:10px">${[1, 2, 3].map((s) => `<span style="flex:1;height:6px;border-radius:3px;background:${s <= val ? 'var(--accent)' : 'var(--surface-3)'}"></span>`).join('')}</div><div class="muted" style="font-size:12px;margin-top:8px">${t ? esc(t.source) : '–'}</div></div>`; }).join('')}</div>`, { sub: 'automatisch aus fertigen Aufträgen', actions: lvl('vehicles') >= 3 ? btn('Korrigieren', { cls: 'sm', action: 'edit-tuning', arg: v.id }) : '' });
    } else if (tab === 'zustand') {
      const last = orders[0];
      body = card('Zustand bei letzter Annahme', last ? Object.entries(last.condition || {}).map(([k, val]) => `<div class="meter"><span>${esc(k)}</span>${bar(val, val < 40 ? 'bad' : val < 70 ? 'warn' : 'ok')}<span class="num">${val} %</span></div>`).join('') : '<div class="empty">Noch keine Annahme</div>', { sub: last ? last.no : '' });
    } else {
      const rows = orders.filter((o) => ['invoiced', 'picked_up', 'done'].includes(o.status)).flatMap((o) => o.items.filter((l) => U.item(l.item) && U.item(l.item).warranty).map((l) => { const until = D.addDays(o.created, U.item(l.item).warranty); const d = U.daysUntil(until); return { l: esc(l.name), o: `<span class="mono">${esc(o.no)}</span>`, u: date(until), s: d >= 0 ? badge('noch ' + d + ' Tage', 'ok') : badge('abgelaufen', '') }; }));
      body = card('', table([{ key: 'l', label: 'Leistung' }, { key: 'o', label: 'Auftrag' }, { key: 'u', label: 'Garantie bis' }, { key: 's', label: 'Status' }], rows, { empty: 'Keine Garantien' }), { flush: true });
    }
    return pageHead(`${plate(v.plate, true)} <span style="margin-left:6px">${esc(v.make)} ${esc(v.model)}</span>`, `${esc(clsName(v.cls))} · ${esc(v.color)} · ${Number(v.km).toLocaleString('de-DE')} km${v.vin ? ' · FIN ' + esc(v.vin) : ''} · Halter ${c.id ? `<a class="link" href="#/kunde/${c.id}">${esc(c.name)}</a>` : '–'}`,
      vehStatus(v.status) + (lvl('vehicles') >= 3 ? btn('Bearbeiten / Halterwechsel', { icon: 'gear', action: 'edit-vehicle', arg: v.id }) : '') + (lvl('orders') >= 3 && v.status !== 'scrapped' ? btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'new-order', arg: v.id }) : ''), `<a href="#/fahrzeuge">Fahrzeuge</a> / ${esc(v.plate)}`) +
      (v.modelId && BX.coverImg ? `<div class="veh-hero mb"><a href="#/modell/${v.modelId}">${BX.coverImg('model', v.modelId, null, 'veh-hero-img')}</a><div><div class="muted" style="font-size:12px">Modell aus dem Katalog</div><a class="link" href="#/modell/${v.modelId}"><b>${esc(v.make)} ${esc(v.model)}</b></a>${lvl('tuning') >= 1 && lvl('orders') >= 3 ? `<div class="mt"><a class="btn sm" href="#/tuning?v=${v.id}">${icon('gauge')}Tuning konfigurieren</a></div>` : ''}</div></div>` : '') +
      U.tabs(base, [['historie', 'Historie'], ['tuning', 'Tuning-Stand'], ['zustand', 'Zustand'], ['garantie', 'Garantie']], tab) + body;
  };

  // ================= Preisliste =================
  function priceCell(it) {
    const variable = it.surcharge || it.classPrices;
    const vals = D.vehicleClasses.map((c) => D.unitPrice(it, c.id));
    return `${money(it.price)}${it.kind === 'labor' ? ' / Std' : ''}${variable && vals.length ? `<span class="sub">je Klasse ${money(Math.min(...vals))} – ${money(Math.max(...vals))}</span>` : ''}`;
  }
  const reqOpts = () => D.trainings.map((t) => ['training:' + t.id, 'Schulung: ' + t.name]).concat(D.licenseTypes.filter((l) => l.holder === 'member').map((l) => ['license:' + l.id, 'Lizenz: ' + l.name]));
  function itemForm(it) {
    it = it || { kind: 'flat', unit: 'pauschal', price: 0, material: 0, active: true, req: [], reqRaw: [] };
    const mode = it.classPrices ? 'fixed' : it.surcharge ? 'surcharge' : 'none';
    const classVals = D.vehicleClasses.map((c) => ({ name: 'cls_' + c.id, label: c.name, type: 'number', step: '0.01', value: mode === 'fixed' ? (it.classPrices[c.id] ?? '') : mode === 'surcharge' ? (it.surcharge[c.id] ?? '') : '' }));
    const partsTxt = (it.parts || []).map((p) => `${p.qty}x ${(U.part(p.part) || {}).sku || ''}`).join(', ');
    BX.form({
      title: it.id ? 'Leistung bearbeiten' : 'Neue Leistung', wide: true,
      intro: note('Alle Preise sind <b>Festpreise</b> (Endpreis für den Kunden). Je Klasse: leer = Grundpreis. Bei „Aufschlag“ Prozent eintragen (z. B. 20 oder -30).', 'info'),
      fields: [
        { name: 'name', label: 'Name', value: it.name, required: true }, { name: 'cat', label: 'Kategorie', type: 'select', options: D.categories.map((c) => [c.id, c.name]), value: it.cat },
        { name: 'kind', label: 'Preisart', type: 'select', options: [['flat', 'Pauschal – fester Endpreis'], ['labor', 'Arbeit – je Stunde/Einheit'], ['part', 'Teil – Verkauf aus dem Lager'], ['bundle', 'Set – Paketpreis, entnimmt Teile']], value: it.kind },
        { name: 'price', label: 'Grundpreis', type: 'number', step: '0.01', value: it.price, required: true }, { name: 'unit', label: 'Einheit', value: it.unit, ph: 'pauschal, Std, Stk' }, { name: 'material', label: 'Material-/Einkaufskosten', type: 'number', step: '0.01', value: it.material ?? 0 },
        { name: 'mode', label: 'Preis je Fahrzeugklasse', type: 'select', options: [['none', 'Einheitspreis'], ['surcharge', 'Aufschlag in % je Klasse'], ['fixed', 'fester Preis je Klasse']], value: mode }, { name: 'warranty', label: 'Garantie (Tage)', type: 'number', value: it.warranty || 0 },
        ...classVals,
        { name: 'req', label: 'Voraussetzung', type: 'multi', options: reqOpts(), value: it.reqRaw || [], full: true }, { name: 'group', label: 'Zuständige Gruppe', type: 'select', options: [['', 'alle']].concat(D.groups.map((g) => [g.id, g.name])), value: it.group || '' },
        { name: 'tuningCat', label: 'Tuning-Kategorie', type: 'select', options: [['', '– kein Tuning –']].concat(TUNING.map((t) => [t, t])), value: it.tuning ? it.tuning[0] : '' }, { name: 'tuningLevel', label: 'Tuning-Stufe', type: 'number', min: 1, max: 5, value: it.tuning ? it.tuning[1] : 1 },
        { name: 'parts', label: 'Teile (Menge x Artikelnr., mit Komma)', value: partsTxt, ph: 'z. B. 4x T-REIF-01', hint: 'Für Pauschal (nur Bestand) und Set', full: true },
        { name: 'part', label: 'Lagerteil (bei Preisart „Teil“)', type: 'select', options: [['', '–']].concat(D.parts.map((p) => [p.id, p.name])), value: it.part || '' },
        { name: 'note', label: 'Interne Notiz', value: it.note, full: true }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: it.active },
      ],
      submit: async (v) => {
        const body = { name: v.name, cat: v.cat, kind: v.kind, price: v.price || 0, unit: v.unit || 'pauschal', material: v.material || 0, warranty: v.warranty || 0, req: v.req, group: v.group || null, note: v.note || '', active: v.active, part: v.part || null };
        const per = {};
        D.vehicleClasses.forEach((c) => { const x = v['cls_' + c.id]; if (x !== null && x !== '' && x !== undefined) per[c.id] = Number(x); });
        body.surcharge = v.mode === 'surcharge' && Object.keys(per).length ? per : null;
        body.classPrices = v.mode === 'fixed' && Object.keys(per).length ? per : null;
        body.tuning = v.tuningCat ? [v.tuningCat, Number(v.tuningLevel) || 1] : null;
        const parts = (v.parts || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/i); const sku = (m ? m[2] : s).trim(); const p = D.parts.find((x) => x.sku.toLowerCase() === sku.toLowerCase() || x.name.toLowerCase() === sku.toLowerCase()); if (!p) throw new Error('Teil nicht gefunden: ' + sku); return { part: p.id, qty: m ? Number(m[1].replace(',', '.')) : 1 }; });
        body.parts = parts.length ? parts : null;
        if (it.id) await BX.api('PATCH', '/api/r/catalog/' + it.id, body); else await BX.api('POST', '/api/r/catalog', body);
        return 'Preisliste gespeichert';
      },
    });
  }
  A['new-item'] = () => itemForm(null);
  A['edit-item'] = (id) => itemForm(U.item(id));
  A['new-category'] = () => BX.prompt('Neue Kategorie', 'Name', 'Anlegen', async (name) => { await BX.api('POST', '/api/r/categories', { name, pos: D.categories.length }); return 'Kategorie angelegt'; });
  A['edit-category'] = (id) => { const c = U.cat(id); BX.prompt('Kategorie umbenennen', 'Name', 'Speichern', async (name) => { await BX.api('PATCH', '/api/r/categories/' + id, { name }); return 'Gespeichert'; }, { value: c.name }); };
  const pgForm = (g) => BX.form({ title: g ? 'Preisgruppe bearbeiten' : 'Neue Preisgruppe', fields: [{ name: 'name', label: 'Name', value: g && g.name, required: true }, { name: 'pct', label: 'Rabatt %', type: 'number', value: g ? g.pct : 0 }, ...D.categories.map((c) => ({ name: 'c_' + c.id, label: 'Abweichend: ' + c.name + ' (%)', type: 'number', value: g && g.cats && g.cats[c.id] != null ? g.cats[c.id] : '' })), { name: 'isDefault', label: 'Standard für neue Kunden', type: 'checkbox', value: g && g.isDefault }],
    submit: async (v) => { const cats = {}; D.categories.forEach((c) => { if (v['c_' + c.id] !== null && v['c_' + c.id] !== '') cats[c.id] = Number(v['c_' + c.id]); }); const body = { name: v.name, pct: v.pct || 0, cats, isDefault: v.isDefault }; if (v.isDefault) for (const o of D.priceGroups) if (o.isDefault && (!g || o.id !== g.id)) await BX.api('PATCH', '/api/r/priceGroups/' + o.id, { isDefault: false }); if (g) await BX.api('PATCH', '/api/r/priceGroups/' + g.id, body); else await BX.api('POST', '/api/r/priceGroups', body); return 'Preisgruppe gespeichert'; } });
  A['new-pg'] = () => pgForm(null);
  A['edit-pg'] = (id) => pgForm(U.pg(id));
  A['pl-class'] = (v) => { S().plClass = v; BX.render(); };
  P.preisliste = function (params, q) {
    const tab = q.tab || 'intern';
    const canW = lvl('catalog') >= 3;
    const head = pageHead('Preisliste', 'Festpreise · Pauschal, Arbeit, Teil oder Set · Preise je Fahrzeugklasse und Preisgruppe',
      (lvl('catalog') >= 2 ? `<a class="btn" href="/api/export/preisliste.csv">${icon('download')}CSV</a>` : '') + (canW ? btn('Kategorie', { icon: 'plus', action: 'new-category' }) + btn('Neue Leistung', { cls: 'primary', icon: 'plus', action: 'new-item' }) : ''));
    const tabsHtml = U.tabs('#/preisliste', [['intern', 'Leistungen', D.catalog.length], ['klassen', 'Preise je Klasse'], ['gruppen', 'Preisgruppen', D.priceGroups.length], ['kunde', 'Kundenansicht']], tab);
    if (tab === 'intern') {
      const kinds = `<div class="legend mb">${Object.keys(U.kindLabel).map((k) => `<span>${U.kindBadge(k)} ${{ flat: 'fester Endpreis inkl. Material', labor: 'Preis je Stunde/Einheit', part: 'Verkauf aus dem Lager', bundle: 'Paketpreis, entnimmt Teile' }[k]}</span>`).join('')}</div>`;
      return head + tabsHtml + kinds + `<div class="stack">${D.categories.map((cg) => {
        const items = D.catalog.filter((i) => i.cat === cg.id);
        const rows = items.map((it) => {
          const margin = it.price && it.material !== null ? Math.round((it.price - it.material) / it.price * 100) : null;
          return {
            _dim: !it.active, name: `<b>${esc(it.name)}</b>${it.note ? `<span class="sub">${esc(it.note)}</span>` : ''}${it.tuning ? `<span class="sub">Tuning: ${esc(it.tuning[0])} Stufe ${it.tuning[1]}</span>` : ''}`, kind: U.kindBadge(it.kind), price: priceCell(it),
            mat: it.material !== null ? money(it.material) : '–', margin: margin !== null ? `${margin} %` : '–', req: `<div class="chips">${it.reqRaw.map((r) => { const [k, i] = r.split(':'); return U.chip(k === 'license' ? (U.ltype(i) || {}).name : (U.training(i) || {}).name); }).join('')}${it.group ? U.chip('Gruppe ' + (U.group(it.group) || {}).name) : ''}</div>`,
            stock: it.parts ? it.parts.map((p) => `${p.qty}× ${esc((U.part(p.part) || {}).name || '?')}`).join('<br>') : it.part ? esc((U.part(it.part) || {}).name || '') : '–', warranty: it.warranty ? it.warranty + ' T.' : '–', st: it.active ? badge('aktiv', 'ok') : badge('inaktiv', ''),
            x: canW ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-item', arg: it.id, title: 'Bearbeiten' }) : '',
          };
        });
        return card(esc(cg.name), table([{ key: 'name', label: 'Leistung' }, { key: 'kind', label: 'Preisart' }, { key: 'price', label: 'Preis', num: true }, { key: 'mat', label: 'Material', num: true }, { key: 'margin', label: 'Marge', num: true }, { key: 'req', label: 'Voraussetzung' }, { key: 'stock', label: 'Lager' }, { key: 'warranty', label: 'Garantie' }, { key: 'st', label: 'Status' }, { key: 'x', label: '' }], rows, { empty: 'Noch keine Leistungen' }), { flush: true, sub: items.length + ' Leistungen', actions: canW ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-category', arg: cg.id, title: 'Umbenennen' }) : '' });
      }).join('')}</div>`;
    }
    if (tab === 'klassen') {
      const rows = D.catalog.filter((i) => i.active && i.kind !== 'part').map((it) => {
        const r = { name: `<b>${esc(it.name)}</b><span class="sub">${it.classPrices ? 'feste Preise je Klasse' : it.surcharge ? 'Aufschlag in %' : 'Einheitspreis'}</span>` };
        D.vehicleClasses.forEach((c) => { const p = D.unitPrice(it, c.id); r[c.id] = p !== it.price ? `<b style="color:var(--accent)">${money(p)}</b>${it.surcharge && it.surcharge[c.id] ? `<span class="sub">${it.surcharge[c.id] > 0 ? '+' : ''}${it.surcharge[c.id]} %</span>` : ''}` : `<span class="muted">${money(p)}</span>`; });
        return r;
      });
      return head + tabsHtml + note('Fahrzeugklassen pflegst du in den Firmen-Einstellungen. Im Auftrag wird automatisch der Preis für die Klasse des Fahrzeugs gewählt. <b>Farbig</b> = abweichend vom Grundpreis.', 'info') + `<div class="mt">${card('', table([{ key: 'name', label: 'Leistung' }].concat(D.vehicleClasses.map((c) => ({ key: c.id, label: c.name, num: true }))), rows, { cls: 'no-stack' }), { flush: true })}</div>`;
    }
    if (tab === 'gruppen') {
      return head + tabsHtml + `<div class="grid g-4">${D.priceGroups.map((g) => card(esc(g.name), `<div class="kpi" style="padding:0"><div class="value">${g.pct ? '−' + g.pct + ' %' : '0 %'}</div><div class="muted">${D.customers.filter((c) => c.pg === g.id).length} Kunden${g.isDefault ? ' · Standard für neue Kunden' : ''}</div></div>${g.cats && Object.keys(g.cats).length ? `<hr><div class="muted" style="font-size:12px">Abweichend: ${Object.entries(g.cats).map(([cg, p]) => esc((U.cat(cg) || {}).name || '') + ' −' + p + ' %').join(', ')}</div>` : ''}`, { actions: lvl('catalog') >= 4 ? btn('Bearbeiten', { cls: 'sm ghost', action: 'edit-pg', arg: g.id }) : '' })).join('')}</div>` +
        `<div class="row mt">${lvl('catalog') >= 4 ? btn('Neue Preisgruppe', { icon: 'plus', action: 'new-pg' }) : ''}</div><div class="mt">${note('Rabatte darüber hinaus gibt jeder Mitarbeiter nur bis zu seinem Einzelrecht <b>„Max. Rabatt ohne Freigabe“</b>; mehr braucht eine Freigabe.', 'info')}</div>`;
    }
    const clsSel = S().plClass || (D.vehicleClasses[1] || D.vehicleClasses[0] || {}).id;
    const paper = `<div class="paper"><div class="row between" style="align-items:flex-start"><div class="row">${BX.look.logoHtml()}<div><div style="font-size:20px;font-weight:800">${esc(D.firm.name)}</div><div class="muted">${esc(D.firm.address || '')}${D.firm.phone ? ' · Tel. ' + esc(D.firm.phone) : ''}</div></div></div><div class="right"><div style="font-size:18px;font-weight:800">Preisliste</div><div class="muted">gültig ab ${date(today())}<br>Fahrzeugklasse: <b style="color:#16181d">${esc(clsName(clsSel))}</b></div></div></div>
      ${D.categories.map((cg) => { const its = D.catalog.filter((i) => i.cat === cg.id && i.active); if (!its.length) return ''; return `<div class="pl-cat"><h3>${esc(cg.name)}</h3>${its.map((it) => `<div class="pl-row"><div class="n">${esc(it.name)}${it.warranty ? `<small>${it.warranty} Tage Garantie</small>` : ''}</div><div class="p">${money(D.unitPrice(it, clsSel))}${it.kind === 'labor' ? ' / Std' : ''}</div></div>`).join('')}</div>`; }).join('')}
      <p class="muted" style="margin-top:22px;font-size:12px">Alle Preise sind Endpreise. Stammkunden und Behörden erhalten Rabatt laut Vereinbarung.</p></div>`;
    const pubOn = D.firm.features.publicPricelist;
    return head + tabsHtml + `<div class="row mb no-print"><div class="field" style="width:220px"><label>Fahrzeugklasse</label>${U.select(D.vehicleClasses.map((c) => [c.id, c.name]), clsSel, 'data-change="pl-class"')}</div><div class="grow"></div>${btn('Drucken / PDF', { icon: 'print', action: 'print' })}${pubOn ? btn('Öffentlichen Link kopieren', { icon: 'link', action: 'copy-public' }) : `<span class="muted" style="font-size:12px">Öffentlicher Link ist aus (Firmen-Einstellungen → Funktionen)</span>`}</div>` + paper;
  };
  A['copy-public'] = () => BX.copy(location.origin + '/#/preise');

  // ================= Lager =================
  const partFields = (p = {}) => [
    { name: 'name', label: 'Bezeichnung', value: p.name, required: true }, { name: 'sku', label: 'Artikelnummer', value: p.sku, mono: true }, { name: 'unit', label: 'Einheit', value: p.unit || 'Stk' }, { name: 'min', label: 'Mindestbestand', type: 'number', value: p.min ?? 0 },
    { name: 'loc', label: 'Lagerort', value: p.loc }, { name: 'buy', label: 'Einkaufspreis', type: 'number', step: '0.01', value: p.buy ?? 0 }, { name: 'sell', label: 'Verkaufspreis', type: 'number', step: '0.01', value: p.sell ?? 0 }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: p.active !== false },
  ];
  A['new-part'] = () => BX.form({ title: 'Neues Teil', fields: partFields(), intro: note('Den Bestand bucht danach ein Wareneingang.', 'info'), submit: async (v) => { await BX.api('POST', '/api/r/parts', v); return 'Teil angelegt'; } });
  A['edit-part'] = (id) => BX.form({ title: 'Teil bearbeiten', fields: partFields(U.part(id)), submit: async (v) => { await BX.api('PATCH', '/api/r/parts/' + id, v); return 'Gespeichert'; } });
  A['stock-in'] = (id) => BX.form({ title: 'Wareneingang', fields: [
    { name: 'part', label: 'Teil', type: 'select', options: D.parts.filter((p) => p.active).map((p) => [p.id, `${p.name} (Bestand ${p.stock})`]), value: id, full: true }, { name: 'qty', label: 'Menge', type: 'number', value: 1, required: true, step: '0.5' },
    { name: 'buy', label: 'Einkaufspreis je Stück', type: 'number', step: '0.01', value: id && U.part(id) ? U.part(id).buy : '' },
    ...((D.accounts || []).length && lvl('accounts') >= 3 ? [{ name: 'account', label: 'Ausgabe buchen von', type: 'select', options: [['', '– nicht buchen –']].concat(D.accounts.filter((a) => a.kind !== 'tax_reserve').map((a) => [a.id, a.name])), value: (D.accounts.find((a) => a.kind === 'bank') || {}).id }] : []),
    { name: 'note', label: 'Lieferant / Notiz', value: '' },
  ], submit: async (v) => { v.account = v.account || null; if (v.buy === null) delete v.buy; await BX.api('POST', '/api/stock/in', v); return 'Wareneingang gebucht'; } });
  A['stock-adjust'] = (id) => { const p = U.part(id); BX.form({ title: 'Inventur / Korrektur · ' + p.name, fields: [{ name: 'counted', label: 'Gezählter Bestand', type: 'number', value: p.stock, step: '0.5', required: true }, { name: 'reason', label: 'Grund', value: 'Inventur', required: true }], submit: async (v) => { const r = await BX.api('POST', '/api/stock/adjust', { part: id, counted: v.counted, reason: v.reason }); return r.diff ? `Differenz ${r.diff > 0 ? '+' : ''}${r.diff} gebucht` : 'Bestand stimmt'; } }); };
  P.lager = function (params, q) {
    const tab = q.tab || 'bestand';
    const canW = lvl('stock') >= 3;
    const low = D.parts.filter((p) => p.active && p.stock < p.min).length;
    const value = D.parts.reduce((s, p) => s + p.stock * (p.buy || 0), 0);
    const head = pageHead('Lager', 'Teile werden über Aufträge reserviert und bei „Fertig“ entnommen', canW ? btn('Neues Teil', { icon: 'plus', action: 'new-part' }) + btn('Wareneingang', { cls: 'primary', icon: 'plus', action: 'stock-in' }) : '');
    const k = `<div class="grid g-4 mb">${kpi('Artikel', D.parts.filter((p) => p.active).length, '', { icon: 'box' })}${kpi('Unter Mindestbestand', low, low ? 'Nachbestellen' : 'alles gut', { icon: 'alert', dir: low ? 'down' : 'up' })}${kpi('Reserviert', D.parts.reduce((s, p) => s + p.reserved, 0) + ' Stück', 'durch offene Aufträge', { icon: 'wrench' })}${lvl('stock') >= 2 ? kpi('Lagerwert (EK)', money(value), '', { icon: 'coins' }) : ''}</div>`;
    const tabsHtml = U.tabs('#/lager', [['bestand', 'Bestand'], ['bewegungen', 'Bewegungen']], tab);
    if (tab === 'bestand') {
      const rows = D.parts.map((p) => ({ _dim: !p.active, sku: `<span class="mono">${esc(p.sku)}</span>`, n: `<b>${esc(p.name)}</b><span class="sub">${esc(p.loc)}</span>`, s: `<div style="min-width:120px"><div class="row between"><b>${p.stock} ${esc(p.unit)}</b>${p.stock < p.min ? badge('knapp', 'bad') : ''}</div>${bar(Math.min(100, p.stock / Math.max(1, p.min * 2) * 100), p.stock < p.min ? 'bad' : p.stock < p.min * 1.3 ? 'warn' : 'ok')}</div>`, r: p.reserved, f: p.stock - p.reserved, m: p.min, b: p.buy !== null ? money(p.buy) : '–', v: money(p.sell), x: canW ? `<div class="row" style="gap:2px;flex-wrap:nowrap">${btn('', { cls: 'sm ghost', icon: 'plus', action: 'stock-in', arg: p.id, title: 'Wareneingang' })}${btn('', { cls: 'sm ghost', icon: 'list', action: 'stock-adjust', arg: p.id, title: 'Inventur / Korrektur' })}${btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-part', arg: p.id, title: 'Bearbeiten' })}</div>` : '' }));
      return head + k + tabsHtml + card('', table([{ key: 'sku', label: 'Artikel' }, { key: 'n', label: 'Bezeichnung' }, { key: 's', label: 'Bestand' }, { key: 'r', label: 'Reserviert', num: true }, { key: 'f', label: 'Frei', num: true }, { key: 'm', label: 'Mindest', num: true }, { key: 'b', label: 'EK', num: true }, { key: 'v', label: 'VK', num: true }, { key: 'x', label: '' }], rows, { empty: 'Noch keine Teile' }), { flush: true });
    }
    const KM = { in: ['Wareneingang', 'ok'], out: ['Entnahme', ''], reserve: ['Reservierung', 'info'], release: ['Freigabe', ''], adjust: ['Korrektur', 'warn'], inventory: ['Inventur', 'warn'] };
    return head + k + tabsHtml + card('', table([{ key: 'a', label: 'Zeit' }, { key: 'p', label: 'Teil' }, { key: 'q', label: 'Menge', num: true }, { key: 'k', label: 'Art' }, { key: 'g', label: 'Bezug / Grund' }, { key: 'u', label: 'Von' }],
      D.stockMovements.map((m) => ({ a: date(m.at), p: esc((U.part(m.part) || {}).name || ''), q: `<b style="color:${m.qty > 0 ? 'var(--ok)' : 'var(--text)'}">${m.qty > 0 ? '+' : ''}${m.qty}</b>`, k: badge(KM[m.kind][0], KM[m.kind][1]), g: esc([m.ref, m.reason].filter(Boolean).join(' · ')), u: person(U.user(m.by)) })), { empty: 'Noch keine Bewegungen' }), { flush: true });
  };
})();
