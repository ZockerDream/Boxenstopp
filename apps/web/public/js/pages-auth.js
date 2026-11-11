/* Boxenstopp – Seiten ohne Anmeldung: Login, Ersteinrichtung, Registrierung, Einladung, Passwort, öffentliche Preisliste */
(function () {
  'use strict';
  const BX = window.BX;
  const U = BX.ui;
  const P = (BX.pages = BX.pages || {});
  const A = (BX.actions = BX.actions || {});
  const { esc, field, input, money } = U;

  const shell = (inner, wide) => `<div class="login-wrap"><div class="login" style="${wide ? 'max-width:520px' : ''}"><div class="brand">${BX.look.logoHtml()}<div><div class="brand-name">Boxenstopp</div><div class="brand-firm">${esc((BX.state.auth && BX.state.auth.firmName) || 'Werkstatt-Management')}</div></div></div>${inner}</div></div>`;
  const err = (id) => `<div id="${id}"></div>`;
  const showErr = (id, e) => { const el = document.getElementById(id); if (el) el.innerHTML = U.note(esc(e.message || e), 'bad'); };
  const val = (form, n) => (form.querySelector(`[name="${n}"]`) || {}).value || '';

  P.auth_login = function () {
    const st = BX.state.auth || {};
    if (st.setup) { location.hash = '#/setup'; return ''; }
    return shell(`${st.maintenance ? U.note(esc(st.maintenanceText || 'Wartungsmodus'), 'warn', 'lock') + '<div class="mt"></div>' : ''}
      ${U.card('', `<form class="form" data-submit="login">${err('loginErr')}
        ${field('E-Mail', input('', { type: 'email', attrs: 'name="email" autocomplete="username" required' }))}
        ${field('Passwort', input('', { type: 'password', attrs: 'name="password" autocomplete="current-password" required' }))}
        <div id="codeField" class="hidden">${field('Code aus der Authenticator-App', input('', { attrs: 'name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"' }))}</div>
        <button class="btn primary" style="justify-content:center" type="submit">Anmelden</button></form>`)}
      <p class="muted center" style="margin-top:14px;font-size:12px">Passwort vergessen? Ein Administrator erzeugt dir einen Link.<br>${st.registration ? '<a class="link" href="#/registrieren">Konto beantragen</a>' : 'Neu hier? Frag deine Werkstattleitung nach einer Einladung.'}</p>`);
  };
  A.login = async (arg, form) => {
    const body = { email: val(form, 'email'), password: val(form, 'password') };
    const code = val(form, 'code');
    if (code) body.code = code;
    try {
      const r = await BX.api('POST', '/api/auth/login', body);
      if (r.need2fa) { document.getElementById('codeField').classList.remove('hidden'); form.querySelector('[name=code]').focus(); document.getElementById('loginErr').innerHTML = U.note('Bitte den 6-stelligen Code eingeben.', 'info'); return; }
      await BX.afterLogin();
    } catch (e) { showErr('loginErr', e); }
  };

  P.auth_setup = function () {
    if (BX.state.auth && !BX.state.auth.setup) { location.hash = '#/login'; return ''; }
    return shell(U.card('Ersteinrichtung', `<p class="muted">Willkommen! Lege deine Firma und das erste Konto an. Du wirst Inhaber und Administrator.</p>
      <form class="form" data-submit="setup">${err('setupErr')}
      ${field('Firmenname', input('', { attrs: 'name="firmName" required' }))}
      ${field('Kürzel für Nummern', input('', { mono: true, attrs: 'name="short" maxlength="6" required', ph: 'z. B. RFG' }), { hint: 'Aufträge heißen dann RFG-2026-0001' })}
      ${field('Dein Name', input('', { attrs: 'name="name" required' }))}
      ${field('E-Mail', input('', { type: 'email', attrs: 'name="email" required' }))}
      ${field('Passwort', input('', { type: 'password', attrs: 'name="password" required autocomplete="new-password"' }), { hint: 'mindestens 10 Zeichen' })}
      <button class="btn primary" style="justify-content:center" type="submit">Firma anlegen</button></form>`), true);
  };
  A.setup = async (arg, form) => {
    try {
      await BX.api('POST', '/api/setup', { firmName: val(form, 'firmName'), short: val(form, 'short'), name: val(form, 'name'), email: val(form, 'email'), password: val(form, 'password') });
      BX.state.auth.setup = false;
      location.hash = '#/dashboard';
      await BX.afterLogin();
    } catch (e) { showErr('setupErr', e); }
  };

  P.auth_registrieren = function () {
    return shell(U.card('Konto beantragen', `<form class="form" data-submit="register">${err('regErr')}
      ${field('Name (im RP)', input('', { attrs: 'name="name" required' }))}${field('E-Mail', input('', { type: 'email', attrs: 'name="email" required' }))}
      ${field('Passwort', input('', { type: 'password', attrs: 'name="password" required autocomplete="new-password"' }), { hint: 'mindestens 10 Zeichen' })}
      <button class="btn primary" style="justify-content:center" type="submit">Beantragen</button></form>
      <p class="muted" style="font-size:12px;margin-top:10px">Dein Konto wird nach Prüfung durch die Leitung freigeschaltet.</p>`) + '<p class="center mt"><a class="link" href="#/login">Zur Anmeldung</a></p>');
  };
  A.register = async (arg, form) => {
    try {
      await BX.api('POST', '/api/auth/register', { name: val(form, 'name'), email: val(form, 'email'), password: val(form, 'password') });
      form.innerHTML = U.note('Danke! Dein Konto wartet jetzt auf Freigabe.', 'ok', 'check');
    } catch (e) { showErr('regErr', e); }
  };

  P.auth_einladung = function (params) {
    const token = params[0] || '';
    setTimeout(async () => {
      try {
        const i = await BX.api('GET', '/api/auth/invite/' + encodeURIComponent(token));
        const box = document.getElementById('inviteInfo');
        if (box) box.innerHTML = `<p>Einladung für <b>${esc(i.email)}</b>${i.rank ? ` als <b>${esc(i.rank)}</b>` : ''}.</p>`;
        const n = document.querySelector('[name=name]'); if (n && i.name) n.value = i.name;
      } catch (e) { showErr('invErr', e); }
    });
    return shell(U.card('Einladung annehmen', `<div id="inviteInfo" class="muted">Einladung wird geprüft …</div><form class="form mt" data-submit="invite" data-arg="${esc(token)}">${err('invErr')}
      ${field('Dein Name (im RP)', input('', { attrs: 'name="name" required' }))}${field('Passwort', input('', { type: 'password', attrs: 'name="password" required autocomplete="new-password"' }), { hint: 'mindestens 10 Zeichen' })}
      <button class="btn primary" style="justify-content:center" type="submit">Konto anlegen</button></form>`));
  };
  A.invite = async (token, form) => {
    try { await BX.api('POST', '/api/auth/invite/' + encodeURIComponent(token), { name: val(form, 'name'), password: val(form, 'password') }); location.hash = '#/dashboard'; await BX.afterLogin(); }
    catch (e) { showErr('invErr', e); }
  };

  P.auth_passwort = function (params) {
    return shell(U.card('Neues Passwort', `<form class="form" data-submit="reset" data-arg="${esc(params[0] || '')}">${err('resetErr')}
      ${field('Neues Passwort', input('', { type: 'password', attrs: 'name="password" required autocomplete="new-password"' }), { hint: 'mindestens 10 Zeichen' })}
      <button class="btn primary" style="justify-content:center" type="submit">Speichern</button></form>`));
  };
  A.reset = async (token, form) => {
    try { await BX.api('POST', '/api/auth/reset/' + encodeURIComponent(token), { password: val(form, 'password') }); form.innerHTML = U.note('Passwort gespeichert. <a class="link" href="#/login">Jetzt anmelden</a>', 'ok', 'check'); }
    catch (e) { showErr('resetErr', e); }
  };

  // Öffentliche Preisliste (ohne Anmeldung, nur wenn eingeschaltet)
  let pub = null, pubCls = null;
  P.auth_preise = function () {
    if (!pub) {
      BX.api('GET', '/api/public/pricelist').then((d) => { pub = d; pubCls = d.classes[1] ? d.classes[1].id : d.classes[0] && d.classes[0].id; BX.render(); })
        .catch((e) => { pub = { error: e.message }; BX.render(); });
      return shell('<div class="empty">Lädt …</div>');
    }
    if (pub.error) return shell(U.note(esc(pub.error), 'warn'));
    const price = (it) => { if (it.classPrices && it.classPrices[pubCls] != null) return it.classPrices[pubCls]; const s = (it.surcharge && it.surcharge[pubCls]) || 0; return Math.round(it.price * (1 + s / 100) * 100) / 100; };
    return `<div class="content" style="max-width:900px;margin:0 auto"><div class="row mb" style="justify-content:space-between"><div class="row">${BX.look.logoHtml('', pub.logo)}<div><b style="font-size:18px">${esc(pub.firm.name)}</b><div class="muted">${esc(pub.firm.address)} · Tel. ${esc(pub.firm.phone)}${pub.firm.hours ? ' · ' + esc(pub.firm.hours) : ''}</div></div></div>
      <div class="field" style="width:220px"><label>Fahrzeugklasse</label>${U.select(pub.classes.map((c) => [c.id, c.name]), pubCls, 'data-change="pub-class"')}</div></div>
      <div class="paper" style="max-width:none">${pub.categories.map((cg) => { const its = pub.items.filter((i) => i.cat === cg.id); if (!its.length) return ''; return `<div class="pl-cat"><h3>${esc(cg.name)}</h3>${its.map((it) => `<div class="pl-row"><div class="n">${esc(it.name)}${it.warranty ? `<small>${it.warranty} Tage Garantie</small>` : ''}</div><div class="p">${money(price(it))}${it.kind === 'labor' ? ' / Std' : ''}</div></div>`).join('')}</div>`; }).join('')}
      <p class="muted" style="margin-top:22px;font-size:12px">Alle Preise sind Endpreise. Stand: ${new Date().toLocaleDateString('de-DE')}.</p></div></div>`;
  };
  A['pub-class'] = (v) => { pubCls = v; BX.render(); };
})();
