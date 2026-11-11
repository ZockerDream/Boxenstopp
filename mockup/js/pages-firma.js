/* Boxenstopp – Seiten: Firma, Administration, Konto */
(function () {
  'use strict';
  const D = window.BX.data;
  const U = window.BX.ui;
  const P = window.BX.pages;
  const S = () => window.BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, person, avatar, note, field, input, select, toggle } = U;
  const perm = () => window.BX.perm;

  // ---------------- Mitarbeiter ----------------
  P.mitarbeiter = function () {
    const rows = D.staff.filter((s) => s.rank).map((s) => ({
      _dim: s.status === 'left', _filter: s.name + ' ' + s.staffNo,
      p: person(s, s.email), n: `<span class="mono">${esc(s.staffNo)}</span><span class="sub">Dienstnr. ${esc(s.dutyNo)}</span>`, r: `<b>${esc(U.rank(s.rank).name)}</b>${s.owner ? ' ' + badge('Inhaberin', 'accent') : ''}`,
      g: `<div class="chips">${s.groups.map((g) => U.chip(U.group(g).name)).join('') || '<span class="faint">–</span>'}</div>`,
      d: D.onDuty[s.id] ? badge('im Dienst', 'ok', true) : '<span class="faint">–</span>', s: badge(U.userStatus[s.status][0], U.userStatus[s.status][1], true), j: date(s.joined),
      a: `<a class="btn sm ghost" href="#/users?q=${s.id}" title="Zugang im User-Management">${icon('userkey')}</a><a class="btn sm ghost" href="#/berechtigungen?tab=wer&u=${s.id}" title="Was darf ${esc(s.name)}?">${icon('shield')}</a>`,
    }));
    return pageHead('Mitarbeiter', 'Fachliche Daten: Rang, Gruppen, Personalnummer, Lohnmodell. Den Zugang (Login, 2FA, Sperre) verwaltet das User-Management.', btn('Einladen', { icon: 'plus', action: 'modal', arg: 'invite' }) + btn('Neuer Mitarbeiter', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'invite' })) +
      card('', `<div class="row mb"><input class="input" style="max-width:320px" placeholder="Name oder Personalnummer …" data-action="filter" data-target="#staffTable"></div>` + table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'n', label: 'Personalnr.' }, { key: 'r', label: 'Rang' }, { key: 'g', label: 'Gruppen' }, { key: 'd', label: 'Dienst' }, { key: 's', label: 'Status' }, { key: 'j', label: 'Eintritt' }, { key: 'a', label: '' }], rows, { id: 'staffTable' }));
  };

  // ---------------- Ränge & Gruppen ----------------
  P.raenge = function () {
    const ranks = D.ranks.slice().sort((a, b) => b.pos - a.pos).map((r, i, arr) => {
      const n = D.staff.filter((s) => s.rank === r.id && s.status !== 'left').length;
      const req = (D.rankReq[r.id] || []).map((t) => U.chip(U.training(t).name)).join('');
      return `<div class="list-item"><div style="display:flex;flex-direction:column;gap:2px"><button class="btn sm ghost" ${i === 0 ? 'disabled' : ''} data-action="toast" data-arg="Rang nach oben (Mockup)">▲</button><button class="btn sm ghost" ${i === arr.length - 1 ? 'disabled' : ''} data-action="toast" data-arg="Rang nach unten (Mockup)">▼</button></div><div class="grow"><div class="title">${esc(r.name)} <span class="muted" style="font-weight:400">· ${n} Mitglieder</span></div><div class="meta">${esc(r.pay)}</div>${req ? `<div class="chips" style="margin-top:6px"><span class="faint" style="font-size:11.5px">Pflicht:</span>${req}</div>` : ''}</div><a class="btn sm" href="#/berechtigungen">Rechte</a>${btn('', { cls: 'sm ghost', icon: 'trash', action: 'toast', arg: n ? 'Ein Rang mit Mitgliedern lässt sich nicht löschen' : 'Rang gelöscht (Mockup)', title: 'Löschen' })}</div>`;
    }).join('');
    const groups = D.groups.map((g) => { const m = D.staff.filter((s) => s.groups.includes(g.id) && s.status !== 'left'); return `<div class="list-item"><div class="grow"><div class="title">${esc(g.name)}</div><div class="meta">${esc(g.desc)}</div></div><span class="avatars">${m.map((s) => avatar(s, 'sm')).join('')}</span></div>`; }).join('');
    return pageHead('Ränge & Gruppen', 'Jeder Mitarbeiter hat genau einen Rang und beliebig viele Gruppen.', btn('Neue Gruppe', { icon: 'plus', action: 'toast', arg: 'Neue Gruppe (Mockup)' }) + btn('Neuer Rang', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'new-rank' })) +
      `<div class="grid g-2">${card('Ränge', `<div class="list">${ranks}</div>`, { flush: true, sub: 'höchster oben', foot: 'Nicht-Inhaber verwalten nur Ränge und Mitarbeiter unter ihrem eigenen Rang.' })}${card('Gruppen', `<div class="list">${groups}</div>`, { flush: true, sub: 'quer zu Rängen' })}</div>`;
  };

  // ---------------- Berechtigungen ----------------
  const lvlCell = (v, arg, locked, allowed) => `<span class="lvl lvl-${v} ${locked ? 'locked' : ''}" ${locked ? '' : `data-action="perm-cycle" data-arg="${arg}"`} title="${locked ? 'Inhaber dürfen immer alles' : 'Klicken zum Ändern'}">${v === null ? '–' : esc(U.levelNames[v])}</span>`;
  P.berechtigungen = function (params, q) {
    const tab = q.tab || 'raenge';
    const head = pageHead('Berechtigungen', 'Stufen je Funktion für Ränge, Gruppen und einzelne Mitarbeiter. Es gilt das höchste Recht aus Rang und Gruppen; persönlich Gesetztes geht vor.', btn('Vorlage anwenden', { action: 'toast', arg: 'Rechtevorlagen: Leitung, Mechaniker, Azubi, Buchhaltung, Nur lesen (Mockup)' }));
    const tabsHtml = U.tabs('#/berechtigungen', [['raenge', 'Ränge'], ['gruppen', 'Gruppen'], ['personen', 'Persönlich', Object.keys(D.userPerms).length], ['einzel', 'Einzelrechte'], ['wer', 'Was darf X?']], tab);
    const legend = `<div class="legend mb">${U.levelNames.map((l, i) => `<span><span class="lvl lvl-${i}" style="min-width:0">${esc(l)}</span></span>`).join('')}</div>`;
    if (tab === 'raenge') {
      const ranks = D.ranks.slice().sort((a, b) => b.pos - a.pos);
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Funktion</th>${ranks.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr></thead><tbody>`;
      D.modules.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b></td>${ranks.map((r) => `<td>${lvlCell(D.rankPerms[r.id][k], 'rank:' + r.id + ':' + k, r.id === 'r1')}</td>`).join('')}</tr>`; });
      t += '</tbody></table></div>';
      return head + tabsHtml + legend + card('', t, { flush: true, foot: 'Klicke eine Zelle, um die Stufe zu ändern. Niemand vergibt mehr, als er selbst hat. Die Geschäftsführung ist Inhaber-Rang und darf immer alles.' });
    }
    if (tab === 'gruppen') {
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Funktion</th>${D.groups.map((g) => `<th>${esc(g.name)}</th>`).join('')}</tr></thead><tbody>`;
      D.modules.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b></td>${D.groups.map((g) => { const v = D.groupPerms[g.id][k]; return `<td>${v === undefined ? `<span class="lvl" style="color:var(--faint)" data-action="perm-cycle" data-arg="group:${g.id}:${k}">nicht gesetzt</span>` : lvlCell(v, 'group:' + g.id + ':' + k)}</td>`; }).join('')}</tr>`; });
      t += '</tbody></table></div>';
      return head + tabsHtml + legend + card('', t, { flush: true, foot: 'Gruppen heben Rechte an („nicht gesetzt“ = es gilt der Rang).' });
    }
    if (tab === 'personen') {
      const rows = Object.entries(D.userPerms).flatMap(([u, m]) => Object.entries(m).map(([k, v]) => ({ p: person(U.user(u), U.rank(U.user(u).rank).name), f: esc(D.modules.find((x) => x[0] === k)[1]), r: lvlCell(D.rankPerms[U.user(u).rank][k], '', true), v: lvlCell(v, 'user:' + u + ':' + k), x: btn('', { cls: 'sm ghost', icon: 'trash', action: 'toast', arg: 'Ausnahme entfernt (Mockup)' }) })));
      return head + tabsHtml + note('Persönliche Rechte gelten <b>genau so</b>, auch wenn sie niedriger sind als Rang oder Gruppe – z. B. um jemandem die Personalakten zu entziehen.', 'info') + `<div class="mt">${card('', table([{ key: 'p', label: 'Mitarbeiter' }, { key: 'f', label: 'Funktion' }, { key: 'r', label: 'Vom Rang' }, { key: 'v', label: 'Persönlich' }, { key: 'x', label: '' }], rows), { flush: true, actions: btn('Ausnahme hinzufügen', { cls: 'sm', icon: 'plus', action: 'toast', arg: 'Persönliche Ausnahme (Mockup)' }) })}</div>`;
    }
    if (tab === 'einzel') {
      const ranks = D.ranks.slice().sort((a, b) => b.pos - a.pos);
      const fmt = (f, v) => v === undefined ? '<span class="faint">–</span>' : f.type === 'percent' ? `<b>${v} %</b>` : v ? `<span style="color:var(--ok)">${icon('check', 'width="16" height="16"')}</span>` : '<span class="faint">✕</span>';
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Einzelrecht</th>${ranks.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>Gruppen</th></tr></thead><tbody>`;
      D.flags.forEach((f) => { t += `<tr><td><b>${esc(f.label)}</b><span class="sub mono">${esc(f.key)}</span></td>${ranks.map((r) => `<td>${fmt(f, f.ranks[r.id])}</td>`).join('')}<td>${Object.entries(f.groups).map(([g, v]) => U.chip(U.group(g).name + ': ' + (f.type === 'percent' ? v + ' %' : 'ja'))).join(' ') || '–'}</td></tr>`; });
      return head + tabsHtml + card('', t + '</tbody></table></div>', { flush: true, foot: 'Rabatte über dem eigenen Wert lösen eine Freigabe-Anfrage an jemanden mit höherem Wert aus.' });
    }
    // Was darf X?
    const uid = q.u || 'u6';
    const u = U.user(uid);
    const rows = D.modules.map(([k, l]) => { const r = perm().explain(uid, k); return { f: `<b>${esc(l)}</b>`, v: lvlCell(r.level, '', true), s: esc(r.source) }; });
    const flags = D.flags.map((f) => ({ f: esc(f.label), v: f.type === 'percent' ? perm().flag(uid, f.key) + ' %' : perm().flag(uid, f.key) ? 'ja' : 'nein' }));
    return head + tabsHtml + `<div class="row mb"><div style="width:280px">${select(D.staff.filter((s) => s.rank && s.status !== 'left').map((s) => [s.id, s.name + ' · ' + U.rank(s.rank).name]), uid, 'data-action="who-select"')}</div><span class="muted">Rang <b>${esc(U.rank(u.rank).name)}</b>${u.groups.length ? ' · Gruppen ' + u.groups.map((g) => '<b>' + esc(U.group(g).name) + '</b>').join(', ') : ''}${u.owner ? ' · <b>Inhaberin</b>' : ''}</span></div>` +
      `<div class="grid g-side">${card('Wirksame Rechte', table([{ key: 'f', label: 'Funktion' }, { key: 'v', label: 'Stufe' }, { key: 's', label: 'Woher' }], rows), { flush: true })}${card('Einzelrechte', table([{ key: 'f', label: 'Recht' }, { key: 'v', label: 'Wert' }], flags), { flush: true })}</div>`;
  };

  // ---------------- Logo ----------------
  function logoCard() {
    const L = window.BX.look;
    const picks = L.LOGO_PRESETS.map((p) => `<button type="button" class="logo-pick ${L.logo.kind === 'preset' && L.logo.preset === p ? 'active' : ''}" data-action="logo" data-arg="${p}" title="${p}"><span class="brand-mark">${icon(p)}</span></button>`).join('');
    return card('Logo', `<div class="row" style="gap:20px;align-items:flex-start">
        <div class="center">${L.logoHtml('lg')}<div class="muted" style="font-size:12px;margin-top:6px">Vorschau</div></div>
        <div class="grow" style="min-width:240px">
          <div class="field"><label>Vorlage (in der Akzentfarbe des Betrachters)</label><div class="logo-picks">${picks}</div></div>
          <div class="row mt"><label class="btn" for="logoFile">${icon('image')}Eigenes Logo hochladen</label><input type="file" id="logoFile" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-action="logo-upload">${btn('Zurücksetzen', { cls: 'ghost', action: 'logo', arg: 'reset' })}</div>
          <p class="muted" style="font-size:12px;margin-top:8px">PNG, JPEG, WebP oder SVG, höchstens 512 KB, am besten quadratisch. Erscheint in der Seitenleiste, beim Login, auf Rechnungen und auf der Preisliste. Der App-Name „Boxenstopp“ bleibt immer gleich.</p>
        </div></div>`, { sub: 'gilt für alle in der Firma' });
  }

  // ---------------- Firmen-Einstellungen ----------------
  P.firma = function (params, q) {
    const tab = q.tab || 'stammdaten';
    const head = pageHead('Firmen-Einstellungen', esc(D.firm.name), btn('Speichern', { cls: 'primary', icon: 'check', action: 'toast', arg: 'Einstellungen gespeichert (Mockup)' }));
    const tabsHtml = U.tabs('#/firma', [['stammdaten', 'Stammdaten'], ['rechnung', 'Rechnungsvorlage'], ['nummern', 'Nummernkreise'], ['steuer', 'Steuern'], ['klassen', 'Fahrzeugklassen'], ['funktionen', 'Funktionen']], tab);
    let body = '';
    if (tab === 'stammdaten') body = card('', `<div class="form cols-2">${field('Firmenname', input(D.firm.name))}${field('Kürzel für Nummern', input(D.firm.short, { mono: true }), { hint: 'z. B. RFG-2026-0042' })}${field('Adresse im RP', input(D.firm.address))}${field('Telefon', input(D.firm.phone))}${field('Öffnungszeiten', input(D.firm.hours))}</div>`) + `<div class="mt">${logoCard()}</div>`;
    else if (tab === 'rechnung') body = `<div class="grid g-2">${card('Vorlage', `<div class="form">${field('Fußtext', `<textarea class="input">${esc(D.firm.invoiceFooter)}</textarea>`)}${field('Zahlungsziel Standard', select(['sofort', '3 Tage', '7 Tage', '14 Tage'], '3 Tage'))}<div class="switch"><div class="txt">Fahrzeug auf der Rechnung zeigen</div>${toggle(true)}</div><div class="switch"><div class="txt">Rabatt je Position zeigen</div>${toggle(true)}</div></div>`)}${card('Vorschau', `<p class="muted">Siehe eine echte Rechnung:</p><a class="btn" href="#/rechnung/${D.invoices[0].id}">${esc(D.invoices[0].no)} öffnen</a>`)}</div>`;
    else if (tab === 'nummern') body = card('', table([{ key: 'k', label: 'Art' }, { key: 'f', label: 'Format' }, { key: 'n', label: 'Nächste Nummer' }], [{ k: 'Aufträge', f: '<span class="mono">RFG-JJJJ-0000</span>', n: '<span class="mono">RFG-2026-0047</span>' }, { k: 'Rechnungen', f: '<span class="mono">RFG-R-JJJJ-0000</span>', n: '<span class="mono">RFG-R-2026-0124</span>' }, { k: 'Einsätze', f: '<span class="mono">E-JJJJ-0000</span>', n: '<span class="mono">E-2026-0188</span>' }]), { flush: true, foot: 'Nummern sind lückenlos und beginnen jedes Jahr neu. Ändern nur für das nächste Jahr möglich.' });
    else if (tab === 'steuer') body = card('', `<div class="form cols-2">${field('Steuersatz', input(D.firm.taxRate + ' %'), { hint: 'gilt ab dem gewählten Datum; ältere Zeiträume behalten ihren Satz' })}${field('Gültig ab', input('11.11.2026'))}${field('Steuerzeitraum', select(['Woche', 'Monat'], D.firm.taxPeriod))}${field('Abführen vom Konto', select(['Steuer-Rücklage', 'Firmenkonto'], 'Steuer-Rücklage'))}</div><hr><div class="switch"><div class="txt">Steuer-Rücklage automatisch füllen<small class="muted">Bei jeder Zahlung wird der Steueranteil auf das Rücklagekonto umgebucht</small></div>${toggle(true)}</div>`, { foot: 'Festpreise: Rechnungen zeigen keine Steuer. Keine Vorsteuer, keine weiteren Abgaben (Entscheidung vom 11.11.2026).' });
    else if (tab === 'klassen') body = card('', `<div class="list">${D.vehicleClasses.map((c) => `<div class="list-item"><span class="faint">⋮⋮</span><div class="grow"><b>${esc(c.name)}</b></div><span class="muted">${D.vehicles.filter((v) => v.cls === c.id).length} Fahrzeuge</span></div>`).join('')}</div>`, { flush: true, actions: btn('Neue Klasse', { cls: 'sm', icon: 'plus', action: 'toast', arg: 'Neue Fahrzeugklasse (Mockup)' }) });
    else body = card('', [['Lager', 'Teile, Bestand, Sets. Aus: nur Pauschal- und Arbeitspreise', true], ['Einsätze', 'Abschlepp- und Pannendienst', true], ['Termine & Stellplätze', 'Kalender mit Hebebühnen', true], ['Steuer-Rücklage', 'Automatische Umbuchung bei Zahlungen', true], ['Test im Tool', 'Schulungen mit Online-Test', true], ['Vier-Augen-Prüfung', 'Meister prüft vor „Fertig“', false], ['Öffentliche Preisliste', 'Link ohne Login', true], ['Qualifikationsprüfung hart', 'Aus = nur Warnung', false]].map(([t, s, on]) => `<div class="switch"><div class="txt"><b>${esc(t)}</b><small class="muted">${esc(s)}</small></div>${toggle(on)}</div>`).join(''), { foot: 'Ausgeschaltete Funktionen verschwinden aus der Navigation; Daten bleiben erhalten.' });
    return head + tabsHtml + body;
  };

  // ---------------- User-Management ----------------
  P.users = function (params, q) {
    const tab = q.tab || 'benutzer';
    const head = pageHead('User-Management', 'Zugang zur App: Konten, Status, 2FA, Sitzungen und Systemrollen', btn('CSV', { icon: 'download', action: 'toast', arg: 'Benutzer als CSV (Mockup)' }) + btn('Einladen', { icon: 'plus', action: 'modal', arg: 'invite' }) + btn('Benutzer anlegen', { cls: 'primary', icon: 'plus', action: 'modal', arg: 'invite' }));
    const tabsHtml = U.tabs('#/users', [['benutzer', 'Benutzer', D.staff.length], ['rollen', 'Rollen & Rechte', D.systemRoles.length], ['einladungen', 'Einladungen', D.invitations.length]], tab);
    if (tab === 'benutzer') {
      const admins = D.staff.filter((s) => s.sys.includes('admin') && s.status === 'active');
      const rows = D.staff.map((s) => {
        const lastAdmin = admins.length === 1 && admins[0].id === s.id;
        return {
          _dim: s.status === 'left', _filter: s.name + ' ' + s.email,
          p: person(s, s.email), s: badge(U.userStatus[s.status][0], U.userStatus[s.status][1], true),
          r: s.sys.length ? s.sys.map((r) => badge(U.byId(D.systemRoles, r).name, r === 'admin' ? 'accent' : 'violet')).join(' ') : '<span class="muted">Benutzer</span>',
          k: s.rank ? esc(U.rank(s.rank).name) : '<span class="faint">kein Rang</span>', f: s.twofa ? badge('2FA', 'ok') : badge('ohne 2FA', 'warn'), l: date(s.lastLogin), e: s.id === 'u9' ? date('2026-12-31') : '–',
          a: `<div class="row" style="gap:2px;flex-wrap:nowrap">${btn('', { cls: 'sm ghost', icon: 'lock', title: lastAdmin ? 'Der letzte aktive Administrator kann nicht gesperrt werden' : 'Sperren', disabled: lastAdmin || s.status === 'left', action: 'toast', arg: s.name + ' gesperrt (Mockup)' })}${btn('', { cls: 'sm ghost', icon: 'shield', title: '2FA erzwingen / zurücksetzen', action: 'toast', arg: '2FA für ' + s.name + ' zurückgesetzt (Mockup)' })}${btn('', { cls: 'sm ghost', icon: 'logout', title: 'Alle Sitzungen beenden', action: 'toast', arg: 'Sitzungen von ' + s.name + ' beendet (Mockup)' })}${btn('', { cls: 'sm ghost', icon: 'link', title: 'Passwort-Reset-Link', action: 'toast', arg: 'Reset-Link kopiert (Mockup)' })}</div>`,
        };
      });
      const pend = D.pendingRegs.map((r) => note(`<b>Registrierung wartet auf Freigabe:</b> ${esc(r.name)} (${esc(r.email)}) · ${date(r.at)} <div class="row" style="margin-top:8px">${btn('Freigeben als Praktikant', { cls: 'sm primary', action: 'toast', arg: 'Freigegeben (Mockup)' })}${btn('Ablehnen', { cls: 'sm', action: 'toast', arg: 'Abgelehnt (Mockup)' })}</div>`, 'info')).join('');
      return head + tabsHtml + (pend ? `<div class="mb">${pend}</div>` : '') + card('', `<div class="row mb" style="gap:8px"><input class="input" style="max-width:260px" placeholder="Name oder E-Mail …" data-action="filter" data-target="#userTable" value="${esc(q.q ? U.user(q.q).name : '')}"><div style="width:160px">${select(['Alle Status', 'Aktiv', 'Gesperrt', 'Ausgeschieden'], 'Alle Status')}</div><div style="width:160px">${select(['Alle Rollen', 'Administrator', 'Support', 'Benutzer'], 'Alle Rollen')}</div><div style="width:140px">${select(['2FA egal', 'mit 2FA', 'ohne 2FA'], '2FA egal')}</div></div>` + table([{ key: 'p', label: 'Benutzer' }, { key: 's', label: 'Status' }, { key: 'r', label: 'Systemrolle' }, { key: 'k', label: 'Rang' }, { key: 'f', label: '2FA' }, { key: 'l', label: 'Letzter Login' }, { key: 'e', label: 'Zugang bis' }, { key: 'a', label: '' }], rows, { id: 'userTable' }), { foot: 'Zugangsablauf gilt bis einschließlich zum gewählten Tag. Der letzte aktive Administrator kann weder gesperrt noch befristet werden.' });
    }
    if (tab === 'rollen') {
      let t = `<div class="table-wrap"><table class="table matrix no-stack"><thead><tr><th>Systemrecht</th>${D.systemRoles.map((r) => `<th>${esc(r.name)}${r.fixed ? '<br><span class="faint" style="text-transform:none;font-weight:500">fest</span>' : ''}</th>`).join('')}</tr></thead><tbody>`;
      D.systemPerms.forEach(([k, l]) => { t += `<tr><td><b>${esc(l)}</b><span class="sub mono">${esc(k)}</span></td>${D.systemRoles.map((r) => `<td><input type="checkbox" ${D.sysRolePerms[r.id].includes(k) ? 'checked' : ''} ${r.fixed ? 'disabled' : ''}></td>`).join('')}</tr>`; });
      return head + tabsHtml + note('Systemrollen regeln nur die <b>Administration</b>. Was jemand in der Werkstatt darf, kommt aus Rang, Gruppen und Berechtigungen.', 'info') + `<div class="mt">${card('', t + '</tbody></table></div>', { flush: true, actions: btn('Neue Rolle', { cls: 'sm', icon: 'plus', action: 'toast', arg: 'Neue Systemrolle (Mockup)' }), foot: 'Standardrolle für neue Benutzer: Benutzer' })}</div>`;
    }
    return head + tabsHtml + card('', table([{ key: 'e', label: 'E-Mail' }, { key: 'r', label: 'Rang' }, { key: 's', label: 'Systemrolle' }, { key: 'b', label: 'Erstellt von' }, { key: 'x', label: 'Läuft ab' }, { key: 'a', label: '' }], D.invitations.map((i) => ({ e: esc(i.email), r: esc(U.rank(i.rank).name), s: esc(U.byId(D.systemRoles, i.role).name), b: person(U.user(i.by)), x: i.expired ? badge('abgelaufen', 'bad') : date(i.expires), a: `<div class="row" style="gap:4px">${btn('Link kopieren', { cls: 'sm', action: 'toast', arg: 'Einladungslink kopiert (Mockup)' })}${btn('Widerrufen', { cls: 'sm danger', action: 'toast', arg: 'Einladung widerrufen (Mockup)' })}</div>` }))), { flush: true });
  };

  // ---------------- Server-Management ----------------
  P.server = function (params, q) {
    const tab = q.tab || 'uebersicht';
    const head = pageHead('Server-Management', 'Version 0.1.0 · Migration 001 · läuft seit 3 Tagen', '');
    const tabsHtml = U.tabs('#/server', [['uebersicht', 'Übersicht'], ['sicherheit', 'Sicherheit & Einstellungen'], ['system', 'System & Backups'], ['integrationen', 'Integrationen'], ['audit', 'Audit-Log']], tab);
    if (tab === 'uebersicht') {
      const act = D.revenue14.map((d, i) => ({ label: U.shortDate(d.date), v: [14, 18, 11, 22, 25, 19, 9, 16, 21, 24, 28, 17, 23, 26][i] }));
      const roleDist = [{ label: 'Administrator', v: 1 }, { label: 'Support', v: 1 }, { label: 'Benutzer', v: D.staff.length - 2 }];
      return head + tabsHtml + `<div class="grid g-6">${kpi('Aktive Benutzer', D.staff.filter((s) => s.status === 'active').length, '1 wartet auf Freigabe', { icon: 'users' })}${kpi('Jetzt angemeldet', 6, '8 Sitzungen', { icon: 'userkey' })}${kpi('Im Dienst', Object.keys(D.onDuty).length, '', { icon: 'clock' })}${kpi('Datenbank', '182 MB', '+4 MB / Woche', { icon: 'server' })}${kpi('Uploads', '1,2 GB', '412 Dateien', { icon: 'image' })}${kpi('Letztes Backup', '03:00', 'heute · 18,4 MB', { icon: 'download', dir: 'up' })}</div>
        <div class="grid g-3 mt"><div class="span-2">${card('Anmeldungen je Tag', U.areaChart(act, { label: 'Anmeldungen je Tag' }).replace(/\$ /g, ''), { sub: '14 Tage' })}</div>${card('Systemrollen', U.donut(roleDist, { fmt: (v) => v, center: 'Benutzer', centerValue: String(D.staff.length), label: 'Verteilung der Systemrollen' }))}</div>
        <div class="mt">${card('Letzte Ereignisse', `<div class="list">${D.audit.slice(0, 6).map((a) => `<div class="list-item">${a.user ? avatar(U.user(a.user), 'sm') : `<span class="avatar sm">${icon('server', 'width="12" height="12"')}</span>`}<div class="grow"><div class="title">${esc(a.action)} <span class="muted" style="font-weight:400">· ${esc(a.area)}</span></div><div class="meta">${esc(a.detail)}</div></div><span class="muted nowrap" style="font-size:12px">${date(a.at)}</span></div>`).join('')}</div>`, { flush: true, actions: `<a class="btn sm ghost" href="#/server?tab=audit">Audit-Log</a>` })}</div>`;
    }
    if (tab === 'sicherheit') {
      return head + tabsHtml + `<div class="grid g-2">
        ${card('Anmeldung & Sitzungen', `<div class="form cols-2">${field('Passwort-Mindestlänge', input('12'))}${field('Sitzungsdauer', select(['8 Stunden', '24 Stunden', '7 Tage', '30 Tage'], '7 Tage'))}${field('Sperre nach Fehlversuchen', input('5'))}${field('Sperrdauer', select(['5 Minuten', '15 Minuten', '1 Stunde'], '15 Minuten'))}${field('2FA-Pflicht', select(['aus', 'Administratoren', 'alle'], 'Administratoren'), { full: true })}</div>`)}
        ${card('Zugriff', `<div class="form">${field('Admin-IP-Allowlist', '<textarea class="input mono" placeholder="eine IP oder ein Netz je Zeile">10.0.0.0/24</textarea>', { hint: 'Wird nur gespeichert, wenn deine IP (10.0.0.14) enthalten ist' })}</div><div class="switch"><div class="txt"><b>Selbstregistrierung</b><small class="muted">Neue Konten warten ohne Rang auf Freigabe</small></div>${toggle(true)}</div><div class="switch"><div class="txt"><b>Wartungsmodus</b><small class="muted">Nur Administratoren kommen hinein</small></div>${toggle(false)}</div>${field('Hinweistext im Wartungsmodus', input('Wir schrauben gerade selbst – gleich wieder da.'))}`)}
        ${card('Allgemein', `<div class="form cols-2">${field('App-Name', input('Boxenstopp', { attrs: 'readonly' }), { hint: 'fest – Firmenname und Logo unter Firmen-Einstellungen' })}${field('Sprache', select(['Deutsch'], 'Deutsch'))}${field('Zeitzone', select(['Europe/Berlin', 'UTC'], 'Europe/Berlin'))}${field('Aufbewahrung Audit-Log', select(['90 Tage', '1 Jahr', 'unbegrenzt'], '1 Jahr'))}${field('Aufbewahrung Benachrichtigungen', select(['30 Tage', '90 Tage'], '90 Tage'))}${field('Aufbewahrung beendeter Sitzungen', select(['30 Tage', '90 Tage'], '30 Tage'))}</div>`)}
        ${card('E-Mail (SMTP)', `<div class="form cols-2">${field('Server', input('smtp.example.org', { mono: true }))}${field('Port', input('587'))}${field('Benutzer', input('noreply@example.org'))}${field('Passwort', input('••••••••', { type: 'password' }))}${field('Absender', input('Boxenstopp <noreply@example.org>'), { full: true })}</div>`, { actions: btn('Testmail senden', { cls: 'sm', action: 'toast', arg: 'Testmail an lena.brandt@rostfrei.rp gesendet (Mockup)' }) })}
      </div><div class="mt">${note('<b>TRUST_PROXY</b> ist gesetzt – Login-Sperre und Audit-Log sehen die echten IPs.', 'ok', 'check')}</div><div class="row mt">${btn('Speichern', { cls: 'primary', icon: 'check', action: 'toast', arg: 'Einstellungen gespeichert (Mockup)' })}</div>`;
    }
    if (tab === 'system') {
      const jobs = table([{ key: 'j', label: 'Job' }, { key: 'e', label: 'Rhythmus' }, { key: 'l', label: 'Letzter Lauf' }, { key: 'n', label: 'Nächster Lauf' }, { key: 's', label: 'Status' }, { key: 'a', label: '' }], D.jobs.map((j) => ({ j: `<b>${esc(j.label)}</b><span class="sub mono">${esc(j.key)}</span>${j.msg ? `<span class="sub" style="color:var(--bad)">${esc(j.msg)}</span>` : ''}`, e: esc(j.every), l: date(j.last), n: j.next === '–' ? '–' : date(j.next), s: j.status === 'ok' ? badge('OK', 'ok', true) : badge('Fehler', 'bad', true), a: btn('Jetzt ausführen', { cls: 'sm', icon: 'play', action: 'toast', arg: j.label + ' gestartet (Mockup)' }) })));
      const backups = table([{ key: 'f', label: 'Datei' }, { key: 's', label: 'Größe', num: true }, { key: 'a', label: 'Erstellt' }, { key: 'b', label: 'Von' }, { key: 'x', label: '' }], D.backups.map((b) => ({ f: `<span class="mono">${esc(b.file)}</span>`, s: esc(b.size), a: date(b.at), b: esc(b.by), x: `<div class="row" style="gap:4px">${btn('', { cls: 'sm ghost', icon: 'download', title: 'Download', action: 'toast', arg: 'Download gestartet (Mockup)' })}${btn('', { cls: 'sm ghost', icon: 'trash', title: 'Löschen', action: 'toast', arg: 'Backup gelöscht (Mockup)' })}</div>` })));
      const env = [['NODE_ENV', 'production'], ['APP_PORT', '8090'], ['DB_HOST', 'db'], ['DB_NAME', 'boxenstopp'], ['TRUST_PROXY', '1'], ['ENCRYPTION_KEY', '•••••••• (gesetzt)'], ['BACKUP_RETENTION_DAYS', '14'], ['TZ', 'Europe/Berlin']];
      return head + tabsHtml + card('Geplante Jobs', jobs, { flush: true }) + `<div class="grid g-side mt">${card('Backups', backups, { flush: true, sub: 'verschlüsselt · 14 Tage aufbewahrt', actions: btn('Backup jetzt', { cls: 'sm primary', icon: 'plus', action: 'toast', arg: 'Backup erstellt (Mockup)' }) })}${card('Umgebung', `<div class="list">${env.map(([k, v]) => `<div class="list-item" style="padding:6px 16px"><span class="mono grow" style="font-size:12px">${esc(k)}</span><span class="mono muted" style="font-size:12px">${esc(v)}</span></div>`).join('')}</div>`, { flush: true, sub: 'schreibgeschützt' })}</div>`;
    }
    if (tab === 'integrationen') {
      const wh = D.webhooks.map((w) => `<div class="list-item"><div class="grow"><div class="title">${esc(w.name)}</div><div class="meta mono">${esc(w.url)}</div><div class="chips" style="margin-top:6px">${w.events.map(U.chip).join('')}</div></div><div class="right"><div>${w.status === 'ok' ? badge('OK', 'ok', true) : badge('Fehler', 'bad', true)}</div><div class="muted" style="font-size:11.5px;margin-top:4px">${esc(w.last)}</div></div>${btn('Test', { cls: 'sm', action: 'toast', arg: 'Testnachricht an ' + w.name + ' gesendet (Mockup)' })}</div>`).join('');
      const keys = table([{ key: 'u', label: 'Benutzer' }, { key: 'n', label: 'Name' }, { key: 'p', label: 'Schlüssel' }, { key: 'c', label: 'Erstellt' }, { key: 'l', label: 'Zuletzt benutzt' }, { key: 'x', label: '' }], D.apiKeys.map((k) => ({ u: person(U.user(k.user)), n: esc(k.name), p: `<span class="mono">${esc(k.prefix)}…</span>`, c: date(k.created), l: date(k.last), x: btn('Widerrufen', { cls: 'sm danger', action: 'toast', arg: 'API-Schlüssel widerrufen (Mockup)' }) })));
      return head + tabsHtml + card('Discord-Webhooks', `<div class="list">${wh}</div>`, { flush: true, sub: 'nur ausgehende Meldungen', actions: btn('Neuer Webhook', { cls: 'sm', icon: 'plus', action: 'toast', arg: 'Neuer Webhook (Mockup)' }) }) + `<div class="mt">${card('API-Schlüssel aller Benutzer', keys, { flush: true, sub: 'nur lesender Zugriff auf die REST-API' })}</div>`;
    }
    const rows = D.audit.map((a) => ({ t: date(a.at), u: a.user ? person(U.user(a.user)) : '<span class="muted">System</span>', b: U.chip(a.area), a: `<b>${esc(a.action)}</b>`, d: esc(a.detail), ip: `<span class="mono muted">${esc(a.ip)}</span>` }));
    return head + tabsHtml + card('', `<div class="row mb" style="gap:8px"><div style="width:180px">${select(['Alle Benutzer'].concat(D.staff.map((s) => s.name)), 'Alle Benutzer')}</div><div style="width:170px">${select(['Alle Bereiche', 'Auftrag', 'Rechnung', 'Preisliste', 'Berechtigungen', 'Benutzer', 'Steuern', 'Server'], 'Alle Bereiche')}</div><div style="width:150px">${select(['Letzte 7 Tage', 'Letzte 30 Tage', 'Alles'], 'Letzte 7 Tage')}</div><div class="grow"></div>${btn('CSV', { icon: 'download', action: 'toast', arg: 'Audit-Log als CSV (Mockup)' })}</div>` + table([{ key: 't', label: 'Zeit' }, { key: 'u', label: 'Benutzer' }, { key: 'b', label: 'Bereich' }, { key: 'a', label: 'Aktion' }, { key: 'd', label: 'Details' }, { key: 'ip', label: 'IP' }], rows));
  };

  // ---------------- Tickets, Hilfe, Changelog ----------------
  const TS = { open: ['Offen', 'info'], in_progress: ['In Arbeit', 'warn'], done: ['Erledigt', 'ok'], rejected: ['Abgelehnt', ''] };
  P.tickets = function () {
    return pageHead('Tickets', 'Gemeldete Fehler', '') + card('', table([{ key: 'i', label: 'Nr.' }, { key: 't', label: 'Titel' }, { key: 'p', label: 'Seite' }, { key: 'b', label: 'Gemeldet von' }, { key: 'd', label: 'Datum' }, { key: 'c', label: 'Kommentare', num: true }, { key: 's', label: 'Status' }], D.tickets.map((t) => ({ i: `<span class="mono">${esc(t.id)}</span>`, t: `<b>${esc(t.title)}</b>`, p: U.chip(t.page), b: person(U.user(t.by)), d: date(t.at), c: t.comments, s: badge(TS[t.status][0], TS[t.status][1], true) }))), { flush: true });
  };
  P.fehler = function () {
    return pageHead('Fehler melden', 'Etwas klemmt? Beschreib kurz, was passiert ist.', '') + `<div class="grid g-side">${card('Neue Meldung', `<div class="form">${field('Titel', input('', { ph: 'Kurz und knackig' }))}${field('Seite', select(['Aufträge', 'Rechnungen', 'Preisliste', 'Dienstplan', 'Sonstiges'], 'Aufträge'))}${field('Beschreibung', '<textarea class="input" style="min-height:140px" placeholder="Was hast du gemacht, was ist passiert, was hast du erwartet? (Markdown)"></textarea>')}${field('Screenshot', btn('Bild anhängen', { icon: 'image', action: 'toast', arg: 'Screenshot angehängt (Mockup)' }))}</div>`, { foot: btn('Senden', { cls: 'primary', action: 'toast', arg: 'Danke! Ticket T-15 angelegt (Mockup)' }) })}${card('Meine Meldungen', `<div class="list">${D.tickets.filter((t) => t.by === 'u5' || t.by === 'u4').map((t) => `<div class="list-item"><div class="grow"><div class="title">${esc(t.title)}</div><div class="meta">${esc(t.id)} · ${date(t.at)} · ${t.comments} Kommentare</div></div>${badge(TS[t.status][0], TS[t.status][1])}</div>`).join('')}</div>`, { flush: true })}</div>`;
  };
  P.hilfe = function () {
    const items = [['Auftrag anlegen', 'Kennzeichen oben in die Suche oder in „Neuer Auftrag“ tippen. Fahrzeug, Halter, Klasse und Preisgruppe sind dann gesetzt.'], ['Preise', 'Alle Preise sind Festpreise. Der Preis hängt von der Fahrzeugklasse ab; die Preisgruppe des Kunden gibt Rabatt.'], ['Rabatt über meinem Limit', 'Gib den Rabatt trotzdem ein – es geht eine Freigabe-Anfrage an jemanden mit höherem Limit.'], ['Steuern', 'Rechnungen zeigen keine Steuer. Je Woche wird der Steuersatz auf den Umsatz gerechnet und abgeführt.'], ['Dienst', 'Oben rechts „Dienst beginnen“. Deine Dienstzeit zählt für den Stundenlohn.'], ['Rechte', 'Was du darfst, steht unter Firma → Berechtigungen → „Was darf X?“.']];
    return pageHead('Hilfe', 'Kurzanleitung für die wichtigsten Abläufe', '') + `<div class="grid g-3">${items.map(([t, d]) => card(esc(t), `<p class="muted">${esc(d)}</p>`)).join('')}</div>`;
  };
  P.changelog = function () {
    const tone = { Neu: 'ok', Geändert: 'info', Behoben: 'warn', Technik: '' };
    return pageHead('Changelog', 'Alle Versionen, neueste oben', `<input class="input" style="width:220px" placeholder="Suchen …">`) + `<div class="stack">${D.changelog.map((c, i) => card(`Version ${esc(c.v)} ${i === 0 ? badge('Installiert', 'accent') : ''}`, `<div class="list">${c.items.map(([k, t]) => `<div class="list-item" style="padding:6px 0">${badge(k, tone[k])}<div class="grow">${esc(t)}</div></div>`).join('')}</div>`, { sub: date(c.date) })).join('')}</div>`;
  };

  // ---------------- Konto ----------------
  P.einstellungen = function (params, q) {
    const tab = q.tab || 'profil';
    const u = U.user(S().viewAs);
    const tabsHtml = U.tabs('#/einstellungen', [['profil', 'Profil'], ['sicherheit', 'Sicherheit'], ['darstellung', 'Darstellung'], ['benachrichtigungen', 'Benachrichtigungen'], ['sitzungen', 'Sitzungen'], ['api', 'API & Kalender']], tab);
    const head = pageHead('Einstellungen', esc(u.name) + ' · ' + esc(u.email), '');
    let body = '';
    if (tab === 'profil') body = card('', `<div class="form cols-2">${field('Name', input(u.name))}${field('E-Mail', input(u.email))}${field('Telefon (RP)', input(u.phone))}${field('Zeitzone', select(['Europe/Berlin'], 'Europe/Berlin'))}</div>`, { foot: btn('Speichern', { cls: 'primary sm', action: 'toast', arg: 'Profil gespeichert (Mockup)' }) });
    else if (tab === 'sicherheit') body = `<div class="grid g-2">${card('Passwort ändern', `<div class="form">${field('Aktuelles Passwort', input('', { type: 'password' }))}${field('Neues Passwort', input('', { type: 'password' }), { hint: 'mindestens 12 Zeichen' })}</div>`, { foot: btn('Ändern', { cls: 'primary sm', action: 'toast', arg: 'Passwort geändert (Mockup)' }) })}${card('Zwei-Faktor-Anmeldung', `<div class="row">${badge(u.twofa ? 'aktiv' : 'aus', u.twofa ? 'ok' : 'warn', true)}<span class="muted">Authenticator-App · 8 Wiederherstellungscodes</span></div>`, { foot: btn(u.twofa ? 'Codes neu erzeugen' : '2FA einrichten', { cls: 'sm', action: 'toast', arg: '2FA (Mockup)' }) })}</div>`;
    else if (tab === 'darstellung') body = appearance();
    else if (tab === 'benachrichtigungen') body = card('', table([{ key: 'k', label: 'Ereignis' }, { key: 'a', label: 'In der App', num: true }, { key: 'm', label: 'E-Mail', num: true }], [['Rabattfreigabe angefragt', 1, 0], ['Auftrag fertig zur Prüfung', 1, 0], ['Neuer Einsatz', 1, 0], ['Lager knapp', 1, 0], ['Nachweis / Lizenz läuft ab', 1, 1], ['Rechnung überfällig', 1, 0], ['Steuerzeitraum fällig', 1, 1], ['Neue Ankündigung', 1, 0]].map(([k, a, m]) => ({ k: esc(k), a: toggle(!!a), m: toggle(!!m) }))), { flush: true });
    else if (tab === 'sitzungen') body = card('', table([{ key: 'd', label: 'Gerät' }, { key: 'i', label: 'IP' }, { key: 'l', label: 'Zuletzt aktiv' }, { key: 'x', label: '' }], [{ d: 'Chrome · Windows <span class="badge ok">diese Sitzung</span>', i: '10.0.0.14', l: 'jetzt', x: '' }, { d: 'Safari · iPhone', i: '10.0.0.22', l: date(D.TODAY + ' 16:02'), x: btn('Beenden', { cls: 'sm', action: 'toast', arg: 'Sitzung beendet (Mockup)' }) }]), { flush: true, actions: btn('Alle anderen beenden', { cls: 'sm danger', action: 'toast', arg: 'Andere Sitzungen beendet (Mockup)' }) });
    else body = `<div class="grid g-2">${card('API-Schlüssel', `<p class="muted">Lesender Zugriff auf die REST-API, z. B. für ein Stream-Overlay.</p>`, { foot: btn('Neuer Schlüssel', { cls: 'sm', icon: 'plus', action: 'toast', arg: 'Schlüssel erzeugt – wird nur einmal angezeigt (Mockup)' }) })}${card('Kalender-Abo (iCal)', `<p class="muted">Termine und Schulungen im eigenen Kalender.</p>${input('https://werkstatt.example/ical/9f2c…', { mono: true, attrs: 'readonly' })}`, { foot: btn('Link kopieren', { cls: 'sm', action: 'toast', arg: 'Link kopiert (Mockup)' }) })}</div>`;
    return head + tabsHtml + body;
  };

  function appearance() {
    const L = window.BX.look, p = L.prefs;
    const design = `<div class="choice-grid">
      <button type="button" class="choice ${p.ui === 'v1' ? 'active' : ''}" data-action="look" data-arg="ui:v1"><div class="preview"><i></i><div class="pv-main"><i></i><i></i><i></i></div></div><b>V1 · Klassisch</b><small>Flach und ruhig, volle Flächen</small></button>
      <button type="button" class="choice ${p.ui === 'v2' ? 'active' : ''}" data-action="look" data-arg="ui:v2"><div class="preview glass"><i></i><div class="pv-main"><i></i><i></i><i></i></div></div><b>V2 · Glass</b><small>Durchscheinende Panels über einem Hintergrund</small></button></div>`;
    const modes = `<div class="seg">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button type="button" class="${p.mode === k ? 'active' : ''}" data-action="look" data-arg="mode:${k}">${l}</button>`).join('')}</div>`;
    const swatches = `<div class="swatches">${L.ACCENTS.map(([k, l, c]) => `<span class="swatch ${p.accent === k ? 'active' : ''}" style="background:${c}" data-action="look" data-arg="accent:${k}" title="${esc(l)}" role="button" tabindex="0"></span>`).join('')}</div><div class="muted" style="margin-top:8px;font-size:12px">Aktiv: <b>${esc(L.ACCENTS.find((a) => a[0] === p.accent)[1])}</b> · färbt Knöpfe, Markierungen, Diagramme und das Vorlagen-Logo</div>`;
    const tiles = L.BACKGROUNDS.map(([k, l, css]) => `<div class="bg-tile ${p.bg === k ? 'active' : ''}" style="background-image:${css === 'none' ? 'none' : css};background-color:var(--bg)" data-action="look" data-arg="bg:${k}" role="button" tabindex="0"><span>${esc(l)}</span></div>`).join('') +
      `<div class="bg-tile ${p.bg === 'custom' ? 'active' : ''}" style="${p.custom ? `background-image:url('${esc(p.custom)}')` : 'display:grid;place-items:center;border-style:dashed'}" data-action="look" data-arg="bg:custom" role="button" tabindex="0">${p.custom ? '' : icon('plus', 'width="22" height="22" style="color:var(--muted)"')}<span>Eigenes Bild</span></div>`;
    const range = (key, label, min, max, unit) => `<div class="range"><label>${esc(label)}</label><input type="range" min="${min}" max="${max}" value="${p[key]}" data-action="look-range" data-key="${key}" data-unit="${unit}"><output>${p[key]}${unit}</output></div>`;
    const v2 = p.ui === 'v2' ? card('Glass-Einstellungen', `<div class="field"><label>Hintergrund</label><div class="bg-tiles">${tiles}</div></div>
      <div class="row" style="margin-top:8px"><label class="btn sm" for="bgFile">${icon('image')}Eigenes Bild hochladen</label><input type="file" id="bgFile" class="hidden" accept="image/png,image/jpeg,image/webp" data-action="bg-upload"><span class="muted" style="font-size:12px">bis 4 MB · nur du siehst dein Bild</span></div><hr>
      ${range('blur', 'Unschärfe', 0, 40, ' px')}${range('glass', 'Deckkraft der Panels', 20, 90, ' %')}${range('dim', 'Hintergrund abdunkeln', 0, 70, ' %')}
      <div class="switch"><div class="txt"><b>Unschärfe auf dem Handy</b><small class="muted">Aus spart Akku und läuft flüssiger; Panels werden dann deckender</small></div>${toggle(!!p.mobileBlur, 'look-mobileBlur')}</div>`, { sub: 'nur in V2' }) : '';
    return `<div class="grid g-2">${card('Design', design, { sub: 'je Mitarbeiter' })}<div class="stack">${card('Modus', modes + '<p class="muted" style="margin-top:10px;font-size:12px">„System“ folgt der Einstellung deines Geräts. Schnell umschalten geht auch oben rechts.</p>')}${card('Farbtheme', swatches)}</div></div>` + (v2 ? `<div class="mt">${v2}</div>` : '') +
      `<div class="row mt">${btn('Auf Standard zurücksetzen', { cls: 'ghost', action: 'look-reset' })}<span class="muted" style="font-size:12px">Wird sofort übernommen und gilt nur für dich.</span></div>`;
  }

  P.login = function () {
    return `<div class="login-wrap"><div class="login"><div class="brand">${window.BX.look.logoHtml()}<div><div class="brand-name">Boxenstopp</div><div class="brand-firm">${esc(D.firm.name)}</div></div></div>
      ${card('', `<div class="form">${field('E-Mail', input('lena.brandt@rostfrei.rp'))}${field('Passwort', input('••••••••••••', { type: 'password' }))}<a class="btn primary" style="justify-content:center" href="#/dashboard">Anmelden</a><a class="link center" href="#/login" style="font-size:12px">Passwort vergessen?</a></div>`)}
      <p class="muted center" style="margin-top:14px;font-size:12px">Neu hier? Frag deine Werkstattleitung nach einer Einladung.</p></div></div>`;
  };
})();
