/* Boxenstopp – Router, Layout, Anmeldung, Formulare, Ereignisse. Kein Inline-JS (CSP). */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = BX.pages;
  const L = BX.look;
  const { esc, icon, money } = U;
  const S = (BX.state = { orderView: 'board', plClass: null, weekOffset: 0, auth: null, chartHidden: {}, chartRange: {} });
  const A = (BX.actions = BX.actions || {});

  // ---------- Navigation ----------
  const NAV = [
    ['Werkstatt', [['dashboard', 'Dashboard', 'dash'], ['auftraege', 'Aufträge', 'wrench', 'orders'], ['tuning', 'Tuning', 'gauge', 'tuning'], ['termine', 'Termine', 'cal', 'appointments'], ['einsaetze', 'Einsätze', 'truck', 'callouts'], ['fuhrpark', 'Fuhrpark', 'steer', 'fleet']]],
    ['Kunden', [['kunden', 'Kunden', 'users', 'customers'], ['fahrzeuge', 'Fahrzeuge', 'car', 'vehicles'], ['modelle', 'Fahrzeug-Katalog', 'image', 'models']]],
    ['Preisliste & Lager', [['preisliste', 'Preisliste', 'tag', 'catalog'], ['lager', 'Lager', 'box', 'stock']]],
    ['Finanzen', [['finanzen', 'Übersicht', 'chart', 'accounts', 2], ['rechnungen', 'Rechnungen', 'file', 'invoices'], ['buchungen', 'Buchungen', 'list', 'accounts', 2], ['konten', 'Konten & Kassen', 'bank', 'accounts', 2], ['steuern', 'Steuern', 'percent', 'tax'], ['lohn', 'Lohn & Provision', 'wallet', 'payroll'], ['berichte', 'Berichte', 'chart', 'reports']]],
    ['Personal', [['regelwerk', 'Regelwerk', 'id', 'rules'], ['dienstplan', 'Dienstplan', 'clock', 'shifts'], ['schulungen', 'Schulungen', 'grad', 'trainings'], ['lizenzen', 'Lizenzen', 'id', 'licenses'], ['qualifikationen', 'Qualifikationen', 'grid', 'trainings', 2], ['personalakten', 'Personalakten', 'folder', 'stafffiles', 2], ['brett', 'Schwarzes Brett', 'megaphone', 'board']]],
    ['Firma', [['mitarbeiter', 'Mitarbeiter', 'users', 'staff'], ['raenge', 'Ränge & Gruppen', 'layers', 'ranks'], ['berechtigungen', 'Berechtigungen', 'shield', 'perms'], ['firma', 'Firmen-Einstellungen', 'building', 'settings']]],
    ['Administration', [['users', 'User-Management', 'userkey', null, 0, 'user:read'], ['server', 'Server-Management', 'server', null, 0, 'server:read'], ['tickets', 'Tickets', 'bug', null, 0, 'ticket:manage'], ['hilfe', 'Hilfe', 'help'], ['fehler', 'Fehler melden', 'alert'], ['changelog', 'Changelog', 'list']]],
  ];
  const ROUTE_ALIAS = { auftrag: 'auftraege', kunde: 'kunden', fahrzeug: 'fahrzeuge', rechnung: 'rechnungen', modell: 'modelle', einstellungen: null };
  const navEntry = (key) => { for (const [, items] of NAV) for (const it of items) if (it[0] === key) return it; return null; };
  const allowed = (entry) => {
    if (!entry) return true;
    const [, , , mod, min, sys] = entry;
    if (sys) return D.me.sys.includes(sys);
    if (!mod) return true;
    return (D.me.levels[mod] || 0) >= (min || 1);
  };
  BX.allowed = (key) => allowed(navEntry(key));
  const counts = () => ({
    auftraege: (D.orders || []).filter((o) => ['accepted', 'in_progress', 'waiting_parts', 'done'].includes(o.status)).length,
    einsaetze: (D.callouts || []).filter((c) => ['open', 'en_route', 'on_site'].includes(c.status)).length,
    rechnungen: (D.invoices || []).filter((i) => i.status === 'overdue').length,
    tickets: (D.tickets || []).filter((t) => t.status === 'open').length,
    users: (D.staff || []).filter((s) => s.status === 'pending').length,
    regelwerk: BX.openRules ? BX.openRules().length : 0,
  });

  function sidebar(active) {
    const c = counts();
    return `<aside class="sidebar" id="sidebar"><a class="brand" href="#/dashboard">${L.logoHtml()}<div><div class="brand-name">Boxenstopp</div><div class="brand-firm">${esc(D.firm.name)}</div></div></a>
      <nav class="nav">${NAV.map(([title, items]) => {
        const vis = items.filter(allowed);
        if (!vis.length) return '';
        return `<div class="nav-group"><div class="nav-title">${esc(title)}</div>${vis.map(([k, l, ic]) => `<a href="#/${k}" class="${k === active ? 'active' : ''}">${icon(ic)}<span>${esc(l)}</span>${c[k] ? `<span class="count">${c[k]}</span>` : ''}</a>`).join('')}</div>`;
      }).join('')}</nav><div class="faint" style="font-size:11px;padding:16px 10px 0">Version ${esc(D.version)}</div></aside>`;
  }
  function topbar() {
    const u = U.user(D.me.id);
    const unread = (D.notifications || []).filter((n) => !n.read).length;
    const on = !!D.onDuty[D.me.id];
    return `<header class="topbar">
      <button class="icon-btn" id="menuToggle" data-action="nav-toggle" aria-label="Menü">${icon('menu')}</button>
      <div class="search"><span>${icon('search')}</span><input id="globalSearch" placeholder="Kennzeichen, Kunde, Auftrag, Rechnung … ( / )" data-action="global-search" autocomplete="off"><div id="searchResults"></div></div>
      <div class="spacer"></div>
      ${u.rank ? `<button class="duty-btn ${on ? 'on' : ''}" data-action="duty" title="${on ? 'Dienst beenden' : 'Dienst beginnen'}"><span class="led"></span><span class="ic">${icon('clock')}</span><span class="lbl">${on ? 'Im Dienst seit ' + D.onDuty[D.me.id] : 'Dienst beginnen'}</span></button>` : ''}
      <button class="icon-btn" data-action="theme" title="Hell / Dunkel (mehr unter Einstellungen → Darstellung)">${icon('sun')}</button>
      <div class="rel"><button class="icon-btn" data-action="bell" title="Benachrichtigungen">${icon('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button><div id="bellMenu"></div></div>
      <div class="rel"><div class="user-chip" data-action="user-menu" role="button" tabindex="0">${U.avatar(u)}<div class="who"><b>${esc(u.name)}</b><small class="muted">${u.rank ? esc(U.rank(u.rank).name) : 'ohne Rang'}</small></div></div><div id="userMenu"></div></div>
    </header>`;
  }
  function banners() {
    let h = '';
    if (D.me.needs2fa) h += `<div class="mb">${U.note('Für dein Konto ist die <b>Zwei-Faktor-Anmeldung</b> vorgeschrieben. <a class="link" href="#/einstellungen?tab=sicherheit">Jetzt einrichten</a>', 'warn', 'shield')}</div>`;
    if (D.security && D.security.maintenance) h += `<div class="mb">${U.note('<b>Wartungsmodus ist an.</b> Nur Administratoren kommen gerade hinein.', 'warn', 'lock')}</div>`;
    return h;
  }

  // ---------- Router ----------
  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const i = kv.indexOf('='); q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = decodeURIComponent(i < 0 ? '' : kv.slice(i + 1)); });
    return { page: parts[0], params: parts.slice(1), q };
  }
  BX.route = parse;
  const PUBLIC_PAGES = ['login', 'setup', 'registrieren', 'einladung', 'passwort', 'preise'];

  function render() {
    const { page, params, q } = parse();
    document.body.classList.remove('nav-open');
    const root = document.getElementById('app');
    if (PUBLIC_PAGES.includes(page) || !D.loaded) {
      const fn = P['auth_' + (PUBLIC_PAGES.includes(page) ? page : 'login')];
      root.innerHTML = fn(params, q);
      document.title = 'Boxenstopp';
      return;
    }
    const navKey = ROUTE_ALIAS[page] !== undefined ? ROUTE_ALIAS[page] : page;
    const entry = navEntry(navKey);
    let content;
    if (!P[page]) content = U.pageHead('Seite nicht gefunden', '', U.btn('Zum Dashboard', { href: '#/dashboard' }));
    else if (!allowed(entry)) content = U.pageHead('Kein Zugriff', 'Für diese Seite fehlt dir das Recht.', U.btn('Was darf ich?', { href: '#/einstellungen?tab=rechte' })) + U.note('Frag deine Werkstattleitung, wenn du hier etwas brauchst.', 'warn', 'lock');
    else {
      try { content = P[page](params, q); } catch (err) { console.error(err); content = U.note('Fehler beim Anzeigen: ' + esc(err.message), 'bad'); }
    }
    const focus = document.activeElement && document.activeElement.id;
    const scroll = window.scrollY;
    root.innerHTML = `<div class="app">${sidebar(navKey)}<div class="main">${topbar()}<main class="content">${banners()}${content}</main></div></div>`;
    document.title = (entry ? entry[1] + ' · ' : '') + 'Boxenstopp';
    if (S.keepScroll) { window.scrollTo(0, scroll); S.keepScroll = false; }
    if (focus && document.getElementById(focus) && focus !== 'globalSearch') document.getElementById(focus).focus();
  }
  BX.render = render;
  BX.reload = async (keepScroll = true) => { await BX.load(); S.keepScroll = keepScroll; render(); };

  // ---------- Toast, Modal, Formulare ----------
  function toast(text, tone) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toast-host'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="d" style="${tone === 'bad' ? 'background:var(--bad)' : tone === 'ok' ? 'background:var(--ok)' : ''}"></span><span>${esc(text)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), tone === 'bad' ? 6000 : 3500);
  }
  BX.toast = toast;
  function closeModal() { const o = document.getElementById('overlay'); if (o) o.remove(); }
  BX.closeModal = closeModal;
  function openModal({ title, body, foot, wide }) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'overlay';
    el.id = 'overlay';
    el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="modal-close" aria-label="Schließen">${icon('x')}</button></div><div class="modal-body"><div id="modalErr"></div>${body}</div>${foot !== undefined ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(el);
    const first = el.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    if (first) first.focus();
    return el;
  }
  BX.openModal = openModal;

  function fieldHtml(f) {
    const v = f.value === undefined || f.value === null ? '' : f.value;
    const req = f.required ? 'required' : '';
    let ctl;
    switch (f.type) {
      case 'select': ctl = `<select class="input" name="${f.name}" ${req} ${f.attrs || ''}>${(f.options || []).map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`; break;
      case 'multi': ctl = `<div class="chips" style="gap:8px">${(f.options || []).map(([ov, ol]) => `<label class="chip-tag" style="cursor:pointer;padding:5px 10px"><input type="checkbox" data-multi="${f.name}" value="${esc(ov)}" ${(v || []).includes(ov) ? 'checked' : ''}> ${esc(ol)}</label>`).join('') || '<span class="faint">–</span>'}</div>`; break;
      case 'textarea': ctl = `<textarea class="input" name="${f.name}" ${req} ${f.attrs || ''} placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`; break;
      case 'checkbox': return `<label class="switch ${f.full !== false ? 'field full' : ''}" style="flex-direction:row"><span class="txt"><b>${esc(f.label)}</b>${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}</span><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"></label>`;
      case 'html': return `<div class="field ${f.full ? 'full' : ''}">${f.label ? `<label>${esc(f.label)}</label>` : ''}${f.html}</div>`;
      default: ctl = `<input class="input ${f.mono ? 'mono' : ''}" type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" ${req} ${f.step ? `step="${f.step}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} placeholder="${esc(f.ph || '')}" ${f.attrs || ''}>`;
    }
    return `<div class="field ${f.full ? 'full' : ''}"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
  }
  function readForm(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
      else out[el.name] = el.value;
    });
    root.querySelectorAll('[data-multi]').forEach((el) => { (out[el.dataset.multi] ||= []); if (el.checked) out[el.dataset.multi].push(el.value); });
    root.querySelectorAll('[data-multi]').forEach((el) => { out[el.dataset.multi] ||= []; });
    return out;
  }
  BX.readForm = readForm;
  // Formular-Dialog: submit(values) → Promise; Fehler bleiben im Dialog stehen
  BX.form = function ({ title, fields, submit, ok = 'Speichern', wide, intro, cols = 2, danger }) {
    const el = openModal({
      title, wide,
      body: `${intro ? `<div class="mb">${intro}</div>` : ''}<form class="form ${cols === 2 ? 'cols-2' : ''}" id="bxForm" novalidate>${fields.map(fieldHtml).join('')}<button type="submit" hidden></button></form>`,
      foot: `<button class="btn" data-action="modal-close">Abbrechen</button><button class="btn ${danger ? 'danger' : 'primary'}" data-action="form-submit">${esc(ok)}</button>`,
    });
    el._submit = submit;
    return el;
  };
  A['form-submit'] = async (arg, btn) => {
    const ov = document.getElementById('overlay');
    if (!ov || !ov._submit) return;
    const form = ov.querySelector('#bxForm');
    const vals = readForm(form);
    const missing = [...form.querySelectorAll('[required]')].find((x) => !x.value);
    if (missing) { ov.querySelector('#modalErr').innerHTML = U.note('Bitte alle Pflichtfelder (*) ausfüllen.', 'bad'); missing.focus(); return; }
    btn.disabled = true;
    try {
      const msg = await ov._submit(vals);
      closeModal();
      if (msg !== false) { if (typeof msg === 'string') toast(msg, 'ok'); await BX.reload(); }
    } catch (e) {
      btn.disabled = false;
      const err = ov.querySelector('#modalErr');
      if (err) err.innerHTML = U.note(esc(e.message), 'bad');
      else toast(e.message, 'bad');
    }
  };
  // API-Aufruf mit Rückmeldung und Neuladen
  BX.call = async (method, url, body, okMsg) => {
    try {
      const r = await BX.api(method, url, body);
      if (r && r.warning) toast(r.warning, 'bad');
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok');
      await BX.reload();
      return r;
    } catch (e) { toast(e.message, 'bad'); return null; }
  };
  BX.confirm = (title, text, ok, fn, danger = true) => {
    openModal({ title, body: `<p>${text}</p>`, foot: `<button class="btn" data-action="modal-close">Abbrechen</button><button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirm-ok">${esc(ok)}</button>` });
    document.getElementById('overlay')._confirm = fn;
  };
  A['confirm-ok'] = async () => { const ov = document.getElementById('overlay'); const fn = ov && ov._confirm; closeModal(); if (fn) await fn(); };
  BX.prompt = (title, label, ok, fn, opts = {}) => BX.form({ title, cols: 1, ok, danger: opts.danger, fields: [{ name: 'v', label, type: opts.type || 'text', required: opts.required !== false, value: opts.value, hint: opts.hint }], submit: async (v) => fn(v.v) });
  BX.copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert', 'ok'); } catch (e) { BX.openModal({ title: 'Link', body: `<input class="input mono" value="${esc(text)}" readonly>` }); } };

  // ---------- Suche ----------
  function searchResults(qs) {
    const q = qs.trim().toLowerCase();
    if (q.length < 2) return '';
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
    const res = [];
    (D.vehicles || []).filter((v) => norm(v.plate).includes(norm(q)) || (v.make + ' ' + v.model).toLowerCase().includes(q)).slice(0, 5).forEach((v) => res.push(`<a href="#/fahrzeug/${v.id}">${U.plate(v.plate)}<span>${esc(v.make)} ${esc(v.model)} <span class="muted">· ${esc((U.cust(v.owner) || {}).name || '')}</span></span></a>`));
    (D.customers || []).filter((c) => c.name.toLowerCase().includes(q) || norm(c.phone).includes(norm(q))).slice(0, 4).forEach((c) => res.push(`<a href="#/kunde/${c.id}">${icon('users', 'width="16" height="16"')}<span>${esc(c.name)} <span class="muted">· Kunde</span></span></a>`));
    (D.orders || []).filter((o) => norm(o.no).includes(norm(q))).slice(0, 3).forEach((o) => res.push(`<a href="#/auftrag/${o.id}">${icon('wrench', 'width="16" height="16"')}<span class="mono">${esc(o.no)}</span>${U.statusBadge(o.status)}</a>`));
    (D.invoices || []).filter((i) => norm(i.no).includes(norm(q))).slice(0, 3).forEach((i) => res.push(`<a href="#/rechnung/${i.id}">${icon('file', 'width="16" height="16"')}<span class="mono">${esc(i.no)}</span>${U.invBadge(i.status)}</a>`));
    (D.callouts || []).filter((c) => norm(c.no).includes(norm(q))).slice(0, 2).forEach((c) => res.push(`<a href="#/einsaetze">${icon('truck', 'width="16" height="16"')}<span class="mono">${esc(c.no)}</span><span class="muted">${esc(c.loc)}</span></a>`));
    return `<div class="search-results">${res.join('') || '<div class="empty" style="padding:12px">Nichts gefunden</div>'}</div>`;
  }

  // ---------- Allgemeine Aktionen ----------
  Object.assign(A, {
    'modal-close': () => closeModal(),
    'nav-toggle': () => document.body.classList.toggle('nav-open'),
    theme: () => { L.set('mode', L.resolvedMode() === 'light' ? 'dark' : 'light'); render(); },
    duty: async () => { const r = await BX.call('POST', '/api/shifts/clock'); if (r) toast(r.onDuty ? 'Dienst begonnen um ' + r.since : 'Dienst beendet – Zeit gebucht', 'ok'); },
    print: () => window.print(),
    href: (arg) => { location.hash = arg; },
    toggle: (arg, el) => {
      el.classList.toggle('on'); el.setAttribute('aria-checked', el.classList.contains('on'));
      if (arg && arg.startsWith('look-')) L.set(arg.slice(5), el.classList.contains('on'));
    },
    bell: async () => {
      const m = document.getElementById('bellMenu');
      if (m.innerHTML) { m.innerHTML = ''; return; }
      const list = D.notifications || [];
      m.innerHTML = `<div class="dropdown"><div class="list">${list.length ? list.map((n) => `<a class="list-item" href="${esc(n.link || '#/dashboard')}" style="${n.read ? 'opacity:.6' : ''}"><span class="badge ${esc(n.tone)}"><span class="d"></span></span><div class="grow"><div style="font-size:13px">${esc(n.text)}</div><div class="meta">${U.date(n.at)}</div></div></a>`).join('') : '<div class="empty">Keine Benachrichtigungen</div>'}</div></div>`;
      if (list.some((n) => !n.read)) { await BX.api('POST', '/api/me/notifications/read').catch(() => {}); list.forEach((n) => { n.read = true; }); const dot = document.querySelector('[data-action=bell] .dot'); if (dot) dot.remove(); }
    },
    'user-menu': () => {
      const m = document.getElementById('userMenu');
      if (m.innerHTML) { m.innerHTML = ''; return; }
      m.innerHTML = `<div class="dropdown" style="min-width:220px"><a class="list-item" href="#/einstellungen">${icon('gear', 'width="16" height="16"')}<span>Einstellungen</span></a><a class="list-item" href="#/einstellungen?tab=darstellung">${icon('sun', 'width="16" height="16"')}<span>Darstellung</span></a><a class="list-item" href="#/einstellungen?tab=rechte">${icon('shield', 'width="16" height="16"')}<span>Was darf ich?</span></a><a class="list-item" href="#/login" data-action="logout">${icon('logout', 'width="16" height="16"')}<span>Abmelden</span></a></div>`;
    },
    logout: async () => { await BX.api('POST', '/api/auth/logout').catch(() => {}); D.loaded = false; location.hash = '#/login'; render(); },
    look: (arg) => {
      const i = arg.indexOf(':');
      const k = arg.slice(0, i), v = arg.slice(i + 1);
      if (k === 'bg' && v === 'custom' && !L.prefs.custom) { const f = document.getElementById('bgFile'); if (f) f.click(); return; }
      L.set(k, v);
      render();
    },
    'chart-toggle': (arg) => {
      const i = arg.lastIndexOf(':'); const id = arg.slice(0, i), key = arg.slice(i + 1);
      const h = (S.chartHidden[id] ||= []);
      const at = h.indexOf(key);
      if (at >= 0) h.splice(at, 1); else h.push(key);
      S.keepScroll = true; render();
    },
    'chart-range': (arg) => { const i = arg.lastIndexOf(':'); S.chartRange[arg.slice(0, i)] = arg.slice(i + 1); S.keepScroll = true; render(); },
    'look-reset': () => { Object.assign(L.prefs, L.DEFAULTS); L.save(); L.apply(); toast('Darstellung auf Standard zurückgesetzt', 'ok'); render(); },
  });

  // ---------- Ereignisse ----------
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (a && !['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) {
      const fn = A[a.dataset.action];
      if (fn) {
        e.preventDefault();
        if (a.disabled) return;
        try { await fn(a.dataset.arg, a, e); } catch (err) { console.error(err); toast(err.message, 'bad'); }
        return;
      }
    }
    const svgLink = e.target.closest('svg [data-href], .donut-legend [data-href]');
    if (svgLink) { location.hash = svgLink.getAttribute('data-href'); return; }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a, button, input, select, label')) { location.hash = row.dataset.href; return; }
    if (!e.target.closest('.rel')) ['bellMenu', 'userMenu'].forEach((id) => { const m = document.getElementById(id); if (m) m.innerHTML = ''; });
    if (!e.target.closest('.search')) { const r = document.getElementById('searchResults'); if (r) r.innerHTML = ''; }
    if (e.target.id === 'overlay') closeModal();
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'bxForm') { const b = document.querySelector('[data-action=form-submit]'); if (b) b.click(); return; }
    const a = f.dataset.submit && A[f.dataset.submit];
    if (a) a(f.dataset.arg, f, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.id === 'globalSearch') { const first = document.querySelector('#searchResults a'); if (first) { location.hash = first.getAttribute('href'); e.target.value = ''; } }
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
    if (t.dataset.input && A[t.dataset.input]) A[t.dataset.input](t.value, t, e);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.change && A[t.dataset.change]) A[t.dataset.change](t.value, t, e);
    if (t.dataset.action === 'bg-upload') {
      L.readImage(t.files[0], 3072, (err, data) => {
        if (err) { toast(err.message, 'bad'); return; }
        L.prefs.custom = data; L.prefs.bg = 'custom'; L.prefs.ui = 'v2'; L.save(); L.apply();
        toast('Eigenes Hintergrundbild aktiv – nur du siehst es', 'ok');
        render();
      });
    }
  });

  // ---------- Diagramm-Tooltips und Hervorhebung ----------
  const tipEl = () => { let t = document.getElementById('chartTip'); if (!t) { t = document.createElement('div'); t.id = 'chartTip'; t.className = 'chart-tip'; t.setAttribute('role', 'tooltip'); document.body.appendChild(t); } return t; };
  function showTip(el, x, y) {
    const t = tipEl();
    const [head, ...rest] = el.getAttribute('data-tip').split('\n');
    t.innerHTML = `<b>${esc(head)}</b>${rest.map((r) => `<div>${esc(r)}</div>`).join('')}`;
    t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    t.style.top = Math.max(8, y - h - 12) + 'px';
  }
  const hideTip = () => { const t = document.getElementById('chartTip'); if (t) t.style.display = 'none'; };
  function donutFocus(wrap, seg) {
    if (!wrap) return;
    wrap.querySelectorAll('.seg').forEach((c) => c.classList.toggle('dim', seg !== null && c.dataset.seg !== seg));
    wrap.querySelectorAll('.leg-row').forEach((r) => r.classList.toggle('hl', seg !== null && r.dataset.seg === seg));
    const s = seg !== null ? wrap.querySelector(`.seg[data-seg="${seg}"]`) : null;
    const l = wrap.querySelector('.dc-label'), v = wrap.querySelector('.dc-value');
    if (l && v) { l.textContent = s ? s.dataset.dl : l.dataset.def; v.textContent = s ? s.dataset.dv : v.dataset.def; }
  }
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && e.target.closest('svg')) showTip(el, e.clientX, e.clientY); else hideTip();
    const wrap = e.target.closest && e.target.closest('.donut-wrap');
    if (wrap) { const seg = e.target.closest('[data-seg]'); donutFocus(wrap, seg ? seg.dataset.seg : null); }
  });
  document.addEventListener('pointerleave', hideTip);
  document.addEventListener('scroll', hideTip, { passive: true });

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
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('.kcol');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drop');
    const o = U.byId(D.orders, e.dataTransfer.getData('text/plain'));
    const to = col.dataset.drop;
    if (!o || o.status === to) return;
    if (to === 'invoiced') { A['order-status'](o.id + ':invoiced'); return; }
    await BX.call('POST', `/api/orders/${o.id}/status`, { to }, `${o.no} → ${U.statusMeta(to).label}`);
  });

  // ---------- Start ----------
  BX.onUnauthorized = () => { if (D.loaded) { D.loaded = false; toast('Sitzung abgelaufen – bitte neu anmelden', 'bad'); location.hash = '#/login'; render(); } };
  async function boot() {
    L.apply();
    try { S.auth = await BX.api('GET', '/api/auth/status'); } catch (e) { S.auth = { setup: false }; }
    D.logo = S.auth.logo;
    const { page } = parse();
    if (S.auth.setup && page !== 'setup') { location.hash = '#/setup'; }
    if (S.auth.loggedIn && !PUBLIC_PAGES.includes(page)) {
      try { await BX.load(); L.adoptServer(D.me.ui); } catch (e) { if (e.status === 503) toast(e.message, 'bad'); }
    }
    render();
    // Daten alle 60 s auffrischen, wenn gerade nichts bearbeitet wird
    setInterval(async () => {
      if (!D.loaded || document.getElementById('overlay') || document.hidden) return;
      const a = document.activeElement;
      if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.id !== 'globalSearch') return;
      try { await BX.load(); S.keepScroll = true; render(); } catch (e) { /* still */ }
    }, 60000);
  }
  BX.afterLogin = async () => { await BX.load(); L.adoptServer(D.me.ui); if (PUBLIC_PAGES.includes(parse().page)) location.hash = '#/dashboard'; else render(); };
  window.addEventListener('hashchange', render);
  boot();
})();
