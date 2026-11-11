/* Boxenstopp – Mockup: Router, Layout, Rechte, Ereignisse. Kein Inline-JS (CSP-tauglich). */
(function () {
  'use strict';
  const D = window.BX.data;
  const U = window.BX.ui;
  const P = window.BX.pages;
  const { esc, icon, money } = U;

  const L = window.BX.look;
  const S = (window.BX.state = { viewAs: 'u1', duty: false, dutySince: '', orderView: 'board', plClass: 'limo', discountDone: false });

  // ---------------- Rechte ----------------
  const SOURCES = (uid, mod) => {
    const u = U.user(uid);
    if (!u || u.status === 'left' || !u.rank) return { level: 0, source: u && !u.rank ? 'kein Rang' : 'ausgeschieden' };
    if (u.owner) return { level: 4, source: 'Inhaberin' };
    if (D.userPerms[uid] && D.userPerms[uid][mod] !== undefined) return { level: D.userPerms[uid][mod], source: 'persönlich gesetzt' };
    let level = D.rankPerms[u.rank][mod], source = 'Rang ' + U.rank(u.rank).name;
    u.groups.forEach((g) => { const v = D.groupPerms[g][mod]; if (v !== undefined && v > level) { level = v; source = 'Gruppe ' + U.group(g).name; } });
    return { level, source };
  };
  window.BX.perm = {
    level: (uid, mod) => SOURCES(uid, mod).level,
    explain: SOURCES,
    flag: (uid, key) => {
      const u = U.user(uid); const f = D.flags.find((x) => x.key === key);
      if (u.owner) return f.type === 'percent' ? 100 : true;
      if (!u.rank) return f.type === 'percent' ? 0 : false;
      let v = f.ranks[u.rank] || 0;
      u.groups.forEach((g) => { if (f.groups[g] !== undefined && f.groups[g] > v) v = f.groups[g]; });
      return f.type === 'percent' ? v : !!v;
    },
    sys: (uid, key) => { const u = U.user(uid); return (u.sys.length ? u.sys : ['user']).some((r) => D.sysRolePerms[r].includes(key)); },
  };
  const perm = window.BX.perm;

  // ---------------- Navigation ----------------
  const NAV = [
    ['Werkstatt', [['dashboard', 'Dashboard', 'dash'], ['auftraege', 'Aufträge', 'wrench', 'orders'], ['termine', 'Termine', 'cal', 'appointments'], ['einsaetze', 'Einsätze', 'truck', 'callouts']]],
    ['Kunden', [['kunden', 'Kunden', 'users', 'customers'], ['fahrzeuge', 'Fahrzeuge', 'car', 'vehicles']]],
    ['Preisliste & Lager', [['preisliste', 'Preisliste', 'tag', 'catalog'], ['lager', 'Lager', 'box', 'stock']]],
    ['Finanzen', [['finanzen', 'Übersicht', 'chart', 'accounts', 2], ['rechnungen', 'Rechnungen', 'file', 'invoices'], ['buchungen', 'Buchungen', 'list', 'accounts'], ['konten', 'Konten & Kassen', 'bank', 'accounts'], ['steuern', 'Steuern', 'percent', 'tax'], ['lohn', 'Lohn & Provision', 'wallet', 'payroll'], ['berichte', 'Berichte', 'chart', 'reports']]],
    ['Personal', [['dienstplan', 'Dienstplan', 'clock', 'shifts'], ['schulungen', 'Schulungen', 'grad', 'trainings'], ['lizenzen', 'Lizenzen', 'id', 'licenses'], ['qualifikationen', 'Qualifikationen', 'grid', 'trainings', 2], ['personalakten', 'Personalakten', 'folder', 'stafffiles'], ['brett', 'Schwarzes Brett', 'megaphone', 'board']]],
    ['Firma', [['mitarbeiter', 'Mitarbeiter', 'users', 'staff'], ['raenge', 'Ränge & Gruppen', 'layers', 'ranks'], ['berechtigungen', 'Berechtigungen', 'shield', 'perms'], ['firma', 'Firmen-Einstellungen', 'building', 'settings']]],
    ['Administration', [['users', 'User-Management', 'userkey', null, 0, 'user:read'], ['server', 'Server-Management', 'server', null, 0, 'server:read'], ['tickets', 'Tickets', 'bug', null, 0, 'ticket:manage'], ['hilfe', 'Hilfe', 'help'], ['fehler', 'Fehler melden', 'alert'], ['changelog', 'Changelog', 'list']]],
  ];
  const ROUTE_ALIAS = { auftrag: 'auftraege', kunde: 'kunden', fahrzeug: 'fahrzeuge', rechnung: 'rechnungen', einstellungen: null, login: null };
  const navEntry = (key) => { for (const [, items] of NAV) for (const it of items) if (it[0] === key) return it; return null; };
  const allowed = (entry) => {
    if (!entry) return true;
    const [, , , mod, min, sys] = entry;
    if (sys) return perm.sys(S.viewAs, sys);
    if (!mod) return true;
    return perm.level(S.viewAs, mod) >= (min || 1);
  };
  const counts = () => ({ auftraege: D.orders.filter((o) => ['accepted', 'in_progress', 'waiting_parts', 'done'].includes(o.status)).length, einsaetze: D.callouts.filter((c) => ['open', 'en_route', 'on_site'].includes(c.status)).length, rechnungen: D.invoices.filter((i) => i.status === 'overdue').length, tickets: D.tickets.filter((t) => t.status === 'open').length });

  function sidebar(active) {
    const c = counts();
    return `<aside class="sidebar" id="sidebar"><a class="brand" href="#/dashboard">${L.logoHtml()}<div><div class="brand-name">Boxenstopp</div><div class="brand-firm">${esc(D.firm.name)}</div></div></a>
      <nav class="nav">${NAV.map(([title, items]) => {
        const vis = items.filter(allowed);
        if (!vis.length) return '';
        return `<div class="nav-group"><div class="nav-title">${esc(title)}</div>${vis.map(([k, l, ic]) => `<a href="#/${k}" class="${k === active ? 'active' : ''}">${icon(ic)}<span>${esc(l)}</span>${c[k] ? `<span class="count">${c[k]}</span>` : ''}</a>`).join('')}</div>`;
      }).join('')}</nav></aside>`;
  }
  function topbar() {
    const u = U.user(S.viewAs);
    const notif = D.notifications.length;
    return `<header class="topbar">
      <button class="icon-btn" id="menuToggle" data-action="nav-toggle" aria-label="Menü">${icon('menu')}</button>
      <div class="search"><span>${icon('search')}</span><input id="globalSearch" placeholder="Kennzeichen, Kunde, Auftrag, Rechnung …" data-action="global-search" autocomplete="off"><div id="searchResults"></div></div>
      <div class="spacer"></div>
      ${u.rank ? `<button class="duty-btn ${S.duty ? 'on' : ''}" data-action="duty" title="${S.duty ? 'Dienst beenden' : 'Dienst beginnen'}"><span class="led"></span><span class="ic">${icon('clock')}</span><span class="lbl">${S.duty ? 'Im Dienst seit ' + S.dutySince : 'Dienst beginnen'}</span></button>` : ''}
      <button class="icon-btn" data-action="theme" title="Hell / Dunkel umschalten (mehr unter Einstellungen → Darstellung)">${icon('sun')}</button>
      <div class="rel"><button class="icon-btn" data-action="bell" title="Benachrichtigungen">${icon('bell')}<span class="dot">${notif}</span></button><div id="bellMenu"></div></div>
      <div class="rel"><div class="user-chip" data-action="user-menu">${U.avatar(u)}<div class="who"><b>${esc(u.name)}</b><small class="muted">${u.rank ? esc(U.rank(u.rank).name) : 'Support'}</small></div></div><div id="userMenu"></div></div>
    </header>`;
  }
  function banner() {
    const opts = [['u1', 'Lena · Inhaberin + Admin'], ['u2', 'Marco · Werkstattleitung'], ['u3', 'Deniz · Meister'], ['u6', 'Tim · Mechaniker'], ['u7', 'Mia · Azubi'], ['u9', 'Nora · Praktikantin'], ['u11', 'Kai · nur Support (kein Rang)']];
    return `<div class="mock-banner"><span>MOCKUP · Beispieldaten · nichts wird gespeichert</span><span class="spacer"></span><label>Ansicht als <select data-action="view-as">${opts.map(([v, l]) => `<option value="${v}" ${v === S.viewAs ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>`;
  }

  // ---------------- Router ----------------
  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { page: parts[0], params: parts.slice(1), q };
  }
  function render() {
    const { page, params, q } = parse();
    document.body.classList.remove('nav-open');
    const root = document.getElementById('app');
    if (page === 'login') { root.innerHTML = banner() + P.login(); return; }
    const navKey = ROUTE_ALIAS[page] !== undefined ? ROUTE_ALIAS[page] : page;
    const entry = navEntry(navKey);
    let content;
    if (!P[page]) content = U.pageHead('Seite nicht gefunden', 'Diese Seite gibt es im Mockup nicht.', U.btn('Zum Dashboard', { href: '#/dashboard' }));
    else if (!allowed(entry)) content = U.pageHead('Kein Zugriff', 'Für diese Seite fehlt dir das Recht.', U.btn('Was darf ich?', { href: '#/einstellungen' })) + U.note(`Mit der Ansicht „${esc(U.user(S.viewAs).name)}“ ist diese Funktion ausgeblendet. Wechsle oben im Mockup-Balken die Ansicht.`, 'warn', 'lock');
    else {
      try { content = P[page](params, q); } catch (err) { console.error(err); content = U.note('Fehler beim Rendern: ' + esc(err.message), 'bad'); }
    }
    root.innerHTML = banner() + `<div class="app">${sidebar(navKey)}<div class="main">${topbar()}<main class="content">${content}</main></div></div><div class="toast-host" id="toasts"></div>`;
    document.title = (entry ? entry[1] + ' · ' : '') + 'Boxenstopp';
  }

  // ---------------- Toast & Modal ----------------
  function toast(text) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="d"></span><span>${esc(text)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  const MODALS = {
    'new-order': () => ({ title: 'Neuer Auftrag', wide: true, body: `<div class="form">${U.field('Kennzeichen', `<input class="input mono" id="plateInput" placeholder="z. B. DF 4207" data-action="plate-lookup" autocomplete="off" style="font-size:18px;letter-spacing:.06em">`, { hint: 'Tippen genügt – Fahrzeug, Halter, Klasse und Preisgruppe werden übernommen.' })}<div id="plateResult">${U.note('Vorschlag: <b>DF 4207</b> eintippen.', 'info')}</div>
      <div class="form cols-2">${U.field('Kundenwunsch', '<textarea class="input" placeholder="Was soll gemacht werden?"></textarea>', { full: true })}${U.field('Kilometerstand', U.input('', { ph: 'km' }))}${U.field('Fertig bis', U.input(U.date(D.addDays(D.TODAY, 1))))}${U.field('Stellplatz', U.select(D.bays.map((b) => [b.id, b.name]), 'b1'))}${U.field('Bearbeiter', U.select(D.staff.filter((s) => s.rank && s.status === 'active').map((s) => [s.id, s.name]), 'u3'))}${U.field('Status', U.select([['quote', 'Angebot'], ['accepted', 'Angenommen']], 'accepted'))}</div></div>`, ok: 'Auftrag anlegen', action: 'create-order' }),
    'new-callout': () => ({ title: 'Neuer Einsatz', body: `<div class="form cols-2">${U.field('Ort', U.input('', { ph: 'z. B. Autobahnauffahrt Nord' }), { full: true })}${U.field('Auftraggeber', U.select(['Kunde', 'Polizeidepartment', 'Rettungsdienst Süd', 'Eigen'], 'Kunde'))}${U.field('Kunde', U.select(D.customers.map((c) => [c.id, c.name]), 'k1'))}${U.field('Kennzeichen', U.input('', { mono: true, ph: 'falls bekannt' }))}${U.field('Fahrer', U.select([['', '– später –']].concat(D.staff.filter((s) => s.groups.includes('g2')).map((s) => [s.id, s.name])), ''))}${U.field('Leistung', U.select(D.catalog.filter((i) => i.cat === 'c7').map((i) => [i.id, i.name + ' – ' + money(i.price)]), 'i18'), { full: true })}</div>`, ok: 'Einsatz anlegen' }),
    'new-customer': () => ({ title: 'Kunde', body: `<div class="form cols-2">${U.field('Name', U.input(''))}${U.field('Art', U.select(Object.entries(U.custKind), 'person'))}${U.field('Telefon (RP)', U.input('', { ph: '555-…' }))}${U.field('Preisgruppe', U.select(D.priceGroups.map((g) => [g.id, g.name + (g.pct ? ' −' + g.pct + ' %' : '')]), 'pg1'))}${U.field('Zahlungsziel', U.select(['sofort', '7 Tage', '14 Tage'], 'sofort'))}${U.field('Tags', U.input('', { ph: 'z. B. VIP, Flotte' }))}${U.field('Warnhinweis', U.input('', { ph: 'optional' }), { full: true })}</div>`, ok: 'Speichern' }),
    'new-item': () => ({ title: 'Neue Leistung', wide: true, body: `<div class="form cols-2">${U.field('Name', U.input(''))}${U.field('Kategorie', U.select(D.categories.map((c) => [c.id, c.name]), 'c1'))}${U.field('Preisart', U.select([['flat', 'Pauschal – fester Endpreis'], ['labor', 'Arbeit – je Stunde/Einheit'], ['part', 'Teil – Verkauf aus dem Lager'], ['bundle', 'Set – Paketpreis, entnimmt Teile']], 'flat'))}${U.field('Festpreis', U.input('', { ph: '$' }), { hint: 'Endpreis für den Kunden, keine Steuer extra' })}${U.field('Preis je Fahrzeugklasse', U.select(['Einheitspreis', 'Aufschlag in % je Klasse', 'fester Preis je Klasse'], 'Einheitspreis'))}${U.field('Material-/Einkaufskosten', U.input('', { ph: '$' }))}${U.field('Voraussetzung', U.select([['', 'keine']].concat(D.trainings.map((t) => [t.id, 'Schulung: ' + t.name])).concat(D.licenseTypes.filter((l) => l.holder === 'member').map((l) => [l.id, 'Lizenz: ' + l.name])), ''))}${U.field('Zuständige Gruppe', U.select([['', 'alle']].concat(D.groups.map((g) => [g.id, g.name])), ''))}${U.field('Garantie (Tage)', U.input('0'))}${U.field('Gültig ab', U.input(U.date(D.TODAY)))}</div>`, ok: 'Leistung anlegen' }),
    'stock-in': () => ({ title: 'Wareneingang', body: `<div class="form cols-2">${U.field('Teil', U.select(D.parts.map((p) => [p.id, p.name + ' (Bestand ' + p.stock + ')']), 'p2'), { full: true })}${U.field('Menge', U.input('10'))}${U.field('Einkaufspreis je Stück', U.input('$ 25'))}${U.field('Bezahlt von', U.select(D.accounts.filter((a) => a.kind !== 'tax_reserve').map((a) => [a.id, a.name]), 'a1'))}${U.field('Lieferant / Notiz', U.input('', { ph: 'optional' }))}</div><div class="switch"><div class="txt">Ausgabe-Buchung erzeugen</div>${U.toggle(true)}</div>`, ok: 'Einbuchen' }),
    payment: () => ({ title: 'Zahlung erfassen', body: `<div class="form cols-2">${U.field('Betrag', U.input('$ 2.380'))}${U.field('Zahlungsart', U.select(['Bar', 'Karte', 'Überweisung'], 'Bar'))}${U.field('Konto', U.select(D.accounts.filter((a) => a.kind !== 'tax_reserve').map((a) => [a.id, a.name]), 'a2'))}${U.field('Datum', U.input(U.date(D.TODAY)))}</div>${U.note(`${D.firm.taxRate} % (${money(238)}) werden automatisch auf die Steuer-Rücklage umgebucht.`, 'info')}`, ok: 'Zahlung buchen' }),
    'tax-file': () => ({ title: 'Steuern abführen · KW 45', body: `<div class="grid g-3">${U.kpi('Steuerpfl. Umsatz', money(D.taxPeriods[1].revenue))}${U.kpi('Satz', D.taxPeriods[1].rate + ' %')}${U.kpi('Steuer', money(D.taxPeriods[1].tax), '', { accent: true })}</div><div class="form mt">${U.field('Abbuchen von', U.select(['Steuer-Rücklage', 'Firmenkonto'], 'Steuer-Rücklage'))}</div><div class="mt">${U.note('Danach ist der Zeitraum abgeschlossen und unveränderlich. Der Steuerbericht steht als PDF bereit.', 'warn')}</div>`, ok: 'Abführen' }),
    invite: () => ({ title: 'Mitarbeiter einladen', body: `<div class="form cols-2">${U.field('Name', U.input(''))}${U.field('E-Mail', U.input('', { ph: 'name@…' }))}${U.field('Rang', U.select(D.ranks.filter((r) => r.id !== 'r1').map((r) => [r.id, r.name]), 'r6'))}${U.field('Systemrolle', U.select(D.systemRoles.map((r) => [r.id, r.name]), 'user'))}${U.field('Gruppen', U.select([['', 'keine']].concat(D.groups.map((g) => [g.id, g.name])), ''))}${U.field('Link gültig', U.select(['1 Tag', '7 Tage', '14 Tage'], '7 Tage'))}${U.field('Zugang befristen bis', U.input('', { ph: 'optional, z. B. für Praktikanten' }), { full: true })}</div>`, ok: 'Einladung erstellen' }),
    'new-rank': () => ({ title: 'Neuer Rang', body: `<div class="form cols-2">${U.field('Name', U.input('', { ph: 'z. B. Obermeister' }))}${U.field('Position', U.select(D.ranks.slice().sort((a, b) => b.pos - a.pos).map((r) => [r.id, 'unter ' + r.name]), 'r4'))}${U.field('Rechtevorlage', U.select(['Leitung', 'Mechaniker', 'Azubi', 'Buchhaltung', 'Nur lesen', 'keine Rechte'], 'Mechaniker'))}${U.field('Lohnmodell', U.input('$ 120 / h + 5 % Provision'))}${U.field('Pflichtschulungen', U.select(D.trainings.map((t) => [t.id, t.name]), 't1'), { full: true })}</div>`, ok: 'Rang anlegen' }),
    'new-tx': () => ({ title: 'Neue Buchung', body: `<div class="form cols-2">${U.field('Art', U.select(['Ausgabe', 'Einnahme', 'Umbuchung'], 'Ausgabe'))}${U.field('Betrag', U.input('', { ph: '$' }))}${U.field('Konto', U.select(D.accounts.map((a) => [a.id, a.name]), 'a1'))}${U.field('Kategorie', U.select(['Teileeinkauf', 'Miete', 'Ausstattung', 'Strafen', 'Sonstiges'], 'Teileeinkauf'))}${U.field('Titel', U.input(''), { full: true })}</div><div class="switch"><div class="txt">Steuerpflichtig<small class="muted">nur bei Einnahmen; zählt dann in den Steuerzeitraum</small></div>${U.toggle(false)}</div>`, ok: 'Buchen' }),
    'new-appt': () => ({ title: 'Neuer Termin', body: `<div class="form cols-2">${U.field('Kunde', U.select(D.customers.map((c) => [c.id, c.name]), 'k1'))}${U.field('Stellplatz', U.select(D.bays.map((b) => [b.id, b.name]), 'b1'))}${U.field('Datum', U.input(U.date(D.addDays(D.TODAY, 1))))}${U.field('Zeit', U.input('18:00–19:30'))}${U.field('Notiz', U.input(''), { full: true })}</div>`, ok: 'Termin anlegen' }),
  };
  function openModal(key) {
    const m = MODALS[key] && MODALS[key]();
    if (!m) return;
    const el = document.createElement('div');
    el.className = 'overlay';
    el.id = 'overlay';
    el.innerHTML = `<div class="modal ${m.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(m.title)}</h2><button class="icon-btn" data-action="modal-close" aria-label="Schließen">${icon('x')}</button></div><div class="modal-body">${m.body}</div><div class="modal-foot"><button class="btn" data-action="modal-close">Abbrechen</button><button class="btn primary" data-action="${m.action || 'modal-ok'}" data-arg="${esc(m.title)}">${esc(m.ok)}</button></div></div>`;
    document.body.appendChild(el);
    const first = el.querySelector('input, select, textarea');
    if (first) first.focus();
  }
  const closeModal = () => { const o = document.getElementById('overlay'); if (o) o.remove(); };

  // ---------------- Suche ----------------
  function searchResults(qs) {
    const q = qs.trim().toLowerCase();
    if (q.length < 2) return '';
    const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
    const res = [];
    D.vehicles.filter((v) => norm(v.plate).includes(norm(q)) || (v.make + ' ' + v.model).toLowerCase().includes(q)).slice(0, 4).forEach((v) => res.push(`<a href="#/fahrzeug/${v.id}">${U.plate(v.plate)}<span>${esc(v.make)} ${esc(v.model)} <span class="muted">· ${esc(U.cust(v.owner).name)}</span></span></a>`));
    D.customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3).forEach((c) => res.push(`<a href="#/kunde/${c.id}">${icon('users', 'width="16" height="16"')}<span>${esc(c.name)} <span class="muted">· Kunde</span></span></a>`));
    D.orders.filter((o) => o.no.toLowerCase().includes(q)).slice(0, 3).forEach((o) => res.push(`<a href="#/auftrag/${o.id}">${icon('wrench', 'width="16" height="16"')}<span class="mono">${esc(o.no)}</span>${U.statusBadge(o.status)}</a>`));
    D.invoices.filter((i) => i.no.toLowerCase().includes(q)).slice(0, 3).forEach((i) => res.push(`<a href="#/rechnung/${i.id}">${icon('file', 'width="16" height="16"')}<span class="mono">${esc(i.no)}</span>${U.invBadge(i.status)}</a>`));
    return `<div class="search-results">${res.join('') || '<div class="empty" style="padding:12px">Nichts gefunden</div>'}</div>`;
  }

  // ---------------- Aktionen ----------------
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const ACTIONS = {
    toast: (arg) => toast(arg),
    modal: (arg) => openModal(arg),
    'modal-close': () => closeModal(),
    'modal-ok': (arg) => { closeModal(); toast(arg + ': gespeichert (Mockup)'); },
    'nav-toggle': () => document.body.classList.toggle('nav-open'),
    theme: () => { L.set('mode', L.resolvedMode() === 'light' ? 'dark' : 'light'); render(); },
    look: (arg) => {
      const i = arg.indexOf(':');
      const k = arg.slice(0, i), v = arg.slice(i + 1);
      if (k === 'bg' && v === 'custom' && !L.prefs.custom) { const f = document.getElementById('bgFile'); if (f) f.click(); return; }
      const ok = L.set(k, v);
      if (k === 'ui' && v === 'v2') toast('Design V2 „Glass“ aktiv – Hintergrund und Regler darunter');
      if (!ok) toast('Browser-Speicher nicht verfügbar – gilt nur bis zum Neuladen');
      render();
    },
    'look-reset': () => { Object.assign(L.prefs, L.DEFAULTS); L.save(); L.apply(); toast('Darstellung auf Standard zurückgesetzt'); render(); },
    logo: (arg) => {
      if (arg === 'reset') { L.logo.kind = 'preset'; L.logo.preset = 'wrench'; L.logo.data = null; }
      else { L.logo.kind = 'preset'; L.logo.preset = arg; }
      L.saveLogo();
      toast('Logo geändert – gilt für alle in der Firma');
      render();
    },
    duty: () => { S.duty = !S.duty; S.dutySince = nowHM(); toast(S.duty ? 'Dienst begonnen um ' + S.dutySince : 'Dienst beendet – Zeit gebucht'); render(); },
    print: () => window.print(),
    toggle: (arg, el) => {
      el.classList.toggle('on'); el.setAttribute('aria-checked', el.classList.contains('on'));
      if (arg && arg.startsWith('look-')) { L.set(arg.slice(5), el.classList.contains('on')); }
    },
    bell: () => {
      const m = document.getElementById('bellMenu');
      if (m.innerHTML) { m.innerHTML = ''; return; }
      m.innerHTML = `<div class="dropdown"><div class="list">${D.notifications.map((n) => `<a class="list-item" href="${n.link}"><span class="badge ${n.tone}"><span class="d"></span></span><div class="grow"><div style="font-size:13px">${esc(n.text)}</div><div class="meta">${esc(n.when)}</div></div></a>`).join('')}</div></div>`;
    },
    'user-menu': () => {
      const m = document.getElementById('userMenu');
      if (m.innerHTML) { m.innerHTML = ''; return; }
      m.innerHTML = `<div class="dropdown" style="min-width:220px"><a class="list-item" href="#/einstellungen">${icon('gear', 'width="16" height="16"')}<span>Einstellungen</span></a><a class="list-item" href="#/einstellungen?tab=darstellung">${icon('sun', 'width="16" height="16"')}<span>Darstellung</span></a><a class="list-item" href="#/berechtigungen?tab=wer&u=${S.viewAs}">${icon('shield', 'width="16" height="16"')}<span>Was darf ich?</span></a><a class="list-item" href="#/login">${icon('logout', 'width="16" height="16"')}<span>Abmelden</span></a></div>`;
    },
    'set-status': (arg) => {
      const [id, to] = arg.split(':');
      const o = U.byId(D.orders, id);
      o.status = to;
      toast(`${o.no}: ${U.statusMeta(to).label}${to === 'invoiced' ? ' – Rechnung erstellt' : ''}`);
      render();
    },
    'add-line': (arg) => {
      const o = U.byId(D.orders, arg);
      const it = U.item(document.getElementById('addItem').value);
      const by = document.getElementById('addBy').value;
      const v = U.veh(o.vehicle), c = U.cust(o.customer);
      o.items.push({ item: it.id, name: it.name, kind: it.kind, qty: 1, unit: D.unitPrice(it, v.cls), disc: D.groupDiscount(c.pg, it), by });
      const miss = window.BX.missingQual(by, it);
      toast(miss.length ? `Hinzugefügt – Warnung: ${U.user(by).name} fehlt ${miss.join(', ')}` : `${it.name} hinzugefügt: ${money(D.unitPrice(it, v.cls))}`);
      render();
    },
    'del-line': (arg) => { const [id, idx] = arg.split(':'); U.byId(D.orders, id).items.splice(Number(idx), 1); toast('Position entfernt'); render(); },
    discount: (arg) => { S.discountDone = true; if (arg === 'ok') { const o = U.byId(D.orders, 'o22'); o.items[1].disc = 15; } toast(arg === 'ok' ? 'Rabatt 15 % freigegeben – steht im Audit-Log' : 'Rabatt abgelehnt'); render(); },
    'perm-cycle': (arg) => {
      const [kind, id, mod] = arg.split(':');
      if (kind === 'rank') { D.rankPerms[id][mod] = (D.rankPerms[id][mod] + 1) % 5; }
      if (kind === 'group') { const v = D.groupPerms[id][mod]; if (v === undefined) D.groupPerms[id][mod] = 0; else if (v >= 4) delete D.groupPerms[id][mod]; else D.groupPerms[id][mod] = v + 1; }
      if (kind === 'user') { D.userPerms[id][mod] = (D.userPerms[id][mod] + 1) % 5; }
      toast('Recht geändert – steht im Audit-Log');
      render();
    },
    'create-order': () => {
      const plate = (document.getElementById('plateInput').value || '').trim();
      const v = D.vehicles.find((x) => x.plate.replace(/\s/g, '').toLowerCase() === plate.replace(/\s/g, '').toLowerCase()) || D.vehicles[0];
      const no = 'RFG-2026-' + String(47 + D.orders.filter((o) => o.id.startsWith('n')).length).padStart(4, '0');
      const id = 'n' + Date.now();
      D.orders.push({ id, no, status: 'accepted', vehicle: v.id, customer: v.owner, assignees: ['u3'], items: [], created: D.TODAY, due: D.addDays(D.TODAY, 1), request: 'Neuer Auftrag aus dem Mockup', bay: 'b1', mileage: v.km, condition: { Motor: 90, Karosserie: 80, Reifen: 70 } });
      closeModal();
      toast(no + ' angelegt');
      location.hash = '#/auftrag/' + id;
    },
  };


  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a && !['INPUT', 'SELECT'].includes(a.tagName)) {
      const fn = ACTIONS[a.dataset.action];
      if (fn) { e.preventDefault(); fn(a.dataset.arg, a); return; }
    }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a, button, input, select')) { location.hash = row.dataset.href; return; }
    if (!e.target.closest('.rel')) { ['bellMenu', 'userMenu'].forEach((id) => { const m = document.getElementById(id); if (m) m.innerHTML = ''; }); }
    if (!e.target.closest('.search')) { const r = document.getElementById('searchResults'); if (r) r.innerHTML = ''; }
    if (e.target.id === 'overlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.id === 'globalSearch') { const first = document.querySelector('#searchResults a'); if (first) location.hash = first.getAttribute('href'); }
    if ((e.key === 'Enter' || e.key === ' ') && (e.target.classList.contains('toggle') || e.target.getAttribute('role') === 'button')) { e.preventDefault(); e.target.click(); }
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { const s = document.getElementById('globalSearch'); if (s) { e.preventDefault(); s.focus(); } }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.action === 'filter') {
      const q = t.value.toLowerCase();
      document.querySelectorAll(t.dataset.target + ' tbody tr[data-filter-text]').forEach((r) => { r.style.display = r.dataset.filterText.includes(q) ? '' : 'none'; });
    }
    if (t.dataset.action === 'global-search') document.getElementById('searchResults').innerHTML = searchResults(t.value);
    if (t.dataset.action === 'look-range') {
      L.set(t.dataset.key, Number(t.value));
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = t.value + (t.dataset.unit || '');
    }
    if (t.dataset.action === 'plate-lookup') {
      const q = t.value.replace(/\s/g, '').toLowerCase();
      const out = document.getElementById('plateResult');
      if (q.length < 2) { out.innerHTML = U.note('Vorschlag: <b>DF 4207</b> eintippen.', 'info'); return; }
      const v = D.vehicles.find((x) => x.plate.replace(/\s/g, '').toLowerCase() === q) || D.vehicles.find((x) => x.plate.replace(/\s/g, '').toLowerCase().startsWith(q));
      if (!v) { out.innerHTML = U.note('Unbekanntes Kennzeichen – es wird ein <b>neues Fahrzeug</b> angelegt. Hersteller, Modell, Klasse und Halter angeben.', 'warn'); return; }
      const c = U.cust(v.owner), g = U.pg(c.pg);
      out.innerHTML = `<div class="card" style="padding:12px 14px"><div class="row between">${U.plate(v.plate, true)}${U.badge(U.cls(v.cls).name, 'accent')}</div><div class="row between" style="margin-top:10px"><div><b>${esc(v.make)} ${esc(v.model)}</b><div class="muted">${esc(v.color)} · ${v.km.toLocaleString('de-DE')} km</div></div><div class="right"><b>${esc(c.name)}</b><div class="muted">Preisgruppe ${esc(g.name)}${g.pct ? ' −' + g.pct + ' %' : ''}</div></div></div>${c.warning ? `<div class="mt">${U.note(esc(c.warning), 'warn')}</div>` : ''}${c.blocked ? `<div class="mt">${U.note('<b>Kunde gesperrt:</b> ' + esc(c.blocked), 'bad', 'lock')}</div>` : ''}</div>`;
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.action === 'view-as') { S.viewAs = t.value; S.duty = false; toast('Ansicht: ' + U.user(t.value).name); render(); }
    if (t.dataset.action === 'pl-class') { S.plClass = t.value; render(); }
    if (t.dataset.action === 'who-select') location.hash = '#/berechtigungen?tab=wer&u=' + t.value;
    if (t.dataset.action === 'promote-rank') location.hash = '#/qualifikationen?rank=' + t.value;
    if (t.dataset.action === 'logo-upload' || t.dataset.action === 'bg-upload') {
      const isLogo = t.dataset.action === 'logo-upload';
      L.readImage(t.files[0], isLogo ? 512 : 4096, (err, data) => {
        if (err) { toast(err.message); return; }
        let ok;
        if (isLogo) { L.logo.kind = 'image'; L.logo.data = data; ok = L.saveLogo(); }
        else { L.prefs.custom = data; L.prefs.bg = 'custom'; L.prefs.ui = 'v2'; ok = L.save(); L.apply(); }
        toast(ok ? (isLogo ? 'Logo hochgeladen' : 'Eigenes Hintergrundbild aktiv – nur du siehst es') : 'Bild aktiv, aber zu groß für den Browser-Speicher – gilt bis zum Neuladen');
        render();
      });
    }
  });

  // Drag & Drop im Auftragsboard
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('.kcard');
    if (!c) return;
    e.dataTransfer.setData('text/plain', c.dataset.order);
    e.dataTransfer.effectAllowed = 'move';
    c.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('.kcard'); if (c) c.classList.remove('dragging'); document.querySelectorAll('.kcol.drop').forEach((x) => x.classList.remove('drop')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('.kcol'); if (col) { e.preventDefault(); document.querySelectorAll('.kcol.drop').forEach((x) => x !== col && x.classList.remove('drop')); col.classList.add('drop'); } });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('.kcol');
    if (!col) return;
    e.preventDefault();
    const o = U.byId(D.orders, e.dataTransfer.getData('text/plain'));
    const to = col.dataset.drop;
    if (!o || o.status === to) { col.classList.remove('drop'); return; }
    const lv = perm.level(S.viewAs, 'orders');
    if (lv < 3 && !(lv === 1 && o.assignees.includes(S.viewAs))) { toast('Dafür fehlt dir das Recht'); render(); return; }
    if (to === 'invoiced' && o.status !== 'done') { toast('Abrechnen geht erst, wenn der Auftrag fertig ist'); render(); return; }
    o.status = to;
    toast(`${o.no} → ${U.statusMeta(to).label}${to === 'invoiced' ? ' · Rechnung erstellt' : ''}`);
    render();
  });

  window.addEventListener('hashchange', render);
  L.apply();
  render();
})();
