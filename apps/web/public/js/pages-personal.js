/* Boxenstopp – Seiten: Dienstplan, Schulungen, Lizenzen, Qualifikationen, Personalakten, Schwarzes Brett */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = BX.pages;
  const A = BX.actions;
  const { esc, date, icon, table, card, kpi, pageHead, btn, badge, person, avatar, note } = U;
  const lvl = (m) => D.me.levels[m] || 0;
  const activeStaff = () => D.staff.filter((s) => s.rank && ['active', 'leave'].includes(s.status));
  const staffOpts = () => activeStaff().map((s) => [s.id, s.name]);

  // ---------- Dienstplan ----------
  A.absence = () => BX.form({ title: 'Abwesenheit melden', fields: [
    ...(lvl('shifts') >= 3 ? [{ name: 'user', label: 'Mitarbeiter', type: 'select', options: staffOpts(), value: D.me.id }] : []),
    { name: 'kind', label: 'Art', type: 'select', options: ['Urlaub', 'Krank', 'Abgemeldet', 'Inaktiv'], value: 'Urlaub' }, { name: 'from', label: 'Von', type: 'date', value: D.TODAY, required: true }, { name: 'to', label: 'Bis', type: 'date', value: D.addDays(D.TODAY, 3), required: true }, { name: 'note', label: 'Notiz', full: true },
  ], submit: async (v) => { v.user = v.user || D.me.id; await BX.api('POST', '/api/r/absences', v); return 'Abwesenheit eingetragen'; } });
  A['del-absence'] = (id) => BX.confirm('Abwesenheit löschen', 'Wirklich löschen?', 'Löschen', () => BX.call('DELETE', '/api/r/absences/' + id, undefined, 'Gelöscht'));
  A['shift-manual'] = () => BX.form({ title: 'Schicht nachtragen', fields: [
    { name: 'user', label: 'Mitarbeiter', type: 'select', options: staffOpts(), value: D.me.id, full: true }, { name: 'from', label: 'Beginn', type: 'datetime-local', value: D.addDays(D.TODAY, -1) + 'T18:00', required: true }, { name: 'to', label: 'Ende', type: 'datetime-local', value: D.addDays(D.TODAY, -1) + 'T22:00', required: true }, { name: 'reason', label: 'Grund', required: true, full: true, ph: 'z. B. vergessen einzustempeln' },
  ], submit: async (v) => { await BX.api('POST', '/api/shifts', v); return 'Schicht nachgetragen'; } });
  A['del-shift'] = (id) => BX.confirm('Schicht löschen', 'Die Stunden fallen aus Aktivität und Lohn heraus.', 'Löschen', () => BX.call('DELETE', '/api/shifts/' + id, undefined, 'Gelöscht'));
  P.dienstplan = function (params, q) {
    const tab = q.tab || 'jetzt';
    const own = lvl('shifts') === 1;
    const onMe = !!D.onDuty[D.me.id];
    const head = pageHead('Dienstplan', 'Stempeluhr, Dienstzeiten und Abwesenheiten', btn('Abwesenheit melden', { icon: 'cal', action: 'absence' }) + (lvl('shifts') >= 3 ? btn('Nachtragen', { icon: 'plus', action: 'shift-manual' }) : '') + (U.user(D.me.id).rank ? btn(onMe ? 'Dienst beenden' : 'Dienst beginnen', { cls: 'primary', icon: 'clock', action: 'duty' }) : ''));
    const tabsHtml = U.tabs('#/dienstplan', [['jetzt', 'Jetzt im Dienst', Object.keys(D.onDuty).length]].concat(own ? [] : [['aktivitaet', 'Aktivität']]).concat([['schichten', own ? 'Meine Schichten' : 'Schichten'], ['abwesend', 'Abwesenheiten', D.absences.length]]), tab);
    if (tab === 'jetzt') {
      const cards = activeStaff().map((s) => {
        const on = D.onDuty[s.id];
        const abs = D.absences.find((a) => a.user === s.id && a.from <= D.TODAY && a.to >= D.TODAY);
        const act = D.activity[s.id];
        return `<div class="card" style="padding:14px"><div class="row">${avatar(s, 'lg')}<div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(U.rank(s.rank).name)} · Dienstnr. ${esc(s.dutyNo || '–')}</div></div></div><div class="row between mt">${on ? badge('im Dienst seit ' + on, 'ok', true) : abs ? badge(abs.kind + ' bis ' + U.shortDate(abs.to), 'warn', true) : s.status === 'leave' ? badge('beurlaubt', 'warn', true) : badge('außer Dienst', '', true)}${act ? `<span class="muted" style="font-size:12px">${act[3]} h diese Woche</span>` : ''}</div></div>`;
      }).join('');
      return head + tabsHtml + `<div class="grid g-4">${cards}</div>`;
    }
    if (tab === 'aktivitaet') {
      const wk = D.activityWeeks;
      const rows = Object.entries(D.activity).map(([uid, a]) => { const s = U.user(uid); const ab = D.absences.find((x) => x.user === uid); return { _dim: s.status === 'left', p: person(s, (U.rank(s.rank) || {}).name), w1: a[0] + ' h', w2: a[1] + ' h', w3: a[2] + ' h', w4: `<b>${a[3]} h</b>`, sp: U.spark(a, D.activityWeeks), abs: (ab ? badge(ab.kind, 'warn') : '') + (s.status === 'left' ? badge('ausgeschieden', '') : s.status === 'leave' ? badge('beurlaubt', 'warn') : '') }; }).sort((x, y) => 0);
      return head + tabsHtml + note('Es gibt keine Mindeststundenzahl – die Übersicht zeigt nur die Stunden, daneben Abwesenheiten.', 'info') + `<div class="mt">${card('Dienststunden je Woche', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'w1', label: wk[0], num: true }, { key: 'w2', label: wk[1], num: true }, { key: 'w3', label: wk[2], num: true }, { key: 'w4', label: wk[3] + ' (laufend)', num: true }, { key: 'sp', label: 'Verlauf' }, { key: 'abs', label: '' }], rows), { flush: true })}</div>`;
    }
    if (tab === 'schichten') {
      const rows = D.shifts.map((s) => ({ p: own ? '' : person(U.user(s.user)), f: date(s.from), t: s.to ? date(s.to) : badge('läuft', 'ok', true), h: s.h.toLocaleString('de-DE') + ' h', s: s.source === 'manual' ? badge('Nachtrag: ' + s.reason, 'warn') : badge('Stempeluhr', ''), x: lvl('shifts') >= 4 && s.to ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-shift', arg: s.id }) : '' }));
      const cols = [{ key: 'f', label: 'Beginn' }, { key: 't', label: 'Ende' }, { key: 'h', label: 'Stunden', num: true }, { key: 's', label: 'Quelle' }, { key: 'x', label: '' }];
      return head + tabsHtml + card('', table(own ? cols : [{ key: 'p', label: 'Mitarbeiter' }].concat(cols), rows, { empty: 'Keine Schichten in den letzten 45 Tagen' }), { flush: true, foot: 'Schichten über 24 Stunden lassen sich nicht ausstempeln, nur nachtragen.' });
    }
    return head + tabsHtml + card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'k', label: 'Art' }, { key: 'z', label: 'Zeitraum' }, { key: 'n', label: 'Notiz' }, { key: 'x', label: '' }], D.absences.map((a) => ({ p: person(U.user(a.user)), k: badge(a.kind, 'warn'), z: `${date(a.from)} – ${date(a.to)}`, n: esc(a.note), x: lvl('shifts') >= 4 || a.user === D.me.id ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-absence', arg: a.id }) : '' })), { empty: 'Keine Abwesenheiten' }), { flush: true });
  };

  // ---------- Schulungen ----------
  const trFields = (t = {}) => [{ name: 'name', label: 'Name', value: t.name, required: true }, { name: 'months', label: 'Gültigkeit (Monate, leer = unbefristet)', type: 'number', value: t.months }, { name: 'desc', label: 'Beschreibung', type: 'textarea', value: t.desc, full: true }, { name: 'test', label: 'Mit Test', type: 'checkbox', value: t.test, hint: 'Der Test im Tool folgt in einer späteren Version' }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: t.active !== false }];
  A['new-training'] = () => BX.form({ title: 'Neue Schulung', fields: trFields(), submit: async (v) => { v.months = v.months || null; await BX.api('POST', '/api/r/trainings', v); return 'Schulung angelegt'; } });
  A['edit-training'] = (id) => BX.form({ title: 'Schulung bearbeiten', fields: trFields(U.training(id)), submit: async (v) => { v.months = v.months || null; await BX.api('PATCH', '/api/r/trainings/' + id, v); return 'Gespeichert'; } });
  A['new-session'] = (tid) => BX.form({ title: 'Neuer Termin', fields: [
    { name: 'training', label: 'Schulung', type: 'select', options: D.trainings.filter((t) => t.active).map((t) => [t.id, t.name]), value: tid, full: true }, { name: 'date', label: 'Datum', type: 'date', value: D.addDays(D.TODAY, 3), required: true }, { name: 'time', label: 'Zeit', value: '19:00' },
    { name: 'loc', label: 'Ort', value: '' }, { name: 'trainer', label: 'Ausbilder', type: 'select', options: staffOpts(), value: D.me.id }, { name: 'users', label: 'Teilnehmer gleich eintragen', type: 'multi', options: staffOpts(), value: [], full: true },
  ], submit: async (v) => { const users = v.users; delete v.users; const r = await BX.api('POST', '/api/r/sessions', v); if (users.length) await BX.api('POST', `/api/sessions/${r.id}/participants`, { users }); return 'Termin angelegt'; } });
  A['session-reg'] = (arg) => { const [id, on] = arg.split(':'); return BX.call('POST', `/api/sessions/${id}/register`, { on: on === '1' }, on === '1' ? 'Angemeldet' : 'Abgemeldet'); };
  A.results = (id) => {
    const s = U.byId(D.sessions, id);
    const t = U.training(s.training);
    BX.form({ title: `Ergebnisse · ${t.name} · ${date(s.date)}`, intro: note('„Bestanden“ erzeugt einen Nachweis mit der Gültigkeit der Schulung. Der Termin gilt danach als abgeschlossen.', 'info'),
      fields: s.participants.map((p) => ({ name: 'r_' + p.user, label: (U.user(p.user) || {}).name, type: 'select', options: [['registered', 'angemeldet'], ['passed', 'bestanden'], ['failed', 'nicht bestanden'], ['no_show', 'nicht erschienen']], value: p.result === 'registered' ? 'passed' : p.result }))
        .concat([{ name: 'add', label: 'Weitere Teilnehmer', type: 'multi', options: staffOpts().filter(([u]) => !s.participants.some((p) => p.user === u)), value: [], full: true }]),
      submit: async (v) => { const results = {}; s.participants.forEach((p) => { results[p.user] = v['r_' + p.user]; }); v.add.forEach((u) => { results[u] = 'passed'; }); await BX.api('POST', `/api/sessions/${id}/results`, { results }); return 'Ergebnisse gespeichert'; } });
  };
  A['add-cert'] = () => BX.form({ title: 'Nachweis eintragen', fields: [{ name: 'user', label: 'Mitarbeiter', type: 'select', options: staffOpts() }, { name: 'training', label: 'Schulung', type: 'select', options: D.trainings.map((t) => [t.id, t.name]) }, { name: 'from', label: 'Bestanden am', type: 'date', value: D.TODAY }], submit: async (v) => { await BX.api('POST', '/api/certificates', v); return 'Nachweis eingetragen'; } });
  A['del-cert'] = (arg) => { const [u, t] = arg.split(':'); BX.confirm('Nachweis entfernen', 'Alle Nachweise dieser Schulung für diese Person werden entfernt.', 'Entfernen', () => BX.call('DELETE', `/api/certificates?user=${u}&training=${t}`, undefined, 'Entfernt')); };
  P.schulungen = function (params, q) {
    const tab = q.tab || 'uebersicht';
    const own = lvl('trainings') === 1;
    const canW = lvl('trainings') >= 3;
    const head = pageHead('Schulungen', own ? 'Du siehst Termine und meldest dich selbst an.' : 'Schulungen, Termine und Nachweise', (canW ? btn('Neuer Termin', { icon: 'cal', action: 'new-session' }) + btn('Nachweis', { icon: 'check', action: 'add-cert' }) : '') + (lvl('trainings') >= 4 ? btn('Neue Schulung', { cls: 'primary', icon: 'plus', action: 'new-training' }) : ''));
    const upcoming = D.sessions.filter((s) => !s.done && s.date >= D.TODAY);
    const tabsHtml = U.tabs('#/schulungen', [['uebersicht', 'Schulungen', D.trainings.length], ['termine', 'Termine', upcoming.length]].concat(own ? [['meine', 'Meine Nachweise']] : [['nachweise', 'Nachweise']]), tab);
    if (tab === 'uebersicht') {
      return head + tabsHtml + `<div class="grid g-3">${D.trainings.map((t) => {
        const holders = Object.values(D.certs).filter((m) => m[t.id] !== undefined && (m[t.id] === null || U.daysUntil(m[t.id]) >= 0)).length;
        const next = upcoming.filter((s) => s.training === t.id).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
        const reqBy = Object.entries(D.rankReq).filter(([, l]) => l.includes(t.id)).map(([r]) => (U.rank(r) || {}).name);
        const mine = next && next.participants.some((p) => p.user === D.me.id);
        return card(esc(t.name) + (t.active ? '' : ' ' + badge('inaktiv', '')), `<p class="muted">${esc(t.desc)}</p><div class="row">${badge(t.months ? t.months + ' Monate gültig' : 'unbefristet', '')}${t.test ? badge('mit Test', 'violet') : ''}${reqBy.length ? badge('Pflicht: ' + reqBy.join(', '), 'accent') : ''}</div><hr>${own ? '' : `<div class="row between"><span class="muted">Gültige Nachweise</span><b>${holders}</b></div>`}<div class="row between" style="margin-top:6px"><span class="muted">Nächster Termin</span><b>${next ? date(next.date) + ' ' + esc(next.time) : '–'}</b></div>`,
          { actions: (next ? btn(mine ? 'Abmelden' : 'Anmelden', { cls: 'sm' + (mine ? '' : ' primary'), action: 'session-reg', arg: next.id + ':' + (mine ? '0' : '1') }) : '') + (lvl('trainings') >= 4 ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-training', arg: t.id }) : '') });
      }).join('')}</div>`;
    }
    if (tab === 'termine') {
      const rows = D.sessions.map((s) => { const mine = s.participants.some((p) => p.user === D.me.id); const past = s.done || s.date < D.TODAY; return { _dim: past, t: `<b>${esc((U.training(s.training) || {}).name)}</b>`, d: date(s.date) + ' ' + esc(s.time), o: esc(s.loc), tr: person(U.user(s.trainer)), p: own ? (mine ? badge('angemeldet', 'ok') : '–') : `<span class="avatars">${s.participants.map((p) => avatar(U.user(p.user), 'sm')).join('')}</span> <span class="muted">${s.participants.length}</span>`, s: s.done ? badge('abgeschlossen', 'ok') : past ? badge('Ergebnisse fehlen', 'warn') : badge('geplant', 'info'), a: s.done ? '' : canW ? btn('Ergebnisse', { cls: 'sm', action: 'results', arg: s.id }) : !past ? btn(mine ? 'Abmelden' : 'Anmelden', { cls: 'sm', action: 'session-reg', arg: s.id + ':' + (mine ? '0' : '1') }) : '' }; });
      return head + tabsHtml + card('', table([{ key: 't', label: 'Schulung' }, { key: 'd', label: 'Termin' }, { key: 'o', label: 'Ort' }, { key: 'tr', label: 'Ausbilder' }, { key: 'p', label: own ? 'Du' : 'Teilnehmer' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }], rows, { empty: 'Keine Termine' }), { flush: true });
    }
    const rows = [];
    Object.entries(D.certs).forEach(([u, m]) => Object.entries(m).forEach(([t, until]) => { const v = U.validity(until); const src = D.certSources[u + ':' + t] || ''; rows.push({ _dim: (U.user(u) || {}).status === 'left', p: person(U.user(u)), t: esc((U.training(t) || {}).name), s: badge(v.label, v.tone, true), src: U.chip(src.startsWith('session') ? 'Termin' : 'von Hand'), x: lvl('trainings') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-cert', arg: u + ':' + t }) : '' }); }));
    return head + tabsHtml + card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 't', label: 'Schulung' }, { key: 's', label: 'Gültigkeit' }, { key: 'src', label: 'Quelle' }, { key: 'x', label: '' }], rows, { empty: 'Keine Nachweise' }), { flush: true });
  };

  // ---------- Lizenzen ----------
  const licFields = (l = {}) => {
    const t = l.type ? U.ltype(l.type) : null;
    return [
      { name: 'type', label: 'Lizenzart', type: 'select', options: D.licenseTypes.map((x) => [x.id, x.name + (x.holder === 'firm' ? ' (Firma)' : '')]), value: l.type }, { name: 'user', label: 'Inhaber (leer = Firma)', type: 'select', options: [['', '– Firma –']].concat(staffOpts()), value: l.user || (t && t.holder === 'firm' ? '' : '') },
      { name: 'no', label: 'Nummer', value: l.no, mono: true }, { name: 'issuer', label: 'Aussteller', value: l.issuer || 'Stadtverwaltung' }, { name: 'issued', label: 'Ausgestellt', type: 'date', value: l.issued || D.TODAY }, { name: 'expires', label: 'Läuft ab (leer = Standard-Gültigkeit)', type: 'date', value: l.expires },
      ...(l.id ? [{ name: 'status', label: 'Status', type: 'select', options: [['valid', 'gültig'], ['suspended', 'gesperrt'], ['revoked', 'entzogen']], value: l.status }, { name: 'reason', label: 'Begründung', value: l.reason, full: true }] : []),
    ];
  };
  const addMonths = (iso, m) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + Number(m)); return d.toISOString().slice(0, 10); };
  const licBody = (v) => { const t = U.ltype(v.type); v.user = v.user || null; if (!v.expires) v.expires = t && t.months ? addMonths(v.issued, t.months) : null; if (v.reason === '') v.reason = null; return v; };
  A['new-license'] = () => BX.form({ title: 'Neue Lizenz', fields: licFields(), submit: async (v) => { await BX.api('POST', '/api/r/licenses', licBody(v)); return 'Lizenz eingetragen'; } });
  A['edit-license'] = (id) => BX.form({ title: 'Lizenz bearbeiten', fields: licFields(U.byId(D.licenses, id)), submit: async (v) => { await BX.api('PATCH', '/api/r/licenses/' + id, licBody(v)); return 'Gespeichert'; } });
  A['extend-license'] = (id) => BX.call('POST', `/api/licenses/${id}/extend`, {}, 'Verlängert');
  const ltFields = (t = {}) => [{ name: 'name', label: 'Name', value: t.name, required: true }, { name: 'holder', label: 'Inhaber', type: 'select', options: [['member', 'Mitarbeiter'], ['firm', 'Firma']], value: t.holder || 'member' }, { name: 'months', label: 'Standard-Gültigkeit (Monate)', type: 'number', value: t.months }];
  A['new-ltype'] = () => BX.form({ title: 'Neue Lizenzart', fields: ltFields(), submit: async (v) => { v.months = v.months || null; await BX.api('POST', '/api/r/licenseTypes', v); return 'Angelegt'; } });
  A['edit-ltype'] = (id) => BX.form({ title: 'Lizenzart', fields: ltFields(U.ltype(id)), submit: async (v) => { v.months = v.months || null; await BX.api('PATCH', '/api/r/licenseTypes/' + id, v); return 'Gespeichert'; } });
  P.lizenzen = function (params, q) {
    const tab = q.tab || 'mitarbeiter';
    const canW = lvl('licenses') >= 3;
    const head = pageHead('Lizenzen', 'Scheine der Mitarbeiter und der Firma', canW ? btn('Neue Lizenz', { cls: 'primary', icon: 'plus', action: 'new-license' }) : '');
    const tabsHtml = U.tabs('#/lizenzen', [['mitarbeiter', 'Mitarbeiter', D.licenses.filter((l) => l.user).length], ['firma', 'Firma', D.licenses.filter((l) => !l.user).length], ['arten', 'Lizenzarten', D.licenseTypes.length]], tab);
    const LS = { suspended: ['Gesperrt', 'bad'], revoked: ['Entzogen', 'bad'] };
    const row = (l) => { const v = U.validity(l.expires || null); const st = LS[l.status] ? badge(LS[l.status][0], LS[l.status][1], true) : badge(l.expires ? v.label : 'unbefristet', v.tone, true); return { _dim: l.status === 'revoked', t: `<b>${esc((U.ltype(l.type) || {}).name)}</b>${l.reason ? `<span class="sub">${esc(l.reason)}</span>` : ''}`, h: l.user ? person(U.user(l.user)) : badge(D.firm.name, 'accent'), n: `<span class="mono">${esc(l.no)}</span>`, i: esc(l.issuer), d: date(l.issued), e: date(l.expires), s: st, a: canW ? `<div class="row" style="gap:2px;flex-wrap:nowrap">${l.status === 'valid' ? btn('Verlängern', { cls: 'sm', action: 'extend-license', arg: l.id }) : ''}${btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-license', arg: l.id })}</div>` : '' }; };
    const cols = [{ key: 't', label: 'Lizenz' }, { key: 'h', label: 'Inhaber' }, { key: 'n', label: 'Nummer' }, { key: 'i', label: 'Aussteller' }, { key: 'd', label: 'Ausgestellt' }, { key: 'e', label: 'Ablauf' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }];
    if (tab === 'mitarbeiter') return head + tabsHtml + card('', table(cols, D.licenses.filter((l) => l.user).map(row), { empty: 'Keine Lizenzen' }), { flush: true });
    if (tab === 'firma') return head + tabsHtml + note('Firmenlizenzen warnen 30 Tage vor Ablauf alle, die Lizenzen verwalten dürfen.', 'info') + `<div class="mt">${card('', table(cols, D.licenses.filter((l) => !l.user).map(row), { empty: 'Keine Firmenlizenzen' }), { flush: true })}</div>`;
    return head + tabsHtml + card('', table([{ key: 'n', label: 'Lizenzart' }, { key: 'h', label: 'Inhaber' }, { key: 'm', label: 'Standard-Gültigkeit' }, { key: 'u', label: 'Benötigt für' }, { key: 'x', label: '' }], D.licenseTypes.map((t) => ({ n: `<b>${esc(t.name)}</b>`, h: t.holder === 'member' ? 'Mitarbeiter' : 'Firma', m: t.months ? t.months + ' Monate' : 'unbefristet', u: D.catalog.filter((i) => i.req.includes(t.id)).map((i) => U.chip(i.name)).join(' ') || '–', x: lvl('licenses') >= 4 ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-ltype', arg: t.id }) : '' }))), { flush: true, actions: lvl('licenses') >= 4 ? btn('Neue Lizenzart', { cls: 'sm', icon: 'plus', action: 'new-ltype' }) : '' });
  };

  // ---------- Qualifikationen ----------
  A['promote-rank'] = (v) => { location.hash = '#/qualifikationen?rank=' + v; };
  P.qualifikationen = function (params, q) {
    const staff = activeStaff();
    const cols = D.trainings.filter((t) => t.active).map((t) => ['t', t]).concat(D.licenseTypes.filter((l) => l.holder === 'member').map((l) => ['l', l]));
    const ranksWithReq = D.ranks.filter((r) => D.rankReq[r.id] && D.rankReq[r.id].length);
    const promoteTo = q.rank || (ranksWithReq[ranksWithReq.length - 1] || {}).id;
    let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Mitarbeiter</th>${cols.map(([k, c]) => `<th style="min-width:96px">${esc(c.name)}${k === 'l' ? '<br><span class="faint" style="text-transform:none;font-weight:500">Lizenz</span>' : ''}</th>`).join('')}</tr></thead><tbody>`;
    staff.forEach((s) => {
      const req = D.rankReq[s.rank] || [];
      t += `<tr><td>${person(s, U.rank(s.rank).name)}</td>${cols.map(([k, c]) => {
        let v;
        if (k === 't') v = U.validity(D.certs[s.id] ? D.certs[s.id][c.id] : undefined);
        else { const l = D.licenses.find((x) => x.user === s.id && x.type === c.id && x.status !== 'revoked'); v = !l ? U.validity(undefined) : l.status !== 'valid' ? { cls: 'bad', label: 'Gesperrt' } : U.validity(l.expires || null); }
        return `<td title="${esc(v.label)}"><span class="qdot ${v.cls} ${req.includes(c.id) ? 'req' : ''}"></span></td>`;
      }).join('')}</tr>`;
    });
    t += '</tbody></table></div>';
    const legend = `<div class="legend mt"><span><span class="qdot ok"></span>gültig</span><span><span class="qdot warn"></span>läuft in 30 Tagen ab</span><span><span class="qdot bad"></span>abgelaufen / gesperrt</span><span><span class="qdot none"></span>fehlt</span><span><span class="qdot ok req"></span>Pflicht für den Rang</span></div>`;
    let promo = '';
    if (promoteTo) {
      const target = U.rank(promoteTo);
      const need = D.rankReq[promoteTo] || [];
      const cand = staff.filter((s) => U.rank(s.rank).pos < target.pos);
      promo = card('Beförderung prüfen', `<div class="row" style="padding:12px 16px"><span class="muted">Ziel-Rang</span><div style="width:220px">${U.select(ranksWithReq.map((r) => [r.id, r.name]), promoteTo, 'data-change="promote-rank"')}</div><span class="muted">Pflicht: ${need.map((n) => esc((U.training(n) || {}).name)).join(', ')}</span></div><div class="list">${cand.map((s) => { const miss = need.filter((tid) => { const c = D.certs[s.id] && D.certs[s.id][tid]; return c === undefined || (c !== null && U.daysUntil(c) < 0); }); return `<div class="list-item">${avatar(s)}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${esc(U.rank(s.rank).name)}</div></div>${miss.length ? `<div class="chips">${miss.map((m) => `<span class="badge bad">fehlt: ${esc((U.training(m) || {}).name)}</span>`).join('')}</div>` : badge('erfüllt alle Pflichten', 'ok', true)}</div>`; }).join('') || '<div class="empty">Niemand unter diesem Rang</div>'}</div>`, { flush: true });
    }
    return pageHead('Qualifikationen', 'Wer darf was? Pflichtqualifikationen des Rangs sind umrandet. Pflichten legst du unter Ränge & Gruppen fest.', '') + card('', t + `<div style="padding:0 16px 14px">${legend}</div>`, { flush: true }) + `<div class="mt">${promo}</div>`;
  };

  // ---------- Personalakten ----------
  const KIND = { Verwarnung: 'bad', Belobigung: 'ok', Gespräch: 'info', Beförderung: 'accent', Degradierung: 'warn', Vermerk: '', Austritt: '' };
  A['new-entry'] = (uid) => BX.form({ title: 'Neuer Eintrag · ' + U.user(uid).name, fields: [
    { name: 'kind', label: 'Art', type: 'select', options: ['Vermerk', 'Verwarnung', 'Belobigung', 'Gespräch'], value: 'Vermerk' }, { name: 'level', label: 'Stufe (bei Verwarnung)', type: 'number', min: 1, max: 3 }, { name: 'date', label: 'Datum', type: 'date', value: D.TODAY }, { name: 'expires', label: 'Läuft ab (optional)', type: 'date' },
    { name: 'text', label: 'Text', type: 'textarea', required: true, full: true }, { name: 'self', label: 'Für den Mitarbeiter sichtbar', type: 'checkbox', value: true },
  ], submit: async (v) => { await BX.api('POST', '/api/r/staffEntries', { ...v, user: uid, level: v.level || null, expires: v.expires || null }); return 'Eintrag gespeichert'; } });
  A['del-entry'] = (id) => BX.confirm('Eintrag löschen', 'Wirklich löschen? Das steht im Audit-Log.', 'Löschen', () => BX.call('DELETE', '/api/r/staffEntries/' + id, undefined, 'Gelöscht'));
  P.personalakten = function (params, q) {
    const people = D.staff.filter((x) => x.rank);
    const sel = q.u || (people[0] || {}).id;
    const s = U.user(sel);
    if (!s) return pageHead('Personalakten', 'Keine Mitarbeiter', '');
    const entries = D.staffEntries.filter((e) => e.user === sel);
    const list = people.map((x) => `<a class="list-item" href="#/personalakten?u=${x.id}" style="${x.id === sel ? 'background:var(--accent-soft)' : ''}">${avatar(x)}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">${esc(U.rank(x.rank).name)} · ${esc(x.staffNo)}${x.status === 'left' ? ' · ausgeschieden' : ''}</div></div>${D.staffEntries.filter((e) => e.user === x.id).length ? `<span class="badge">${D.staffEntries.filter((e) => e.user === x.id).length}</span>` : ''}</a>`).join('');
    const tl = entries.map((e) => `<div class="tl-item"><div class="when">${date(e.date)} · ${esc((U.user(e.author) || {}).name || '')}</div><div class="what">${badge(e.kind + (e.level ? ' · Stufe ' + e.level : ''), KIND[e.kind] || '')} ${e.self ? '<span class="faint" style="font-size:12px">für Mitarbeiter sichtbar</span>' : `<span class="faint" style="font-size:12px">${icon('lock', 'width="11" height="11"')} nur Leitung</span>`} ${lvl('stafffiles') >= 4 ? `<button class="btn sm ghost" data-action="del-entry" data-arg="${e.id}">${icon('trash')}</button>` : ''}</div><div style="margin-top:4px">${U.md(e.text)}</div>${e.expires ? `<div class="muted" style="font-size:12px">läuft ab am ${date(e.expires)}</div>` : ''}</div>`).join('');
    const rh = (D.rankHistory || []).filter((h) => h.user === sel).map((h) => `<div class="list-item" style="padding:6px 0"><div class="grow">${esc(h.from || '–')} → <b>${esc(h.to)}</b>${h.reason ? `<div class="meta">${esc(h.reason)}</div>` : ''}</div><span class="muted">${date(h.date)}</span></div>`).join('') + `<div class="list-item" style="padding:6px 0"><div class="grow">Eintritt</div><span class="muted">${date(s.joined)}</span></div>`;
    return pageHead('Personalakten', 'Vermerke, Verwarnungen, Belobigungen und Rang-Historie · nur mit Recht „Personalakten“', '') +
      `<div class="grid" style="grid-template-columns:300px 1fr">${card('', `<div class="list">${list}</div>`, { flush: true })}
      <div class="stack">${card(`${avatar(s)} ${esc(s.name)}`, `<div class="grid g-4">${[['Rang', U.rank(s.rank).name], ['Personalnr.', s.staffNo], ['Eintritt', date(s.joined)], ['Status', U.userStatus[s.status][0]]].map(([k, v]) => `<div><div class="muted" style="font-size:12px">${k}</div><b>${esc(v)}</b></div>`).join('')}</div>`, { actions: lvl('stafffiles') >= 3 ? btn('Neuer Eintrag', { cls: 'primary sm', icon: 'plus', action: 'new-entry', arg: s.id }) : '' })}
      <div class="grid g-2">${card('Einträge', entries.length ? `<div class="timeline">${tl}</div>` : '<div class="empty">Keine Einträge</div>')}${card('Rang-Historie', rh)}</div></div></div>`;
  };

  // ---------- Schwarzes Brett ----------
  const postFields = (p = {}) => [{ name: 'title', label: 'Titel', value: p.title, required: true, full: true }, { name: 'body', label: 'Text (**fett** möglich)', type: 'textarea', value: p.text, full: true }, { name: 'pinned', label: 'Anheften', type: 'checkbox', value: p.pinned }];
  A['new-post'] = () => BX.form({ title: 'Neue Ankündigung', cols: 1, fields: postFields().concat([{ name: 'notify', label: 'Alle benachrichtigen', type: 'checkbox', value: true }]), submit: async (v) => { const n = v.notify; delete v.notify; const r = await BX.api('POST', '/api/r/boardPosts', v); if (n) await BX.api('POST', `/api/board/${r.id}/announce`); return 'Veröffentlicht'; } });
  A['edit-post'] = (id) => BX.form({ title: 'Ankündigung bearbeiten', cols: 1, fields: postFields(U.byId(D.boardPosts, id)), submit: async (v) => { await BX.api('PATCH', '/api/r/boardPosts/' + id, v); return 'Gespeichert'; } });
  A['del-post'] = (id) => BX.confirm('Ankündigung löschen', 'Wirklich löschen?', 'Löschen', () => BX.call('DELETE', '/api/r/boardPosts/' + id, undefined, 'Gelöscht'));
  A['read-post'] = (id) => BX.call('POST', `/api/board/${id}/read`, {}, 'Als gelesen markiert');
  P.brett = function () {
    return pageHead('Schwarzes Brett', 'Ankündigungen der Leitung mit Lesebestätigung', lvl('board') >= 3 ? btn('Neue Ankündigung', { cls: 'primary', icon: 'plus', action: 'new-post' }) : '') +
      `<div class="stack">${D.boardPosts.map((p) => card(`${p.pinned ? icon('pin', 'width="14" height="14" style="color:var(--accent);vertical-align:-2px"') + ' ' : ''}${esc(p.title)}`, `<p>${U.md(p.text)}</p><div class="row between mt"><span class="person">${avatar(U.user(p.author), 'sm')} <span class="muted">${esc((U.user(p.author) || {}).name || '')} · ${date(p.date)}</span></span><div class="row" style="min-width:220px">${U.bar(p.reads / Math.max(1, D.activeStaffCount) * 100, 'ok')}<span class="muted nowrap">gelesen ${p.reads}/${D.activeStaffCount}</span></div></div>`,
        { actions: (p.readByMe ? badge('gelesen', 'ok') : btn('Gelesen', { cls: 'sm', icon: 'check', action: 'read-post', arg: p.id })) + (lvl('board') >= 3 ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-post', arg: p.id }) : '') + (lvl('board') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-post', arg: p.id }) : '') })).join('') || card('', '<div class="empty">Noch keine Ankündigungen</div>')}</div>`;
  };
})();
