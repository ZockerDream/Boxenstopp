/* Boxenstopp – Seiten: Werkstatt, Kunden, Preisliste & Lager */
(function () {
  'use strict';
  const D = window.BX.data;
  const U = window.BX.ui;
  const P = (window.BX.pages = window.BX.pages || {});
  const S = () => window.BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, plate, person, avatar, note, bar } = U;

  const OPEN = ['accepted', 'in_progress', 'waiting_parts', 'done'];
  const me = () => U.user(S().viewAs);
  const lvl = (m) => window.BX.perm.level(S().viewAs, m);

  // Fehlende Qualifikationen eines Mitarbeiters für eine Leistung
  function missingQual(userId, it) {
    if (!it || !it.req.length) return [];
    return it.req.filter((r) => {
      if (r.startsWith('lt')) return !D.licenses.some((l) => l.user === userId && l.type === r && l.status === 'valid' && U.daysUntil(l.expires) >= 0);
      const c = D.certs[userId] && D.certs[userId][r];
      return c === undefined || (c !== null && U.daysUntil(c) < 0);
    }).map((r) => (r.startsWith('lt') ? U.ltype(r).name : U.training(r).name));
  }
  window.BX.missingQual = missingQual;

  // ---------------- Dashboard ----------------
  P.dashboard = function () {
    const openOrders = D.orders.filter((o) => OPEN.includes(o.status));
    const openInv = D.invoices.filter((i) => ['open', 'partial', 'overdue'].includes(i.status));
    const openSum = openInv.reduce((s, i) => s + i.total - i.paid, 0);
    const cash = D.accounts.filter((a) => a.kind !== 'tax_reserve').reduce((s, a) => s + a.balance, 0);
    const reserve = D.accounts.find((a) => a.kind === 'tax_reserve').balance;
    const today = D.revenue14[13].rev, yday = D.revenue14[12].rev;
    const lowParts = D.parts.filter((p) => p.stock < p.min);
    const expiring = [];
    Object.entries(D.certs).forEach(([u, m]) => Object.entries(m).forEach(([t, until]) => {
      const st = U.user(u).status;
      if (until && st !== 'left' && U.daysUntil(until) <= 30) expiring.push({ u, label: U.training(t).name, until });
    }));
    D.licenses.filter((l) => l.status === 'valid' && U.daysUntil(l.expires) <= 30).forEach((l) => expiring.push({ u: l.user, label: U.ltype(l.type).name, until: l.expires, firm: !l.user }));

    const todo = [
      `<a class="list-item" href="#/auftrag/o22"><span class="badge accent">Freigabe</span><div class="grow"><div class="title">Rabatt 15 % auf RFG-2026-0042</div><div class="meta">angefragt von Mia Schulz · erlaubt: 0 %</div></div></a>`,
      ...D.invoices.filter((i) => i.status === 'overdue').slice(0, 2).map((i) => `<a class="list-item" href="#/rechnung/${i.id}"><span class="badge bad">Überfällig</span><div class="grow"><div class="title">${esc(i.no)} · ${money(i.total - i.paid)}</div><div class="meta">${esc(U.cust(i.customer).name)} · fällig ${date(i.due)}</div></div></a>`),
      ...lowParts.map((p) => `<a class="list-item" href="#/lager"><span class="badge warn">Lager</span><div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">Bestand ${p.stock} · Mindestbestand ${p.min}</div></div></a>`),
      ...expiring.sort((a, b) => (a.until < b.until ? -1 : 1)).slice(0, 4).map((e) => { const v = U.validity(e.until); return `<a class="list-item" href="#/${e.firm ? 'lizenzen?tab=firma' : 'qualifikationen'}"><span class="badge ${v.tone}">${e.firm ? 'Firma' : 'Nachweis'}</span><div class="grow"><div class="title">${esc(e.label)}${e.u ? ' · ' + esc(U.user(e.u).name) : ''}</div><div class="meta">${v.label}</div></div></a>`; }),
      `<a class="list-item" href="#/steuern"><span class="badge info">Steuern</span><div class="grow"><div class="title">KW 45 bereit zur Abführung</div><div class="meta">${money(D.taxPeriods[1].tax)} · Rücklage reicht</div></div></a>`,
    ].join('');

    const statusCounts = D.statuses.slice(0, 6).map(([k, l, t]) => {
      const n = D.orders.filter((o) => o.status === k).length;
      return `<a href="#/auftraege" class="list-item"><span class="grow">${badge(l, t, true)}</span><b class="num">${n}</b></a>`;
    }).join('');

    const duty = Object.entries(D.onDuty).map(([u, since]) => { const x = U.user(u); return `<div class="list-item">${avatar(x)}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">${esc(U.rank(x.rank).name)} · seit ${since}</div></div>${badge('im Dienst', 'ok', true)}</div>`; }).join('');

    const todayAppts = D.appointments.filter((a) => a.day === 0).map((a) => `<div class="list-item"><div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${esc(U.byId(D.bays, a.bay).name)} · ${esc(a.time)}${a.customer ? ' · ' + esc(U.cust(a.customer).name) : ''}</div></div>${a.order ? `<a class="btn sm" href="#/auftrag/${a.order}">Auftrag</a>` : ''}</div>`).join('');
    const openCallouts = D.callouts.filter((c) => ['open', 'en_route', 'on_site'].includes(c.status)).map((c) => `<a class="list-item" href="#/einsaetze"><div class="grow"><div class="title">${esc(c.no)} · ${esc(c.loc)}</div><div class="meta">${esc(c.by)} · ${esc(c.at.slice(11))} Uhr${c.driver ? ' · ' + esc(U.user(c.driver).name) : ''}</div></div>${calloutBadge(c.status)}</a>`).join('');

    const post = D.boardPosts[1];
    return pageHead(`Guten Abend, ${esc(me().name.split(' ')[0])}`, `${U.weekday(D.TODAY)}, ${date(D.TODAY)} · ${esc(D.firm.name)}`, btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-order' }) + btn('Neuer Einsatz', { icon: 'truck', action: 'modal', arg: 'new-callout' })) +
      `<div class="grid g-6">
        ${kpi('Umsatz heute', money(today), `${today >= yday ? '▲' : '▼'} ${money(Math.abs(today - yday))} zu gestern`, { accent: true, dir: today >= yday ? 'up' : 'down', icon: 'coins' })}
        ${kpi('Umsatz KW 46', money(D.taxPeriods[0].revenue), 'Mo–heute', { icon: 'chart' })}
        ${kpi('Offene Aufträge', openOrders.length, `${D.orders.filter((o) => o.status === 'done').length} fertig zur Abholung`, { icon: 'wrench' })}
        ${kpi('Offene Rechnungen', money(openSum), `${openInv.length} Rechnungen · ${D.invoices.filter((i) => i.status === 'overdue').length} überfällig`, { icon: 'file', dir: 'down' })}
        ${kpi('Kassenstand', money(cash), 'alle Konten ohne Rücklage', { icon: 'wallet' })}
        ${kpi('Steuer-Rücklage', money(reserve), `Schuld offen: ${money(D.taxPeriods[0].tax + D.taxPeriods[1].tax)}`, { icon: 'percent' })}
      </div>
      <div class="grid g-3 mt">
        <div class="span-2">${card('Umsatz', U.areaChart(D.revenue14.map((d) => ({ label: U.shortDate(d.date), v: d.rev })), { label: 'Umsatz der letzten 14 Tage' }), { sub: 'letzte 14 Tage' })}</div>
        ${card('Im Dienst', `<div class="list">${duty}</div>`, { flush: true, sub: Object.keys(D.onDuty).length + ' von ' + D.staff.filter((s) => s.rank && s.status === 'active').length, actions: `<a class="btn sm ghost" href="#/dienstplan">Dienstplan</a>` })}
      </div>
      <div class="grid g-3 mt">
        ${card('Handlungsbedarf', `<div class="list">${todo}</div>`, { flush: true })}
        <div class="stack">
          ${card('Heute auf den Bühnen', `<div class="list">${todayAppts}</div>`, { flush: true, actions: `<a class="btn sm ghost" href="#/termine">Termine</a>` })}
          ${card('Offene Einsätze', `<div class="list">${openCallouts}</div>`, { flush: true, actions: `<a class="btn sm ghost" href="#/einsaetze">Alle</a>` })}
        </div>
        <div class="stack">
          ${card('Aufträge nach Status', `<div class="list">${statusCounts}</div>`, { flush: true })}
          ${card('Schwarzes Brett', `<div class="title" style="font-weight:600">${esc(post.title)}</div><p class="muted" style="margin-top:4px">${U.md(post.text)}</p><div class="row between"><small>${esc(U.user(post.author).name)} · ${date(post.date)}</small>${badge(`gelesen ${post.reads}/${post.of}`, 'info')}</div>`, { actions: `<a class="btn sm ghost" href="#/brett">Alle</a>` })}
        </div>
      </div>`;
  };

  // ---------------- Aufträge ----------------
  function orderCard(o) {
    const v = U.veh(o.vehicle), c = U.cust(o.customer);
    const late = OPEN.includes(o.status) && U.daysUntil(o.due) < 0;
    return `<a class="kcard" href="#/auftrag/${o.id}" draggable="true" data-order="${o.id}">
      <div class="top"><span class="no">${esc(o.no)}</span>${plate(v.plate)}</div>
      <div class="veh">${esc(v.make)} ${esc(v.model)}</div>
      <div class="cust">${esc(c.name)}${c.warning ? ' ⚠' : ''}</div>
      <div class="foot"><span class="avatars">${o.assignees.map((a) => avatar(U.user(a), 'sm')).join('')}</span><span class="due ${late ? 'late' : ''}">${late ? 'überfällig · ' : ''}${U.shortDate(o.due)}</span><b>${money(D.orderTotal(o))}</b></div>
    </a>`;
  }
  P.auftraege = function (params, q) {
    const view = q.view || S().orderView || 'board';
    S().orderView = view;
    const own = lvl('orders') === 1 || q.mine === '1';
    let list = D.orders.slice();
    if (own) list = list.filter((o) => o.assignees.includes(S().viewAs));
    const seg = `<div class="seg"><a href="#/auftraege?view=board${own && q.mine ? '&mine=1' : ''}" class="${view === 'board' ? 'active' : ''}">Board</a><a href="#/auftraege?view=liste${own && q.mine ? '&mine=1' : ''}" class="${view === 'liste' ? 'active' : ''}">Liste</a></div>`;
    const mine = lvl('orders') > 1 ? `<div class="seg"><a href="#/auftraege?view=${view}" class="${!q.mine ? 'active' : ''}">Alle</a><a href="#/auftraege?view=${view}&mine=1" class="${q.mine ? 'active' : ''}">Meine</a></div>` : '';
    const head = pageHead('Aufträge', own && lvl('orders') === 1 ? 'Du siehst nur Aufträge, an denen du arbeitest (Stufe „Eigene“).' : 'Ziehe Karten in eine andere Spalte, um den Status zu ändern.', seg + mine + (lvl('orders') >= 3 ? btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-order' }) : ''));
    if (view === 'liste') {
      const rows = list.sort((a, b) => (a.no < b.no ? 1 : -1)).map((o) => {
        const v = U.veh(o.vehicle), c = U.cust(o.customer);
        return { _href: '#/auftrag/' + o.id, _filter: [o.no, v.plate, v.make, v.model, c.name].join(' '), no: `<span class="mono">${esc(o.no)}</span>`, veh: `${plate(v.plate)} <span class="sub">${esc(v.make)} ${esc(v.model)}</span>`, cust: esc(c.name), status: U.statusBadge(o.status), team: `<span class="avatars">${o.assignees.map((a) => avatar(U.user(a), 'sm')).join('')}</span>`, created: date(o.created), due: date(o.due), total: money(D.orderTotal(o)) };
      });
      return head + card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Suchen: Nummer, Kennzeichen, Kunde …" data-action="filter" data-target="#orderTable"></div>` + table([
        { key: 'no', label: 'Nummer' }, { key: 'veh', label: 'Fahrzeug' }, { key: 'cust', label: 'Kunde' }, { key: 'status', label: 'Status' }, { key: 'team', label: 'Bearbeiter' }, { key: 'created', label: 'Angelegt' }, { key: 'due', label: 'Fertig bis' }, { key: 'total', label: 'Summe', num: true },
      ], rows, { id: 'orderTable' }));
    }
    const cols = ['quote', 'accepted', 'in_progress', 'waiting_parts', 'done', 'invoiced'];
    const colors = { quote: 'var(--violet)', accepted: 'var(--info)', in_progress: 'var(--accent)', waiting_parts: 'var(--warn)', done: 'var(--ok)', invoiced: 'var(--faint)' };
    const board = cols.map((k) => {
      const items = list.filter((o) => o.status === k);
      return `<div class="kcol" data-drop="${k}"><div class="kcol-head"><span class="d" style="background:${colors[k]}"></span>${esc(U.statusMeta(k).label)}<span class="count">${items.length}</span></div><div class="kcol-body">${items.map(orderCard).join('') || '<div class="empty" style="padding:16px;font-size:12px">Leer</div>'}</div></div>`;
    }).join('');
    const hidden = list.filter((o) => ['picked_up', 'cancelled', 'rejected'].includes(o.status)).length;
    return head + `<div class="kanban">${board}</div><p class="muted mt">${hidden} abgeholte bzw. stornierte Aufträge sind im Board ausgeblendet · <a class="link" href="#/auftraege?view=liste">Liste zeigen</a></p>`;
  };

  const NEXT = {
    quote: [['accepted', 'Angebot angenommen', 'check'], ['rejected', 'Abgelehnt', 'x']],
    accepted: [['in_progress', 'Arbeit beginnen', 'play']],
    in_progress: [['done', 'Fertig melden', 'check'], ['waiting_parts', 'Wartet auf Teile', 'box']],
    waiting_parts: [['in_progress', 'Teile da – weiter', 'play']],
    done: [['invoiced', 'Abrechnen → Rechnung', 'file']],
    invoiced: [['picked_up', 'Abgeholt', 'car']],
  };
  P.auftrag = function (params) {
    const o = U.byId(D.orders, params[0]);
    if (!o) return pageHead('Auftrag nicht gefunden', '', btn('Zur Übersicht', { href: '#/auftraege' }));
    const v = U.veh(o.vehicle), c = U.cust(o.customer), group = U.pg(c.pg);
    const locked = ['invoiced', 'picked_up', 'cancelled', 'rejected'].includes(o.status);
    const canEdit = lvl('orders') >= 3 || (lvl('orders') === 1 && o.assignees.includes(S().viewAs));
    const steps = ['quote', 'accepted', 'in_progress', 'done', 'invoiced', 'picked_up'];
    const curIdx = steps.indexOf(o.status === 'waiting_parts' ? 'in_progress' : o.status);
    const stepper = `<div class="card mb"><div class="stepper">${steps.map((s, i) => `<div class="step ${i < curIdx ? 'done' : ''} ${i === curIdx ? 'current' : ''}"><b>${esc(U.statusMeta(s).label)}</b>${i === curIdx && o.status === 'waiting_parts' ? 'wartet auf Teile' : i <= curIdx ? '✓' : ''}</div>`).join('')}</div></div>`;

    const rows = o.items.map((l, idx) => {
      const it = U.item(l.item);
      const miss = missingQual(l.by, it);
      const partsInfo = it && it.parts ? it.parts.map((p) => { const pt = U.part(p.part); const free = pt.stock - pt.reserved; return `<span class="sub">${icon('box', 'width="11" height="11"')} ${p.qty}× ${esc(pt.name)} · frei ${free}${free < p.qty ? ' ⚠' : ''}</span>`; }).join('') : '';
      return {
        name: `${esc(l.name)} ${U.kindBadge(l.kind)}${partsInfo}${miss.length ? `<span class="sub" style="color:var(--bad)">${icon('alert', 'width="11" height="11"')} Qualifikation fehlt: ${esc(miss.join(', '))}</span>` : ''}`,
        qty: l.qty + (l.kind === 'labor' ? ' Std' : ''), unit: money(l.unit), disc: l.disc ? `−${l.disc} %` : '–',
        by: person(U.user(l.by)), total: money(D.lineTotal(l)),
        x: !locked && canEdit ? `<button class="btn sm ghost" data-action="del-line" data-arg="${o.id}:${idx}" title="Entfernen">${icon('x')}</button>` : '',
      };
    });
    const gross = D.orderGross(o), total = D.orderTotal(o);
    const addRow = !locked && canEdit ? `<div class="row mt" style="align-items:flex-end">
      <div class="field" style="flex:2;min-width:220px"><label>Leistung aus der Preisliste</label><select class="input" id="addItem">${D.categories.map((cg) => `<optgroup label="${esc(cg.name)}">${D.catalog.filter((i) => i.cat === cg.id && i.active).map((i) => `<option value="${i.id}">${esc(i.name)} – ${money(D.unitPrice(i, v.cls))}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:160px"><label>Ausgeführt von</label>${U.select(o.assignees.concat(D.staff.filter((s) => s.rank && s.status === 'active' && !o.assignees.includes(s.id)).map((s) => s.id)).map((id) => [id, U.user(id).name]), o.assignees[0], 'id="addBy"')}</div>
      ${btn('Hinzufügen', { cls: 'primary', icon: 'plus', action: 'add-line', arg: o.id })}
    </div><p class="muted" style="margin-top:8px;font-size:12px">Preis automatisch für Klasse <b>${esc(U.cls(v.cls).name)}</b> und Preisgruppe <b>${esc(group.name)}</b> (−${group.pct} %). Fehlt dem Ausführenden die Qualifikation, warnt das System (Einstellung: Warnung).</p>` : '';

    const actions = (NEXT[o.status] || []).map(([to, label, ic], i) => btn(label, { cls: i === 0 ? 'primary' : '', icon: ic, action: 'set-status', arg: o.id + ':' + to })).join('') +
      (!locked ? btn('Stornieren', { cls: 'danger', action: 'set-status', arg: o.id + ':cancelled' }) : '') + btn('Drucken', { icon: 'print', action: 'print' });

    const discountReq = o.id === 'o22' && !S().discountDone ? note(`<b>Rabattfreigabe angefragt:</b> Mia Schulz möchte 15 % auf „Bremsen Stufe 2“ geben (ihr Limit: 0 %, Preisgruppe gibt 10 %). <div class="row" style="margin-top:8px">${btn('Freigeben', { cls: 'sm primary', action: 'discount', arg: 'ok' })}${btn('Ablehnen', { cls: 'sm', action: 'discount', arg: 'no' })}</div>`, 'warn') : '';

    const timeline = [
      [o.created + ' 17:12', 'Angebot erstellt', U.user(o.assignees[0]).name],
      [o.created + ' 17:20', 'Kunde hat zugestimmt', 'telefonisch'],
      [o.created + ' 17:31', 'Fahrzeug angenommen', `km ${o.mileage.toLocaleString('de-DE')} · ${U.byId(D.bays, o.bay).name}`],
      [o.created + ' 18:02', 'Arbeit begonnen', o.assignees.map((a) => U.user(a).name).join(', ')],
    ].slice(0, Math.max(1, curIdx + 1)).reverse().map(([w, what, who]) => `<div class="tl-item"><div class="when">${date(w)}</div><div class="what">${esc(what)}</div><div class="muted">${esc(who)}</div></div>`).join('');

    const cond = Object.entries(o.condition).map(([k, val]) => `<div class="meter"><span>${esc(k)}</span>${bar(val, val < 40 ? 'bad' : val < 70 ? 'warn' : 'ok')}<span class="num">${val} %</span></div>`).join('');

    return pageHead(`${esc(o.no)} ${U.statusBadge(o.status)}`, esc(o.request), actions, `<a href="#/auftraege">Aufträge</a> / ${esc(o.no)}`) + stepper + (discountReq ? `<div class="mb">${discountReq}</div>` : '') +
      `<div class="grid g-side">
        <div class="stack">
          ${card('Positionen', table([{ key: 'name', label: 'Leistung' }, { key: 'qty', label: 'Menge', num: true }, { key: 'unit', label: 'Einzelpreis', num: true }, { key: 'disc', label: 'Rabatt', num: true }, { key: 'by', label: 'Ausgeführt von' }, { key: 'total', label: 'Gesamt', num: true }, { key: 'x', label: '' }], rows, {
            foot: ['Gesamtpreis', '', '', `<span class="muted" style="font-weight:500">−${money(gross - total)}</span>`, '', money(total), ''],
          }) + `<div style="padding:0 16px 14px">${addRow}</div>`, { flush: true, sub: 'Festpreise · Steuer wird im Steuerzeitraum aus dem Umsatz berechnet', actions: locked ? badge('gesperrt', '', false) : '' })}
          ${card('Interne Notizen', `<div class="list"><div class="list-item">${avatar(U.user('u3'))}<div class="grow"><div class="title">Deniz Aydin <span class="muted" style="font-weight:400">· heute 18:40</span></div><div>Turbo nicht nötig, Stufe 2 reicht für die Strecke. Kunde informiert.</div></div></div></div><div style="padding:12px 16px"><textarea class="input" placeholder="Notiz hinzufügen … (Markdown)"></textarea></div>`, { flush: true })}
        </div>
        <div class="stack">
          ${card('Fahrzeug', `<div class="row between">${plate(v.plate, true)}${badge(U.cls(v.cls).name, 'accent')}</div><div style="margin-top:10px;font-weight:600">${esc(v.make)} ${esc(v.model)}</div><div class="muted">${esc(v.color)} · km bei Annahme ${o.mileage.toLocaleString('de-DE')}</div><hr>${cond}`, { actions: `<a class="btn sm ghost" href="#/fahrzeug/${v.id}">Akte</a>` })}
          ${card('Kunde', `<div class="title" style="font-weight:650">${esc(c.name)}</div><div class="muted">${esc(U.custKind[c.kind])} · Tel. ${esc(c.phone)}</div><div class="row" style="margin-top:8px">${badge('Preisgruppe ' + group.name, 'info')}${c.tags.map(U.chip).join('')}</div>${c.warning ? `<div class="mt">${note(esc(c.warning), 'warn')}</div>` : ''}`, { actions: `<a class="btn sm ghost" href="#/kunde/${c.id}">Akte</a>` })}
          ${card('Ablauf', `<div class="list-item" style="padding:0 0 10px;border:0"><div class="grow"><div class="meta">Bearbeiter</div>${o.assignees.map((a) => person(U.user(a))).join('<br>')}</div></div><div class="row between"><span class="muted">Stellplatz</span><b>${esc(U.byId(D.bays, o.bay).name)}</b></div><div class="row between" style="margin-top:6px"><span class="muted">Fertig bis</span><b>${date(o.due)}</b></div><hr><div class="timeline">${timeline}</div>`)}
        </div>
      </div>`;
  };

  // ---------------- Termine ----------------
  P.termine = function () {
    const monday = D.addDays(D.TODAY, -2);
    const days = Array.from({ length: 7 }, (_, i) => D.addDays(monday, i));
    let grid = `<div class="week"><div class="wh"></div>${days.map((d) => `<div class="wh ${d === D.TODAY ? 'today' : ''}">${U.weekday(d)} ${U.shortDate(d)}</div>`).join('')}`;
    D.bays.forEach((b) => {
      grid += `<div class="bay">${esc(b.name)}</div>`;
      days.forEach((d) => {
        const offset = U.daysUntil(d);
        const appts = D.appointments.filter((a) => a.bay === b.id && a.day === offset);
        grid += `<div class="cell ${d === D.TODAY ? 'today' : ''}">${appts.map((a) => `<a class="appt ${a.order ? 'order' : ''}" ${a.order ? `href="#/auftrag/${a.order}"` : ''}><b>${esc(a.time)}</b>${esc(a.title)}${a.customer ? `<br><span class="muted">${esc(U.cust(a.customer).name)}</span>` : ''}</a>`).join('')}</div>`;
      });
    });
    grid += '</div>';
    return pageHead('Termine', 'Woche 46 · Belegung der Hebebühnen und Stellplätze', `<div class="seg"><button>‹</button><button class="active">Diese Woche</button><button>›</button></div>` + btn('Neuer Termin', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-appt' })) +
      `<div class="table-wrap">${grid}</div><div class="legend mt"><span><span class="appt order" style="display:inline-block;width:14px;height:10px;margin:0;padding:0"></span>mit Auftrag</span><span><span class="appt" style="display:inline-block;width:14px;height:10px;margin:0;padding:0"></span>Termin ohne Auftrag – ein Klick legt den Auftrag an</span></div>`;
  };

  // ---------------- Einsätze ----------------
  const CS = { open: ['Offen', 'bad'], en_route: ['Unterwegs', 'warn'], on_site: ['Vor Ort', 'info'], done: ['Erledigt', 'ok'], cancelled: ['Abgebrochen', ''] };
  function calloutBadge(s) { return badge(CS[s][0], CS[s][1], true); }
  P.einsaetze = function () {
    const rows = D.callouts.map((c) => {
      const v = c.vehicle ? U.veh(c.vehicle) : null;
      return {
        no: `<span class="mono">${esc(c.no)}</span>`, at: date(c.at), loc: `${icon('pin', 'width="12" height="12"')} ${esc(c.loc)}`, by: `${esc(c.by)}<span class="sub">${esc(U.cust(c.customer).name)}</span>`,
        veh: v ? plate(v.plate) : '<span class="faint">unbekannt</span>', driver: c.driver ? person(U.user(c.driver)) : `<button class="btn sm" data-action="toast" data-arg="Fahrer zugewiesen (Mockup)">Fahrer zuweisen</button>`,
        status: calloutBadge(c.status), fee: c.fee ? money(c.fee) : '–',
        act: c.status === 'done' ? (c.order ? `<a class="btn sm" href="#/auftrag/${c.order}">Auftrag</a>` : btn('Abrechnen', { cls: 'sm', action: 'toast', arg: 'Rechnung für den Einsatz erstellt (Mockup)' })) : ['open', 'en_route', 'on_site'].includes(c.status) ? btn('In Auftrag umwandeln', { cls: 'sm', action: 'toast', arg: 'Auftrag aus Einsatz angelegt (Mockup)' }) : '',
      };
    });
    return pageHead('Einsätze', 'Abschlepp- und Pannendienst vor Ort', btn('Neuer Einsatz', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-callout' })) +
      `<div class="grid g-4 mb">${kpi('Offen', D.callouts.filter((c) => c.status === 'open').length, 'ohne Fahrer', { icon: 'alert' })}${kpi('Unterwegs / vor Ort', D.callouts.filter((c) => ['en_route', 'on_site'].includes(c.status)).length, '', { icon: 'truck' })}${kpi('Heute erledigt', 0, '', { icon: 'check' })}${kpi('Einnahmen Woche', money(2050), '6 Einsätze', { icon: 'coins' })}</div>` +
      card('', table([{ key: 'no', label: 'Nummer' }, { key: 'at', label: 'Zeit' }, { key: 'loc', label: 'Ort' }, { key: 'by', label: 'Auftraggeber' }, { key: 'veh', label: 'Fahrzeug' }, { key: 'driver', label: 'Fahrer' }, { key: 'status', label: 'Status' }, { key: 'fee', label: 'Gebühr', num: true }, { key: 'act', label: '' }], rows), { flush: true });
  };
  window.BX.calloutBadge = calloutBadge;

  // ---------------- Kunden ----------------
  function custStats(c) {
    const inv = D.invoices.filter((i) => i.customer === c.id && i.status !== 'cancelled');
    return { revenue: inv.reduce((s, i) => s + i.paid, 0), open: inv.reduce((s, i) => s + (i.total - i.paid), 0), vehicles: D.vehicles.filter((v) => v.owner === c.id && v.status !== 'scrapped').length, orders: D.orders.filter((o) => o.customer === c.id).length };
  }
  P.kunden = function () {
    const rows = D.customers.map((c) => {
      const st = custStats(c);
      return { _href: '#/kunde/' + c.id, _filter: c.name + ' ' + c.phone + ' ' + c.tags.join(' '), name: `<b>${esc(c.name)}</b>${c.blocked ? ' ' + badge('gesperrt', 'bad') : c.warning ? ' ' + badge('Hinweis', 'warn') : ''}<span class="sub">Tel. ${esc(c.phone)}</span>`, kind: esc(U.custKind[c.kind]), pg: badge(U.pg(c.pg).name, c.pg === 'pg1' ? '' : 'info'), tags: `<div class="chips">${c.tags.map(U.chip).join('')}</div>`, veh: st.vehicles, rev: money(st.revenue), open: st.open ? `<span style="color:var(--bad)">${money(st.open)}</span>` : '–' };
    });
    return pageHead('Kunden', `${D.customers.length} Kundenakten`, btn('CSV', { icon: 'download', action: 'toast', arg: 'CSV-Export (Mockup)' }) + btn('Neuer Kunde', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-customer' })) +
      card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Suchen: Name, Telefon, Tag …" data-action="filter" data-target="#custTable"></div>` + table([{ key: 'name', label: 'Kunde' }, { key: 'kind', label: 'Art' }, { key: 'pg', label: 'Preisgruppe' }, { key: 'tags', label: 'Tags' }, { key: 'veh', label: 'Fahrzeuge', num: true }, { key: 'rev', label: 'Umsatz', num: true }, { key: 'open', label: 'Offen', num: true }], rows, { id: 'custTable' }));
  };
  P.kunde = function (params, q) {
    const c = U.cust(params[0]);
    const tab = q.tab || 'uebersicht';
    const st = custStats(c);
    const vehicles = D.vehicles.filter((v) => v.owner === c.id);
    const orders = D.orders.filter((o) => o.customer === c.id);
    const invs = D.invoices.filter((i) => i.customer === c.id);
    const base = '#/kunde/' + c.id;
    let body = '';
    const vehTable = table([{ key: 'p', label: 'Kennzeichen' }, { key: 'm', label: 'Fahrzeug' }, { key: 'c', label: 'Klasse' }, { key: 's', label: 'Status' }], vehicles.map((v) => ({ _href: '#/fahrzeug/' + v.id, p: plate(v.plate), m: esc(v.make + ' ' + v.model), c: esc(U.cls(v.cls).name), s: vehStatus(v.status) })), { empty: 'Keine Fahrzeuge' });
    const ordTable = table([{ key: 'no', label: 'Nummer' }, { key: 'v', label: 'Fahrzeug' }, { key: 's', label: 'Status' }, { key: 'd', label: 'Datum' }, { key: 't', label: 'Summe', num: true }], orders.map((o) => ({ _href: '#/auftrag/' + o.id, no: `<span class="mono">${esc(o.no)}</span>`, v: plate(U.veh(o.vehicle).plate), s: U.statusBadge(o.status), d: date(o.created), t: money(D.orderTotal(o)) })), { empty: 'Keine Aufträge' });
    const invTable = table([{ key: 'no', label: 'Nummer' }, { key: 'd', label: 'Datum' }, { key: 's', label: 'Status' }, { key: 't', label: 'Betrag', num: true }, { key: 'o', label: 'Offen', num: true }], invs.map((i) => ({ _href: '#/rechnung/' + i.id, no: `<span class="mono">${esc(i.no)}</span>`, d: date(i.issued), s: U.invBadge(i.status), t: money(i.total), o: i.total - i.paid > 0 && i.status !== 'cancelled' ? money(i.total - i.paid) : '–' })), { empty: 'Keine Rechnungen' });
    const entries = `<div class="list">${[['u2', '2026-11-02', 'Möchte beim nächsten Besuch ein Angebot für **Turbo-Einbau**.'], ['u1', '2026-10-12', 'Stammkunde seit dem Sommer, zahlt zuverlässig.']].map(([u, d, t]) => `<div class="list-item">${avatar(U.user(u))}<div class="grow"><div class="title">${esc(U.user(u).name)} <span class="muted" style="font-weight:400">· ${date(d)}</span></div><div>${U.md(t)}</div></div></div>`).join('')}</div><div style="padding:12px 16px"><textarea class="input" placeholder="Eintrag hinzufügen … (Markdown)"></textarea><div class="row mt">${btn('Speichern', { cls: 'primary sm', action: 'toast', arg: 'Eintrag gespeichert (Mockup)' })}</div></div>`;
    if (tab === 'uebersicht') {
      body = `<div class="grid g-4 mb">${kpi('Umsatz gesamt', money(st.revenue), '', { icon: 'coins' })}${kpi('Offen', money(st.open), '', { icon: 'file' })}${kpi('Fahrzeuge', st.vehicles, '', { icon: 'car' })}${kpi('Aufträge', st.orders, '', { icon: 'wrench' })}</div>
        <div class="grid g-2">${card('Fahrzeuge', vehTable, { flush: true })}${card('Letzte Einträge', entries, { flush: true })}</div>`;
    } else if (tab === 'fahrzeuge') body = card('', vehTable, { flush: true });
    else if (tab === 'auftraege') body = card('', ordTable, { flush: true });
    else if (tab === 'rechnungen') body = card('', invTable, { flush: true });
    else if (tab === 'eintraege') body = card('', entries, { flush: true });
    else body = card('', `<div class="empty">${icon('image', 'width="28" height="28"')}<p>Noch keine Dokumente. Bilder und PDFs hierher ziehen.</p>${btn('Datei hochladen', { icon: 'plus', action: 'toast', arg: 'Upload (Mockup)' })}</div>`);
    return pageHead(esc(c.name), `${esc(U.custKind[c.kind])} · Tel. ${esc(c.phone)} · Kunde seit ${date(c.since)} · Zahlungsziel ${c.terms ? c.terms + ' Tage' : 'sofort'}`,
      btn('Bearbeiten', { action: 'modal', arg: 'new-customer' }) + btn('Zusammenführen', { action: 'toast', arg: 'Kunden zusammenführen: Duplikat wählen (Mockup)' }) + btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-order' }), `<a href="#/kunden">Kunden</a> / ${esc(c.name)}`) +
      `<div class="row mb">${badge('Preisgruppe ' + U.pg(c.pg).name + (U.pg(c.pg).pct ? ' · −' + U.pg(c.pg).pct + ' %' : ''), 'info')}${c.tags.map(U.chip).join('')}</div>` +
      (c.blocked ? `<div class="mb">${note('<b>Gesperrt:</b> ' + esc(c.blocked), 'bad', 'lock')}</div>` : '') + (c.warning ? `<div class="mb">${note('<b>Hinweis:</b> ' + esc(c.warning), 'warn')}</div>` : '') +
      U.tabs(base, [['uebersicht', 'Übersicht'], ['fahrzeuge', 'Fahrzeuge', vehicles.length], ['auftraege', 'Aufträge', orders.length], ['rechnungen', 'Rechnungen', invs.length], ['eintraege', 'Einträge', 2], ['dokumente', 'Dokumente', 0]], tab) + body;
  };

  // ---------------- Fahrzeuge ----------------
  function vehStatus(s) { return s === 'active' ? badge('Aktiv', 'ok', true) : s === 'stolen' ? badge('Gestohlen gemeldet', 'bad', true) : badge('Verschrottet', '', true); }
  P.fahrzeuge = function () {
    const rows = D.vehicles.map((v) => {
      const c = U.cust(v.owner);
      const last = D.orders.filter((o) => o.vehicle === v.id).sort((a, b) => (a.created < b.created ? 1 : -1))[0];
      return { _href: '#/fahrzeug/' + v.id, _dim: v.status === 'scrapped', _filter: [v.plate, v.make, v.model, c.name, v.color].join(' '), p: plate(v.plate), m: `<b>${esc(v.make)} ${esc(v.model)}</b><span class="sub">${esc(v.color)}</span>`, c: esc(U.cls(v.cls).name), o: esc(c.name), km: v.km.toLocaleString('de-DE'), last: last ? date(last.created) : '–', s: vehStatus(v.status) };
    });
    return pageHead('Fahrzeuge', `${D.vehicles.length} Fahrzeugakten`, btn('Neues Fahrzeug', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-order' })) +
      card('', `<div class="row mb"><input class="input mono" style="max-width:320px" placeholder="Kennzeichen, Modell, Halter …" data-action="filter" data-target="#vehTable"></div>` + table([{ key: 'p', label: 'Kennzeichen' }, { key: 'm', label: 'Fahrzeug' }, { key: 'c', label: 'Klasse' }, { key: 'o', label: 'Halter' }, { key: 'km', label: 'km', num: true }, { key: 'last', label: 'Letzter Besuch' }, { key: 's', label: 'Status' }], rows, { id: 'vehTable' }));
  };
  P.fahrzeug = function (params, q) {
    const v = U.veh(params[0]);
    const c = U.cust(v.owner);
    const tab = q.tab || 'historie';
    const base = '#/fahrzeug/' + v.id;
    const orders = D.orders.filter((o) => o.vehicle === v.id).sort((a, b) => (a.created < b.created ? 1 : -1));
    const tuning = { Motor: 0, Turbo: 0, Bremsen: 0, Getriebe: 0, Federung: 0, Panzerung: 0, Optik: 0 };
    const src = {};
    if (v.id === 'v1') { tuning.Motor = 1; src.Motor = 'RFG-2026-0007 · 14.09.2026'; tuning.Optik = 1; src.Optik = 'RFG-2026-0011 · 02.10.2026'; tuning.Getriebe = 1; src.Getriebe = 'von Hand korrigiert · L. Brandt'; }
    orders.filter((o) => ['done', 'invoiced', 'picked_up'].includes(o.status)).forEach((o) => o.items.forEach((l) => { const it = U.item(l.item); if (it && it.tuning && it.tuning[1] > tuning[it.tuning[0]]) { tuning[it.tuning[0]] = it.tuning[1]; src[it.tuning[0]] = o.no + ' · ' + date(o.created); } }));
    let body = '';
    if (tab === 'historie') {
      const ev = orders.map((o) => `<div class="tl-item"><div class="when">${date(o.created)}</div><div class="what"><a class="link" href="#/auftrag/${o.id}">${esc(o.no)}</a> ${U.statusBadge(o.status)}</div><div class="muted">${esc(o.items.map((l) => l.name).join(', '))} · ${money(D.orderTotal(o))} · km ${o.mileage.toLocaleString('de-DE')}</div></div>`).join('') +
        `<div class="tl-item muted"><div class="when">${date('2026-08-14')}</div><div class="what">Halterwechsel</div><div class="muted">Hugo Vance → ${esc(c.name)}</div></div><div class="tl-item muted"><div class="when">${date('2026-06-02')}</div><div class="what">Fahrzeug angelegt</div><div class="muted">Kennzeichen ${esc(v.plate)}</div></div>`;
      body = card('Historie', `<div class="timeline">${ev}</div>`);
    } else if (tab === 'tuning') {
      body = card('Tuning-Stand', `<div class="grid g-3">${Object.entries(tuning).map(([k, val]) => `<div class="card" style="padding:12px 14px"><div class="row between"><b>${esc(k)}</b>${val ? badge('Stufe ' + val, 'accent') : badge('Serie', '')}</div><div class="row" style="gap:4px;margin-top:10px">${[1, 2, 3].map((s) => `<span style="flex:1;height:6px;border-radius:3px;background:${s <= val ? 'var(--accent)' : 'var(--surface-3)'}"></span>`).join('')}</div><div class="muted" style="font-size:12px;margin-top:8px">${src[k] ? esc(src[k]) : '–'}</div></div>`).join('')}</div>`, { sub: 'automatisch aus abgeschlossenen Aufträgen', actions: btn('Korrigieren', { cls: 'sm', action: 'toast', arg: 'Tuning-Stand von Hand korrigieren (Mockup)' }) });
    } else if (tab === 'zustand') {
      const last = orders[0];
      body = card('Zustand bei letzter Annahme', last ? Object.entries(last.condition).map(([k, val]) => `<div class="meter"><span>${esc(k)}</span>${bar(val, val < 40 ? 'bad' : val < 70 ? 'warn' : 'ok')}<span class="num">${val} %</span></div>`).join('') + `<hr><div class="muted">Schäden: Kratzer Stoßstange hinten rechts (Foto), Delle Fahrertür.</div>` : '<div class="empty">Noch keine Annahme</div>', { sub: last ? last.no : '' });
    } else if (tab === 'garantie') {
      const rows = orders.filter((o) => ['invoiced', 'picked_up', 'done'].includes(o.status)).flatMap((o) => o.items.filter((l) => U.item(l.item) && U.item(l.item).warranty).map((l) => { const until = D.addDays(o.created, U.item(l.item).warranty); const d = U.daysUntil(until); return { l: esc(l.name), o: `<span class="mono">${esc(o.no)}</span>`, u: date(until), s: d >= 0 ? badge('noch ' + d + ' Tage', 'ok') : badge('abgelaufen', '') }; }));
      body = card('', table([{ key: 'l', label: 'Leistung' }, { key: 'o', label: 'Auftrag' }, { key: 'u', label: 'Garantie bis' }, { key: 's', label: 'Status' }], rows, { empty: 'Keine Garantien' }), { flush: true });
    } else {
      body = card('', table([{ key: 'c', label: 'Halter' }, { key: 'f', label: 'Von' }, { key: 't', label: 'Bis' }], [{ c: `<a class="link" href="#/kunde/${c.id}">${esc(c.name)}</a>`, f: date('2026-08-14'), t: 'heute' }, { c: 'Hugo Vance', f: date('2026-06-02'), t: date('2026-08-14') }]), { flush: true });
    }
    return pageHead(`${plate(v.plate, true)} <span style="margin-left:6px">${esc(v.make)} ${esc(v.model)}</span>`, `${esc(U.cls(v.cls).name)} · ${esc(v.color)} · ${v.km.toLocaleString('de-DE')} km · FIN ${esc(v.vin)} · Halter <a class="link" href="#/kunde/${c.id}">${esc(c.name)}</a>`,
      vehStatus(v.status) + btn('Halterwechsel', { action: 'toast', arg: 'Halterwechsel (Mockup)' }) + btn('Neuer Auftrag', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-order' }), `<a href="#/fahrzeuge">Fahrzeuge</a> / ${esc(v.plate)}`) +
      U.tabs(base, [['historie', 'Historie'], ['tuning', 'Tuning-Stand'], ['zustand', 'Zustand'], ['garantie', 'Garantie'], ['halter', 'Halter-Historie']], tab) + body;
  };

  // ---------------- Preisliste ----------------
  function priceCell(it) {
    const variable = it.surcharge || it.classPrices;
    const vals = D.vehicleClasses.map((c) => D.unitPrice(it, c.id));
    const min = Math.min(...vals), max = Math.max(...vals);
    return `${money(it.price)}${it.kind === 'labor' ? ' / Std' : ''}${variable ? `<span class="sub">je Klasse ${money(min)} – ${money(max)}</span>` : ''}`;
  }
  P.preisliste = function (params, q) {
    const tab = q.tab || 'intern';
    const head = pageHead('Preisliste', 'Festpreise · Pauschal, Arbeit, Teil oder Set · Preise je Fahrzeugklasse und Preisgruppe',
      btn('CSV-Import', { icon: 'download', action: 'toast', arg: 'CSV-Import: Datei wird zuerst geprüft (Mockup)' }) + btn('Als PDF', { icon: 'print', action: 'print' }) + (lvl('catalog') >= 3 ? btn('Neue Leistung', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-item' }) : ''));
    const tabsHtml = U.tabs('#/preisliste', [['intern', 'Leistungen', D.catalog.length], ['klassen', 'Preise je Klasse'], ['gruppen', 'Preisgruppen', D.priceGroups.length], ['kunde', 'Kundenansicht']], tab);
    if (tab === 'intern') {
      const kinds = `<div class="legend mb">${Object.entries(U.kindLabel).map(([k, [l]]) => `<span>${U.kindBadge(k)} ${{ flat: 'fester Endpreis inkl. Material', labor: 'Preis je Stunde/Einheit', part: 'Verkauf aus dem Lager', bundle: 'Paketpreis, entnimmt Teile' }[k]}</span>`).join('')}</div>`;
      return head + tabsHtml + kinds + `<div class="stack">${D.categories.map((cg) => {
        const items = D.catalog.filter((i) => i.cat === cg.id);
        const rows = items.map((it) => {
          const margin = it.price ? Math.round((it.price - it.material) / it.price * 100) : 0;
          return {
            _dim: !it.active, name: `<b>${esc(it.name)}</b>${it.note ? `<span class="sub">${esc(it.note)}</span>` : ''}${it.tuning ? `<span class="sub">Tuning: ${esc(it.tuning[0])} Stufe ${it.tuning[1]}</span>` : ''}`, kind: U.kindBadge(it.kind), price: priceCell(it),
            mat: money(it.material), margin: `${margin} %`, req: `<div class="chips">${it.req.map((r) => U.chip(r.startsWith('lt') ? U.ltype(r).name : U.training(r).name)).join('')}${it.group ? U.chip('Gruppe ' + U.group(it.group).name) : ''}</div>`,
            stock: it.parts ? it.parts.map((p) => `${p.qty}× ${esc(U.part(p.part).name)}`).join('<br>') : it.part ? esc(U.part(it.part).name) : '–', warranty: it.warranty ? it.warranty + ' T.' : '–', st: it.active ? badge('aktiv', 'ok') : badge('inaktiv', ''),
          };
        });
        return card(esc(cg.name), table([{ key: 'name', label: 'Leistung' }, { key: 'kind', label: 'Preisart' }, { key: 'price', label: 'Preis', num: true }, { key: 'mat', label: 'Material', num: true }, { key: 'margin', label: 'Marge', num: true }, { key: 'req', label: 'Voraussetzung' }, { key: 'stock', label: 'Lager' }, { key: 'warranty', label: 'Garantie' }, { key: 'st', label: 'Status' }], rows), { flush: true, sub: items.length + ' Leistungen' });
      }).join('')}</div>`;
    }
    if (tab === 'klassen') {
      const rows = D.catalog.filter((i) => i.active && i.kind !== 'part').map((it) => {
        const r = { name: `<b>${esc(it.name)}</b><span class="sub">${it.classPrices ? 'feste Preise je Klasse' : it.surcharge ? 'Aufschlag in %' : 'Einheitspreis'}</span>` };
        D.vehicleClasses.forEach((c) => {
          const p = D.unitPrice(it, c.id);
          const diff = p !== it.price;
          r[c.id] = diff ? `<b style="color:var(--accent)">${money(p)}</b>${it.surcharge && it.surcharge[c.id] ? `<span class="sub">${it.surcharge[c.id] > 0 ? '+' : ''}${it.surcharge[c.id]} %</span>` : ''}` : `<span class="muted">${money(p)}</span>`;
        });
        return r;
      });
      return head + tabsHtml + note('Fahrzeugklassen pflegst du in den Firmen-Einstellungen. Im Auftrag wird automatisch der Preis für die Klasse des Fahrzeugs gewählt. <b>Orange</b> = abweichend vom Grundpreis.', 'info') + `<div class="mt">${card('', table([{ key: 'name', label: 'Leistung' }].concat(D.vehicleClasses.map((c) => ({ key: c.id, label: c.name, num: true }))), rows, { cls: 'no-stack' }), { flush: true })}</div>`;
    }
    if (tab === 'gruppen') {
      return head + tabsHtml + `<div class="grid g-4">${D.priceGroups.map((g) => card(esc(g.name), `<div class="kpi" style="padding:0"><div class="value">${g.pct ? '−' + g.pct + ' %' : '0 %'}</div><div class="muted">${D.customers.filter((c) => c.pg === g.id).length} Kunden${g.isDefault ? ' · Standard für neue Kunden' : ''}</div></div>${g.cats ? `<hr><div class="muted" style="font-size:12px">Abweichend: ${Object.entries(g.cats).map(([cg, p]) => esc(U.cat(cg).name) + ' −' + p + ' %').join(', ')}</div>` : ''}`, { actions: btn('Bearbeiten', { cls: 'sm ghost', action: 'toast', arg: 'Preisgruppe bearbeiten (Mockup)' }) })).join('')}</div>` +
        `<div class="mt">${note('Rabatte darüber hinaus gibt jeder Mitarbeiter nur bis zu seinem Einzelrecht <b>rabatt.max_prozent</b>; mehr braucht eine Freigabe.', 'info')}</div>`;
    }
    // Kundenansicht
    const clsSel = S().plClass || 'limo';
    const paper = `<div class="paper"><div class="row between" style="align-items:flex-start"><div class="row">${window.BX.look.logoHtml()}<div><div style="font-size:20px;font-weight:800">${esc(D.firm.name)}</div><div class="muted">${esc(D.firm.address)} · Tel. ${esc(D.firm.phone)}</div></div></div><div class="right"><div style="font-size:18px;font-weight:800">Preisliste</div><div class="muted">gültig ab ${date(D.TODAY)}<br>Fahrzeugklasse: <b style="color:#16181d">${esc(U.cls(clsSel).name)}</b></div></div></div>
      ${D.categories.filter((cg) => cg.id !== 'c8').map((cg) => `<div class="pl-cat"><h3>${esc(cg.name)}</h3>${D.catalog.filter((i) => i.cat === cg.id && i.active).map((it) => `<div class="pl-row"><div class="n">${esc(it.name)}${it.warranty ? `<small>${it.warranty} Tage Garantie</small>` : ''}</div><div class="p">${money(D.unitPrice(it, clsSel))}${it.kind === 'labor' ? ' / Std' : ''}</div></div>`).join('')}</div>`).join('')}
      <p class="muted" style="margin-top:22px;font-size:12px">Alle Preise sind Endpreise. Stammkunden und Behörden erhalten Rabatt laut Vereinbarung.</p></div>`;
    return head + tabsHtml + `<div class="row mb"><div class="field" style="width:220px"><label>Fahrzeugklasse</label>${U.select(D.vehicleClasses.map((c) => [c.id, c.name]), clsSel, 'data-action="pl-class"')}</div><div class="grow"></div>${btn('Als Bild', { icon: 'image', action: 'toast', arg: 'PNG zum Posten im Discord erzeugt (Mockup)' })}${btn('Öffentlicher Link', { icon: 'link', action: 'toast', arg: 'Öffentlicher Link kopiert: https://werkstatt.example/preise (Mockup)' })}</div>` + paper;
  };

  // ---------------- Lager ----------------
  P.lager = function (params, q) {
    const tab = q.tab || 'bestand';
    const low = D.parts.filter((p) => p.stock < p.min).length;
    const value = D.parts.reduce((s, p) => s + p.stock * p.buy, 0);
    const head = pageHead('Lager', 'Teile werden über Aufträge reserviert und bei „Fertig“ entnommen', btn('Inventur starten', { icon: 'list', action: 'toast', arg: 'Inventur gestartet (Mockup)' }) + btn('Wareneingang', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'stock-in' }));
    const k = `<div class="grid g-4 mb">${kpi('Artikel', D.parts.length, '', { icon: 'box' })}${kpi('Unter Mindestbestand', low, 'Nachbestellen', { icon: 'alert', dir: 'down' })}${kpi('Reserviert', D.parts.reduce((s, p) => s + p.reserved, 0) + ' Stück', 'durch offene Aufträge', { icon: 'wrench' })}${kpi('Lagerwert (EK)', money(value), '', { icon: 'coins' })}</div>`;
    const tabsHtml = U.tabs('#/lager', [['bestand', 'Bestand'], ['bewegungen', 'Bewegungen'], ['inventur', 'Inventuren']], tab);
    if (tab === 'bestand') {
      const rows = D.parts.map((p) => {
        const pct = Math.min(100, p.stock / (p.min * 2) * 100);
        return { sku: `<span class="mono">${esc(p.sku)}</span>`, n: `<b>${esc(p.name)}</b><span class="sub">${esc(p.loc)}</span>`, s: `<div style="min-width:120px"><div class="row between"><b>${p.stock} ${esc(p.unit)}</b>${p.stock < p.min ? badge('knapp', 'bad') : ''}</div>${bar(pct, p.stock < p.min ? 'bad' : p.stock < p.min * 1.3 ? 'warn' : 'ok')}</div>`, r: p.reserved, f: p.stock - p.reserved, m: p.min, b: money(p.buy), v: money(p.sell) };
      });
      return head + k + tabsHtml + card('', table([{ key: 'sku', label: 'Artikel' }, { key: 'n', label: 'Bezeichnung' }, { key: 's', label: 'Bestand' }, { key: 'r', label: 'Reserviert', num: true }, { key: 'f', label: 'Frei', num: true }, { key: 'm', label: 'Mindest', num: true }, { key: 'b', label: 'EK', num: true }, { key: 'v', label: 'VK', num: true }], rows), { flush: true });
    }
    if (tab === 'bewegungen') {
      const mv = [[D.TODAY + ' 19:12', 'p3', +2, 'Wareneingang', 'Lieferung Teilehandel · Buchung $ 4.400', 'u1'], [D.TODAY + ' 18:40', 'p5', -1, 'Reservierung', 'RFG-2026-0042', 'u7'], [D.TODAY + ' 18:39', 'p1', -4, 'Reservierung', 'RFG-2026-0042', 'u7'], ['2026-11-10 22:05', 'p2', -1, 'Entnahme', 'RFG-2026-0039 · Ölwechsel', 'u4'], ['2026-11-10 20:00', 'p6', -4, 'Entnahme', 'RFG-2026-0037 · Lackierung komplett', 'u5'], ['2026-11-09 17:30', 'p4', -1, 'Korrektur', 'Beschädigt beim Einbau', 'u3']];
      return head + k + tabsHtml + card('', table([{ key: 'a', label: 'Zeit' }, { key: 'p', label: 'Teil' }, { key: 'q', label: 'Menge', num: true }, { key: 'k', label: 'Art' }, { key: 'g', label: 'Bezug / Grund' }, { key: 'u', label: 'Von' }], mv.map(([a, p, qn, kd, g, u]) => ({ a: date(a), p: esc(U.part(p).name), q: `<b style="color:${qn > 0 ? 'var(--ok)' : 'var(--text)'}">${qn > 0 ? '+' : ''}${qn}</b>`, k: badge(kd, kd === 'Wareneingang' ? 'ok' : kd === 'Korrektur' ? 'warn' : ''), g: esc(g), u: person(U.user(u)) }))), { flush: true });
    }
    return head + k + tabsHtml + card('', table([{ key: 'd', label: 'Datum' }, { key: 'u', label: 'Durchgeführt von' }, { key: 'n', label: 'Positionen', num: true }, { key: 'x', label: 'Differenzen' }], [{ d: date('2026-11-01'), u: person(U.user('u3')), n: 8, x: badge('2 Abweichungen · −$ 145', 'warn') }, { d: date('2026-10-01'), u: person(U.user('u2')), n: 7, x: badge('keine', 'ok') }]), { flush: true });
  };
})();
