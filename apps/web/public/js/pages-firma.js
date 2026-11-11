/* Boxenstopp – Seiten: Mitarbeiter, Ränge & Gruppen, Berechtigungen, Firmen-Einstellungen, Administration, Konto */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = BX.pages;
  const A = BX.actions;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, person, avatar, note, toggle } = U;
  const lvl = (m) => D.me.levels[m] || 0;
  const sys = (p) => D.me.sys.includes(p);
  const flag = (k) => D.me.flags[k];
  const myPos = () => (D.me.owner ? Infinity : (U.rank(U.user(D.me.id).rank) || { pos: 0 }).pos);
  const ranksDesc = () => D.ranks.slice().sort((a, b) => b.pos - a.pos);
  const payText = (p) => { p = p || {}; const parts = []; if (+p.fixed) parts.push(`Fixum ${money(p.fixed)} / Woche`); if (+p.hourly) parts.push(`${money(p.hourly)} / h`); if (+p.commission) parts.push(`${p.commission} % Provision`); return parts.join(' + ') || 'kein Lohn'; };

  // ================= Mitarbeiter =================
  A['edit-staff'] = (id) => {
    const s = U.user(id);
    const r = U.rank(s.rank) || {};
    const pm = s.payModel || {};
    BX.form({ title: 'Mitarbeiter · ' + s.name, wide: true, fields: [
      { name: 'rank', label: 'Rang', type: 'select', options: ranksDesc().filter((x) => x.pos < myPos() || x.id === s.rank).map((x) => [x.id, x.name]), value: s.rank }, { name: 'reason', label: 'Grund bei Rangwechsel', ph: 'z. B. Prüfung bestanden' },
      { name: 'groups', label: 'Gruppen', type: 'multi', options: D.groups.map((g) => [g.id, g.name]), value: s.groups, full: true },
      { name: 'staffNo', label: 'Personalnummer', value: s.staffNo }, { name: 'dutyNo', label: 'Dienstnummer', value: s.dutyNo }, { name: 'phone', label: 'Telefon (RP)', value: s.phone }, { name: 'joined', label: 'Eintritt', type: 'date', value: s.joined },
      { name: 'status', label: 'Status', type: 'select', options: [['active', 'Aktiv'], ['leave', 'Beurlaubt'], ['left', 'Ausgeschieden']], value: ['active', 'leave', 'left'].includes(s.status) ? s.status : 'active', hint: 'Ausgeschiedene verlieren den Zugang, bleiben aber in der Historie' },
      ...(flag('personal.lohn_sehen') ? [{ name: 'html', type: 'html', full: true, html: `<hr><b>Lohnmodell</b> <span class="muted">· leer = vom Rang (${esc(payText(r.pay))})</span>` }, { name: 'hourly', label: 'Stundenlohn', type: 'number', step: '0.01', value: s.payModel ? pm.hourly : '' }, { name: 'commission', label: 'Provision %', type: 'number', step: '0.1', value: s.payModel ? pm.commission : '' }, { name: 'fixed', label: 'Fixum je Woche', type: 'number', step: '0.01', value: s.payModel ? pm.fixed : '' }] : []),
    ], submit: async (v) => {
      const body = { rank: v.rank, groups: v.groups, staffNo: v.staffNo, dutyNo: v.dutyNo, phone: v.phone, joined: v.joined, status: v.status };
      if (v.reason) body.reason = v.reason;
      if (flag('personal.lohn_sehen')) body.payModel = (v.hourly === null && v.commission === null && v.fixed === null) ? null : { hourly: v.hourly || 0, commission: v.commission || 0, fixed: v.fixed || 0 };
      await BX.api('PATCH', '/api/staff/' + id, body); return 'Gespeichert';
    } });
  };
  A['invite-staff'] = () => BX.form({ title: 'Mitarbeiter einladen', fields: [
    { name: 'name', label: 'Name', value: '' }, { name: 'email', label: 'E-Mail', type: 'email', required: true }, { name: 'rank', label: 'Rang', type: 'select', options: ranksDesc().filter((x) => x.pos < myPos()).map((x) => [x.id, x.name]), value: (ranksDesc()[ranksDesc().length - 1] || {}).id },
    { name: 'group', label: 'Gruppe', type: 'select', options: [['', 'keine']].concat(D.groups.map((g) => [g.id, g.name])) }, ...(sys('user:create') ? [{ name: 'role', label: 'Systemrolle', type: 'select', options: (D.systemRoles || [{ id: 'user', name: 'Benutzer' }]).map((r) => [r.id, r.name]), value: 'user' }] : []), { name: 'days', label: 'Link gültig (Tage)', type: 'number', value: 7, min: 1, max: 30 },
  ], intro: note('Du bekommst einen Link, den du der Person schickst (z. B. per Discord). Damit legt sie ihr Passwort fest.', 'info'),
  submit: async (v) => { v.group = v.group || null; const r = await BX.api('POST', '/api/staff/invite', v); setTimeout(() => showLink('Einladungslink', r.link)); return 'Einladung erstellt'; } });
  function showLink(title, path) {
    const url = location.origin + path;
    BX.openModal({ title, body: `<p>Diesen Link der Person schicken. Er funktioniert nur einmal.</p><input class="input mono" value="${esc(url)}" readonly>`, foot: `<button class="btn" data-action="modal-close">Schließen</button><button class="btn primary" data-action="copy" data-arg="${esc(url)}">Kopieren</button>` });
  }
  BX.showLink = showLink;
  A.copy = (t) => BX.copy(t);
  P.mitarbeiter = function () {
    const canW = lvl('staff') >= 3;
    const rows = D.staff.filter((s) => s.rank).map((s) => ({
      _dim: s.status === 'left', _filter: s.name + ' ' + s.staffNo,
      p: person(s, s.email), n: `<span class="mono">${esc(s.staffNo)}</span><span class="sub">Dienstnr. ${esc(s.dutyNo || '–')}</span>`, r: `<b>${esc(U.rank(s.rank).name)}</b>${s.owner ? ' ' + badge('Inhaber', 'accent') : ''}`,
      g: `<div class="chips">${s.groups.map((g) => U.chip((U.group(g) || {}).name)).join('') || '<span class="faint">–</span>'}</div>`,
      d: D.onDuty[s.id] ? badge('im Dienst', 'ok', true) : '<span class="faint">–</span>', s: badge(U.userStatus[s.status][0], U.userStatus[s.status][1], true), j: date(s.joined),
      a: `<div class="row" style="gap:2px;flex-wrap:nowrap">${canW && !s.owner && s.id !== D.me.id && (U.rank(s.rank).pos < myPos()) ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-staff', arg: s.id, title: 'Bearbeiten' }) : ''}${lvl('perms') >= 2 ? `<a class="btn sm ghost" href="#/berechtigungen?tab=wer&u=${s.id}" title="Was darf ${esc(s.name)}?">${icon('shield')}</a>` : ''}${lvl('stafffiles') >= 2 ? `<a class="btn sm ghost" href="#/personalakten?u=${s.id}" title="Personalakte">${icon('folder')}</a>` : ''}</div>`,
    }));
    return pageHead('Mitarbeiter', 'Fachliche Daten: Rang, Gruppen, Nummern, Lohnmodell. Den Zugang (Login, 2FA, Sperre) verwaltet das User-Management.', canW ? btn('Einladen', { cls: 'primary', icon: 'plus', action: 'invite-staff' }) : '') +
      card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Name oder Personalnummer …" data-action="filter" data-target="#staffTable"></div>` + table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'n', label: 'Personalnr.' }, { key: 'r', label: 'Rang' }, { key: 'g', label: 'Gruppen' }, { key: 'd', label: 'Dienst' }, { key: 's', label: 'Status' }, { key: 'j', label: 'Eintritt' }, { key: 'a', label: '' }], rows, { id: 'staffTable' }), { foot: 'Du bearbeitest nur Mitarbeiter unter deinem eigenen Rang.' });
  };

  // ================= Ränge & Gruppen =================
  const rankFields = (r) => [
    { name: 'name', label: 'Name', value: r && r.name, required: true },
    ...(r ? [] : [{ name: 'below', label: 'Position: direkt unter', type: 'select', options: ranksDesc().filter((x) => x.pos < myPos() + 1).map((x) => [x.id, x.name]), value: (ranksDesc().find((x) => x.pos < myPos()) || {}).id }, { name: 'template', label: 'Rechtevorlage', type: 'select', options: BX.TEMPLATES, value: 'Mechaniker' }]),
    { name: 'hourly', label: 'Stundenlohn', type: 'number', step: '0.01', value: r ? r.pay.hourly || 0 : 0 }, { name: 'commission', label: 'Provision %', type: 'number', step: '0.1', value: r ? r.pay.commission || 0 : 0 }, { name: 'fixed', label: 'Fixum je Woche', type: 'number', step: '0.01', value: r ? r.pay.fixed || 0 : 0 },
    { name: 'req', label: 'Pflichtschulungen', type: 'multi', options: D.trainings.map((t) => [t.id, t.name]), value: r ? D.rankReq[r.id] || [] : [], full: true },
  ];
  A['new-rank'] = () => BX.form({ title: 'Neuer Rang', fields: rankFields(null), submit: async (v) => { await BX.api('POST', '/api/ranks', { name: v.name, below: v.below, template: v.template, pay: { hourly: v.hourly || 0, commission: v.commission || 0, fixed: v.fixed || 0 }, req: v.req }); return 'Rang angelegt'; } });
  A['edit-rank'] = (id) => BX.form({ title: 'Rang bearbeiten', fields: rankFields(U.rank(id)), submit: async (v) => { await BX.api('PATCH', '/api/ranks/' + id, { name: v.name, pay: { hourly: v.hourly || 0, commission: v.commission || 0, fixed: v.fixed || 0 }, req: v.req }); return 'Gespeichert'; } });
  A['move-rank'] = (arg) => { const [id, dir] = arg.split(':'); return BX.call('POST', `/api/ranks/${id}/move`, { dir }); };
  A['del-rank'] = (id) => BX.confirm('Rang löschen', `„${esc(U.rank(id).name)}“ wird gelöscht. Geht nur ohne Mitglieder.`, 'Löschen', () => BX.call('DELETE', '/api/ranks/' + id, undefined, 'Rang gelöscht'));
  const groupFields = (g = {}) => [{ name: 'name', label: 'Name', value: g.name, required: true }, { name: 'desc', label: 'Beschreibung', value: g.desc }];
  A['new-group'] = () => BX.form({ title: 'Neue Gruppe', fields: groupFields(), submit: async (v) => { await BX.api('POST', '/api/r/groups', v); return 'Gruppe angelegt'; } });
  A['edit-group'] = (id) => BX.form({ title: 'Gruppe bearbeiten', fields: groupFields(U.group(id)), submit: async (v) => { await BX.api('PATCH', '/api/r/groups/' + id, v); return 'Gespeichert'; } });
  A['del-group'] = (id) => BX.confirm('Gruppe löschen', 'Mitglieder verlieren die Rechte dieser Gruppe.', 'Löschen', async () => { await BX.api('DELETE', `/api/groups/${id}/perms`); await BX.call('DELETE', '/api/r/groups/' + id, undefined, 'Gruppe gelöscht'); });
  P.raenge = function () {
    const canW = lvl('ranks') >= 4;
    const rk = ranksDesc();
    const ranks = rk.map((r, i) => {
      const n = D.staff.filter((s) => s.rank === r.id && s.status !== 'left').length;
      const req = (D.rankReq[r.id] || []).map((t) => U.chip((U.training(t) || {}).name)).join('');
      const mine = r.pos >= myPos();
      return `<div class="list-item">${canW ? `<div style="display:flex;flex-direction:column;gap:2px"><button class="btn sm ghost" ${i === 0 || mine || rk[i - 1].pos >= myPos() ? 'disabled' : ''} data-action="move-rank" data-arg="${r.id}:up">▲</button><button class="btn sm ghost" ${i === rk.length - 1 || mine ? 'disabled' : ''} data-action="move-rank" data-arg="${r.id}:down">▼</button></div>` : ''}<div class="grow"><div class="title">${esc(r.name)} <span class="muted" style="font-weight:400">· ${n} Mitglieder</span></div><div class="meta">${esc(payText(r.pay))}</div>${req ? `<div class="chips" style="margin-top:6px"><span class="faint" style="font-size:11.5px">Pflicht:</span>${req}</div>` : ''}</div>${lvl('perms') >= 2 ? `<a class="btn sm" href="#/berechtigungen">Rechte</a>` : ''}${canW && !mine ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-rank', arg: r.id }) + btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-rank', arg: r.id, disabled: n > 0, title: n ? 'Hat Mitglieder' : 'Löschen' }) : ''}</div>`;
    }).join('');
    const groups = D.groups.map((g) => { const m = D.staff.filter((s) => s.groups.includes(g.id) && s.status !== 'left'); return `<div class="list-item"><div class="grow"><div class="title">${esc(g.name)}</div><div class="meta">${esc(g.desc)}</div></div><span class="avatars">${m.map((s) => avatar(s, 'sm')).join('')}</span>${canW ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-group', arg: g.id }) + btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-group', arg: g.id }) : ''}</div>`; }).join('');
    return pageHead('Ränge & Gruppen', 'Jeder Mitarbeiter hat genau einen Rang und beliebig viele Gruppen. Mitglieder ordnest du unter „Mitarbeiter“ zu.', canW ? btn('Neue Gruppe', { icon: 'plus', action: 'new-group' }) + btn('Neuer Rang', { cls: 'primary', icon: 'plus', action: 'new-rank' }) : '') +
      `<div class="grid g-2">${card('Ränge', `<div class="list">${ranks}</div>`, { flush: true, sub: 'höchster oben', foot: 'Nicht-Inhaber verwalten nur Ränge und Mitarbeiter unter ihrem eigenen Rang.' })}${card('Gruppen', `<div class="list">${groups || '<div class="empty">Noch keine Gruppen</div>'}</div>`, { flush: true, sub: 'quer zu Rängen' })}</div>`;
  };

  // ================= Berechtigungen =================
  const lvlCell = (v, arg, locked) => `<span class="lvl lvl-${v} ${locked ? 'locked' : ''}" ${locked ? '' : `data-action="perm-cycle" data-arg="${arg}" role="button" tabindex="0"`} title="${locked ? 'nicht änderbar' : 'Klicken zum Ändern'}">${esc(U.levelNames[v])}</span>`;
  A['perm-cycle'] = async (arg) => {
    const [type, id, mod] = arg.split(':');
    let cur, next;
    if (type === 'rank') { cur = D.rankPerms[id][mod]; next = (cur + 1) % 5; }
    else { const src = type === 'group' ? D.groupPerms[id] : (D.userPerms[id] || {}); cur = src ? src[mod] : undefined; next = cur === undefined ? 0 : cur >= 4 ? null : cur + 1; }
    await BX.call('PUT', '/api/permissions', { type, id, module: mod, level: next });
  };
  A['add-override'] = () => BX.form({ title: 'Persönliche Ausnahme', fields: [{ name: 'user', label: 'Mitarbeiter', type: 'select', options: D.staff.filter((s) => s.rank && !s.owner && s.status !== 'left').map((s) => [s.id, s.name]) }, { name: 'module', label: 'Funktion', type: 'select', options: BX.MODULES }, { name: 'level', label: 'Stufe', type: 'select', options: U.levelNames.map((l, i) => [i, l]), value: 2 }],
    submit: async (v) => { await BX.api('PUT', '/api/permissions', { type: 'user', id: v.user, module: v.module, level: Number(v.level) }); return 'Ausnahme gespeichert'; } });
  A['del-override'] = (arg) => { const [id, mod] = arg.split(':'); return BX.call('PUT', '/api/permissions', { type: 'user', id, module: mod, level: null }, 'Ausnahme entfernt'); };
  A['edit-flags'] = (arg) => {
    const [type, id] = arg.split(':');
    const name = type === 'rank' ? U.rank(id).name : U.group(id).name;
    BX.form({ title: 'Einzelrechte · ' + name, cols: 1, intro: type === 'group' ? note('Leer = nicht gesetzt (es gilt der Rang). Gruppen heben nur an.', 'info') : '',
      fields: D.flags.map((f) => { const cur = (type === 'rank' ? f.ranks : f.groups)[id]; return f.type === 'percent' ? { name: f.key, label: f.label + ' (%)', type: 'number', min: 0, max: 100, value: cur ?? '' } : { name: f.key, label: f.label, type: 'select', options: [['', type === 'rank' ? 'nein' : 'nicht gesetzt'], ['1', 'ja'], ...(type === 'group' ? [['0', 'nein']] : [])], value: cur === undefined || cur === null ? '' : String(cur ? 1 : 0) }; }),
      submit: async (v) => { for (const f of D.flags) { const raw = v[f.key]; const val = raw === '' || raw === null ? (type === 'rank' ? 0 : null) : Number(raw); const cur = (type === 'rank' ? f.ranks : f.groups)[id]; if ((cur ?? null) !== val) await BX.api('PUT', '/api/flags', { type, id, flag: f.key, value: val }); } return 'Einzelrechte gespeichert'; } });
  };
  A['who-select'] = (v) => { location.hash = '#/berechtigungen?tab=wer&u=' + v; };
  P.berechtigungen = function (params, q) {
    const tab = q.tab || 'raenge';
    const canW = lvl('perms') >= 3;
    const head = pageHead('Berechtigungen', 'Stufen je Funktion für Ränge, Gruppen und einzelne Mitarbeiter. Es gilt das höchste Recht aus Rang und Gruppen; persönlich Gesetztes geht vor.', '');
    const tabsHtml = U.tabs('#/berechtigungen', [['raenge', 'Ränge'], ['gruppen', 'Gruppen'], ['personen', 'Persönlich', Object.values(D.userPerms || {}).reduce((s, m) => s + Object.keys(m).length, 0)], ['einzel', 'Einzelrechte'], ['wer', 'Was darf X?']], tab);
    const legend = `<div class="legend mb">${U.levelNames.map((l, i) => `<span><span class="lvl lvl-${i}" style="min-width:0">${esc(l)}</span></span>`).join('')}</div>`;
    const ownGroups = U.user(D.me.id).groups;
    if (tab === 'raenge') {
      const rk = ranksDesc();
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Funktion</th>${rk.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr></thead><tbody>`;
      BX.MODULES.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b></td>${rk.map((r) => `<td>${lvlCell(D.rankPerms[r.id][k], 'rank:' + r.id + ':' + k, !canW || (!D.me.owner && (r.pos >= myPos())))}</td>`).join('')}</tr>`; });
      return head + tabsHtml + legend + card('', t + '</tbody></table></div>', { flush: true, foot: 'Klicke eine Zelle, um die Stufe zu ändern. Niemand vergibt mehr, als er selbst hat; den eigenen Rang ändert jemand darüber. Inhaber dürfen immer alles.' });
    }
    if (tab === 'gruppen') {
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Funktion</th>${D.groups.map((g) => `<th>${esc(g.name)}</th>`).join('')}</tr></thead><tbody>`;
      BX.MODULES.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b></td>${D.groups.map((g) => { const v = D.groupPerms[g.id][k]; const locked = !canW || (!D.me.owner && ownGroups.includes(g.id)); return `<td>${v === undefined ? `<span class="lvl" style="color:var(--faint)" ${locked ? '' : `data-action="perm-cycle" data-arg="group:${g.id}:${k}" role="button" tabindex="0"`}>nicht gesetzt</span>` : lvlCell(v, 'group:' + g.id + ':' + k, locked)}</td>`; }).join('')}</tr>`; });
      return head + tabsHtml + legend + card('', t + '</tbody></table></div>', { flush: true, foot: 'Gruppen heben Rechte an („nicht gesetzt“ = es gilt der Rang). Zyklus: nicht gesetzt → Kein Zugriff → … → Verwalten → nicht gesetzt.' });
    }
    if (tab === 'personen') {
      const rows = Object.entries(D.userPerms || {}).flatMap(([u, m]) => Object.entries(m).map(([k, v]) => ({ p: person(U.user(u), (U.rank(U.user(u).rank) || {}).name), f: esc((BX.MODULES.find((x) => x[0] === k) || [k, k])[1]), r: lvlCell((D.rankPerms[U.user(u).rank] || {})[k] || 0, '', true), v: lvlCell(v, 'user:' + u + ':' + k, !canW || u === D.me.id), x: canW && u !== D.me.id ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-override', arg: u + ':' + k }) : '' })));
      return head + tabsHtml + note('Persönliche Rechte gelten <b>genau so</b>, auch wenn sie niedriger sind als Rang oder Gruppe – z. B. um jemandem die Personalakten zu entziehen.', 'info') + `<div class="mt">${card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'f', label: 'Funktion' }, { key: 'r', label: 'Vom Rang' }, { key: 'v', label: 'Persönlich' }, { key: 'x', label: '' }], rows, { empty: 'Keine persönlichen Ausnahmen' }), { flush: true, actions: canW ? btn('Ausnahme hinzufügen', { cls: 'sm', icon: 'plus', action: 'add-override' }) : '' })}</div>`;
    }
    if (tab === 'einzel') {
      const rk = ranksDesc();
      const fmt = (f, v) => v === undefined || v === null ? '<span class="faint">–</span>' : f.type === 'percent' ? `<b>${v} %</b>` : v ? `<span style="color:var(--ok)">${icon('check', 'width="16" height="16"')}</span>` : '<span class="faint">✕</span>';
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Einzelrecht</th>${rk.map((r) => `<th>${esc(r.name)}${lvl('perms') >= 4 && (D.me.owner || r.pos < myPos()) ? `<br><button class="btn sm ghost" data-action="edit-flags" data-arg="rank:${r.id}">${icon('gear')}</button>` : ''}</th>`).join('')}<th>Gruppen</th></tr></thead><tbody>`;
      D.flags.forEach((f) => { t += `<tr><td><b>${esc(f.label)}</b><span class="sub mono">${esc(f.key)}</span></td>${rk.map((r) => `<td>${fmt(f, f.ranks[r.id])}</td>`).join('')}<td>${Object.entries(f.groups).map(([g, v]) => U.chip((U.group(g) || {}).name + ': ' + (f.type === 'percent' ? v + ' %' : v ? 'ja' : 'nein'))).join(' ') || '–'}</td></tr>`; });
      const gBtns = lvl('perms') >= 4 ? `<div class="row" style="padding:12px 16px"><span class="muted">Gruppen bearbeiten:</span>${D.groups.map((g) => btn(g.name, { cls: 'sm', action: 'edit-flags', arg: 'group:' + g.id })).join('')}</div>` : '';
      return head + tabsHtml + card('', t + '</tbody></table></div>' + gBtns, { flush: true, foot: 'Rabatte über dem eigenen Wert lösen eine Freigabe-Anfrage an jemanden mit höherem Wert aus.' });
    }
    const people = D.staff.filter((s) => s.rank && s.status !== 'left');
    const uid = q.u || (people[0] || {}).id;
    const u = U.user(uid);
    const ex = D.explain[uid];
    const rows = BX.MODULES.map(([k, l]) => ({ f: `<b>${esc(l)}</b>`, v: lvlCell(ex.levels[k].level, '', true), s: esc(ex.levels[k].source) }));
    const flags = D.flags.map((f) => ({ f: esc(f.label), v: f.type === 'percent' ? ex.flags[f.key] + ' %' : ex.flags[f.key] ? 'ja' : 'nein' }));
    return head + tabsHtml + `<div class="row mb"><div style="width:280px">${U.select(people.map((s) => [s.id, s.name + ' · ' + U.rank(s.rank).name]), uid, 'data-change="who-select"')}</div><span class="muted">Rang <b>${esc(U.rank(u.rank).name)}</b>${u.groups.length ? ' · Gruppen ' + u.groups.map((g) => '<b>' + esc((U.group(g) || {}).name) + '</b>').join(', ') : ''}${u.owner ? ' · <b>Inhaber</b>' : ''}</span></div>` +
      `<div class="grid g-side">${card('Wirksame Rechte', table([{ key: 'f', label: 'Funktion' }, { key: 'v', label: 'Stufe' }, { key: 's', label: 'Woher' }], rows), { flush: true })}${card('Einzelrechte', table([{ key: 'f', label: 'Recht' }, { key: 'v', label: 'Wert' }], flags), { flush: true })}</div>`;
  };

  // ================= Firmen-Einstellungen =================
  A['save-firm'] = async () => {
    const f = document.getElementById('firmForm');
    const v = BX.readForm(f);
    await BX.call('PUT', '/api/settings/firm', { ...v, termsDays: Number(v.termsDays) || 0 }, 'Stammdaten gespeichert');
  };
  A.logo = async (preset) => BX.call('PUT', '/api/settings/logo', { kind: 'preset', preset }, 'Logo geändert');
  A['logo-upload'] = (v, input) => BX.look.readImage(input.files[0], 512, async (err, data) => { if (err) return BX.toast(err.message, 'bad'); await BX.call('PUT', '/api/settings/logo', { kind: 'image', data }, 'Logo hochgeladen'); });
  A.feature = async (key, el) => { const f = { ...D.firm.features }; f[key] = !f[key]; await BX.call('PUT', '/api/settings/features', f, 'Funktion ' + (f[key] ? 'eingeschaltet' : 'ausgeschaltet')); };
  A['save-tax'] = async () => { const v = BX.readForm(document.getElementById('taxForm')); await BX.call('PUT', '/api/settings/tax', { period: v.period, reserveAccount: v.reserveAccount || null, payrollAccount: v.payrollAccount || null }, 'Steuer-Einstellungen gespeichert'); };
  A['new-class'] = () => BX.prompt('Neue Fahrzeugklasse', 'Name', 'Anlegen', async (name) => { await BX.api('POST', '/api/r/vehicleClasses', { name, pos: D.vehicleClasses.length }); return 'Angelegt'; });
  A['edit-class'] = (id) => BX.prompt('Fahrzeugklasse umbenennen', 'Name', 'Speichern', async (name) => { await BX.api('PATCH', '/api/r/vehicleClasses/' + id, { name }); return 'Gespeichert'; }, { value: U.cls(id).name });
  A['del-class'] = (id) => BX.confirm('Fahrzeugklasse löschen', 'Geht nur, wenn kein Fahrzeug diese Klasse hat.', 'Löschen', () => BX.call('DELETE', '/api/r/vehicleClasses/' + id, undefined, 'Gelöscht'));
  function logoCard() {
    const L = BX.look, lg = L.logo();
    const picks = L.LOGO_PRESETS.map((p) => `<button type="button" class="logo-pick ${lg.kind === 'preset' && lg.preset === p ? 'active' : ''}" data-action="logo" data-arg="${p}" title="${p}"><span class="brand-mark">${icon(p)}</span></button>`).join('');
    return card('Logo', `<div class="row" style="gap:20px;align-items:flex-start"><div class="center">${L.logoHtml('lg')}<div class="muted" style="font-size:12px;margin-top:6px">Vorschau</div></div>
      <div class="grow" style="min-width:240px"><div class="field"><label>Vorlage (in der Akzentfarbe des Betrachters)</label><div class="logo-picks">${picks}</div></div>
      <div class="row mt"><label class="btn" for="logoFile">${icon('image')}Eigenes Logo hochladen</label><input type="file" id="logoFile" class="hidden" accept="image/png,image/jpeg,image/webp" data-change="logo-upload"></div>
      <p class="muted" style="font-size:12px;margin-top:8px">PNG, JPEG oder WebP, höchstens 512 KB, am besten quadratisch. Erscheint in der Seitenleiste, beim Login, auf Rechnungen und der Preisliste. Der App-Name „Boxenstopp“ bleibt immer gleich.</p></div></div>`, { sub: 'gilt für alle in der Firma' });
  }
  P.firma = function (params, q) {
    const tab = q.tab || 'stammdaten';
    const f = D.firm;
    const tabsHtml = U.tabs('#/firma', [['stammdaten', 'Stammdaten & Logo'], ['steuer', 'Steuern'], ['klassen', 'Fahrzeugklassen'], ['funktionen', 'Funktionen']], tab);
    const head = pageHead('Firmen-Einstellungen', esc(f.name), '');
    let body = '';
    if (tab === 'stammdaten') body = card('Stammdaten', `<form class="form cols-2" id="firmForm" data-submit="save-firm">${U.field('Firmenname', U.input(f.name, { attrs: 'name="name" required' }))}${U.field('Kürzel für Nummern', U.input(f.short, { mono: true, attrs: 'name="short" maxlength="6"' }), { hint: 'z. B. ' + esc(f.short) + '-2026-0042 · gilt für neue Nummern' })}${U.field('Adresse im RP', U.input(f.address || '', { attrs: 'name="address"' }))}${U.field('Telefon', U.input(f.phone || '', { attrs: 'name="phone"' }))}${U.field('Öffnungszeiten', U.input(f.hours || '', { attrs: 'name="hours"' }))}${U.field('Zahlungsziel (Tage)', U.input(f.termsDays ?? 3, { type: 'number', attrs: 'name="termsDays" min="0"' }))}${U.field('Fußtext auf Rechnungen', `<textarea class="input" name="invoiceFooter">${esc(f.invoiceFooter || '')}</textarea>`, { full: true })}</form>`, { actions: btn('Speichern', { cls: 'primary sm', icon: 'check', action: 'save-firm' }) }) + `<div class="mt">${logoCard()}</div>`;
    else if (tab === 'steuer') body = `<div class="grid g-2">${card('Steuer-Einstellungen', `<form class="form" id="taxForm">${U.field('Steuerzeitraum', U.select([['week', 'Woche'], ['month', 'Monat']], f.taxPeriod === 'Monat' ? 'month' : 'week', 'name="period"'), { hint: 'Wechsel nur bis zur ersten Abführung' })}${U.field('Steuer-Rücklage (Konto)', U.select([['', '–']].concat((D.accounts || []).map((a) => [a.id, a.name])), f.reserveAccount || '', 'name="reserveAccount"'))}${U.field('Lohnkonto', U.select([['', '–']].concat((D.accounts || []).map((a) => [a.id, a.name])), f.payrollAccount || '', 'name="payrollAccount"'))}</form>`, { actions: lvl('tax') >= 4 ? btn('Speichern', { cls: 'primary sm', action: 'save-tax' }) : '' })}
      ${card('Steuersatz', `<div class="kpi" style="padding:0"><div class="value">${D.firm.taxRate} %</div><div class="muted">Festpreise: Rechnungen zeigen keine Steuer. Keine Vorsteuer, keine weiteren Abgaben.</div></div>`, { actions: lvl('tax') >= 4 ? btn('Satz ändern', { cls: 'sm', action: 'tax-rate' }) : '' })}</div>`;
    else if (tab === 'klassen') body = card('', `<div class="list">${D.vehicleClasses.map((c) => `<div class="list-item"><div class="grow"><b>${esc(c.name)}</b></div><span class="muted">${D.vehicles.filter((v) => v.cls === c.id).length} Fahrzeuge</span>${btn('', { cls: 'sm ghost', icon: 'gear', action: 'edit-class', arg: c.id })}${lvl('settings') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'del-class', arg: c.id }) : ''}</div>`).join('')}</div>`, { flush: true, actions: btn('Neue Klasse', { cls: 'sm', icon: 'plus', action: 'new-class' }), foot: 'Fahrzeugklassen bestimmen den Preis in der Preisliste.' });
    else {
      const canF = lvl('settings') >= 4;
      const FEATS = [['stock', 'Lager', 'Teile, Bestand, Sets. Aus: nur Pauschal- und Arbeitspreise'], ['callouts', 'Einsätze', 'Abschlepp- und Pannendienst'], ['appointments', 'Termine & Stellplätze', 'Kalender mit Hebebühnen'], ['taxReserve', 'Steuer-Rücklage', 'Automatische Umbuchung bei jeder Zahlung'], ['publicPricelist', 'Öffentliche Preisliste', 'Link ohne Anmeldung: ' + location.origin + '/#/preise'], ['fourEyes', 'Vier-Augen-Prüfung', '„Fertig“ meldet nur jemand mit Aufträge: Verwalten'], ['qualHard', 'Qualifikationsprüfung hart', 'Aus = nur Warnung, an = Position wird abgelehnt']];
      body = card('', FEATS.map(([k, t, s]) => `<div class="switch"><div class="txt"><b>${esc(t)}</b><small class="muted">${esc(s)}</small></div>${canF ? `<span class="toggle ${f.features[k] ? 'on' : ''}" data-action="feature" data-arg="${k}" role="switch" tabindex="0" aria-checked="${!!f.features[k]}"></span>` : badge(f.features[k] ? 'an' : 'aus', f.features[k] ? 'ok' : '')}</div>`).join(''), { foot: 'Ausgeschaltete Funktionen verschwinden aus der Navigation; Daten bleiben erhalten.' });
    }
    return head + tabsHtml + body;
  };

  // ================= User-Management =================
  A['user-new'] = () => BX.form({ title: 'Benutzer anlegen', fields: [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'E-Mail', type: 'email', required: true }, { name: 'password', label: 'Start-Passwort', type: 'password', required: true, hint: 'mindestens 10 Zeichen; die Person ändert es danach selbst' }, { name: 'rank', label: 'Rang', type: 'select', options: [['', '– kein Rang (nur Administration) –']].concat(ranksDesc().map((r) => [r.id, r.name])) }, ...(sys('role:manage') ? [{ name: 'role', label: 'Systemrolle', type: 'select', options: D.systemRoles.map((r) => [r.id, r.name]), value: 'user' }] : [])],
    intro: note('Lieber einladen? Unter Firma → Mitarbeiter gibt es Einladungslinks.', 'info'), submit: async (v) => { v.rank = v.rank || null; await BX.api('POST', '/api/admin/users', v); return 'Benutzer angelegt'; } });
  A['user-lock'] = (id) => { const u = U.user(id); const lock = u.status === 'active'; return BX.confirm(lock ? 'Benutzer sperren' : 'Benutzer entsperren', lock ? `${esc(u.name)} wird abgemeldet und kann sich nicht mehr anmelden.` : `${esc(u.name)} kann sich wieder anmelden.`, lock ? 'Sperren' : 'Entsperren', () => BX.call('PATCH', '/api/admin/users/' + id, { status: lock ? 'locked' : 'active' }, lock ? 'Gesperrt' : 'Entsperrt'), lock); };
  A['user-2fa'] = (id) => BX.confirm('2FA zurücksetzen', 'Die Person meldet sich danach nur mit Passwort an und richtet 2FA neu ein.', 'Zurücksetzen', () => BX.call('POST', `/api/admin/users/${id}/reset-2fa`, {}, '2FA zurückgesetzt'));
  A['user-sessions'] = (id) => BX.call('POST', `/api/admin/users/${id}/revoke-sessions`, {}, 'Alle Sitzungen beendet');
  A['user-reset'] = async (id) => { try { const r = await BX.api('POST', `/api/admin/users/${id}/reset-link`); showLink('Passwort-Reset-Link (24 Stunden gültig)', r.link); } catch (e) { BX.toast(e.message, 'bad'); } };
  A['user-edit'] = (id) => { const u = U.user(id); BX.form({ title: 'Zugang · ' + u.name, fields: [
    ...(sys('user:update') ? [{ name: 'name', label: 'Name', value: u.name }, { name: 'email', label: 'E-Mail', type: 'email', value: u.email }] : []),
    ...(sys('user:lock') ? [{ name: 'expires', label: 'Zugang bis einschließlich', type: 'date', value: u.expires || '', hint: 'leer = unbefristet' }, { name: 'force2fa', label: '2FA erzwingen', type: 'checkbox', value: u.force2fa }] : []),
    ...(sys('role:manage') ? [{ name: 'roles', label: 'Systemrollen', type: 'multi', options: D.systemRoles.filter((r) => r.id !== 'user').map((r) => [r.id, r.name]), value: u.sys, full: true }] : []),
  ], submit: async (v) => { if ('expires' in v) v.expires = v.expires || null; await BX.api('PATCH', '/api/admin/users/' + id, v); return 'Gespeichert'; } }); };
  A['user-approve'] = (id) => BX.form({ title: 'Registrierung freigeben · ' + U.user(id).name, cols: 1, fields: [{ name: 'rank', label: 'Rang', type: 'select', options: ranksDesc().map((r) => [r.id, r.name]), value: (ranksDesc()[ranksDesc().length - 1] || {}).id }], submit: async (v) => { await BX.api('POST', `/api/admin/users/${id}/approve`, v); return 'Freigegeben'; } });
  A['user-delete'] = (id) => BX.confirm('Registrierung ablehnen', 'Das Konto wird gelöscht.', 'Löschen', () => BX.call('DELETE', '/api/admin/users/' + id, undefined, 'Gelöscht'));
  A['role-perm'] = async (v, el) => { const role = el.dataset.role; const perms = [...document.querySelectorAll(`input[data-role="${role}"]`)].filter((x) => x.checked).map((x) => x.value); await BX.call('PUT', `/api/admin/roles/${role}/perms`, { perms }, 'Rolle gespeichert'); };
  A['role-new'] = () => BX.form({ title: 'Neue Systemrolle', fields: [{ name: 'name', label: 'Name', required: true }, { name: 'desc', label: 'Beschreibung' }], submit: async (v) => { await BX.api('POST', '/api/admin/roles', v); return 'Rolle angelegt'; } });
  A['role-del'] = (id) => BX.confirm('Systemrolle löschen', 'Benutzer verlieren diese Rolle.', 'Löschen', () => BX.call('DELETE', '/api/admin/roles/' + id, undefined, 'Gelöscht'));
  A['invite-revoke'] = (id) => BX.call('DELETE', '/api/invitations/' + id, undefined, 'Einladung widerrufen');
  P.users = function (params, q) {
    const tab = q.tab || 'benutzer';
    const head = pageHead('User-Management', 'Zugang zur App: Konten, Status, 2FA, Sitzungen und Systemrollen', (sys('user:read') ? `<a class="btn" href="/api/admin/users.csv">${icon('download')}CSV</a>` : '') + (sys('user:create') ? btn('Benutzer anlegen', { cls: 'primary', icon: 'plus', action: 'user-new' }) : ''));
    const tabsHtml = U.tabs('#/users', [['benutzer', 'Benutzer', D.staff.length], ['rollen', 'Rollen & Rechte', D.systemRoles.length], ['einladungen', 'Einladungen', D.invitations.length]], tab);
    if (tab === 'benutzer') {
      const admins = D.staff.filter((s) => s.sys.includes('admin') && s.status === 'active');
      const pend = D.staff.filter((s) => s.status === 'pending');
      const rows = D.staff.filter((s) => s.status !== 'pending').map((s) => {
        const lastAdmin = admins.length === 1 && admins[0].id === s.id;
        return {
          _dim: s.status === 'left', _filter: s.name + ' ' + s.email,
          p: person(s, s.email), s: badge(U.userStatus[s.status][0], U.userStatus[s.status][1], true) + (s.locked ? ' ' + badge('Fehlversuche', 'bad') : ''),
          r: s.sys.length ? s.sys.map((r) => badge((U.byId(D.systemRoles, r) || { name: r }).name, r === 'admin' ? 'accent' : 'violet')).join(' ') : '<span class="muted">Benutzer</span>',
          k: s.rank ? esc(U.rank(s.rank).name) : '<span class="faint">kein Rang</span>', f: s.twofa ? badge('2FA', 'ok') : s.force2fa ? badge('2FA Pflicht', 'warn') : badge('ohne 2FA', ''), l: date(s.lastLogin), e: date(s.expires),
          a: `<div class="row" style="gap:2px;flex-wrap:nowrap">${sys('user:lock') && s.status !== 'left' ? btn('', { cls: 'sm ghost', icon: 'lock', title: lastAdmin ? 'Der letzte aktive Administrator kann nicht gesperrt werden' : s.status === 'active' ? 'Sperren' : 'Entsperren', disabled: lastAdmin || s.id === D.me.id, action: 'user-lock', arg: s.id }) : ''}${sys('user:lock') ? btn('', { cls: 'sm ghost', icon: 'shield', title: '2FA zurücksetzen', action: 'user-2fa', arg: s.id, disabled: !s.twofa }) + btn('', { cls: 'sm ghost', icon: 'logout', title: 'Alle Sitzungen beenden', action: 'user-sessions', arg: s.id }) + btn('', { cls: 'sm ghost', icon: 'link', title: 'Passwort-Reset-Link', action: 'user-reset', arg: s.id }) : ''}${sys('user:update') || sys('user:lock') || sys('role:manage') ? btn('', { cls: 'sm ghost', icon: 'gear', title: 'Bearbeiten', action: 'user-edit', arg: s.id }) : ''}</div>`,
        };
      });
      const pendHtml = pend.map((r) => note(`<b>Registrierung wartet auf Freigabe:</b> ${esc(r.name)} (${esc(r.email || '')}) <div class="row" style="margin-top:8px">${sys('user:update') ? btn('Freigeben', { cls: 'sm primary', action: 'user-approve', arg: r.id }) : ''}${sys('user:delete') ? btn('Ablehnen', { cls: 'sm', action: 'user-delete', arg: r.id }) : ''}</div>`, 'info')).join('');
      return head + tabsHtml + (pendHtml ? `<div class="stack mb">${pendHtml}</div>` : '') + card('', `<div class="row mb"><input class="input" style="max-width:260px" placeholder="Name oder E-Mail …" data-action="filter" data-target="#userTable"></div>` + table([{ key: 'p', label: 'Benutzer' }, { key: 's', label: 'Status' }, { key: 'r', label: 'Systemrolle' }, { key: 'k', label: 'Rang' }, { key: 'f', label: '2FA' }, { key: 'l', label: 'Letzter Login' }, { key: 'e', label: 'Zugang bis' }, { key: 'a', label: '' }], rows, { id: 'userTable' }), { foot: 'Zugangsablauf gilt bis einschließlich zum gewählten Tag. Der letzte aktive Administrator kann weder gesperrt noch befristet werden.' });
    }
    if (tab === 'rollen') {
      const can = sys('role:manage');
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Systemrecht</th>${D.systemRoles.map((r) => `<th>${esc(r.name)}${r.fixed ? '<br><span class="faint" style="text-transform:none;font-weight:500">fest</span>' : can ? `<br><button class="btn sm ghost" data-action="role-del" data-arg="${r.id}">${icon('trash')}</button>` : ''}</th>`).join('')}</tr></thead><tbody>`;
      D.systemPerms.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b><span class="sub mono">${esc(k)}</span></td>${D.systemRoles.map((r) => `<td><input type="checkbox" value="${k}" data-role="${r.id}" data-change="role-perm" ${D.sysRolePerms[r.id].includes(k) ? 'checked' : ''} ${r.fixed || !can ? 'disabled' : ''}></td>`).join('')}</tr>`; });
      return head + tabsHtml + note('Systemrollen regeln nur die <b>Administration</b>. Was jemand in der Werkstatt darf, kommt aus Rang, Gruppen und Berechtigungen.', 'info') + `<div class="mt">${card('', t + '</tbody></table></div>', { flush: true, actions: can ? btn('Neue Rolle', { cls: 'sm', icon: 'plus', action: 'role-new' }) : '' })}</div>`;
    }
    return head + tabsHtml + card('', table([{ key: 'e', label: 'E-Mail' }, { key: 'r', label: 'Rang' }, { key: 's', label: 'Systemrolle' }, { key: 'b', label: 'Erstellt von' }, { key: 'x', label: 'Läuft ab' }, { key: 'a', label: '' }], D.invitations.map((i) => ({ e: esc(i.email) + (i.name ? `<span class="sub">${esc(i.name)}</span>` : ''), r: esc((U.rank(i.rank) || {}).name || '–'), s: esc((U.byId(D.systemRoles, i.role) || { name: 'Benutzer' }).name), b: person(U.user(i.by)), x: i.expired ? badge('abgelaufen', 'bad') : date(i.expires), a: btn('Widerrufen', { cls: 'sm danger', action: 'invite-revoke', arg: i.id }) })), { empty: 'Keine offenen Einladungen' }), { flush: true, actions: lvl('staff') >= 3 || sys('user:create') ? btn('Einladen', { cls: 'sm', icon: 'plus', action: 'invite-staff' }) : '', foot: 'Einladungslinks werden nur beim Erstellen angezeigt.' });
  };

  // ================= Server-Management =================
  A['save-security'] = async () => { const v = BX.readForm(document.getElementById('secForm')); ['minPassword', 'maxFailed', 'lockMinutes', 'sessionDays', 'auditDays'].forEach((k) => { v[k] = Number(v[k]) || 0; }); await BX.call('PUT', '/api/admin/security', v, 'Einstellungen gespeichert'); };
  A['job-run'] = async (key, b) => { b.disabled = true; const r = await BX.call('POST', `/api/admin/jobs/${key}/run`, {}, (x) => `${BX.JOB_LABELS[key] ? BX.JOB_LABELS[key][0] : key}: ${x.message || 'ok'}`); if (!r) b.disabled = false; };
  A['backup-now'] = async (a, b) => { b.disabled = true; await BX.call('POST', '/api/admin/backups', {}, (r) => 'Backup erstellt: ' + r.file); };
  A['backup-del'] = (f) => BX.confirm('Backup löschen', esc(f), 'Löschen', () => BX.call('DELETE', '/api/admin/backups/' + encodeURIComponent(f), undefined, 'Gelöscht'));
  const hookFields = (h = {}) => [{ name: 'name', label: 'Name', value: h.name, required: true, ph: '#werkstatt-feed' }, { name: 'url', label: 'Webhook-URL', value: '', required: !h.id, ph: h.id ? 'leer = unverändert' : 'https://discord.com/api/webhooks/…', full: true }, { name: 'events', label: 'Ereignisse', type: 'multi', options: BX.WEBHOOK_EVENTS.map((e) => [e, e]), value: h.events || [], full: true }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: h.active !== false }];
  A['hook-new'] = () => BX.form({ title: 'Neuer Discord-Webhook', fields: hookFields(), submit: async (v) => { await BX.api('POST', '/api/admin/webhooks', v); return 'Webhook angelegt'; } });
  A['hook-edit'] = (id) => BX.form({ title: 'Webhook bearbeiten', fields: hookFields(U.byId(D.webhooks, id)), submit: async (v) => { if (!v.url) delete v.url; await BX.api('PATCH', '/api/admin/webhooks/' + id, v); return 'Gespeichert'; } });
  A['hook-del'] = (id) => BX.confirm('Webhook löschen', 'Wirklich löschen?', 'Löschen', () => BX.call('DELETE', '/api/admin/webhooks/' + id, undefined, 'Gelöscht'));
  A['hook-test'] = (id) => BX.call('POST', `/api/admin/webhooks/${id}/test`, {}, (r) => 'Antwort: ' + r.status);
  A['key-revoke'] = (id) => BX.confirm('API-Schlüssel widerrufen', 'Programme mit diesem Schlüssel verlieren den Zugriff.', 'Widerrufen', () => BX.call('POST', `/api/me/api-keys/${id}/revoke`, {}, 'Widerrufen'));
  const audit = { user: '', area: '', q: '' };
  A['audit-filter'] = (v, el) => { audit[el.dataset.k] = v; BX.render(); };
  const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
  P.server = function (params, q) {
    const tab = q.tab || 'uebersicht';
    const o = D.overview;
    const head = pageHead('Server-Management', `Version ${esc(D.version)} · Migration ${esc(o.migration)} · läuft seit ${o.uptime > 86400 ? Math.floor(o.uptime / 86400) + ' Tagen' : Math.floor(o.uptime / 3600) + ' Stunden'}`, '');
    const tabsHtml = U.tabs('#/server', [['uebersicht', 'Übersicht']].concat(sys('server:settings') ? [['sicherheit', 'Sicherheit & Einstellungen']] : []).concat([['system', 'System & Backups']]).concat(sys('integration:manage') ? [['integrationen', 'Integrationen']] : []).concat(sys('audit:read') ? [['audit', 'Audit-Log']] : []), tab);
    const need = { sicherheit: 'server:settings', integrationen: 'integration:manage', audit: 'audit:read' }[tab];
    if (need && !sys(need)) return head + tabsHtml + note(`Dafür fehlt dir das Systemrecht <span class="mono">${need}</span>.`, 'warn', 'lock');
    if (tab === 'uebersicht') {
      const last = (D.backups || [])[0];
      const days = Array.from({ length: 14 }, (_, i) => D.addDays(D.TODAY, i - 13));
      const logins = days.map((d) => ({ label: U.shortDate(d), v: ((o.logins14 || []).find((x) => x.d === d) || { n: 0 }).n }));
      const roleDist = D.systemRoles.map((r) => ({ label: r.name, v: r.id === 'user' ? D.staff.filter((s) => !s.sys.length).length : D.staff.filter((s) => s.sys.includes(r.id)).length })).filter((x) => x.v);
      return head + tabsHtml + `<div class="grid g-6">${kpi('Aktive Benutzer', o.activeUsers, o.pending ? o.pending + ' warten auf Freigabe' : '', { icon: 'users' })}${kpi('Gerade online', o.sessions.u, o.sessions.n + ' Sitzungen (30 min)', { icon: 'userkey' })}${kpi('Im Dienst', Object.keys(D.onDuty).length, '', { icon: 'clock' })}${kpi('Datenbank', esc(o.dbSize), '', { icon: 'server' })}${kpi('Backups', (D.backups || []).length, last ? 'letztes ' + date(last.at) : 'noch keins', { icon: 'download', dir: last ? 'up' : 'down' })}${kpi('Jobs mit Fehler', (D.jobs || []).filter((j) => j.status === 'error').length, '', { icon: 'alert' })}</div>
        <div class="grid g-3 mt"><div class="span-2">${card('Anmeldungen je Tag', U.areaChart(logins, { label: 'Anmeldungen je Tag', count: true }), { sub: '14 Tage' })}</div>${card('Systemrollen', U.donut(roleDist, { fmt: (v) => v, center: 'Benutzer', centerValue: String(D.staff.length), label: 'Verteilung der Systemrollen' }))}</div>
        ${sys('audit:read') ? `<div class="mt">${card('Letzte Ereignisse', `<div class="list">${D.audit.slice(0, 8).map((a) => `<div class="list-item">${a.user ? avatar(U.user(a.user), 'sm') : `<span class="avatar sm">${icon('server', 'width="12" height="12"')}</span>`}<div class="grow"><div class="title">${esc(a.action)} <span class="muted" style="font-weight:400">· ${esc(a.area)}</span></div><div class="meta">${esc(a.detail)}</div></div><span class="muted nowrap" style="font-size:12px">${date(a.at)}</span></div>`).join('')}</div>`, { flush: true, actions: `<a class="btn sm ghost" href="#/server?tab=audit">Audit-Log</a>` })}</div>` : ''}`;
    }
    if (tab === 'sicherheit') {
      const s = D.security;
      const chk = (n, v) => `<input type="checkbox" name="${n}" ${v ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)">`;
      return head + tabsHtml + `<form id="secForm"><div class="grid g-2">
        ${card('Anmeldung & Sitzungen', `<div class="form cols-2">${U.field('Passwort-Mindestlänge', U.input(s.minPassword, { type: 'number', attrs: 'name="minPassword" min="8" max="64"' }))}${U.field('Sitzungsdauer (Tage)', U.input(s.sessionDays, { type: 'number', attrs: 'name="sessionDays" min="1" max="90"' }))}${U.field('Sperre nach Fehlversuchen', U.input(s.maxFailed, { type: 'number', attrs: 'name="maxFailed" min="3" max="20"' }))}${U.field('Sperrdauer (Minuten)', U.input(s.lockMinutes, { type: 'number', attrs: 'name="lockMinutes" min="1"' }))}${U.field('2FA-Pflicht', U.select([['off', 'aus'], ['admins', 'für alle mit Systemrechten'], ['all', 'für alle']], s.require2fa, 'name="require2fa"'), { full: true })}</div>`)}
        ${card('Zugriff', `<div class="form">${U.field('Admin-IP-Allowlist', `<textarea class="input mono" name="allowlist" placeholder="eine IP oder ein Netz je Zeile, leer = alle">${esc(s.allowlist || '')}</textarea>`, { hint: 'gilt für /api/admin; wird nur gespeichert, wenn deine eigene IP enthalten ist' })}</div><label class="switch"><div class="txt"><b>Selbstregistrierung</b><small class="muted">Neue Konten warten ohne Rang auf Freigabe</small></div>${chk('registration', s.registration)}</label><label class="switch"><div class="txt"><b>Wartungsmodus</b><small class="muted">Nur wer Server-Einstellungen darf, kommt hinein</small></div>${chk('maintenance', s.maintenance)}</label>${U.field('Hinweistext im Wartungsmodus', U.input(s.maintenanceText, { attrs: 'name="maintenanceText"' }))}`)}
        ${card('Aufbewahrung', `<div class="form">${U.field('Audit-Log aufbewahren (Tage, 0 = unbegrenzt)', U.input(s.auditDays || 0, { type: 'number', attrs: 'name="auditDays" min="0"' }))}<p class="muted" style="font-size:12px">Benachrichtigungen 90 Tage, beendete Sitzungen 30 Tage, Backups laut BACKUP_RETENTION_DAYS.</p></div>`)}
        ${card('Allgemein', `<div class="form">${U.field('App-Name', U.input('Boxenstopp', { attrs: 'readonly' }), { hint: 'fest – Firmenname und Logo unter Firmen-Einstellungen' })}${U.note(D.env.TRUST_PROXY === '1' ? '<b>TRUST_PROXY</b> ist gesetzt – Login-Sperre und Audit-Log sehen echte IPs.' : '<b>TRUST_PROXY</b> ist aus. Hinter einem Reverse-Proxy auf 1 setzen.', D.env.TRUST_PROXY === '1' ? 'ok' : 'warn')}</div>`)}
      </div></form><div class="row mt">${btn('Speichern', { cls: 'primary', icon: 'check', action: 'save-security' })}</div>`;
    }
    if (tab === 'system') {
      const jobs = table([{ key: 'j', label: 'Job' }, { key: 'e', label: 'Rhythmus' }, { key: 'l', label: 'Letzter Lauf' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }], Object.entries(BX.JOB_LABELS).map(([k, [label, every]]) => { const j = (D.jobs || []).find((x) => x.job === k); return { j: `<b>${esc(label)}</b><span class="sub mono">${esc(k)}</span>${j && j.message ? `<span class="sub" style="color:${j.status === 'error' ? 'var(--bad)' : 'var(--muted)'}">${esc(j.message)}</span>` : ''}`, e: esc(every), l: j ? date(j.last) : '–', s: !j ? badge('noch nie', '') : j.status === 'ok' ? badge('OK', 'ok', true) : j.status === 'running' ? badge('läuft', 'info', true) : badge('Fehler', 'bad', true), a: sys(k === 'backup.daily' ? 'backup:manage' : 'server:settings') ? btn('Jetzt ausführen', { cls: 'sm', icon: 'play', action: 'job-run', arg: k }) : '' }; }));
      const bk = table([{ key: 'f', label: 'Datei' }, { key: 's', label: 'Größe', num: true }, { key: 'a', label: 'Erstellt' }, { key: 'x', label: '' }], (D.backups || []).map((b) => ({ f: `<span class="mono">${esc(b.file)}</span>`, s: size(b.size), a: date(b.at), x: sys('backup:manage') ? `<div class="row" style="gap:4px;flex-wrap:nowrap"><a class="btn sm ghost" href="/api/admin/backups/${encodeURIComponent(b.file)}" title="Download">${icon('download')}</a>${btn('', { cls: 'sm ghost', icon: 'trash', title: 'Löschen', action: 'backup-del', arg: b.file })}</div>` : '' })), { empty: 'Noch keine Backups' });
      const env = Object.entries(D.env).map(([k, v]) => `<div class="list-item" style="padding:6px 16px"><span class="mono grow" style="font-size:12px">${esc(k)}</span><span class="mono muted" style="font-size:12px">${esc(v)}</span></div>`).join('');
      return head + tabsHtml + card('Geplante Jobs', jobs, { flush: true, foot: 'Der Worker prüft jede Minute, was fällig ist.' }) + `<div class="grid g-side mt">${card('Backups', bk, { flush: true, sub: 'pg_dump im Custom-Format', actions: sys('backup:manage') ? btn('Backup jetzt', { cls: 'sm primary', icon: 'plus', action: 'backup-now' }) : '', foot: 'Wiederherstellen: docker compose exec -T db pg_restore --clean -U … -d … < datei.dump (siehe README)' })}${card('Umgebung', `<div class="list">${env}</div>`, { flush: true, sub: 'schreibgeschützt' })}</div>`;
    }
    if (tab === 'integrationen') {
      const wh = D.webhooks.map((w) => `<div class="list-item"><div class="grow"><div class="title">${esc(w.name)} ${w.active ? '' : badge('aus', '')}</div><div class="meta mono">${esc(w.url)}</div><div class="chips" style="margin-top:6px">${w.events.map(U.chip).join('')}</div></div><div class="right"><div>${!w.last_status ? badge('noch nie', '') : /^2\d\d$/.test(w.last_status) ? badge('OK ' + w.last_status, 'ok', true) : badge(w.last_status, 'bad', true)}</div><div class="muted" style="font-size:11.5px;margin-top:4px">${date(w.last_at)}</div></div>${btn('Test', { cls: 'sm', action: 'hook-test', arg: w.id })}${btn('', { cls: 'sm ghost', icon: 'gear', action: 'hook-edit', arg: w.id })}${btn('', { cls: 'sm ghost', icon: 'trash', action: 'hook-del', arg: w.id })}</div>`).join('');
      const keys = table([{ key: 'u', label: 'Benutzer' }, { key: 'n', label: 'Name' }, { key: 'p', label: 'Schlüssel' }, { key: 'c', label: 'Erstellt' }, { key: 'l', label: 'Zuletzt benutzt' }, { key: 'x', label: '' }], D.apiKeys.map((k) => ({ u: person(U.user(k.user)), n: esc(k.name), p: `<span class="mono">${esc(k.prefix)}…</span>`, c: date(k.created), l: date(k.last), x: btn('Widerrufen', { cls: 'sm danger', action: 'key-revoke', arg: k.id }) })), { empty: 'Keine API-Schlüssel' });
      return head + tabsHtml + card('Discord-Webhooks', `<div class="list">${wh || '<div class="empty">Noch keine Webhooks</div>'}</div>`, { flush: true, sub: 'nur ausgehende Meldungen · URLs verschlüsselt gespeichert', actions: btn('Neuer Webhook', { cls: 'sm', icon: 'plus', action: 'hook-new' }) }) + `<div class="mt">${card('API-Schlüssel aller Benutzer', keys, { flush: true, sub: 'nur lesend: GET-Anfragen mit „Authorization: Bearer bxs_…“' })}</div>`;
    }
    let list = D.audit;
    if (audit.user) list = list.filter((a) => a.user === audit.user);
    if (audit.area) list = list.filter((a) => a.area === audit.area);
    if (audit.q) list = list.filter((a) => (a.action + ' ' + a.detail).toLowerCase().includes(audit.q.toLowerCase()));
    const areas = [...new Set(D.audit.map((a) => a.area))].sort();
    const rows = list.map((a) => ({ t: date(a.at), u: a.user ? person(U.user(a.user)) : '<span class="muted">System</span>', b: U.chip(a.area), a: `<b>${esc(a.action)}</b>`, d: esc(a.detail), ip: `<span class="mono muted">${esc(a.ip || '')}</span>` }));
    return head + tabsHtml + card('', `<div class="row mb" style="gap:8px"><div style="width:190px">${U.select([['', 'Alle Benutzer']].concat(D.staff.map((s) => [s.id, s.name])), audit.user, 'data-change="audit-filter" data-k="user"')}</div><div style="width:190px">${U.select([['', 'Alle Bereiche']].concat(areas.map((x) => [x, x])), audit.area, 'data-change="audit-filter" data-k="area"')}</div><input class="input" style="max-width:240px" placeholder="Suchen …" value="${esc(audit.q)}" data-change="audit-filter" data-k="q"><div class="grow"></div><a class="btn" href="/api/admin/audit.csv">${icon('download')}CSV</a></div>` + table([{ key: 't', label: 'Zeit' }, { key: 'u', label: 'Benutzer' }, { key: 'b', label: 'Bereich' }, { key: 'a', label: 'Aktion' }, { key: 'd', label: 'Details' }, { key: 'ip', label: 'IP' }], rows, { empty: 'Keine Einträge' }), { foot: 'Die letzten 500 Einträge; die CSV enthält bis zu 20.000.' });
  };

  // ================= Tickets, Fehler melden, Hilfe, Changelog =================
  const TS = { open: ['Offen', 'info'], in_progress: ['In Arbeit', 'warn'], done: ['Erledigt', 'ok'], rejected: ['Abgelehnt', ''] };
  A['ticket-status'] = (v, el) => BX.call('PATCH', '/api/tickets/' + el.dataset.id, { status: v }, 'Status geändert');
  A['ticket-del'] = (id) => BX.confirm('Ticket löschen', 'Wirklich löschen?', 'Löschen', () => BX.call('DELETE', '/api/tickets/' + id, undefined, 'Gelöscht'));
  A['ticket-open'] = async (id) => {
    const t = (D.tickets || []).find((x) => x.id === id) || D.myTickets.find((x) => x.id === id);
    let comments = [];
    try { comments = await BX.api('GET', `/api/tickets/${id}/comments`); } catch (e) { BX.toast(e.message, 'bad'); return; }
    BX.form({ title: `T-${t.no} · ${t.title}`, cols: 1, wide: true, ok: 'Antworten',
      intro: `${t.body ? `<p>${U.md(t.body)}</p>` : ''}<div class="list">${comments.map((c) => `<div class="list-item">${avatar(U.user(c.author))}<div class="grow"><div class="title">${esc((U.user(c.author) || {}).name || '')} <span class="muted" style="font-weight:400">· ${date(c.at)}</span></div><div>${U.md(c.body)}</div></div></div>`).join('') || '<div class="empty">Noch keine Antworten</div>'}</div>`,
      fields: [{ name: 'body', label: 'Antwort', type: 'textarea', required: true }], submit: async (v) => { await BX.api('POST', `/api/tickets/${id}/comments`, v); return 'Antwort gesendet'; } });
  };
  P.tickets = function () {
    return pageHead('Tickets', 'Gemeldete Fehler', '') + card('', table([{ key: 'i', label: 'Nr.' }, { key: 't', label: 'Titel' }, { key: 'p', label: 'Seite' }, { key: 'b', label: 'Gemeldet von' }, { key: 'd', label: 'Datum' }, { key: 'c', label: 'Antworten', num: true }, { key: 's', label: 'Status' }, { key: 'x', label: '' }],
      D.tickets.map((t) => ({ i: `<span class="mono">T-${t.no}</span>`, t: `<b>${esc(t.title)}</b>${t.body ? `<span class="sub">${esc(t.body.slice(0, 80))}</span>` : ''}`, p: U.chip(t.page || '–'), b: person(U.user(t.by)), d: date(t.at), c: t.comments, s: U.select(Object.entries(TS).map(([k, [l]]) => [k, l]), t.status, `data-change="ticket-status" data-id="${t.id}"`), x: `<div class="row" style="gap:2px;flex-wrap:nowrap">${btn('Öffnen', { cls: 'sm', action: 'ticket-open', arg: t.id })}${btn('', { cls: 'sm ghost', icon: 'trash', action: 'ticket-del', arg: t.id })}</div>` })), { empty: 'Keine Tickets' }), { flush: true });
  };
  A['ticket-send'] = async () => { const v = BX.readForm(document.getElementById('ticketForm')); if (!v.title) return BX.toast('Titel fehlt', 'bad'); const r = await BX.call('POST', '/api/tickets', v, (x) => `Danke! Ticket T-${x.no} angelegt`); if (r) document.getElementById('ticketForm').reset(); };
  P.fehler = function () {
    return pageHead('Fehler melden', 'Etwas klemmt? Beschreib kurz, was passiert ist.', '') + `<div class="grid g-side">${card('Neue Meldung', `<form class="form" id="ticketForm">${U.field('Titel', U.input('', { attrs: 'name="title" required', ph: 'Kurz und knackig' }))}${U.field('Seite', U.select(['Dashboard', 'Aufträge', 'Kunden', 'Fahrzeuge', 'Preisliste', 'Lager', 'Rechnungen', 'Finanzen', 'Dienstplan', 'Schulungen', 'Sonstiges'], 'Sonstiges', 'name="page"'))}${U.field('Beschreibung', '<textarea class="input" name="body" style="min-height:140px" placeholder="Was hast du gemacht, was ist passiert, was hast du erwartet?"></textarea>')}</form>`, { foot: btn('Senden', { cls: 'primary', action: 'ticket-send' }) })}
      ${card('Meine Meldungen', `<div class="list">${D.myTickets.map((t) => `<div class="list-item"><div class="grow"><div class="title">${esc(t.title)}</div><div class="meta">T-${t.no} · ${date(t.at)} · ${t.comments} Antworten</div></div>${badge(TS[t.status][0], TS[t.status][1])}${btn('Öffnen', { cls: 'sm', action: 'ticket-open', arg: t.id })}</div>`).join('') || '<div class="empty">Noch nichts gemeldet</div>'}</div>`, { flush: true })}</div>`;
  };
  P.hilfe = function () {
    const items = [['Auftrag anlegen', 'Oben „Neuer Auftrag“ und das Kennzeichen tippen. Fahrzeug, Halter, Klasse und Preisgruppe sind dann gesetzt. Unbekanntes Kennzeichen legt ein neues Fahrzeug an.'], ['Positionen & Preise', 'Alle Preise sind Festpreise. Der Preis hängt von der Fahrzeugklasse ab; die Preisgruppe des Kunden gibt Rabatt. Teile werden reserviert und bei „Fertig“ entnommen.'], ['Rabatt über meinem Limit', 'Trag den Rabatt trotzdem ein – es geht eine Freigabe-Anfrage an jemanden mit höherem Limit.'], ['Abrechnen', '„Abrechnen → Rechnung“ erstellt die Rechnung; danach ist der Auftrag gesperrt. Korrekturen nur per Storno (Gegenrechnung).'], ['Steuern', 'Rechnungen zeigen keine Steuer. Je Zeitraum wird der Satz auf die Zahlungseingänge gerechnet und unter Finanzen → Steuern abgeführt.'], ['Dienst', 'Oben rechts „Dienst beginnen“. Deine Dienstzeit zählt für den Stundenlohn und die Aktivität.'], ['Rechte', 'Was du darfst, steht im Profilmenü unter „Was darf ich?“.'], ['Darstellung', 'Hell/Dunkel, Farbe und Design V1 oder V2 „Glass“ stellst du unter Einstellungen → Darstellung ein.'], ['Tastatur', '„/“ springt in die Suche, Esc schließt Dialoge, Enter in der Suche öffnet den ersten Treffer.']];
    return pageHead('Hilfe', 'Kurzanleitung für die wichtigsten Abläufe', '') + `<div class="grid g-3">${items.map(([t, d]) => card(esc(t), `<p class="muted">${esc(d)}</p>`)).join('')}</div>`;
  };
  const CHANGELOG = [
    { v: '0.3.0', date: '2026-11-11', items: [['Neu', 'Dashboard anpassbar: Module verschieben (Ziehen oder Pfeile), Breite 4/6/8/12, ausblenden, wieder hinzufügen; je Benutzer gespeichert, in V1 und V2'], ['Neu', 'Fuhrpark der Werkstatt: Firmenfahrzeuge mit Ausgabe/Rückgabe, Fahrtenbuch, Service, Schäden, Tanken und Kosten; Erinnerungen für Service und Versicherung; Einsätze mit Firmenfahrzeug'], ['Neu', 'Tuning: Konfigurator je Kundenfahrzeug mit Tuning-Stand, Preisen der Klasse und Paketen; daraus Angebot oder Auftrag; Tuning-Pakete; Übersicht'], ['Neu', 'Fahrzeug-Katalog mit Bildergalerie, Daten und Werkstatt-Hinweisen; Kunden- und Firmenfahrzeuge verknüpfen ein Modell'], ['Neu', 'Regelwerk nur für Mitarbeiter: Dienstverordnung, Firmen-Kodex und weitere Dokumente mit Fassungen und Lesebestätigung'], ['Neu', 'Diagramme interaktiv: Tooltips, Hervorhebung, Reihen ein-/ausblenden, Zeitraum wählen, Klick führt zu den Daten']] },
    { v: '0.2.0', date: '2026-11-11', items: [['Neu', 'Erste lauffähige Version: Backend mit PostgreSQL, echte Anmeldung mit 2FA, Rechte serverseitig'], ['Neu', 'Aufträge mit Positionen, Lager-Reservierung, Qualifikationsprüfung, Rabattfreigaben, Rechnungen mit Snapshot'], ['Neu', 'Finanzen: Zahlungen mit Steuer-Rücklage, Storno per Gegenrechnung, Tagesabschluss, Steuerzeiträume, Lohnlauf'], ['Neu', 'Personal: Stempeluhr, Schulungen mit Nachweisen, Lizenzen, Personalakten, Schwarzes Brett'], ['Neu', 'Administration: User- und Server-Management, Backups, Webhooks, API-Schlüssel, Audit-Log, Tickets'], ['Technik', 'Worker für Daueraufträge, Erinnerungen und Backups; Demo-Daten per Seed-Skript']] },
    { v: '0.1.0', date: '2026-11-11', items: [['Neu', 'Klickbares Mockup mit Beispieldaten'], ['Neu', 'Darstellung je Mitarbeiter: Hell/Dunkel, Farbthemes, Design V1 und V2 „Glass“'], ['Geändert', 'Steuern: Festpreise, ein Satz, Abführung je Zeitraum']] },
    { v: '0.0.0', date: '2026-11-11', items: [['Technik', 'Konzept und technische Planung']] },
  ];
  P.changelog = function () {
    const tone = { Neu: 'ok', Geändert: 'info', Behoben: 'warn', Technik: '' };
    return pageHead('Changelog', 'Alle Versionen, neueste oben', '') + `<div class="stack">${CHANGELOG.map((c) => card(`Version ${esc(c.v)} ${c.v === D.version ? badge('Installiert', 'accent') : ''}`, `<div class="list">${c.items.map(([k, t]) => `<div class="list-item" style="padding:6px 0">${badge(k, tone[k])}<div class="grow">${esc(t)}</div></div>`).join('')}</div>`, { sub: date(c.date) })).join('')}</div>`;
  };

  // ================= Konto =================
  A['save-profile'] = async () => { const v = BX.readForm(document.getElementById('profileForm')); await BX.call('PATCH', '/api/me', v, 'Profil gespeichert'); };
  A['change-pw'] = () => BX.form({ title: 'Passwort ändern', cols: 1, fields: [{ name: 'current', label: 'Aktuelles Passwort', type: 'password', required: true }, { name: 'password', label: 'Neues Passwort', type: 'password', required: true, hint: 'mindestens ' + ((D.security || {}).minPassword || 10) + ' Zeichen' }], submit: async (v) => { await BX.api('POST', '/api/me/password', v); return 'Passwort geändert – andere Sitzungen wurden beendet'; } });
  A['2fa-setup'] = async () => {
    try {
      const r = await BX.api('POST', '/api/me/2fa/setup');
      BX.form({ title: 'Zwei-Faktor-Anmeldung einrichten', cols: 1, ok: 'Einschalten', intro: `<div class="row" style="align-items:flex-start;gap:18px"><img src="${r.qr}" alt="QR-Code" width="180" height="180" style="border-radius:8px;background:#fff;padding:6px"><div><p>1. QR-Code mit einer Authenticator-App scannen (z. B. Google Authenticator, Aegis, 1Password).</p><p class="muted">Oder den Schlüssel eintippen:<br><span class="mono" style="word-break:break-all">${esc(r.secret)}</span></p><p>2. Den 6-stelligen Code unten eingeben.</p></div></div>`,
        fields: [{ name: 'code', label: 'Code', required: true, attrs: 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"' }], submit: async (v) => { await BX.api('POST', '/api/me/2fa/enable', v); return '2FA ist aktiv'; } });
    } catch (e) { BX.toast(e.message, 'bad'); }
  };
  A['2fa-disable'] = () => BX.form({ title: '2FA ausschalten', cols: 1, danger: true, ok: 'Ausschalten', fields: [{ name: 'password', label: 'Passwort zur Bestätigung', type: 'password', required: true }], submit: async (v) => { await BX.api('POST', '/api/me/2fa/disable', v); return '2FA ausgeschaltet'; } });
  A['session-revoke'] = (id) => BX.call('POST', `/api/me/sessions/${id}/revoke`, {}, 'Sitzung beendet');
  A['sessions-others'] = () => BX.call('POST', '/api/me/sessions/revoke-others', {}, 'Andere Sitzungen beendet');
  A['key-new'] = () => BX.form({ title: 'Neuer API-Schlüssel', cols: 1, fields: [{ name: 'name', label: 'Wofür?', required: true, ph: 'z. B. Stream-Overlay' }], submit: async (v) => { const r = await BX.api('POST', '/api/me/api-keys', v); setTimeout(() => BX.openModal({ title: 'Dein API-Schlüssel', body: `<p>Wird <b>nur jetzt</b> angezeigt. Nur lesender Zugriff (GET) mit <span class="mono">Authorization: Bearer …</span>.</p><input class="input mono" value="${esc(r.key)}" readonly>`, foot: `<button class="btn primary" data-action="copy" data-arg="${esc(r.key)}">Kopieren</button>` })); return 'Schlüssel erstellt'; } });
  function appearance() {
    const L = BX.look, p = L.prefs;
    const design = `<div class="choice-grid"><button type="button" class="choice ${p.ui === 'v1' ? 'active' : ''}" data-action="look" data-arg="ui:v1"><div class="preview"><i></i><div class="pv-main"><i></i><i></i><i></i></div></div><b>V1 · Klassisch</b><small>Flach und ruhig, volle Flächen</small></button><button type="button" class="choice ${p.ui === 'v2' ? 'active' : ''}" data-action="look" data-arg="ui:v2"><div class="preview glass"><i></i><div class="pv-main"><i></i><i></i><i></i></div></div><b>V2 · Glass</b><small>Durchscheinende Panels über einem Hintergrund</small></button></div>`;
    const modes = `<div class="seg">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button type="button" class="${p.mode === k ? 'active' : ''}" data-action="look" data-arg="mode:${k}">${l}</button>`).join('')}</div>`;
    const swatches = `<div class="swatches">${L.ACCENTS.map(([k, l, c]) => `<span class="swatch ${p.accent === k ? 'active' : ''}" style="background:${c}" data-action="look" data-arg="accent:${k}" title="${esc(l)}" role="button" tabindex="0"></span>`).join('')}</div><div class="muted" style="margin-top:8px;font-size:12px">Aktiv: <b>${esc((L.ACCENTS.find((a) => a[0] === p.accent) || ['', ''])[1])}</b></div>`;
    const tiles = L.BACKGROUNDS.map(([k, l, css]) => `<div class="bg-tile ${p.bg === k ? 'active' : ''}" style="background-image:${css};background-color:var(--bg)" data-action="look" data-arg="bg:${k}" role="button" tabindex="0"><span>${esc(l)}</span></div>`).join('') + `<div class="bg-tile ${p.bg === 'custom' ? 'active' : ''}" style="${p.custom ? `background-image:url('${esc(p.custom)}')` : 'display:grid;place-items:center;border-style:dashed'}" data-action="look" data-arg="bg:custom" role="button" tabindex="0">${p.custom ? '' : icon('plus', 'width="22" height="22" style="color:var(--muted)"')}<span>Eigenes Bild</span></div>`;
    const range = (key, label, min, max, unit) => `<div class="range"><label>${esc(label)}</label><input type="range" min="${min}" max="${max}" value="${p[key]}" data-action="look-range" data-key="${key}" data-unit="${unit}"><output>${p[key]}${unit}</output></div>`;
    const v2 = p.ui === 'v2' ? card('Glass-Einstellungen', `<div class="field"><label>Hintergrund</label><div class="bg-tiles">${tiles}</div></div><div class="row" style="margin-top:8px"><label class="btn sm" for="bgFile">${icon('image')}Eigenes Bild hochladen</label><input type="file" id="bgFile" class="hidden" accept="image/png,image/jpeg,image/webp" data-action="bg-upload"><span class="muted" style="font-size:12px">bis 3 MB · nur du siehst dein Bild</span></div><hr>${range('blur', 'Unschärfe', 0, 40, ' px')}${range('glass', 'Deckkraft der Panels', 20, 90, ' %')}${range('dim', 'Hintergrund abdunkeln', 0, 70, ' %')}<div class="switch"><div class="txt"><b>Unschärfe auf dem Handy</b><small class="muted">Aus spart Akku und läuft flüssiger</small></div>${toggle(!!p.mobileBlur, 'look-mobileBlur')}</div>`, { sub: 'nur in V2' }) : '';
    return `<div class="grid g-2">${card('Design', design, { sub: 'nur für dich' })}<div class="stack">${card('Modus', modes)}${card('Farbtheme', swatches)}</div></div>` + (v2 ? `<div class="mt">${v2}</div>` : '') + `<div class="row mt">${btn('Auf Standard zurücksetzen', { cls: 'ghost', action: 'look-reset' })}<span class="muted" style="font-size:12px">Wird sofort übernommen und an deinem Konto gespeichert.</span></div>`;
  }
  P.einstellungen = function (params, q) {
    const tab = q.tab || 'profil';
    const u = U.user(D.me.id);
    const tabsHtml = U.tabs('#/einstellungen', [['profil', 'Profil'], ['sicherheit', 'Sicherheit'], ['darstellung', 'Darstellung'], ['sitzungen', 'Sitzungen', D.mySessions.length], ['api', 'API-Schlüssel'], ['rechte', 'Was darf ich?']], tab);
    const head = pageHead('Einstellungen', esc(u.name) + ' · ' + esc(u.email), '');
    let body;
    if (tab === 'profil') body = card('', `<form class="form cols-2" id="profileForm">${U.field('Name', U.input(u.name, { attrs: 'name="name"' }))}${U.field('Telefon (RP)', U.input(u.phone || '', { attrs: 'name="phone"' }))}</form><p class="muted mt" style="font-size:12px">E-Mail, Rang und Gruppen ändert die Leitung bzw. ein Administrator.</p>`, { foot: btn('Speichern', { cls: 'primary sm', action: 'save-profile' }) });
    else if (tab === 'sicherheit') body = `<div class="grid g-2">${card('Passwort', `<p class="muted">Beim Ändern werden deine anderen Sitzungen beendet.</p>`, { foot: btn('Passwort ändern', { cls: 'sm', action: 'change-pw' }) })}${card('Zwei-Faktor-Anmeldung', `<div class="row">${badge(D.me.twofa ? 'aktiv' : 'aus', D.me.twofa ? 'ok' : 'warn', true)}<span class="muted">Authenticator-App (TOTP)</span></div>${D.me.needs2fa ? `<div class="mt">${note('Für dein Konto vorgeschrieben.', 'warn')}</div>` : ''}`, { foot: D.me.twofa ? btn('Ausschalten', { cls: 'sm danger', action: '2fa-disable' }) : btn('Einrichten', { cls: 'sm primary', action: '2fa-setup' }) })}</div>`;
    else if (tab === 'darstellung') body = appearance();
    else if (tab === 'sitzungen') body = card('', table([{ key: 'd', label: 'Gerät' }, { key: 'i', label: 'IP' }, { key: 'l', label: 'Zuletzt aktiv' }, { key: 'x', label: '' }], D.mySessions.map((s) => ({ d: esc((s.ua || '').replace(/\(.*?\)/g, '').slice(0, 60)) + (s.current ? ' ' + badge('diese Sitzung', 'ok') : ''), i: `<span class="mono">${esc(s.ip || '')}</span>`, l: date(s.seen), x: s.current ? '' : btn('Beenden', { cls: 'sm', action: 'session-revoke', arg: s.id }) }))), { flush: true, actions: btn('Alle anderen beenden', { cls: 'sm danger', action: 'sessions-others' }) });
    else if (tab === 'api') body = card('API-Schlüssel', table([{ key: 'n', label: 'Name' }, { key: 'p', label: 'Schlüssel' }, { key: 'c', label: 'Erstellt' }, { key: 'l', label: 'Zuletzt benutzt' }, { key: 'x', label: '' }], D.myApiKeys.map((k) => ({ n: esc(k.name), p: `<span class="mono">${esc(k.prefix)}…</span>`, c: date(k.created), l: date(k.last), x: btn('Widerrufen', { cls: 'sm danger', action: 'key-revoke', arg: k.id }) })), { empty: 'Noch keine Schlüssel' }), { flush: true, sub: 'nur lesend, mit deinen Rechten', actions: btn('Neuer Schlüssel', { cls: 'sm', icon: 'plus', action: 'key-new' }) });
    else {
      const rows = BX.MODULES.map(([k, l]) => ({ f: `<b>${esc(l)}</b>`, v: `<span class="lvl lvl-${D.me.levels[k]} locked">${esc(U.levelNames[D.me.levels[k]])}</span>` }));
      const flags = Object.entries(D.me.flags).map(([k, v]) => ({ f: esc({ 'rabatt.max_prozent': 'Max. Rabatt ohne Freigabe', 'auftrag.preis_aendern': 'Vom Preis abweichen', 'rechnung.storno': 'Rechnungen stornieren', 'kasse.abschluss': 'Tagesabschluss', 'personal.lohn_sehen': 'Löhne anderer sehen' }[k] || k), v: typeof v === 'number' ? v + ' %' : v ? 'ja' : 'nein' }));
      body = `<div class="grid g-side">${card('Werkstatt', table([{ key: 'f', label: 'Funktion' }, { key: 'v', label: 'Deine Stufe' }], rows), { flush: true, sub: u.owner ? 'Inhaber – darf alles' : (u.rank ? 'Rang ' + esc(U.rank(u.rank).name) : 'ohne Rang') })}<div class="stack">${card('Einzelrechte', table([{ key: 'f', label: 'Recht' }, { key: 'v', label: 'Wert' }], flags), { flush: true })}${card('Administration', D.me.sys.length ? `<div class="chips">${D.me.sys.map((s) => U.chip(s)).join('')}</div>` : '<span class="muted">keine Systemrechte</span>')}</div></div>`;
    }
    return head + tabsHtml + body;
  };
})();
