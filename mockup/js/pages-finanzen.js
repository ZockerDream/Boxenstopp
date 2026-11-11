/* Boxenstopp – Seiten: Finanzen */
(function () {
  'use strict';
  const D = window.BX.data;
  const U = window.BX.ui;
  const P = window.BX.pages;
  const S = () => window.BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, plate, person, note } = U;

  const accName = (id) => U.byId(D.accounts, id).name;
  const TX = { income: ['Einnahme', 'ok'], expense: ['Ausgabe', 'bad'], transfer_in: ['Umbuchung', 'info'], transfer_out: ['Umbuchung', 'info'] };
  const SRC = { invoice: 'Rechnung', reserve: 'Rücklage', stock: 'Lager', recurring: 'Dauerauftrag', tax: 'Steuer', payroll: 'Lohn', manual: 'Manuell', closing: 'Tagesabschluss' };

  P.finanzen = function () {
    const month = D.weekly8.slice(-4);
    const rev = month.reduce((s, w) => s + w.rev, 0), exp = month.reduce((s, w) => s + w.exp, 0);
    const openInv = D.invoices.filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    const byCat = {};
    D.orders.filter((o) => ['invoiced', 'picked_up', 'done'].includes(o.status)).forEach((o) => o.items.forEach((l) => { const it = U.item(l.item); const k = it ? U.cat(it.cat).name : 'Sonstiges'; byCat[k] = (byCat[k] || 0) + D.lineTotal(l); }));
    const catData = Object.entries(byCat).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
    return pageHead('Finanzen', 'Übersicht der letzten vier Wochen (KW 43–46)', btn('Bericht', { icon: 'chart', href: '#/berichte' }) + btn('Neue Buchung', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-tx' })) +
      `<div class="grid g-4">${kpi('Umsatz', money(rev), '▲ 12 % zum Vormonat', { accent: true, dir: 'up', icon: 'coins' })}${kpi('Ausgaben', money(exp), 'inkl. Löhne & Steuern', { icon: 'wallet' })}${kpi('Gewinn', money(rev - exp), Math.round((rev - exp) / rev * 100) + ' % Marge', { icon: 'chart', dir: 'up' })}${kpi('Offene Posten', money(openInv.reduce((s, i) => s + i.total - i.paid, 0)), openInv.length + ' Rechnungen', { icon: 'file' })}</div>
      <div class="grid g-3 mt"><div class="span-2">${card('Umsatz und Ausgaben je Woche', U.barChart(D.weekly8.map((w) => ({ label: w.label, rev: w.rev, exp: w.exp })), { keys: ['rev', 'exp'], colors: ['var(--accent)', 'var(--border-strong)'], label: 'Umsatz und Ausgaben je Woche' }) + `<div class="legend"><span><i class="qdot" style="background:var(--accent);width:10px;height:10px;border-radius:3px"></i>Umsatz</span><span><i class="qdot" style="background:var(--border-strong);width:10px;height:10px;border-radius:3px"></i>Ausgaben</span></div>`)}</div>
      ${card('Umsatz nach Kategorie', U.donut(catData.slice(0, 6), { label: 'Umsatz nach Kategorie' }))}</div>
      <div class="grid g-4 mt">${D.accounts.map((a) => card(esc(a.name), `<div class="kpi" style="padding:0"><div class="value">${money(a.balance)}</div><div class="muted">${{ bank: 'Bankkonto', cash: 'Kasse', tax_reserve: 'nur für Steuern' }[a.kind]}</div></div>`, { actions: `<a class="btn sm ghost" href="#/buchungen">Buchungen</a>` })).join('')}</div>`;
  };

  P.rechnungen = function (params, q) {
    const f = q.status || 'alle';
    let list = D.invoices;
    if (f === 'offen') list = list.filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    if (f === 'ueberfaellig') list = list.filter((i) => i.status === 'overdue');
    if (f === 'bezahlt') list = list.filter((i) => i.status === 'paid');
    const rows = list.map((i) => ({ _href: '#/rechnung/' + i.id, _dim: i.status === 'cancelled', no: `<span class="mono">${esc(i.no)}</span>`, c: esc(U.cust(i.customer).name), o: i.order ? `<span class="mono muted">${esc(U.byId(D.orders, i.order).no)}</span>` : '<span class="faint">frei</span>', d: date(i.issued), due: date(i.due), s: U.invBadge(i.status), t: money(i.total), p: i.status === 'cancelled' ? '–' : i.total - i.paid > 0 ? `<b style="color:${i.status === 'overdue' ? 'var(--bad)' : 'var(--text)'}">${money(i.total - i.paid)}</b>` : '–' }));
    const seg = `<div class="seg">${[['alle', 'Alle'], ['offen', 'Offen'], ['ueberfaellig', 'Überfällig'], ['bezahlt', 'Bezahlt']].map(([k, l]) => `<a href="#/rechnungen?status=${k}" class="${f === k ? 'active' : ''}">${l}</a>`).join('')}</div>`;
    return pageHead('Rechnungen', 'Nummernkreis RFG-R-JJJJ-laufend, lückenlos · Storno nur per Gegenrechnung', seg + btn('Freie Rechnung', { icon: 'plus', action: 'toast', arg: 'Freie Rechnung ohne Auftrag (Mockup)' })) +
      card('', table([{ key: 'no', label: 'Nummer' }, { key: 'c', label: 'Kunde' }, { key: 'o', label: 'Auftrag' }, { key: 'd', label: 'Datum' }, { key: 'due', label: 'Fällig' }, { key: 's', label: 'Status' }, { key: 't', label: 'Betrag', num: true }, { key: 'p', label: 'Offen', num: true }], rows), { flush: true });
  };

  P.rechnung = function (params) {
    const i = U.byId(D.invoices, params[0]);
    const c = U.cust(i.customer);
    const o = i.order ? U.byId(D.orders, i.order) : null;
    const v = o ? U.veh(o.vehicle) : null;
    const lines = o ? o.items : [{ name: 'Leistung lt. Vereinbarung', qty: 1, unit: i.total, disc: 0, kind: 'flat' }];
    const gross = lines.reduce((s, l) => s + l.qty * l.unit, 0);
    const stamp = i.status === 'paid' ? '<span class="stamp">BEZAHLT</span>' : i.status === 'cancelled' ? '<span class="stamp cancel">STORNIERT</span>' : i.status === 'partial' ? '<span class="stamp open">TEILWEISE BEZAHLT</span>' : '<span class="stamp open">OFFEN</span>';
    const paper = `<div class="paper">
      <div class="row between" style="align-items:flex-start"><div class="row">${window.BX.look.logoHtml()}<div><div style="font-size:20px;font-weight:800">${esc(D.firm.name)}</div><div class="muted">${esc(D.firm.address)}<br>Tel. ${esc(D.firm.phone)}</div></div></div>
      <div class="right"><div style="font-size:22px;font-weight:800">Rechnung</div><div class="mono">${esc(i.no)}</div><div class="muted">Datum ${date(i.issued)} · fällig ${date(i.due)}</div></div></div>
      <div class="row between" style="margin-top:22px;align-items:flex-start"><div><h3>Kunde</h3><b>${esc(c.name)}</b><div class="muted">${esc(U.custKind[c.kind])} · Tel. ${esc(c.phone)}</div></div>${v ? `<div class="right"><h3>Fahrzeug</h3>${plate(v.plate)}<div class="muted">${esc(v.make)} ${esc(v.model)} · Auftrag ${esc(o.no)}</div></div>` : ''}</div>
      <table><thead><tr><th>Leistung</th><th style="text-align:right">Menge</th><th style="text-align:right">Preis</th><th style="text-align:right">Rabatt</th><th style="text-align:right">Gesamt</th></tr></thead><tbody>
      ${lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unit)}</td><td style="text-align:right">${l.disc ? '−' + l.disc + ' %' : ''}</td><td style="text-align:right">${money(D.lineTotal(l))}</td></tr>`).join('')}
      </tbody><tbody><tr class="tot"><td colspan="4" style="text-align:right">Zwischensumme</td><td style="text-align:right">${money(gross)}</td></tr>${gross - i.total > 0 ? `<tr class="tot"><td colspan="4" style="text-align:right">Rabatt (Preisgruppe ${esc(U.pg(c.pg).name)})</td><td style="text-align:right">−${money(gross - i.total)}</td></tr>` : ''}<tr class="grand"><td colspan="4" style="text-align:right">Gesamtpreis</td><td style="text-align:right">${money(i.total)}</td></tr></tbody></table>
      <div class="row between" style="margin-top:26px;align-items:flex-end"><p class="muted" style="max-width:420px;font-size:12px">${esc(D.firm.invoiceFooter)}<br>Alle Preise sind Endpreise.</p>${stamp}</div></div>`;
    const pays = i.paid ? `<div class="list"><div class="list-item"><div class="grow"><div class="title">${money(i.paid)} · ${esc(i.method)}</div><div class="meta">${date(i.issued)} · Konto ${i.method === 'Bar' ? 'Bargeldkasse' : 'Firmenkonto'} · Rücklage ${money(Math.round(i.paid * D.firm.taxRate / 100))} umgebucht</div></div>${badge('gebucht', 'ok')}</div></div>` : '<div class="empty">Noch keine Zahlung</div>';
    const canStorno = window.BX.perm.flag(S().viewAs, 'rechnung.storno');
    return pageHead(`Rechnung ${esc(i.no)} ${U.invBadge(i.status)}`, esc(c.name), (i.status !== 'paid' && i.status !== 'cancelled' ? btn('Zahlung erfassen', { cls: 'primary', icon: 'coins', action: 'modal', arg: 'payment' }) : '') + btn('PDF', { icon: 'download', action: 'toast', arg: 'PDF erzeugt (Mockup)' }) + btn('Als Bild', { icon: 'image', action: 'toast', arg: 'PNG zum Posten im RP erzeugt (Mockup)' }) + (i.status !== 'cancelled' ? btn('Stornieren', { cls: 'danger', action: 'toast', arg: canStorno ? 'Gegenrechnung erstellt (Mockup)' : 'Dir fehlt das Einzelrecht „rechnung.storno“', disabled: !canStorno, title: canStorno ? '' : 'Einzelrecht rechnung.storno fehlt' }) : ''), `<a href="#/rechnungen">Rechnungen</a> / ${esc(i.no)}`) +
      `<div class="grid g-side"><div>${paper}</div><div class="stack">${card('Zahlungen', pays, { flush: !!i.paid, foot: `Offen: <b>${money(i.status === 'cancelled' ? 0 : i.total - i.paid)}</b>` })}${card('Steuer', `<p class="muted">Die Rechnung weist keine Steuer aus (Festpreise). Mit jeder Zahlung fließen <b>${D.firm.taxRate} %</b> in die Steuer-Rücklage; abgeführt wird je Steuerzeitraum.</p>`)}${o ? card('Auftrag', `<a class="link mono" href="#/auftrag/${o.id}">${esc(o.no)}</a> ${U.statusBadge(o.status)}`) : ''}</div></div>`;
  };

  P.buchungen = function (params, q) {
    const tab = q.tab || 'alle';
    const head = pageHead('Buchungen', 'Alle Ein- und Ausgaben über alle Konten', btn('CSV', { icon: 'download', action: 'toast', arg: 'CSV-Export (Mockup)' }) + btn('Neue Buchung', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-tx' }));
    const tabsHtml = U.tabs('#/buchungen', [['alle', 'Buchungen', D.transactions.length], ['dauer', 'Daueraufträge', D.recurring.length]], tab);
    if (tab === 'dauer') {
      return head + tabsHtml + card('', table([{ key: 'n', label: 'Name' }, { key: 'a', label: 'Betrag', num: true }, { key: 'e', label: 'Rhythmus' }, { key: 'x', label: 'Nächste' }, { key: 'k', label: 'Konto' }, { key: 'c', label: 'Kategorie' }, { key: 's', label: 'Status' }], D.recurring.map((r) => ({ n: `<b>${esc(r.name)}</b>`, a: money(-r.amount), e: esc(r.every), x: date(r.next), k: esc(accName(r.account)), c: esc(r.cat), s: badge('aktiv', 'ok') }))), { flush: true });
    }
    const rows = D.transactions.map((t) => ({ d: date(t.date), t: `<b>${esc(t.title)}</b><span class="sub">${esc(t.cat)}</span>`, k: badge(TX[t.type][0], TX[t.type][1]), a: esc(accName(t.account)), src: U.chip(SRC[t.source]), tax: t.type === 'income' ? (t.taxable ? badge('steuerpflichtig', 'accent') : '<span class="faint">nein</span>') : '', by: U.avatar(U.user(t.by), 'sm'), amt: `<b style="color:${t.type === 'income' ? 'var(--ok)' : 'var(--text)'}">${money(t.type === 'income' ? t.amount : -t.amount, { sign: true })}</b>` }));
    return head + tabsHtml + card('', table([{ key: 'd', label: 'Datum' }, { key: 't', label: 'Buchung' }, { key: 'k', label: 'Art' }, { key: 'a', label: 'Konto' }, { key: 'src', label: 'Quelle' }, { key: 'tax', label: 'Steuer' }, { key: 'by', label: 'Von' }, { key: 'amt', label: 'Betrag', num: true }], rows), { flush: true });
  };

  P.konten = function () {
    const cash = U.byId(D.accounts, 'a2');
    return pageHead('Konten & Kassen', 'Kontostand = Einnahmen − Ausgaben', btn('Umbuchung', { icon: 'coins', action: 'toast', arg: 'Umbuchung zwischen Konten (Mockup)' }) + btn('Neues Konto', { cls: 'primary', icon: 'plus', action: 'toast', arg: 'Neues Konto (Mockup)' })) +
      `<div class="grid g-4">${D.accounts.map((a) => card(esc(a.name), `<div class="kpi" style="padding:0"><div class="value">${money(a.balance)}</div><div class="muted">${{ bank: 'Bankkonto', cash: 'Kasse', tax_reserve: 'Steuer-Rücklage' }[a.kind]}</div></div>`)).join('')}</div>
      <div class="grid g-2 mt">${card('Tagesabschluss Bargeldkasse', `<div class="form cols-2">${U.field('Erwarteter Bestand', U.input(money(cash.balance), { attrs: 'readonly' }))}${U.field('Gezählter Bestand', U.input('', { ph: '$ …' }))}${U.field('Begründung bei Differenz', '<textarea class="input" placeholder="z. B. Wechselgeld"></textarea>', { full: true })}</div>`, { foot: 'Nach dem Abschluss sind Buchungen dieses Tages in dieser Kasse gesperrt.', actions: btn('Abschließen', { cls: 'primary sm', action: 'toast', arg: 'Tagesabschluss gespeichert (Mockup)' }) })}
      ${card('Letzte Abschlüsse', table([{ key: 'd', label: 'Tag' }, { key: 'k', label: 'Kasse' }, { key: 'e', label: 'Erwartet', num: true }, { key: 'z', label: 'Gezählt', num: true }, { key: 'x', label: 'Differenz', num: true }, { key: 'u', label: 'Von' }], [
        { d: date('2026-11-10'), k: 'Bargeldkasse', e: money(3430), z: money(3410), x: `<span style="color:var(--bad)">${money(-20)}</span>`, u: U.avatar(U.user('u1'), 'sm') },
        { d: date('2026-11-09'), k: 'Bargeldkasse', e: money(2210), z: money(2210), x: '0', u: U.avatar(U.user('u2'), 'sm') },
        { d: date('2026-11-08'), k: 'Bargeldkasse', e: money(4980), z: money(4985), x: `<span style="color:var(--ok)">+$ 5</span>`, u: U.avatar(U.user('u3'), 'sm') },
      ]), { flush: true })}</div>`;
  };

  P.steuern = function () {
    const cur = D.taxPeriods[0], ready = D.taxPeriods[1];
    const reserve = U.byId(D.accounts, 'a4').balance;
    const rows = D.taxPeriods.map((p) => ({
      l: `<b>${esc(p.label)}</b><span class="sub">${date(p.from)} – ${date(p.to)}</span>`, r: money(p.revenue), s: p.rate + ' %', t: `<b>${money(p.tax)}</b>`,
      st: p.status === 'running' ? badge('läuft', 'info', true) : p.status === 'ready' ? badge('bereit zur Abführung', 'warn', true) : badge('abgeführt ' + date(p.filed), 'ok', true),
      a: p.status === 'ready' ? btn('Steuern abführen', { cls: 'sm primary', action: 'modal', arg: 'tax-file' }) : p.status === 'filed' ? btn('PDF', { cls: 'sm', icon: 'download', action: 'toast', arg: 'Steuerbericht ' + p.label + ' (Mockup)' }) : '',
    }));
    return pageHead('Steuern', `Ein Satz für die Firma (${D.firm.taxRate} %) · Steuer = Satz × Umsatz des Zeitraums · Zeitraum: ${D.firm.taxPeriod}`, btn('Satz ändern', { action: 'toast', arg: 'Neuer Satz mit Gültig-ab-Datum (Mockup)' })) +
      `<div class="grid g-4">${kpi('Umsatz ' + cur.label + ' bisher', money(cur.revenue), 'bezahlte Rechnungen + steuerpflichtige Einnahmen', { icon: 'coins' })}${kpi('Steuer ' + cur.label + ' bisher', money(cur.tax), 'Hochrechnung Woche: ' + money(Math.round(cur.tax / 3 * 7)), { icon: 'percent', accent: true })}${kpi('Bereit zur Abführung', money(ready.tax), ready.label, { icon: 'alert' })}${kpi('Steuer-Rücklage', money(reserve), reserve >= cur.tax + ready.tax ? '✓ deckt offene Steuer' : 'reicht nicht', { icon: 'wallet', dir: reserve >= cur.tax + ready.tax ? 'up' : 'down' })}</div>
      <div class="grid g-side mt">${card('Steuerzeiträume', table([{ key: 'l', label: 'Zeitraum' }, { key: 'r', label: 'Steuerpfl. Umsatz', num: true }, { key: 's', label: 'Satz', num: true }, { key: 't', label: 'Steuer', num: true }, { key: 'st', label: 'Status' }, { key: 'a', label: '' }], rows), { flush: true })}
      <div class="stack">${card('Regeln', `<div class="list"><div class="list-item" style="padding:6px 0"><div class="grow">Festpreise – Rechnungen weisen keine Steuer aus</div></div><div class="list-item" style="padding:6px 0"><div class="grow">Steuerpflichtig: Zahlungseingänge auf Rechnungen, Stornos mindern</div></div><div class="list-item" style="padding:6px 0"><div class="grow">Manuelle Einnahmen nur, wenn als steuerpflichtig markiert</div></div><div class="list-item" style="padding:6px 0"><div class="grow">Keine Vorsteuer, keine weiteren Abgaben</div></div><div class="list-item" style="padding:6px 0"><div class="grow">Abgeführte Zeiträume sind unveränderlich</div></div></div>`)}
      ${card('Satz-Historie', table([{ key: 'r', label: 'Satz' }, { key: 'f', label: 'Gültig ab' }, { key: 'b', label: 'Geändert von' }], D.taxRateHistory.map((h) => ({ r: `<b>${h.rate} %</b>`, f: date(h.from), b: person(U.user(h.by)) }))), { flush: true })}</div></div>`;
  };

  P.lohn = function () {
    const run = D.staff.filter((s) => s.rank && s.status !== 'left').map((s) => {
      const hours = D.activity[s.id] ? D.activity[s.id][2] : 0;
      const rate = { r1: 0, r2: 180, r3: 150, r4: 120, r5: 80, r6: 50 }[s.rank];
      const comm = { r2: 8, r3: 6, r4: 5 }[s.rank] || 0;
      const base = s.id === 'u3' ? 21430 : s.id === 'u6' ? 9800 : s.id === 'u4' ? 7300 : s.id === 'u5' ? 6100 : s.id === 'u2' ? 14200 : 0;
      const fixed = s.rank === 'r1' ? 4000 : 0;
      const hourly = hours * rate, cm = Math.round(base * comm / 100);
      return { s, hours, rate, comm, base, fixed, hourly, cm, total: hourly + cm + fixed };
    });
    const total = run.reduce((s, r) => s + r.total, 0);
    const canSee = window.BX.perm.flag(S().viewAs, 'personal.lohn_sehen');
    const rows = run.map((r) => ({ p: person(r.s, U.rank(r.s.rank).name), h: r.hours + ' h', hr: r.rate ? money(r.hourly) + `<span class="sub">${money(r.rate)}/h</span>` : '–', c: r.comm ? money(r.cm) + `<span class="sub">${r.comm} % von ${money(r.base)}</span>` : '–', f: r.fixed ? money(r.fixed) : '–', a: `<input class="input" style="width:90px;text-align:right" placeholder="0">`, t: `<b>${money(r.total)}</b>` }));
    return pageHead('Lohn & Provision', 'Lohnlauf KW 45 · Entwurf · nach Freigabe unveränderlich', btn('Neu berechnen', { action: 'toast', arg: 'Lohnlauf neu berechnet (Mockup)' }) + btn('Freigeben & buchen', { cls: 'primary', icon: 'check', action: 'toast', arg: 'Lohnlauf freigegeben: ' + money(total) + ' als Ausgaben gebucht (Mockup)' })) +
      (canSee ? '' : `<div class="mb">${note('Mit deinen Rechten siehst du nur deine eigene Abrechnung (Einzelrecht „personal.lohn_sehen“ fehlt).', 'info')}</div>`) +
      `<div class="grid g-4 mb">${kpi('Summe Lohnlauf', money(total), run.length + ' Mitarbeiter', { accent: true, icon: 'coins' })}${kpi('Stundenlöhne', money(run.reduce((s, r) => s + r.hourly, 0)), run.reduce((s, r) => s + r.hours, 0) + ' Dienststunden', { icon: 'clock' })}${kpi('Provisionen', money(run.reduce((s, r) => s + r.cm, 0)), 'auf eigene abgerechnete Positionen', { icon: 'percent' })}${kpi('Fixum', money(run.reduce((s, r) => s + r.fixed, 0)), '', { icon: 'wallet' })}</div>` +
      card('Lohnlauf KW 45 (02.11. – 08.11.2026)', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'h', label: 'Dienst', num: true }, { key: 'hr', label: 'Stundenlohn', num: true }, { key: 'c', label: 'Provision', num: true }, { key: 'f', label: 'Fixum', num: true }, { key: 'a', label: 'Anpassung', num: true }, { key: 't', label: 'Auszahlung', num: true }], canSee ? rows : rows.filter((r, i) => run[i].s.id === S().viewAs), { foot: canSee ? ['Summe', '', '', '', '', '', money(total)] : null }), { flush: true, actions: badge('Entwurf', 'warn', true) }) +
      `<div class="mt">${card('Frühere Lohnläufe', table([{ key: 'k', label: 'Zeitraum' }, { key: 's', label: 'Summe', num: true }, { key: 'b', label: 'Freigegeben' }, { key: 'x', label: '' }], [['KW 44', 14920, '2026-11-02'], ['KW 43', 17210, '2026-10-26'], ['KW 42', 16480, '2026-10-19']].map(([k, s, d]) => ({ k: `<b>${k}</b>`, s: money(s), b: `${date(d)} · Lena Brandt`, x: badge('unveränderlich', '', false) }))), { flush: true })}</div>`;
  };

  P.berichte = function () {
    const byUser = {};
    D.orders.filter((o) => ['invoiced', 'picked_up', 'done', 'in_progress'].includes(o.status)).forEach((o) => o.items.forEach((l) => { byUser[l.by] = (byUser[l.by] || 0) + D.lineTotal(l); }));
    const userData = Object.entries(byUser).map(([u, v]) => ({ label: U.user(u).name.split(' ')[0], rev: v })).sort((a, b) => b.rev - a.rev);
    const byItem = {};
    D.orders.forEach((o) => o.items.forEach((l) => { const k = l.name; byItem[k] = byItem[k] || { n: 0, v: 0, item: l.item }; byItem[k].n += l.qty; byItem[k].v += D.lineTotal(l); }));
    const top = Object.entries(byItem).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
    return pageHead('Berichte', 'Auswertungen · Export als CSV oder PDF', `<div class="seg"><button>Woche</button><button class="active">Monat</button><button>Quartal</button></div>` + btn('Export', { icon: 'download', action: 'toast', arg: 'Bericht exportiert (Mockup)' })) +
      `<div class="grid g-2">${card('Umsatz je Mitarbeiter', U.barChart(userData, { label: 'Umsatz je Mitarbeiter' }), { sub: 'ausgeführte Positionen' })}${card('Top-Leistungen', table([{ key: 'n', label: 'Leistung' }, { key: 'c', label: 'Anzahl', num: true }, { key: 'v', label: 'Umsatz', num: true }, { key: 'm', label: 'Marge', num: true }], top.map(([n, x]) => { const it = U.item(x.item); return { n: esc(n), c: x.n, v: money(x.v), m: it && it.price ? Math.round((it.price - it.material) / it.price * 100) + ' %' : '–' }; })), { flush: true })}</div>
      <div class="grid g-3 mt">${card('Auslastung Stellplätze', D.bays.map((b, i) => { const p = [78, 91, 54, 62, 23][i]; return `<div class="meter"><span>${esc(b.name)}</span>${U.bar(p, p > 85 ? 'warn' : 'ok')}<span class="num">${p} %</span></div>`; }).join(''))}${card('Kunden mit dem meisten Umsatz', `<div class="list">${['Polizeidepartment', 'Dario Fontana', 'Sunrise Taxi', 'Hafenlogistik Kade', 'Ava Reyes'].map((n, i) => `<div class="list-item" style="padding:7px 0"><div class="grow">${esc(n)}</div><b>${money([18400, 14250, 9100, 7720, 5310][i])}</b></div>`).join('')}</div>`)}${card('Lohnkosten-Quote', `<div class="kpi" style="padding:0"><div class="value">41 %</div><div class="muted">Löhne / Umsatz im Monat</div></div>` + U.spark([44, 39, 46, 41]))}</div>`;
  };
})();
