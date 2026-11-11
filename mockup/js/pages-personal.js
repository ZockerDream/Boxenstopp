/* Boxenstopp – Seiten: Personal */
(function () {
  'use strict';
  const D = window.BX.data;
  const U = window.BX.ui;
  const P = window.BX.pages;
  const S = () => window.BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, person, avatar, note } = U;
  const lvl = (m) => window.BX.perm.level(S().viewAs, m);
  const activeStaff = () => D.staff.filter((s) => s.rank && s.status !== 'left');

  P.dienstplan = function (params, q) {
    const tab = q.tab || 'jetzt';
    const own = lvl('shifts') === 1;
    const head = pageHead('Dienstplan', 'Stempeluhr, Dienstzeiten und Abwesenheiten', btn('Abwesenheit melden', { icon: 'cal', action: 'toast', arg: 'Abwesenheit gemeldet (Mockup)' }) + btn(S().duty ? 'Dienst beenden' : 'Dienst beginnen', { cls: 'primary', icon: 'clock', action: 'duty' }));
    const tabsHtml = U.tabs('#/dienstplan', [['jetzt', 'Jetzt im Dienst', Object.keys(D.onDuty).length]].concat(own ? [] : [['aktivitaet', 'Aktivität']]).concat([['meine', 'Meine Schichten'], ['abwesend', 'Abwesenheiten', D.absences.length]]), tab);
    if (tab === 'jetzt') {
      const cards = activeStaff().map((s) => {
        const on = D.onDuty[s.id] || (s.id === S().viewAs && S().duty);
        const abs = D.absences.find((a) => a.user === s.id && a.from <= D.TODAY && a.to >= D.TODAY);
        return `<div class="card" style="padding:14px"><div class="row">${avatar(s, 'lg')}<div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(U.rank(s.rank).name)} · Dienstnr. ${esc(s.dutyNo)}</div></div></div><div class="row between mt">${on ? badge('im Dienst seit ' + (D.onDuty[s.id] || S().dutySince), 'ok', true) : abs ? badge(abs.kind + ' bis ' + U.shortDate(abs.to), 'warn', true) : badge('außer Dienst', '', true)}<span class="muted" style="font-size:12px">${D.activity[s.id] ? D.activity[s.id][3] : 0} h diese Woche</span></div></div>`;
      }).join('');
      return head + tabsHtml + `<div class="grid g-4">${cards}</div>`;
    }
    if (tab === 'aktivitaet') {
      const rows = activeStaff().concat(D.staff.filter((s) => s.status === 'left')).map((s) => {
        const a = D.activity[s.id] || [0, 0, 0, 0];
        return { _dim: s.status === 'left', p: person(s, U.rank(s.rank).name), w1: a[0] + ' h', w2: a[1] + ' h', w3: a[2] + ' h', w4: `<b>${a[3]} h</b>`, sp: U.spark(a), abs: (D.absences.find((x) => x.user === s.id) ? badge(D.absences.find((x) => x.user === s.id).kind, 'warn') : '') + (s.status === 'left' ? badge('ausgeschieden', '') : '') };
      });
      return head + tabsHtml + note('Eine Mindeststundenzahl gibt es nicht – die Übersicht zeigt nur die Stunden und daneben Abwesenheiten.', 'info') + `<div class="mt">${card('Dienststunden je Woche', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'w1', label: 'KW 43', num: true }, { key: 'w2', label: 'KW 44', num: true }, { key: 'w3', label: 'KW 45', num: true }, { key: 'w4', label: 'KW 46', num: true }, { key: 'sp', label: 'Verlauf' }, { key: 'abs', label: '' }], rows), { flush: true })}</div>`;
    }
    if (tab === 'meine') {
      const rows = D.shifts.map((s) => ({ f: date(s.from), t: date(s.to), h: s.h.toLocaleString('de-DE') + ' h', s: s.src.startsWith('Nachtrag') ? badge(s.src, 'warn') : badge(s.src, '') }));
      if (S().duty) rows.unshift({ f: date(D.TODAY + ' ' + S().dutySince), t: badge('läuft', 'ok', true), h: '–', s: badge('Stempeluhr', '') });
      return head + tabsHtml + card('', table([{ key: 'f', label: 'Beginn' }, { key: 't', label: 'Ende' }, { key: 'h', label: 'Stunden', num: true }, { key: 's', label: 'Quelle' }], rows), { flush: true, foot: 'Nachträge brauchen einen Grund und das Recht „Dienstplan: Lesen & Schreiben“.' });
    }
    return head + tabsHtml + card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'k', label: 'Art' }, { key: 'z', label: 'Zeitraum' }, { key: 'n', label: 'Notiz' }], D.absences.map((a) => ({ p: person(U.user(a.user)), k: badge(a.kind, 'warn'), z: `${date(a.from)} – ${date(a.to)}`, n: esc(a.note) }))), { flush: true });
  };

  P.schulungen = function (params, q) {
    const tab = q.tab || 'uebersicht';
    const own = lvl('trainings') === 1;
    const head = pageHead('Schulungen', own ? 'Mit „Eigene“ siehst du Termine und meldest dich selbst an.' : 'Schulungen, Termine, Tests und Nachweise', own ? '' : btn('Neuer Termin', { icon: 'cal', action: 'toast', arg: 'Neuer Schulungstermin (Mockup)' }) + btn('Neue Schulung', { cls: 'primary', icon: 'plus', action: 'toast', arg: 'Neue Schulung (Mockup)' }));
    const tabsHtml = U.tabs('#/schulungen', [['uebersicht', 'Schulungen', D.trainings.length], ['termine', 'Termine', D.sessions.filter((s) => !s.done).length]].concat(own ? [] : [['nachweise', 'Nachweise']]).concat([['test', 'Test im Tool']]), tab);
    if (tab === 'uebersicht') {
      return head + tabsHtml + `<div class="grid g-3">${D.trainings.map((t) => {
        const holders = Object.entries(D.certs).filter(([u, m]) => m[t.id] !== undefined && U.user(u).status !== 'left' && (m[t.id] === null || U.daysUntil(m[t.id]) >= 0)).length;
        const next = D.sessions.find((s) => s.training === t.id && !s.done);
        const reqBy = Object.entries(D.rankReq).filter(([, l]) => l.includes(t.id)).map(([r]) => U.rank(r).name);
        return card(esc(t.name), `<p class="muted">${esc(t.desc)}</p><div class="row">${badge(t.months ? t.months + ' Monate gültig' : 'unbefristet', '')}${t.test ? badge('mit Test', 'violet') : ''}${reqBy.length ? badge('Pflicht: ' + reqBy.join(', '), 'accent') : ''}</div><hr><div class="row between"><span class="muted">Gültige Nachweise</span><b>${holders}</b></div><div class="row between" style="margin-top:6px"><span class="muted">Nächster Termin</span><b>${next ? date(next.date) + ' ' + next.time : '–'}</b></div>`, { actions: own && next ? btn('Anmelden', { cls: 'sm primary', action: 'toast', arg: 'Für den Termin angemeldet (Mockup)' }) : '' });
      }).join('')}</div>`;
    }
    if (tab === 'termine') {
      const rows = D.sessions.map((s) => ({ _dim: s.done, t: `<b>${esc(U.training(s.training).name)}</b>`, d: date(s.date) + ' ' + s.time, o: esc(s.loc), tr: person(U.user(s.trainer)), p: own ? (s.participants.includes(S().viewAs) ? badge('angemeldet', 'ok') : '–') : `<span class="avatars">${s.participants.map((u) => avatar(U.user(u), 'sm')).join('')}</span>`, s: s.done ? badge('Ergebnisse eingetragen', 'ok') : badge('geplant', 'info'), a: s.done ? '' : own ? btn(s.participants.includes(S().viewAs) ? 'Abmelden' : 'Anmelden', { cls: 'sm', action: 'toast', arg: 'Anmeldung geändert (Mockup)' }) : btn('Ergebnisse', { cls: 'sm', action: 'toast', arg: 'Ergebnisse eintragen: bestanden / nicht bestanden / nicht erschienen (Mockup)' }) }));
      return head + tabsHtml + card('', table([{ key: 't', label: 'Schulung' }, { key: 'd', label: 'Termin' }, { key: 'o', label: 'Ort' }, { key: 'tr', label: 'Ausbilder' }, { key: 'p', label: own ? 'Du' : 'Teilnehmer' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }], rows), { flush: true });
    }
    if (tab === 'nachweise') {
      const rows = [];
      Object.entries(D.certs).forEach(([u, m]) => Object.entries(m).forEach(([t, until]) => { const v = U.validity(until); rows.push({ _dim: U.user(u).status === 'left', p: person(U.user(u)), t: esc(U.training(t).name), s: badge(v.label, v.tone, true), src: U.chip(t === 't3' ? 'Test im Tool' : 'Termin') }); }));
      return head + tabsHtml + card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 't', label: 'Schulung' }, { key: 's', label: 'Gültigkeit' }, { key: 'src', label: 'Quelle' }], rows), { flush: true });
    }
    // Test
    return head + tabsHtml + `<div class="grid g-2">${card('Test: Tuning Stufe 1', `<div class="row between"><span class="muted">Frage 3 von 12</span>${badge('noch 08:41', 'warn')}</div><div class="bar" style="margin:10px 0 16px"><span style="width:25%"></span></div><h3 style="font-size:15px;margin-bottom:12px">Welche Teile brauchst du für „Bremsen Stufe 2“? <span class="muted" style="font-weight:400">(mehrere richtig)</span></h3>
      ${['Bremsscheiben Sport (Satz)', 'Sportfedern (Satz)', 'Bremsflüssigkeit', 'Turbolader'].map((a, i) => `<label class="list-item" style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer"><input type="checkbox" ${i === 0 ? 'checked' : ''}> ${esc(a)}</label>`).join('')}
      <div class="row between mt">${btn('Zurück', {})}${btn('Weiter', { cls: 'primary' })}</div>`, { sub: 'Ansicht für Teilnehmende' })}
      ${card('Einstellungen des Tests', `<div class="form cols-2">${U.field('Bestehensgrenze', U.input('70 %'))}${U.field('Zeitlimit', U.input('15 Minuten'))}${U.field('Versuche je Person', U.input('3'))}${U.field('Voraussetzung', U.select(['Teilnahme an einem Termin', 'keine'], 'Teilnahme an einem Termin'))}</div><hr><div class="switch"><div class="txt">Fragen und Antworten mischen</div>${U.toggle(true)}</div><div class="switch"><div class="txt">Teilpunkte<small class="muted">Eine Frage zählt nur, wenn genau die richtigen Antworten gewählt sind</small></div>${U.toggle(false)}</div>`, { sub: 'nur mit „Verwalten“', foot: 'Lösungen werden nie an Teilnehmende ausgeliefert; bewertet wird auf dem Server.' })}</div>`;
  };

  P.lizenzen = function (params, q) {
    const tab = q.tab || 'mitarbeiter';
    const head = pageHead('Lizenzen', 'Scheine der Mitarbeiter und der Firma', lvl('licenses') >= 3 ? btn('Neue Lizenz', { cls: 'primary', icon: 'plus', action: 'toast', arg: 'Neue Lizenz (Mockup)' }) : '');
    const tabsHtml = U.tabs('#/lizenzen', [['mitarbeiter', 'Mitarbeiter', D.licenses.filter((l) => l.user).length], ['firma', 'Firma', D.licenses.filter((l) => !l.user).length], ['arten', 'Lizenzarten', D.licenseTypes.length]], tab);
    const LS = { valid: null, suspended: ['Gesperrt', 'bad'], revoked: ['Entzogen', 'bad'] };
    const row = (l) => { const v = U.validity(l.expires); const st = LS[l.status] ? badge(LS[l.status][0], LS[l.status][1], true) : badge(v.label, v.tone, true); return { _dim: l.status === 'revoked', t: `<b>${esc(U.ltype(l.type).name)}</b>${l.reason ? `<span class="sub">${esc(l.reason)}</span>` : ''}`, h: l.user ? person(U.user(l.user)) : badge(D.firm.name, 'accent'), n: `<span class="mono">${esc(l.no)}</span>`, i: esc(l.issuer), d: date(l.issued), e: date(l.expires), s: st, a: l.status === 'valid' ? btn('Verlängern', { cls: 'sm', action: 'toast', arg: 'Um Standard-Gültigkeit verlängert (Mockup)' }) : '' }; };
    const cols = [{ key: 't', label: 'Lizenz' }, { key: 'h', label: 'Inhaber' }, { key: 'n', label: 'Nummer' }, { key: 'i', label: 'Aussteller' }, { key: 'd', label: 'Ausgestellt' }, { key: 'e', label: 'Ablauf' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }];
    if (tab === 'mitarbeiter') return head + tabsHtml + card('', table(cols, D.licenses.filter((l) => l.user).map(row)), { flush: true });
    if (tab === 'firma') return head + tabsHtml + note('Firmenlizenzen warnen 30 Tage vor Ablauf alle, die Lizenzen verwalten dürfen.', 'info') + `<div class="mt">${card('', table(cols, D.licenses.filter((l) => !l.user).map(row)), { flush: true })}</div>`;
    return head + tabsHtml + card('', table([{ key: 'n', label: 'Lizenzart' }, { key: 'h', label: 'Inhaber' }, { key: 'm', label: 'Standard-Gültigkeit' }, { key: 'u', label: 'Benötigt für' }], D.licenseTypes.map((t) => ({ n: `<b>${esc(t.name)}</b>`, h: t.holder === 'member' ? 'Mitarbeiter' : 'Firma', m: t.months + ' Monate', u: D.catalog.filter((i) => i.req.includes(t.id)).map((i) => U.chip(i.name)).join(' ') || '–' }))), { flush: true });
  };

  P.qualifikationen = function (params, q) {
    const staff = activeStaff();
    const cols = D.trainings.map((t) => ['t', t]).concat(D.licenseTypes.filter((l) => l.holder === 'member').map((l) => ['l', l]));
    const promoteTo = q.rank || 'r3';
    const head = pageHead('Qualifikationen', 'Wer darf was? Pflichtqualifikationen des Rangs sind umrandet.', '');
    let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Mitarbeiter</th>${cols.map(([k, c]) => `<th style="min-width:96px">${esc(c.name)}${k === 'l' ? '<br><span class="faint" style="text-transform:none;font-weight:500">Lizenz</span>' : ''}</th>`).join('')}</tr></thead><tbody>`;
    staff.forEach((s) => {
      const req = D.rankReq[s.rank] || [];
      t += `<tr><td>${person(s, U.rank(s.rank).name)}</td>${cols.map(([k, c]) => {
        let v;
        if (k === 't') v = U.validity(D.certs[s.id] ? D.certs[s.id][c.id] : undefined);
        else { const l = D.licenses.find((x) => x.user === s.id && x.type === c.id); v = !l ? U.validity(undefined) : l.status !== 'valid' ? { cls: 'bad', label: l.status === 'suspended' ? 'Gesperrt' : 'Entzogen' } : U.validity(l.expires); }
        return `<td title="${esc(v.label)}"><span class="qdot ${v.cls} ${req.includes(c.id) ? 'req' : ''}"></span></td>`;
      }).join('')}</tr>`;
    });
    t += '</tbody></table></div>';
    const legend = `<div class="legend mt"><span><span class="qdot ok"></span>gültig</span><span><span class="qdot warn"></span>läuft in 30 Tagen ab</span><span><span class="qdot bad"></span>abgelaufen / gesperrt</span><span><span class="qdot none"></span>fehlt</span><span><span class="qdot ok req"></span>Pflicht für den Rang</span></div>`;
    // Beförderung prüfen
    const cand = staff.filter((s) => U.rank(s.rank).pos < U.rank(promoteTo).pos);
    const need = D.rankReq[promoteTo] || [];
    const promo = cand.map((s) => { const miss = need.filter((tid) => { const c = D.certs[s.id] && D.certs[s.id][tid]; return c === undefined || (c !== null && U.daysUntil(c) < 0); }); return `<div class="list-item">${avatar(s)}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${esc(U.rank(s.rank).name)}</div></div>${miss.length ? `<div class="chips">${miss.map((m) => `<span class="badge bad">fehlt: ${esc(U.training(m).name)}</span>`).join('')}</div>` : badge('erfüllt alle Pflichten', 'ok', true)}</div>`; }).join('');
    return head + card('', t + `<div style="padding:0 16px 14px">${legend}</div>`, { flush: true }) +
      `<div class="mt">${card('Beförderung prüfen', `<div class="row" style="padding:12px 16px"><span class="muted">Ziel-Rang</span><div style="width:220px">${U.select(D.ranks.filter((r) => D.rankReq[r.id] && D.rankReq[r.id].length).map((r) => [r.id, r.name]), promoteTo, 'data-action="promote-rank"')}</div><span class="muted">Pflicht: ${need.map((n) => esc(U.training(n).name)).join(', ')}</span></div><div class="list">${promo || '<div class="empty">Niemand unter diesem Rang</div>'}</div>`, { flush: true })}</div>`;
  };

  P.personalakten = function (params, q) {
    const sel = q.u || 'u7';
    const s = U.user(sel);
    const KIND = { Verwarnung: 'bad', Belobigung: 'ok', Gespräch: 'info', Beförderung: 'accent', Austritt: '' };
    const entries = D.staffEntries.filter((e) => e.user === sel);
    const list = D.staff.filter((x) => x.rank).map((x) => `<a class="list-item ${x.id === sel ? 'active' : ''}" href="#/personalakten?u=${x.id}" style="${x.id === sel ? 'background:var(--accent-soft)' : ''}">${avatar(x)}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">${esc(U.rank(x.rank).name)} · ${esc(x.staffNo)}</div></div>${D.staffEntries.filter((e) => e.user === x.id).length ? `<span class="badge">${D.staffEntries.filter((e) => e.user === x.id).length}</span>` : ''}</a>`).join('');
    const tl = entries.map((e) => `<div class="tl-item"><div class="when">${date(e.date)} · ${esc(U.user(e.author).name)}</div><div class="what">${badge(e.kind + (e.level ? ' · Stufe ' + e.level : ''), KIND[e.kind])} ${e.self ? '<span class="faint" style="font-size:12px">für Mitarbeiter sichtbar</span>' : `<span class="faint" style="font-size:12px">${icon('lock', 'width="11" height="11"')} nur Leitung</span>`}</div><div style="margin-top:4px">${esc(e.text)}</div>${e.expires ? `<div class="muted" style="font-size:12px">läuft ab am ${date(e.expires)}</div>` : ''}</div>`).join('');
    const rh = `<div class="list-item" style="padding:6px 0"><div class="grow">Eintritt als ${s.id === 'u3' ? 'Mechaniker' : esc(U.rank(s.rank).name)}</div><span class="muted">${date(s.joined)}</span></div>` + (s.id === 'u3' ? `<div class="list-item" style="padding:6px 0"><div class="grow">Beförderung → Meister</div><span class="muted">${date('2026-02-01')}</span></div>` : '');
    return pageHead('Personalakten', 'Vermerke, Verwarnungen, Belobigungen und Rang-Historie · nur mit Recht „Personalakten“', '') +
      `<div class="grid" style="grid-template-columns:300px 1fr">${card('', `<div class="list">${list}</div>`, { flush: true })}
      <div class="stack">${card(`${avatar(s)} ${esc(s.name)}`, `<div class="grid g-4">${[['Rang', U.rank(s.rank).name], ['Personalnr.', s.staffNo], ['Eintritt', date(s.joined)], ['Status', U.userStatus[s.status][0]]].map(([k, v]) => `<div><div class="muted" style="font-size:12px">${k}</div><b>${esc(v)}</b></div>`).join('')}</div>`, { actions: btn('Neuer Eintrag', { cls: 'primary sm', icon: 'plus', action: 'toast', arg: 'Neuer Eintrag (Mockup)' }) })}
      <div class="grid g-2">${card('Einträge', entries.length ? `<div class="timeline">${tl}</div>` : '<div class="empty">Keine Einträge</div>')}${card('Rang-Historie', rh)}</div></div></div>`;
  };

  P.brett = function () {
    return pageHead('Schwarzes Brett', 'Ankündigungen der Leitung mit Lesebestätigung', lvl('board') >= 3 ? btn('Neue Ankündigung', { cls: 'primary', icon: 'plus', action: 'toast', arg: 'Neue Ankündigung (Mockup)' }) : '') +
      `<div class="stack">${D.boardPosts.map((p) => card(`${p.pinned ? icon('pin', 'width="14" height="14" style="color:var(--accent);vertical-align:-2px"') + ' ' : ''}${esc(p.title)}`, `<p>${U.md(p.text)}</p><div class="row between mt"><span class="person">${avatar(U.user(p.author), 'sm')} <span class="muted">${esc(U.user(p.author).name)} · ${date(p.date)} · an alle</span></span><div class="row" style="min-width:220px">${U.bar(p.reads / p.of * 100, 'ok')}<span class="muted nowrap">gelesen ${p.reads}/${p.of}</span></div></div>`, { actions: btn('Gelesen', { cls: 'sm', icon: 'check', action: 'toast', arg: 'Als gelesen markiert (Mockup)' }) })).join('')}</div>`;
  };
})();
