/* Boxenstopp – Seiten: Finanzen, Rechnungen, Buchungen, Konten, Steuern, Lohn, Berichte */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = BX.pages;
  const A = BX.actions;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, plate, person, note } = U;
  const lvl = (m) => D.me.levels[m] || 0;
  const flag = (k) => D.me.flags[k];
  const accName = (id) => (U.byId(D.accounts || [], id) || { name: '–' }).name;
  const payAccounts = () => (D.accounts || []).filter((a) => a.kind !== 'tax_reserve' && !a.archived);
  const TX = { income: ['Einnahme', 'ok'], expense: ['Ausgabe', 'bad'], transfer_in: ['Umbuchung', 'info'], transfer_out: ['Umbuchung', 'info'] };
  const SRC = { invoice: 'Rechnung', reserve: 'Rücklage', stock: 'Lager', recurring: 'Dauerauftrag', tax: 'Steuer', payroll: 'Lohn', manual: 'Manuell', closing: 'Tagesabschluss', transfer: 'Umbuchung', refund: 'Erstattung' };
  const EVERY = { weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };

  P.finanzen = function () {
    const w = D.weekly8 || [];
    const last4 = w.slice(-4);
    const rev = last4.reduce((s, x) => s + x.rev, 0), exp = last4.reduce((s, x) => s + x.exp, 0);
    const openInv = (D.invoices || []).filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    const byCat = {};
    (D.orders || []).filter((o) => ['invoiced', 'picked_up'].includes(o.status)).forEach((o) => o.items.forEach((l) => { const it = U.item(l.item); const k = it ? (U.cat(it.cat) || { name: 'Sonstiges' }).name : 'Freie Positionen'; byCat[k] = (byCat[k] || 0) + D.lineTotal(l); }));
    const catData = Object.entries(byCat).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
    return pageHead('Finanzen', `Übersicht der letzten vier Wochen (${last4.length ? last4[0].label + '–' + last4[last4.length - 1].label : ''})`, (lvl('reports') >= 1 ? btn('Berichte', { icon: 'chart', href: '#/berichte' }) : '') + (lvl('accounts') >= 3 ? btn('Neue Buchung', { cls: 'primary', icon: 'plus', action: 'new-tx' }) : '')) +
      `<div class="grid g-4">${kpi('Umsatz (Zahlungseingänge)', money(rev), '4 Wochen', { accent: true, icon: 'coins' })}${kpi('Ausgaben', money(exp), 'inkl. Löhne & Steuern', { icon: 'wallet' })}${kpi('Ergebnis', money(rev - exp), rev ? Math.round((rev - exp) / rev * 100) + ' % vom Umsatz' : '', { icon: 'chart', dir: rev - exp >= 0 ? 'up' : 'down' })}${kpi('Offene Posten', money(openInv.reduce((s, i) => s + i.total - i.paid, 0)), openInv.length + ' Rechnungen', { icon: 'file' })}</div>
      <div class="grid g-3 mt"><div class="span-2">${card('Umsatz und Ausgaben je Woche', U.barChart(w.map((x) => ({ label: x.label, rev: x.rev, exp: x.exp })), { keys: ['rev', 'exp'], colors: ['var(--accent)', 'var(--border-strong)'], label: 'Umsatz und Ausgaben je Woche' }) + `<div class="legend"><span><i class="qdot" style="background:var(--accent);width:10px;height:10px;border-radius:3px"></i>Umsatz</span><span><i class="qdot" style="background:var(--border-strong);width:10px;height:10px;border-radius:3px"></i>Ausgaben</span></div>`)}</div>
      ${card('Umsatz nach Kategorie', catData.length ? U.donut(catData.slice(0, 7), { label: 'Umsatz nach Kategorie' }) : '<div class="empty">Noch keine abgerechneten Aufträge</div>', { sub: 'abgerechnete Aufträge' })}</div>
      <div class="grid g-4 mt">${(D.accounts || []).map((a) => card(esc(a.name), `<div class="kpi" style="padding:0"><div class="value">${money(a.balance)}</div><div class="muted">${{ bank: 'Bankkonto', cash: 'Kasse', tax_reserve: 'nur für Steuern', other: 'Sonstiges' }[a.kind]}</div></div>`, { actions: `<a class="btn sm ghost" href="#/buchungen?konto=${a.id}">Buchungen</a>` })).join('')}</div>`;
  };

  // ---------- Rechnungen ----------
  P.rechnungen = function (params, q) {
    const f = q.status || 'alle';
    let list = D.invoices;
    if (f === 'offen') list = list.filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    if (f === 'ueberfaellig') list = list.filter((i) => i.status === 'overdue');
    if (f === 'bezahlt') list = list.filter((i) => i.status === 'paid');
    if (f === 'storno') list = list.filter((i) => ['cancelled', 'credit'].includes(i.status));
    const rows = list.map((i) => ({ _href: '#/rechnung/' + i.id, _dim: ['cancelled', 'credit'].includes(i.status), _filter: [i.no, (U.cust(i.customer) || {}).name].join(' '), no: `<span class="mono">${esc(i.no)}</span>`, c: esc((U.cust(i.customer) || {}).name || (i.snapshot.customer || {}).name || ''), o: i.order ? `<span class="mono muted">${esc((U.byId(D.orders, i.order) || { no: i.snapshot.ref || '' }).no)}</span>` : i.snapshot.ref ? `<span class="mono muted">${esc(i.snapshot.ref)}</span>` : '<span class="faint">frei</span>', d: date(i.issued), due: date(i.due), s: U.invBadge(i.status), t: money(i.total), p: ['cancelled', 'credit'].includes(i.status) ? '–' : i.total - i.paid > 0 ? `<b style="color:${i.status === 'overdue' ? 'var(--bad)' : 'var(--text)'}">${money(i.total - i.paid)}</b>` : '–' }));
    const seg = `<div class="seg">${[['alle', 'Alle'], ['offen', 'Offen'], ['ueberfaellig', 'Überfällig'], ['bezahlt', 'Bezahlt'], ['storno', 'Storno']].map(([k, l]) => `<a href="#/rechnungen?status=${k}" class="${f === k ? 'active' : ''}">${l}</a>`).join('')}</div>`;
    return pageHead('Rechnungen', 'Nummernkreis lückenlos · Storno nur per Gegenrechnung · Rechnungen entstehen aus Aufträgen und Einsätzen', seg) +
      card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Nummer oder Kunde …" data-action="filter" data-target="#invTable"></div>` + table([{ key: 'no', label: 'Nummer' }, { key: 'c', label: 'Kunde' }, { key: 'o', label: 'Bezug' }, { key: 'd', label: 'Datum' }, { key: 'due', label: 'Fällig' }, { key: 's', label: 'Status' }, { key: 't', label: 'Betrag', num: true }, { key: 'p', label: 'Offen', num: true }], rows, { id: 'invTable', empty: 'Keine Rechnungen' }));
  };
  A.payment = (id) => {
    const i = U.byId(D.invoices, id);
    const cash = payAccounts().find((a) => a.kind === 'cash') || payAccounts()[0];
    BX.form({ title: 'Zahlung erfassen · ' + i.no, fields: [
      { name: 'amount', label: 'Betrag', type: 'number', step: '0.01', value: Math.round((i.total - i.paid) * 100) / 100, required: true }, { name: 'method', label: 'Zahlungsart', type: 'select', options: ['Bar', 'Karte', 'Überweisung'], value: 'Bar' },
      { name: 'account', label: 'Konto', type: 'select', options: payAccounts().map((a) => [a.id, a.name]), value: cash && cash.id }, { name: 'date', label: 'Datum', type: 'date', value: D.TODAY },
    ], intro: D.firm.features.taxReserve ? note(`${D.firm.taxRate} % der Zahlung werden automatisch auf die Steuer-Rücklage umgebucht.`, 'info') : '',
    submit: async (v) => { await BX.api('POST', `/api/invoices/${id}/payments`, v); return 'Zahlung gebucht'; } });
  };
  A['cancel-invoice'] = (id) => { const i = U.byId(D.invoices, id); BX.prompt('Rechnung stornieren · ' + i.no, 'Grund', 'Stornieren', async (reason) => { await BX.api('POST', `/api/invoices/${id}/cancel`, { reason }); return 'Storniert – Gegenrechnung erstellt'; }, { danger: true, hint: i.paid ? `Bereits bezahlte ${money(i.paid)} werden als Erstattung gebucht.` : '' }); };
  P.rechnung = function (params) {
    const i = U.byId(D.invoices, params[0]);
    if (!i) return pageHead('Rechnung nicht gefunden', '', btn('Zurück', { href: '#/rechnungen' }));
    const s = i.snapshot;
    const o = i.order ? U.byId(D.orders, i.order) : null;
    const isCredit = i.status === 'credit';
    const stamp = i.status === 'paid' ? '<span class="stamp">BEZAHLT</span>' : i.status === 'cancelled' ? '<span class="stamp cancel">STORNIERT</span>' : isCredit ? '<span class="stamp cancel">GUTSCHRIFT</span>' : i.status === 'partial' ? '<span class="stamp open">TEILWEISE BEZAHLT</span>' : '<span class="stamp open">OFFEN</span>';
    const paper = `<div class="paper">
      <div class="row between" style="align-items:flex-start"><div class="row">${BX.look.logoHtml('', s.firm.logo)}<div><div style="font-size:20px;font-weight:800">${esc(s.firm.name)}</div><div class="muted">${esc(s.firm.address || '')}${s.firm.phone ? '<br>Tel. ' + esc(s.firm.phone) : ''}</div></div></div>
      <div class="right"><div style="font-size:22px;font-weight:800">${isCredit ? 'Stornorechnung' : 'Rechnung'}</div><div class="mono">${esc(i.no)}</div><div class="muted">Datum ${date(i.issued)}${isCredit ? '' : ' · fällig ' + date(i.due)}</div>${s.ref ? `<div class="muted">${esc(s.ref)}</div>` : ''}</div></div>
      <div class="row between" style="margin-top:22px;align-items:flex-start">${s.customer ? `<div><h3>Kunde</h3><b>${esc(s.customer.name)}</b><div class="muted">${esc(U.custKind[s.customer.kind] || '')}${s.customer.phone ? ' · Tel. ' + esc(s.customer.phone) : ''}</div></div>` : '<div></div>'}${s.vehicle ? `<div class="right"><h3>Fahrzeug</h3>${plate(s.vehicle.plate)}<div class="muted">${esc(s.vehicle.make || '')} ${esc(s.vehicle.model || '')}</div></div>` : ''}</div>
      <table><thead><tr><th>Leistung</th><th style="text-align:right">Menge</th><th style="text-align:right">Preis</th><th style="text-align:right">Rabatt</th><th style="text-align:right">Gesamt</th></tr></thead><tbody>
      ${s.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unit)}</td><td style="text-align:right">${l.disc ? '−' + l.disc + ' %' : ''}</td><td style="text-align:right">${money(l.total)}</td></tr>`).join('')}
      </tbody><tbody><tr class="tot"><td colspan="4" style="text-align:right">Zwischensumme</td><td style="text-align:right">${money(s.gross)}</td></tr>${s.discount ? `<tr class="tot"><td colspan="4" style="text-align:right">Rabatt${s.customer && s.customer.priceGroup ? ' (Preisgruppe ' + esc(s.customer.priceGroup) + ')' : ''}</td><td style="text-align:right">−${money(s.discount)}</td></tr>` : ''}<tr class="grand"><td colspan="4" style="text-align:right">Gesamtpreis</td><td style="text-align:right">${money(s.total)}</td></tr></tbody></table>
      ${s.reason ? `<p style="margin-top:14px"><b>Grund:</b> ${esc(s.reason)}</p>` : ''}
      <div class="row between" style="margin-top:26px;align-items:flex-end"><p class="muted" style="max-width:420px;font-size:12px">${esc(s.firm.footer || '')}<br>Alle Preise sind Endpreise.</p>${stamp}</div></div>`;
    const pays = i.payments.length ? `<div class="list">${i.payments.map((p) => `<div class="list-item"><div class="grow"><div class="title">${money(p.amount)} · ${esc(p.method)}</div><div class="meta">${date(p.at)} · ${esc(accName(p.account))} · ${esc((U.user(p.by) || {}).name || '')}</div></div>${badge(p.amount < 0 ? 'Erstattung' : 'gebucht', p.amount < 0 ? 'warn' : 'ok')}</div>`).join('')}</div>` : '<div class="empty">Noch keine Zahlung</div>';
    const canPay = ['open', 'partial', 'overdue'].includes(i.status) && lvl('invoices') >= 3 && payAccounts().length;
    const canStorno = ['open', 'partial', 'overdue', 'paid'].includes(i.status) && lvl('invoices') >= 3;
    const related = D.invoices.filter((x) => x.cancels === i.id || i.cancels === x.id);
    return pageHead(`${isCredit ? 'Stornorechnung' : 'Rechnung'} ${esc(i.no)} ${U.invBadge(i.status)}`, esc((s.customer || {}).name || ''), (canPay ? btn('Zahlung erfassen', { cls: 'primary', icon: 'coins', action: 'payment', arg: i.id }) : '') + btn('Drucken / PDF', { icon: 'print', action: 'print' }) + (canStorno ? btn('Stornieren', { cls: 'danger', action: 'cancel-invoice', arg: i.id, disabled: !flag('rechnung.storno'), title: flag('rechnung.storno') ? '' : 'Einzelrecht „Rechnungen stornieren“ fehlt' }) : ''), `<a href="#/rechnungen">Rechnungen</a> / ${esc(i.no)}`) +
      `<div class="grid g-side"><div>${paper}</div><div class="stack no-print">${isCredit ? '' : card('Zahlungen', pays, { flush: true, foot: `Offen: <b>${money(['cancelled'].includes(i.status) ? 0 : i.total - i.paid)}</b>` })}
      ${card('Steuer', `<p class="muted">Die Rechnung weist keine Steuer aus (Festpreise). Mit jeder Zahlung fließen <b>${D.firm.taxRate} %</b> in die Steuer-Rücklage; abgeführt wird je Steuerzeitraum.</p>`)}
      ${o ? card('Auftrag', `<a class="link mono" href="#/auftrag/${o.id}">${esc(o.no)}</a> ${U.statusBadge(o.status)}`) : ''}
      ${related.length ? card('Storno', related.map((x) => `<a class="link mono" href="#/rechnung/${x.id}">${esc(x.no)}</a> ${U.invBadge(x.status)}`).join('<br>')) : ''}</div></div>`;
  };

  // ---------- Buchungen ----------
  A['new-tx'] = () => BX.form({ title: 'Neue Buchung', fields: [
    { name: 'type', label: 'Art', type: 'select', options: [['expense', 'Ausgabe'], ['income', 'Einnahme']], value: 'expense' }, { name: 'amount', label: 'Betrag', type: 'number', step: '0.01', required: true },
    { name: 'account', label: 'Konto', type: 'select', options: (D.accounts || []).filter((a) => !a.archived).map((a) => [a.id, a.name]) }, { name: 'category', label: 'Kategorie', type: 'select', options: ['Teileeinkauf', 'Miete', 'Ausstattung', 'Versicherung', 'Gebühren', 'Strafen', 'Einlage', 'Trinkgeld', 'Sonstiges'], value: 'Sonstiges' },
    { name: 'title', label: 'Titel', required: true, full: true }, { name: 'date', label: 'Datum', type: 'date', value: D.TODAY }, { name: 'taxable', label: 'Steuerpflichtig', type: 'checkbox', hint: 'nur bei Einnahmen: zählt dann in den Steuerzeitraum' },
  ], submit: async (v) => { await BX.api('POST', '/api/transactions', v); return 'Gebucht'; } });
  A['del-tx'] = (id) => BX.confirm('Buchung löschen', 'Nur manuelle Buchungen lassen sich löschen. Das steht im Audit-Log.', 'Löschen', () => BX.call('DELETE', '/api/transactions/' + id, undefined, 'Gelöscht'));
  const recFields = (r = {}) => [
    { name: 'name', label: 'Name', value: r.name, required: true }, { name: 'amount', label: 'Betrag', type: 'number', step: '0.01', value: r.amount, required: true },
    { name: 'type', label: 'Art', type: 'select', options: [['expense', 'Ausgabe'], ['income', 'Einnahme']], value: r.type || 'expense' }, { name: 'every', label: 'Rhythmus', type: 'select', options: Object.entries(EVERY), value: r.every || 'monthly' },
    { name: 'next', label: 'Nächste Ausführung', type: 'date', value: r.next || D.TODAY, required: true }, { name: 'account', label: 'Konto', type: 'select', options: (D.accounts || []).map((a) => [a.id, a.name]), value: r.account },
    { name: 'category', label: 'Kategorie', value: r.cat || 'Sonstiges' }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: r.active !== false },
  ];
  A['new-rec'] = () => BX.form({ title: 'Neuer Dauerauftrag', fields: recFields(), submit: async (v) => { await BX.api('POST', '/api/r/recurring', v); return 'Dauerauftrag angelegt'; } });
  A['edit-rec'] = (id) => BX.form({ title: 'Dauerauftrag', fields: recFields(U.byId(D.recurring, id)), submit: async (v) => { await BX.api('PATCH', '/api/r/recurring/' + id, v); return 'Gespeichert'; } });
  P.buchungen = function (params, q) {
    const tab = q.tab || 'alle';
    const canW = lvl('accounts') >= 3;
    const head = pageHead('Buchungen', 'Alle Ein- und Ausgaben über alle Konten', `<a class="btn" href="/api/export/buchungen.csv">${icon('download')}CSV</a>` + (canW ? btn('Umbuchung', { icon: 'coins', action: 'transfer' }) + btn('Neue Buchung', { cls: 'primary', icon: 'plus', action: 'new-tx' }) : ''));
    const tabsHtml = U.tabs('#/buchungen', [['alle', 'Buchungen', D.transactions.length], ['dauer', 'Daueraufträge', D.recurring.length]], tab);
    if (tab === 'dauer') {
      return head + tabsHtml + card('', table([{ key: 'n', label: 'Name' }, { key: 'a', label: 'Betrag', num: true }, { key: 'e', label: 'Rhythmus' }, { key: 'x', label: 'Nächste' }, { key: 'k', label: 'Konto' }, { key: 'c', label: 'Kategorie' }, { key: 's', label: 'Status' }, { key: 'b', label: '' }],
        D.recurring.map((r) => ({ _dim: !r.active, n: `<b>${esc(r.name)}</b>`, a: money(r.type === 'income' ? r.amount : -r.amount), e: EVERY[r.every], x: date(r.next), k: esc(accName(r.account)), c: esc(r.cat), s: r.active ? badge('aktiv', 'ok') : badge('pausiert', ''), b: canW ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-rec', arg: r.id }) : '' })), { empty: 'Keine Daueraufträge' }), { flush: true, actions: canW ? btn('Neu', { cls: 'sm', icon: 'plus', action: 'new-rec' }) : '', foot: 'Der Worker bucht fällige Daueraufträge stündlich.' });
    }
    let list = D.transactions;
    if (q.konto) list = list.filter((t) => t.account === q.konto);
    const rows = list.map((t) => ({ _filter: [t.title, t.cat, accName(t.account)].join(' '), d: date(t.date), t: `<b>${esc(t.title)}</b><span class="sub">${esc(t.cat)}</span>`, k: badge(TX[t.type][0], TX[t.type][1]), a: esc(accName(t.account)), src: U.chip(SRC[t.source] || t.source), tax: t.type === 'income' ? (t.source === 'invoice' ? '<span class="faint">über Rechnung</span>' : t.taxable ? badge('steuerpflichtig', 'accent') : '<span class="faint">nein</span>') : '', by: U.avatar(U.user(t.by), 'sm'), amt: `<b style="color:${['income', 'transfer_in'].includes(t.type) ? 'var(--ok)' : 'var(--text)'}">${money(['income', 'transfer_in'].includes(t.type) ? t.amount : -t.amount, { sign: true })}</b>`, x: t.source === 'manual' && lvl('accounts') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-tx', arg: t.id, title: 'Löschen' }) : '' }));
    return head + tabsHtml + (q.konto ? `<div class="mb">${note(`Gefiltert auf Konto <b>${esc(accName(q.konto))}</b> · <a class="link" href="#/buchungen">alle zeigen</a>`, 'info')}</div>` : '') + card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Suchen …" data-action="filter" data-target="#txTable"></div>` + table([{ key: 'd', label: 'Datum' }, { key: 't', label: 'Buchung' }, { key: 'k', label: 'Art' }, { key: 'a', label: 'Konto' }, { key: 'src', label: 'Quelle' }, { key: 'tax', label: 'Steuer' }, { key: 'by', label: 'Von' }, { key: 'amt', label: 'Betrag', num: true }, { key: 'x', label: '' }], rows, { id: 'txTable', empty: 'Keine Buchungen' }));
  };
  A.transfer = () => BX.form({ title: 'Umbuchung', fields: [{ name: 'from', label: 'Von', type: 'select', options: D.accounts.map((a) => [a.id, `${a.name} (${money(a.balance)})`]) }, { name: 'to', label: 'Nach', type: 'select', options: D.accounts.map((a) => [a.id, a.name]), value: (D.accounts[1] || {}).id }, { name: 'amount', label: 'Betrag', type: 'number', step: '0.01', required: true }, { name: 'title', label: 'Titel', value: 'Umbuchung' }],
    submit: async (v) => { await BX.api('POST', '/api/transfers', v); return 'Umgebucht'; } });

  // ---------- Konten & Tagesabschluss ----------
  A['new-account'] = () => BX.form({ title: 'Neues Konto', fields: [{ name: 'name', label: 'Name', required: true }, { name: 'kind', label: 'Art', type: 'select', options: [['bank', 'Bankkonto'], ['cash', 'Kasse'], ['other', 'Sonstiges'], ['tax_reserve', 'Steuer-Rücklage']] }], submit: async (v) => { await BX.api('POST', '/api/r/accounts', v); return 'Konto angelegt'; } });
  A.closing = (id) => {
    const a = U.byId(D.accounts, id);
    BX.form({ title: 'Tagesabschluss · ' + a.name, intro: note(`Erwarteter Bestand: <b>${money(a.balance)}</b>. Eine Differenz wird mit Grund als Buchung erfasst; danach ist der Tag für diese Kasse gesperrt.`, 'info'),
      fields: [{ name: 'counted', label: 'Gezählter Bestand', type: 'number', step: '0.01', value: a.balance, required: true }, { name: 'reason', label: 'Grund bei Differenz', ph: 'z. B. Wechselgeld' }],
      submit: async (v) => { const r = await BX.api('POST', '/api/closings', { account: id, counted: v.counted, reason: v.reason }); return r.diff ? `Abgeschlossen · Differenz ${money(r.diff)}` : 'Abgeschlossen · stimmt'; } });
  };
  P.konten = function () {
    const canW = lvl('accounts') >= 3;
    return pageHead('Konten & Kassen', 'Kontostand = Einnahmen − Ausgaben', (canW ? btn('Umbuchung', { icon: 'coins', action: 'transfer' }) : '') + (lvl('accounts') >= 4 ? btn('Neues Konto', { cls: 'primary', icon: 'plus', action: 'new-account' }) : '')) +
      `<div class="grid g-4">${D.accounts.map((a) => card(esc(a.name), `<div class="kpi" style="padding:0"><div class="value">${money(a.balance)}</div><div class="muted">${{ bank: 'Bankkonto', cash: 'Kasse', tax_reserve: 'Steuer-Rücklage', other: 'Sonstiges' }[a.kind]}</div></div>`, { actions: (a.kind === 'cash' && flag('kasse.abschluss') ? btn('Abschluss', { cls: 'sm', action: 'closing', arg: a.id }) : '') + `<a class="btn sm ghost" href="#/buchungen?konto=${a.id}">Buchungen</a>` })).join('')}</div>
      <div class="mt">${card('Letzte Tagesabschlüsse', table([{ key: 'd', label: 'Tag' }, { key: 'k', label: 'Kasse' }, { key: 'e', label: 'Erwartet', num: true }, { key: 'z', label: 'Gezählt', num: true }, { key: 'x', label: 'Differenz', num: true }, { key: 'r', label: 'Grund' }, { key: 'u', label: 'Von' }],
        D.closings.map((c) => { const diff = Math.round((c.counted - c.expected) * 100) / 100; return { d: date(c.date), k: esc(accName(c.account)), e: money(c.expected), z: money(c.counted), x: `<span style="color:${diff < 0 ? 'var(--bad)' : diff > 0 ? 'var(--ok)' : 'inherit'}">${money(diff, { sign: true })}</span>`, r: esc(c.reason), u: U.avatar(U.user(c.by), 'sm') }; }), { empty: 'Noch keine Abschlüsse' }), { flush: true })}</div>`;
  };

  // ---------- Steuern ----------
  A['tax-file'] = (from) => {
    const p = D.taxPeriods.find((x) => x.from === from);
    const reserve = D.accounts.find((a) => a.kind === 'tax_reserve');
    BX.form({ title: 'Steuern abführen · ' + p.label, intro: `<div class="grid g-3 mb">${kpi('Steuerpfl. Umsatz', money(p.revenue))}${kpi('Satz', p.rate + ' %')}${kpi('Steuer', money(p.tax), '', { accent: true })}</div>${note('Danach ist der Zeitraum abgeschlossen und unveränderlich.', 'warn')}`,
      fields: [{ name: 'account', label: 'Abbuchen von', type: 'select', options: D.accounts.map((a) => [a.id, `${a.name} (${money(a.balance)})`]), value: reserve && reserve.id, full: true }], cols: 1, ok: 'Abführen',
      submit: async (v) => { const r = await BX.api('POST', '/api/tax/file', { from, account: v.account }); return `Abgeführt: ${money(r.tax)}`; } });
  };
  A['tax-rate'] = () => BX.form({ title: 'Steuersatz ändern', fields: [{ name: 'rate', label: 'Neuer Satz (%)', type: 'number', step: '0.1', value: D.firm.taxRate, required: true }, { name: 'from', label: 'Gültig ab', type: 'date', value: D.TODAY, required: true }], intro: note('Ältere Zeiträume behalten ihren Satz. Für schon abgeführte Zeiträume geht keine Änderung.', 'info'),
    submit: async (v) => { await BX.api('POST', '/api/tax/rates', v); return 'Steuersatz gespeichert'; } });
  P.steuern = function () {
    const cur = D.taxPeriods[0], ready = D.taxPeriods.filter((p) => p.status === 'ready');
    const reserve = D.accounts.find((a) => a.kind === 'tax_reserve');
    const openTax = D.taxPeriods.filter((p) => p.status !== 'filed').reduce((s, p) => s + p.tax, 0);
    const days = Math.max(1, Math.round((new Date(D.TODAY) - new Date(cur.from)) / 86400000) + 1);
    const span = Math.round((new Date(cur.to) - new Date(cur.from)) / 86400000) + 1;
    const rows = D.taxPeriods.map((p) => ({
      l: `<b>${esc(p.label)}</b><span class="sub">${date(p.from)} – ${date(p.to)}</span>`, r: money(p.revenue), s: p.rate + ' %', t: `<b>${money(p.tax)}</b>`,
      st: p.status === 'running' ? badge('läuft', 'info', true) : p.status === 'ready' ? badge(p.tax > 0 ? 'bereit zur Abführung' : 'keine Steuer', p.tax > 0 ? 'warn' : '', true) : badge('abgeführt ' + date(p.filed), 'ok', true),
      a: p.status === 'ready' && lvl('tax') >= 4 ? btn('Abführen', { cls: 'sm primary', action: 'tax-file', arg: p.from }) : p.status === 'filed' ? btn('Bericht', { cls: 'sm', icon: 'print', action: 'tax-report', arg: p.from }) : '',
    }));
    return pageHead('Steuern', `Ein Satz für die Firma (aktuell ${D.firm.taxRate} %) · Steuer = Satz × Umsatz des Zeitraums · Zeitraum: ${D.firm.taxPeriod}`, lvl('tax') >= 4 ? btn('Satz ändern', { icon: 'percent', action: 'tax-rate' }) : '') +
      `<div class="grid g-4">${kpi('Umsatz ' + cur.label + ' bisher', money(cur.revenue), 'bezahlte Rechnungen + steuerpfl. Einnahmen', { icon: 'coins' })}${kpi('Steuer ' + cur.label + ' bisher', money(cur.tax), 'Hochrechnung: ' + money(Math.round(cur.tax / days * span)), { icon: 'percent', accent: true })}${kpi('Bereit zur Abführung', money(ready.reduce((s, p) => s + p.tax, 0)), ready.map((p) => p.label).join(', ') || '–', { icon: 'alert' })}${reserve ? kpi('Steuer-Rücklage', money(reserve.balance), reserve.balance >= openTax ? '✓ deckt offene Steuer (' + money(openTax) + ')' : 'reicht nicht (' + money(openTax) + ' offen)', { icon: 'wallet', dir: reserve.balance >= openTax ? 'up' : 'down' }) : ''}</div>
      <div class="grid g-side mt">${card('Steuerzeiträume', table([{ key: 'l', label: 'Zeitraum' }, { key: 'r', label: 'Steuerpfl. Umsatz', num: true }, { key: 's', label: 'Satz', num: true }, { key: 't', label: 'Steuer', num: true }, { key: 'st', label: 'Status' }, { key: 'a', label: '' }], rows), { flush: true })}
      <div class="stack">${card('Regeln', `<ul class="muted" style="margin:0;padding-left:18px;line-height:1.8"><li>Festpreise – Rechnungen weisen keine Steuer aus</li><li>Steuerpflichtig: Zahlungseingänge auf Rechnungen; Stornos mindern</li><li>Manuelle Einnahmen nur, wenn als steuerpflichtig markiert</li><li>Keine Vorsteuer, keine weiteren Abgaben</li><li>Abgeführte Zeiträume sind unveränderlich</li></ul>`)}
      ${card('Satz-Historie', table([{ key: 'r', label: 'Satz' }, { key: 'f', label: 'Gültig ab' }, { key: 'b', label: 'Geändert von' }], D.taxRateHistory.map((h) => ({ r: `<b>${h.rate} %</b>`, f: date(h.from), b: h.by_user ? person(U.user(h.by_user)) : '–' }))), { flush: true })}</div></div>`;
  };
  A['tax-report'] = (from) => {
    const p = D.taxPeriods.find((x) => x.from === from);
    BX.openModal({ title: 'Steuerbericht ' + p.label, wide: true, body: `<div class="paper"><div class="row">${BX.look.logoHtml()}<div><b style="font-size:18px">${esc(D.firm.name)}</b><div class="muted">${esc(D.firm.address || '')}</div></div></div><h3>Steuerbericht ${esc(p.label)}</h3><p>Zeitraum ${date(p.from)} – ${date(p.to)}</p><table><tbody><tr><td>Steuerpflichtiger Umsatz</td><td style="text-align:right">${money(p.revenue)}</td></tr><tr><td>Steuersatz</td><td style="text-align:right">${p.rate} %</td></tr><tr class="grand"><td>Abgeführte Steuer</td><td style="text-align:right">${money(p.tax)}</td></tr></tbody></table><p class="muted" style="margin-top:20px">Abgeführt am ${date(p.filed)} von ${esc((U.user(p.by) || {}).name || '')}.</p></div>`, foot: `<button class="btn" data-action="modal-close">Schließen</button><button class="btn primary" data-action="print">Drucken</button>` });
  };

  // ---------- Lohn ----------
  A['payroll-approve'] = () => {
    const pr = D.payroll;
    BX.form({ title: 'Lohnlauf freigeben · ' + pr.period.label, intro: note('Anpassungen (Bonus oder Abzug) je Mitarbeiter in $. Nach der Freigabe wird je Mitarbeiter eine Ausgabe gebucht; der Lohnlauf ist dann unveränderlich.', 'info'),
      fields: pr.draft.map((l) => ({ name: 'adj_' + l.user, label: `${(U.user(l.user) || {}).name} · ${money(l.total)}`, type: 'number', step: '0.01', value: 0 })).concat([{ name: 'account', label: 'Auszahlen von', type: 'select', options: payAccounts().map((a) => [a.id, a.name]), value: D.firm.payrollAccount }]),
      ok: 'Freigeben & buchen',
      submit: async (v) => { const adjust = {}; pr.draft.forEach((l) => { if (v['adj_' + l.user]) adjust[l.user] = v['adj_' + l.user]; }); const r = await BX.api('POST', '/api/payroll/approve', { from: pr.period.from, adjust, account: v.account }); return 'Lohnlauf freigegeben: ' + money(r.total); } });
  };
  P.lohn = function () {
    const pr = D.payroll;
    const lines = pr.draft || [];
    const total = lines.reduce((s, l) => s + l.total, 0);
    const rows = lines.map((r) => ({ p: person(U.user(r.user), (U.rank((U.user(r.user) || {}).rank) || {}).name), h: r.hours.toLocaleString('de-DE') + ' h', hr: r.rate ? money(r.hourly) + `<span class="sub">${money(r.rate)}/h</span>` : '–', c: r.comm ? money(r.commission) + `<span class="sub">${r.comm} % von ${money(r.base)}</span>` : '–', f: r.fixed ? money(r.fixed) : '–', t: `<b>${money(r.total)}</b>` }));
    const runs = pr.runs.map((r) => ({ k: `<b>${esc(r.label)}</b><span class="sub">${date(r.from)} – ${date(r.to)}</span>`, s: pr.seeAll ? money(r.total) : money(r.lines.reduce((s, l) => s + l.total, 0)), n: r.lines.length, b: `${date(r.at)} · ${esc((U.user(r.by) || {}).name || '')}`, x: badge('unveränderlich', '') }));
    return pageHead('Lohn & Provision', pr.approved ? `${esc(pr.period.label)} ist freigegeben.` : `Lohnlauf ${esc(pr.period.label)} · Entwurf · nach Freigabe unveränderlich`, !pr.approved && lvl('payroll') >= 4 && lines.length ? btn('Freigeben & buchen', { cls: 'primary', icon: 'check', action: 'payroll-approve' }) : '') +
      (pr.seeAll ? '' : `<div class="mb">${note('Du siehst nur deine eigene Abrechnung (Einzelrecht „Löhne anderer sehen“ fehlt).', 'info')}</div>`) +
      (pr.approved ? '' : `<div class="grid g-4 mb">${kpi(pr.seeAll ? 'Summe Lohnlauf' : 'Deine Auszahlung', money(total), lines.length + ' Mitarbeiter', { accent: true, icon: 'coins' })}${kpi('Stundenlöhne', money(lines.reduce((s, r) => s + r.hourly, 0)), lines.reduce((s, r) => s + r.hours, 0).toLocaleString('de-DE') + ' Dienststunden', { icon: 'clock' })}${kpi('Provisionen', money(lines.reduce((s, r) => s + r.commission, 0)), 'auf eigene abgerechnete Positionen', { icon: 'percent' })}${kpi('Fixum', money(lines.reduce((s, r) => s + r.fixed, 0)), '', { icon: 'wallet' })}</div>` +
      card(`Lohnlauf ${esc(pr.period.label)} (${date(pr.period.from)} – ${date(pr.period.to)})`, table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'h', label: 'Dienst', num: true }, { key: 'hr', label: 'Stundenlohn', num: true }, { key: 'c', label: 'Provision', num: true }, { key: 'f', label: 'Fixum', num: true }, { key: 't', label: 'Auszahlung', num: true }], rows, { foot: pr.seeAll && rows.length ? ['Summe', '', '', '', '', money(total)] : null, empty: 'Keine Dienststunden oder Provisionen im Zeitraum' }), { flush: true, actions: badge('Entwurf', 'warn', true), foot: 'Stunden aus der Stempeluhr, Provision auf Positionen, die in dieser Woche abgerechnet wurden. Lohnmodell je Rang, abweichend je Mitarbeiter.' })) +
      `<div class="mt">${card('Freigegebene Lohnläufe', table([{ key: 'k', label: 'Zeitraum' }, { key: 's', label: 'Summe', num: true }, { key: 'n', label: 'Mitarbeiter', num: true }, { key: 'b', label: 'Freigegeben' }, { key: 'x', label: '' }], runs, { empty: 'Noch keine' }), { flush: true })}</div>`;
  };

  // ---------- Berichte ----------
  P.berichte = function () {
    const byUser = {}, byItem = {}, byCust = {};
    (D.orders || []).filter((o) => ['invoiced', 'picked_up', 'done'].includes(o.status)).forEach((o) => o.items.forEach((l) => {
      const t = D.lineTotal(l);
      if (l.by) byUser[l.by] = (byUser[l.by] || 0) + t;
      byItem[l.name] = byItem[l.name] || { n: 0, v: 0, item: l.item }; byItem[l.name].n += l.qty; byItem[l.name].v += t;
      byCust[o.customer] = (byCust[o.customer] || 0) + t;
    }));
    const userData = Object.entries(byUser).map(([u, v]) => ({ label: ((U.user(u) || {}).name || '?').split(' ')[0], rev: v })).sort((a, b) => b.rev - a.rev);
    const top = Object.entries(byItem).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
    const topCust = Object.entries(byCust).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const bayUse = D.bays.map((b) => ({ b, n: (D.appointments || []).filter((a) => a.bay === b.id && U.daysUntil(a.date) > -28 && U.daysUntil(a.date) <= 0).length }));
    const maxBay = Math.max(1, ...bayUse.map((x) => x.n));
    const w = D.weekly8 || [];
    return pageHead('Berichte', 'Auswertungen aus abgerechneten und fertigen Aufträgen', btn('Drucken', { icon: 'print', action: 'print' })) +
      `<div class="grid g-2">${card('Umsatz je Mitarbeiter', userData.length ? U.barChart(userData, { label: 'Umsatz je Mitarbeiter' }) : '<div class="empty">Noch keine Daten</div>', { sub: 'ausgeführte Positionen' })}${card('Top-Leistungen', table([{ key: 'n', label: 'Leistung' }, { key: 'c', label: 'Anzahl', num: true }, { key: 'v', label: 'Umsatz', num: true }, { key: 'm', label: 'Marge', num: true }], top.map(([n, x]) => { const it = U.item(x.item); return { n: esc(n), c: x.n, v: money(x.v), m: it && it.price && it.material !== null ? Math.round((it.price - it.material) / it.price * 100) + ' %' : '–' }; }), { empty: 'Noch keine Daten' }), { flush: true })}</div>
      <div class="grid g-3 mt">${card('Termine je Stellplatz (4 Wochen)', bayUse.map(({ b, n }) => `<div class="meter"><span>${esc(b.name)}</span>${U.bar(n / maxBay * 100, 'ok')}<span class="num">${n}</span></div>`).join(''))}
      ${card('Kunden mit dem meisten Umsatz', `<div class="list">${topCust.map(([c, v]) => `<div class="list-item" style="padding:7px 0"><div class="grow">${esc((U.cust(c) || {}).name || '')}</div><b>${money(v)}</b></div>`).join('') || '<div class="empty">Noch keine Daten</div>'}</div>`)}
      ${card('Ergebnis je Woche', `<div class="list">${w.slice().reverse().map((x) => `<div class="list-item" style="padding:6px 0"><div class="grow">${esc(x.label)}</div><span style="color:${x.rev - x.exp >= 0 ? 'var(--ok)' : 'var(--bad)'}">${money(x.rev - x.exp, { sign: true })}</span></div>`).join('')}</div>`)}</div>`;
  };
})();
