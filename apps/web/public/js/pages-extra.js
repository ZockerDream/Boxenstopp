/* Boxenstopp – Seiten: Fuhrpark, Fahrzeug-Katalog, Tuning, Regelwerk (0.3.0) */
(function () {
  'use strict';
  const BX = window.BX;
  const D = BX.data;
  const U = BX.ui;
  const P = BX.pages;
  const A = BX.actions;
  const S = () => BX.state;
  const { esc, money, date, icon, table, card, kpi, pageHead, btn, badge, plate, person, avatar, note, bar } = U;
  const lvl = (m) => D.me.levels[m] || 0;
  const today = () => D.TODAY;
  const clsName = (id) => (U.cls(id) || { name: '–' }).name;
  const staffOpts = () => D.staff.filter((s) => s.rank && s.status === 'active').map((s) => [s.id, s.name]);
  const model = (id) => U.byId(D.models || [], id);

  // ---------- Bilder ----------
  const imagesOf = (type, id) => (D.images || []).filter((i) => i.ownerType === type && i.ownerId === id).sort((a, b) => a.position - b.position);
  const coverOf = (type, id) => { const l = imagesOf(type, id); return l.find((i) => i.cover) || l[0] || null; };
  const imgUrl = (id) => '/api/images/' + id;
  BX.coverImg = (type, id, modelId, cls) => {
    const c = coverOf(type, id) || (modelId ? coverOf('model', modelId) : null);
    return c ? `<img class="${cls || ''}" src="${imgUrl(c.id)}" alt="${esc(c.caption)}" loading="lazy">` : `<div class="${cls || ''} img-ph">${icon('car', 'width="28" height="28"')}</div>`;
  };
  // Bild im Browser verkleinern (max. 1600 px), dann als JPEG (oder kleines PNG) hochladen
  function prepareImage(file, cb) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return cb(new Error('Nur PNG, JPEG oder WebP.'));
    if (file.size > 15 * 1024 * 1024) return cb(new Error('Datei zu groß (max. 15 MB vor dem Verkleinern).'));
    const fr = new FileReader();
    fr.onerror = () => cb(new Error('Datei nicht lesbar'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => cb(new Error('Bild nicht lesbar'));
      img.onload = () => {
        const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && file.size < 900 * 1024) return cb(null, fr.result);
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(null, cv.toDataURL('image/jpeg', 0.86));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  A['img-upload'] = (v, input) => {
    const [type, id] = input.dataset.owner.split(':');
    const files = [...input.files].slice(0, 10);
    let left = files.length, okN = 0;
    BX.toast(`Lade ${files.length} Bild(er) hoch …`);
    files.forEach((f) => prepareImage(f, async (err, data) => {
      if (err) BX.toast(f.name + ': ' + err.message, 'bad');
      else { try { await BX.api('POST', '/api/images', { ownerType: type, ownerId: id, data, caption: f.name.replace(/\.[^.]+$/, '').slice(0, 80) }); okN++; } catch (e) { BX.toast(e.message, 'bad'); } }
      if (--left === 0) { BX.toast(`${okN} Bild(er) hochgeladen`, 'ok'); await BX.reload(); }
    }));
  };
  function gallery(type, id, canEdit, fallbackModel) {
    const imgs = imagesOf(type, id);
    const fb = !imgs.length && fallbackModel ? imagesOf('model', fallbackModel) : [];
    const list = imgs.length ? imgs : fb;
    const main = list.find((i) => i.cover) || list[0];
    const upload = canEdit ? `<label class="btn sm" for="up-${id}">${icon('image')}Bilder hochladen</label><input type="file" id="up-${id}" class="hidden" multiple accept="image/png,image/jpeg,image/webp" data-change="img-upload" data-owner="${type}:${id}">` : '';
    if (!main) return `<div class="gallery"><div class="gal-main img-ph">${icon('image', 'width="40" height="40"')}<span class="muted">Noch keine Bilder</span></div><div class="row mt">${upload}</div></div>`;
    return `<div class="gallery"><button type="button" class="gal-main" data-action="lightbox" data-arg="${main.id}">${`<img src="${imgUrl(main.id)}" alt="${esc(main.caption)}">`}</button>
      <div class="gal-thumbs">${list.map((i) => `<button type="button" class="gal-thumb ${i.id === main.id ? 'active' : ''}" data-action="lightbox" data-arg="${i.id}" title="${esc(i.caption)}"><img src="${imgUrl(i.id)}" alt="${esc(i.caption)}" loading="lazy">${i.cover ? '<span class="cover-dot" title="Titelbild"></span>' : ''}</button>`).join('')}</div>
      ${fb.length ? '<p class="muted" style="font-size:12px">Bilder aus dem Fahrzeug-Katalog</p>' : ''}<div class="row mt">${upload}</div></div>`;
  }
  A.lightbox = (id) => {
    const img = (D.images || []).find((i) => i.id === id);
    const list = imagesOf(img.ownerType, img.ownerId);
    const idx = list.findIndex((i) => i.id === id);
    const canEdit = lvl(img.ownerType === 'model' ? 'models' : 'fleet') >= 3;
    BX.openModal({ title: img.caption || 'Bild', wide: true,
      body: `<div class="lightbox"><img src="${imgUrl(id)}" alt="${esc(img.caption)}">${list.length > 1 ? `<button class="lb-nav prev" data-action="lightbox" data-arg="${list[(idx - 1 + list.length) % list.length].id}" aria-label="Vorheriges">‹</button><button class="lb-nav next" data-action="lightbox" data-arg="${list[(idx + 1) % list.length].id}" aria-label="Nächstes">›</button>` : ''}</div><div class="row between mt"><span class="muted">${idx + 1} / ${list.length} · ${Math.round(img.size / 1024)} KB</span>${img.cover ? badge('Titelbild', 'accent') : ''}</div>`,
      foot: canEdit ? `<button class="btn danger" data-action="img-del" data-arg="${id}">Löschen</button><button class="btn" data-action="img-move" data-arg="${id}:left">‹ nach vorn</button><button class="btn" data-action="img-move" data-arg="${id}:right">nach hinten ›</button><button class="btn" data-action="img-caption" data-arg="${id}">Beschriften</button>${img.cover ? '' : `<button class="btn primary" data-action="img-cover" data-arg="${id}">Als Titelbild</button>`}` : `<button class="btn" data-action="modal-close">Schließen</button>` });
  };
  A['img-cover'] = async (id) => { BX.closeModal(); await BX.call('PATCH', '/api/images/' + id, { cover: true }, 'Titelbild gesetzt'); };
  A['img-move'] = async (arg) => { const [id, move] = arg.split(':'); await BX.call('PATCH', '/api/images/' + id, { move }); A.lightbox(id); };
  A['img-del'] = (id) => BX.confirm('Bild löschen', 'Das Bild wird endgültig gelöscht.', 'Löschen', () => BX.call('DELETE', '/api/images/' + id, undefined, 'Bild gelöscht'));
  A['img-caption'] = (id) => { const i = D.images.find((x) => x.id === id); BX.prompt('Bildunterschrift', 'Text', 'Speichern', async (caption) => { await BX.api('PATCH', '/api/images/' + id, { caption }); return 'Gespeichert'; }, { value: i.caption, required: false }); };

  // ================= Fuhrpark =================
  const FS = { available: ['Verfügbar', 'ok'], in_use: ['Im Einsatz', 'accent'], workshop: ['Werkstatt', 'warn'], retired: ['Ausgemustert', ''] };
  BX.fleetBadge = (f) => badge(FS[f.status][0], FS[f.status][1], true);
  const KINDS = ['Abschleppwagen', 'Servicewagen', 'Transporter', 'Dienstwagen', 'Pannenhilfe', 'Sonstiges'];
  const fleetFields = (f = {}) => [
    { name: 'name', label: 'Rufname', value: f.name, required: true, ph: 'z. B. Abschlepper 3' }, { name: 'plate', label: 'Kennzeichen', value: f.plate, required: true, mono: true },
    { name: 'kind', label: 'Art', type: 'select', options: KINDS, value: f.kind || 'Servicewagen' }, { name: 'modelId', label: 'Modell aus dem Katalog', type: 'select', options: [['', '– frei –']].concat((D.models || []).map((m) => [m.id, `${m.make} ${m.model}`])), value: f.modelId || '' },
    { name: 'km', label: 'Kilometerstand', type: 'number', value: f.km ?? 0 }, { name: 'serviceDue', label: 'Nächster Service am', type: 'date', value: f.serviceDue || '' },
    { name: 'serviceKm', label: 'Nächster Service bei km', type: 'number', value: f.serviceKm ?? '' }, { name: 'insuranceUntil', label: 'Versichert bis', type: 'date', value: f.insuranceUntil || '' },
    { name: 'purchasePrice', label: 'Kaufpreis', type: 'number', step: '0.01', value: f.purchasePrice ?? '' }, { name: 'purchasedOn', label: 'Gekauft am', type: 'date', value: f.purchasedOn || '' },
    ...(f.id ? [{ name: 'status', label: 'Status', type: 'select', options: Object.entries(FS).map(([k, [l]]) => [k, l]), value: f.status }] : []),
    { name: 'note', label: 'Notiz', type: 'textarea', value: f.note, full: true },
  ];
  const fleetBody = (v) => { const m = model(v.modelId); return { ...v, modelId: v.modelId || null, make: m ? m.make : (v.make || ''), model: m ? m.model : (v.model || ''), km: v.km || 0, serviceKm: v.serviceKm || null, purchasePrice: v.purchasePrice ?? null }; };
  A['fleet-new'] = () => BX.form({ title: 'Neues Firmenfahrzeug', fields: fleetFields(), submit: async (v) => { const r = await BX.api('POST', '/api/r/fleet', fleetBody(v)); setTimeout(() => { location.hash = '#/fuhrpark/' + r.id; }); return 'Fahrzeug angelegt'; } });
  A['fleet-edit'] = (id) => BX.form({ title: 'Firmenfahrzeug bearbeiten', fields: fleetFields(U.byId(D.fleet, id)), submit: async (v) => { await BX.api('PATCH', '/api/r/fleet/' + id, fleetBody(v)); return 'Gespeichert'; } });
  A['fleet-out'] = (id) => { const f = U.byId(D.fleet, id); BX.form({ title: `${f.name} ausgeben`, fields: [...(lvl('fleet') >= 3 ? [{ name: 'driver', label: 'Fahrer', type: 'select', options: staffOpts(), value: D.me.id }] : []), { name: 'km', label: 'Kilometerstand', type: 'number', value: f.km, required: true }, { name: 'note', label: 'Zweck', full: true, ph: 'z. B. Einsatz E-2026-0012' }], ok: 'Ausgeben', submit: async (v) => { await BX.api('POST', `/api/fleet/${id}/checkout`, v); return f.name + ' ausgegeben'; } }); };
  A['fleet-in'] = (id) => { const f = U.byId(D.fleet, id); BX.form({ title: `${f.name} zurückgeben`, fields: [{ name: 'km', label: 'Kilometerstand', type: 'number', value: f.km, required: true, hint: 'bei Ausgabe: ' + f.km.toLocaleString('de-DE') + ' km' }, { name: 'note', label: 'Notiz', full: true }, { name: 'damage', label: 'Schaden melden', type: 'checkbox', hint: 'Fahrzeug geht in die Werkstatt, die Leitung wird benachrichtigt' }], ok: 'Zurückgeben', submit: async (v) => { await BX.api('POST', `/api/fleet/${id}/checkin`, v); return f.name + ' zurückgegeben'; } }); };
  A['fleet-entry'] = (arg) => {
    const [id, kind] = arg.split(':');
    const f = U.byId(D.fleet, id);
    const title = { service: 'Service eintragen', damage: 'Schaden melden', fuel: 'Tanken', cost: 'Kosten buchen', note: 'Vermerk' }[kind];
    const money2 = ['service', 'fuel', 'cost', 'damage'].includes(kind) && lvl('accounts') >= 3 && (D.accounts || []).length;
    BX.form({ title: `${title} · ${f.name}`, fields: [
      { name: 'text', label: kind === 'damage' ? 'Was ist kaputt?' : 'Beschreibung', full: true, required: kind !== 'fuel' },
      ...(['service', 'fuel', 'cost', 'damage'].includes(kind) ? [{ name: 'amount', label: 'Betrag', type: 'number', step: '0.01' }] : []),
      ...(money2 ? [{ name: 'account', label: 'Ausgabe buchen von', type: 'select', options: [['', '– nicht buchen –']].concat(D.accounts.filter((a) => a.kind !== 'tax_reserve').map((a) => [a.id, a.name])), value: (D.accounts.find((a) => a.kind === 'bank') || {}).id }] : []),
      ...(kind === 'service' ? [{ name: 'km', label: 'Kilometerstand', type: 'number', value: f.km }, { name: 'nextDue', label: 'Nächster Service am', type: 'date', value: D.addDays(today(), 90) }, { name: 'nextKm', label: 'Nächster Service bei km', type: 'number', value: f.km + 10000 }] : []),
    ], submit: async (v) => { v.kind = kind; if (v.amount === null) delete v.amount; v.account = v.account || null; await BX.api('POST', `/api/fleet/${id}/entry`, v); return title + ' gespeichert'; } });
  };
  const serviceBadge = (f) => {
    if (f.status === 'retired') return '';
    const kmDue = f.serviceKm && f.km >= f.serviceKm;
    if (!f.serviceDue && !f.serviceKm) return '';
    const d = f.serviceDue ? U.daysUntil(f.serviceDue) : 999;
    if (d < 0 || kmDue) return badge('Service überfällig', 'bad');
    if (d <= 7 || (f.serviceKm && f.serviceKm - f.km < 500)) return badge('Service bald', 'warn');
    return '';
  };
  function fleetActions(f, small) {
    const cls = small ? 'sm' : '';
    if (f.status === 'retired') return '';
    const mine = f.driver === D.me.id;
    return (f.status === 'available' && lvl('fleet') >= 2 ? btn('Ausgeben', { cls: cls + ' primary', icon: 'play', action: 'fleet-out', arg: f.id }) : '') +
      (f.status === 'in_use' && (mine || lvl('fleet') >= 3) ? btn('Zurückgeben', { cls: cls + ' primary', icon: 'check', action: 'fleet-in', arg: f.id }) : '');
  }
  P.fuhrpark = function (params, q) {
    if (params[0]) return fleetDetail(params[0], q);
    const list = D.fleet.filter((f) => q.alle === '1' || f.status !== 'retired');
    const costs30 = D.fleetLog.filter((l) => l.amount && U.daysUntil(l.at.slice(0, 10)) > -30).reduce((s, l) => s + l.amount, 0);
    const due = D.fleet.filter((f) => serviceBadge(f)).length;
    const cards = list.map((f) => `<div class="card fleet-card">${`<a href="#/fuhrpark/${f.id}" class="fc-img">${BX.coverImg('fleet', f.id, f.modelId, '')}</a>`}<div class="fc-body"><div class="row between"><a href="#/fuhrpark/${f.id}"><b style="font-size:15px">${esc(f.name)}</b></a>${BX.fleetBadge(f)}</div><div class="row" style="margin-top:6px">${plate(f.plate)}<span class="muted">${esc(f.kind)} · ${esc(f.make)} ${esc(f.model)}</span></div>
      <div class="row between mt"><span class="muted">${f.km.toLocaleString('de-DE')} km</span>${serviceBadge(f)}</div>${f.driver ? `<div class="row mt" style="gap:6px">${person(U.user(f.driver))}<span class="muted">fährt gerade</span></div>` : ''}<div class="row mt">${fleetActions(f, true)}<a class="btn sm ghost" href="#/fuhrpark/${f.id}">Details</a></div></div></div>`).join('');
    return pageHead('Fuhrpark', 'Firmenfahrzeuge der Werkstatt: Ausgabe, Fahrtenbuch, Service und Kosten', `<div class="seg"><a href="#/fuhrpark" class="${q.alle !== '1' ? 'active' : ''}">Aktiv</a><a href="#/fuhrpark?alle=1" class="${q.alle === '1' ? 'active' : ''}">Alle</a></div>` + (lvl('fleet') >= 3 ? btn('Neues Fahrzeug', { cls: 'primary', icon: 'plus', action: 'fleet-new' }) : '')) +
      `<div class="grid g-4 mb">${kpi('Verfügbar', D.fleet.filter((f) => f.status === 'available').length, '', { icon: 'check', dir: 'up' })}${kpi('Im Einsatz', D.fleet.filter((f) => f.status === 'in_use').length, '', { icon: 'truck' })}${kpi('In der Werkstatt', D.fleet.filter((f) => f.status === 'workshop').length, due ? due + '× Service fällig' : 'kein Service fällig', { icon: 'wrench', dir: due ? 'down' : 'up' })}${lvl('fleet') >= 2 ? kpi('Kosten 30 Tage', money(costs30), 'Service, Tanken, Reparaturen', { icon: 'coins' }) : ''}</div>` +
      `<div class="fleet-grid">${cards || '<div class="empty">Noch keine Firmenfahrzeuge</div>'}</div>`;
  }
  ;
  const LK = { checkout: ['Ausgabe', 'accent'], checkin: ['Rückgabe', 'ok'], service: ['Service', 'info'], damage: ['Schaden', 'bad'], fuel: ['Tanken', ''], cost: ['Kosten', ''], note: ['Vermerk', ''], status: ['Status', ''] };
  function fleetDetail(id, q) {
    const f = U.byId(D.fleet, id);
    if (!f) return pageHead('Fahrzeug nicht gefunden', '', btn('Zurück', { href: '#/fuhrpark' }));
    const tab = q.tab || 'fahrtenbuch';
    const logs = D.fleetLog.filter((l) => l.fleet === id);
    const canW = lvl('fleet') >= 3;
    const m = model(f.modelId);
    let body;
    if (tab === 'fahrtenbuch') {
      const trips = logs.filter((l) => l.kind === 'checkin' || (l.kind === 'checkout' && f.status === 'in_use' && logs.find((x) => x.kind === 'checkout') === l));
      body = card('', table([{ key: 'u', label: 'Fahrer' }, { key: 'v', label: 'Von' }, { key: 'b', label: 'Bis' }, { key: 'k', label: 'km', num: true }, { key: 't', label: 'Zweck / Notiz' }], trips.map((l) => ({ u: person(U.user(l.user)), v: date(l.started), b: l.kind === 'checkout' ? badge('unterwegs', 'accent', true) : date(l.ended), k: l.kmEnd != null ? `${(l.kmEnd - l.kmStart).toLocaleString('de-DE')}<span class="sub">${l.kmStart.toLocaleString('de-DE')} → ${l.kmEnd.toLocaleString('de-DE')}</span>` : '–', t: esc(l.text || (logs.find((x) => x.kind === 'checkout' && x.started === l.started) || {}).text || '') })), { empty: 'Noch keine Fahrten' }), { flush: true });
    } else if (tab === 'kosten') {
      const c = logs.filter((l) => l.amount);
      const months = {};
      c.forEach((l) => { const k = l.at.slice(0, 7); months[k] = months[k] || { label: k.split('-').reverse().join('/'), service: 0, fuel: 0, other: 0 }; months[k][l.kind === 'service' ? 'service' : l.kind === 'fuel' ? 'fuel' : 'other'] += l.amount; });
      const data = Object.keys(months).sort().map((k) => months[k]);
      const total = c.reduce((s, l) => s + l.amount, 0);
      body = `<div class="grid g-side">${card('Kosten je Monat', data.length ? U.barChart(data, { id: 'fleetCost' + id, label: 'Kosten je Monat', series: [{ key: 'service', label: 'Service', color: 'var(--info)' }, { key: 'fuel', label: 'Tanken', color: 'var(--accent)' }, { key: 'other', label: 'Reparatur/Sonstiges', color: 'var(--bad)' }] }) : '<div class="empty">Noch keine Kosten</div>', { sub: 'Summe ' + money(total) })}
        ${card('Einzelposten', table([{ key: 'd', label: 'Datum' }, { key: 'k', label: 'Art' }, { key: 't', label: 'Text' }, { key: 'a', label: 'Betrag', num: true }], c.map((l) => ({ d: date(l.at), k: badge(LK[l.kind][0], LK[l.kind][1]), t: esc(l.text), a: money(l.amount) })), { empty: '–' }), { flush: true })}</div>`;
    } else if (tab === 'verlauf') {
      body = card('', `<div class="timeline">${logs.map((l) => `<div class="tl-item"><div class="when">${date(l.at)} · ${esc((U.user(l.user) || {}).name || '')}</div><div class="what">${badge(LK[l.kind][0], LK[l.kind][1])} ${l.amount ? money(l.amount) : ''}</div><div class="muted">${esc(l.text)}${l.kmEnd != null && l.kind !== 'checkin' ? ' · ' + l.kmEnd.toLocaleString('de-DE') + ' km' : ''}</div></div>`).join('') || '<div class="empty">Noch nichts</div>'}</div>`);
    } else {
      const co = (D.callouts || []).filter((c) => c.fleet === id);
      body = card('', table([{ key: 'n', label: 'Einsatz' }, { key: 'a', label: 'Zeit' }, { key: 'l', label: 'Ort' }, { key: 'd', label: 'Fahrer' }, { key: 's', label: 'Status' }], co.map((c) => ({ n: `<span class="mono">${esc(c.no)}</span>`, a: date(c.at), l: esc(c.loc), d: c.driver ? person(U.user(c.driver)) : '–', s: BX.calloutBadge(c.status) })), { empty: 'Keine Einsätze mit diesem Fahrzeug' }), { flush: true });
    }
    const info = [['Art', esc(f.kind)], ['Modell', m ? `<a class="link" href="#/modell/${m.id}">${esc(m.make)} ${esc(m.model)}</a>` : esc(`${f.make} ${f.model}`)], ['Kilometerstand', f.km.toLocaleString('de-DE') + ' km'], ['Nächster Service', (f.serviceDue ? date(f.serviceDue) : '–') + (f.serviceKm ? ` · ${f.serviceKm.toLocaleString('de-DE')} km` : '') + ' ' + serviceBadge(f)], ['Versichert bis', f.insuranceUntil ? date(f.insuranceUntil) + (U.daysUntil(f.insuranceUntil) < 14 ? ' ' + badge('bald', 'warn') : '') : '–'], ['Fahrer', f.driver ? person(U.user(f.driver)) : '–'], ...(lvl('fleet') >= 3 ? [['Kaufpreis', f.purchasePrice ? money(f.purchasePrice) + (f.purchasedOn ? ' · ' + date(f.purchasedOn) : '') : '–']] : [])];
    return pageHead(`${esc(f.name)} ${plate(f.plate)}`, `${esc(f.kind)}${f.note ? ' · ' + esc(f.note) : ''}`, BX.fleetBadge(f) + fleetActions(f) + (lvl('fleet') >= 2 ? btn('Schaden', { icon: 'alert', action: 'fleet-entry', arg: id + ':damage' }) + btn('Tanken', { action: 'fleet-entry', arg: id + ':fuel' }) : '') + (canW ? btn('Service', { icon: 'wrench', action: 'fleet-entry', arg: id + ':service' }) + btn('Kosten', { icon: 'coins', action: 'fleet-entry', arg: id + ':cost' }) + btn('', { icon: 'gear', action: 'fleet-edit', arg: id, title: 'Bearbeiten' }) : ''), `<a href="#/fuhrpark">Fuhrpark</a> / ${esc(f.name)}`) +
      `<div class="grid g-2 mb">${card('', gallery('fleet', id, canW, f.modelId))}${card('Daten', `<div class="list">${info.map(([k, v]) => `<div class="list-item" style="padding:8px 0"><span class="muted" style="width:140px">${k}</span><div class="grow">${v}</div></div>`).join('')}</div>`)}</div>` +
      U.tabs('#/fuhrpark/' + id, [['fahrtenbuch', 'Fahrtenbuch'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf', logs.length], ['einsaetze', 'Einsätze']], tab) + body;
  }

  // ================= Fahrzeug-Katalog =================
  const BODIES = ['Coupé', 'Limousine', 'Kombi', 'SUV', 'Kleinwagen', 'Cabrio', 'Pick-up', 'Transporter', 'Abschleppwagen', 'Motorrad'];
  const modelFields = (m = {}) => [
    { name: 'make', label: 'Hersteller', value: m.make, required: true }, { name: 'model', label: 'Modell', value: m.model, required: true },
    { name: 'cls', label: 'Fahrzeugklasse (Preise)', type: 'select', options: D.vehicleClasses.map((c) => [c.id, c.name]), value: m.cls }, { name: 'body', label: 'Bauform', type: 'select', options: [['', '–']].concat(BODIES.map((b) => [b, b])), value: m.body || '' },
    { name: 'price', label: 'Neupreis im RP', type: 'number', step: '1', value: m.price ?? '' }, { name: 'seats', label: 'Sitze', type: 'number', value: m.seats ?? '' },
    { name: 'topSpeed', label: 'Höchstgeschwindigkeit (km/h)', type: 'number', value: m.topSpeed ?? '' }, { name: 'drive', label: 'Antrieb', value: m.drive, ph: 'Heck, Front, Allrad' },
    { name: 'fuel', label: 'Kraftstoff', value: m.fuel, ph: 'Benzin, Diesel, Elektro' }, { name: 'active', label: 'Im Katalog sichtbar', type: 'checkbox', value: m.active !== false },
    { name: 'description', label: 'Beschreibung', type: 'textarea', value: m.description, full: true }, { name: 'tuningNote', label: 'Hinweise für Tuning und Werkstatt', type: 'textarea', value: m.tuningNote, full: true },
  ];
  const modelBody = (v) => ({ ...v, cls: v.cls || null, price: v.price ?? null, seats: v.seats ?? null, topSpeed: v.topSpeed ?? null });
  A['model-new'] = () => BX.form({ title: 'Neues Modell', fields: modelFields(), submit: async (v) => { const r = await BX.api('POST', '/api/r/models', modelBody(v)); setTimeout(() => { location.hash = '#/modell/' + r.id; }); return 'Modell angelegt'; } });
  A['model-edit'] = (id) => BX.form({ title: 'Modell bearbeiten', fields: modelFields(model(id)), submit: async (v) => { await BX.api('PATCH', '/api/r/models/' + id, modelBody(v)); return 'Gespeichert'; } });
  A['model-filter'] = (v, el) => { S().modelFilter = Object.assign({}, S().modelFilter, { [el.dataset.k]: v }); BX.render(); };
  A['model-class'] = (v) => { S().modelFilter = Object.assign({}, S().modelFilter, { cls: v }); BX.render(); };
  P.modelle = function () {
    const f = S().modelFilter || {};
    const qs = (f.q || '').toLowerCase();
    let list = D.models.filter((m) => (lvl('models') >= 3 || m.active) && (!f.cls || m.cls === f.cls) && (!qs || `${m.make} ${m.model} ${m.body}`.toLowerCase().includes(qs)));
    const count = (m) => D.vehicles.filter((v) => v.modelId === m.id && v.status !== 'scrapped').length;
    const classes = D.vehicleClasses.filter((c) => D.models.some((m) => m.cls === c.id));
    return pageHead('Fahrzeug-Katalog', `${D.models.filter((m) => m.active).length} Modelle · Bilder, Daten und Werkstatt-Hinweise`, lvl('models') >= 3 ? btn('Neues Modell', { cls: 'primary', icon: 'plus', action: 'model-new' }) : '') +
      `<div class="row mb"><div class="seg">${[['', 'Alle']].concat(classes.map((c) => [c.id, c.name])).map(([id, n]) => `<button type="button" class="${(f.cls || '') === id ? 'active' : ''}" data-action="model-class" data-arg="${id}">${esc(n)}</button>`).join('')}</div><input class="input" style="max-width:260px" placeholder="Hersteller oder Modell …" value="${esc(f.q || '')}" data-change="model-filter" data-k="q"></div>` +
      `<div class="model-grid">${list.map((m) => `<a class="card model-card ${m.active ? '' : 'inactive'}" href="#/modell/${m.id}">${BX.coverImg('model', m.id, null, 'mc-img')}<div class="mc-body"><div class="row between"><b>${esc(m.make)} ${esc(m.model)}</b>${badge(clsName(m.cls), 'accent')}</div><div class="muted" style="font-size:12px">${[m.body, m.topSpeed ? m.topSpeed + ' km/h' : '', m.seats ? m.seats + ' Sitze' : '', m.fuel].filter(Boolean).map(esc).join(' · ')}</div><div class="row between mt"><b>${m.price ? money(m.price) : ''}</b><span class="muted" style="font-size:12px">${count(m)} in Kundenhand · ${imagesOf('model', m.id).length} Bilder</span></div></div></a>`).join('') || '<div class="empty">Kein Modell gefunden</div>'}</div>`;
  };
  P.modell = function (params) {
    const m = model(params[0]);
    if (!m) return pageHead('Modell nicht gefunden', '', btn('Zurück', { href: '#/modelle' }));
    const canW = lvl('models') >= 3;
    const vs = D.vehicles.filter((v) => v.modelId === m.id);
    const fl = (D.fleet || []).filter((f) => f.modelId === m.id);
    const specs = [['Hersteller', m.make], ['Modell', m.model], ['Fahrzeugklasse', clsName(m.cls)], ['Bauform', m.body], ['Neupreis', m.price ? money(m.price) : '–'], ['Höchstgeschwindigkeit', m.topSpeed ? m.topSpeed + ' km/h' : '–'], ['Sitze', m.seats || '–'], ['Antrieb', m.drive || '–'], ['Kraftstoff', m.fuel || '–']];
    const prices = D.catalog.filter((i) => i.active && i.tuning).slice(0, 8);
    return pageHead(`${esc(m.make)} ${esc(m.model)} ${m.active ? '' : badge('ausgeblendet', '')}`, `${esc(clsName(m.cls))}${m.body ? ' · ' + esc(m.body) : ''}`, canW ? btn('Bearbeiten', { icon: 'gear', action: 'model-edit', arg: m.id }) : '', `<a href="#/modelle">Fahrzeug-Katalog</a> / ${esc(m.make)} ${esc(m.model)}`) +
      `<div class="grid g-side"><div class="stack">${card('', gallery('model', m.id, canW))}${m.description ? card('Beschreibung', U.mdBlock(m.description).html) : ''}${m.tuningNote ? card('Hinweise für die Werkstatt', `<p>${U.md(m.tuningNote)}</p>`) : ''}</div>
      <div class="stack">${card('Daten', `<div class="list">${specs.map(([k, v]) => `<div class="list-item" style="padding:7px 0"><span class="muted grow">${k}</span><b>${esc(String(v))}</b></div>`).join('')}</div>`)}
      ${lvl('catalog') >= 1 && prices.length ? card('Tuning-Preise für diese Klasse', `<div class="list">${prices.map((i) => `<div class="list-item" style="padding:6px 0"><span class="grow">${esc(i.name)}</span><b>${money(D.unitPrice(i, m.cls))}</b></div>`).join('')}</div>`, { actions: lvl('tuning') >= 1 ? '<a class="btn sm ghost" href="#/tuning">Tuning</a>' : '' }) : ''}
      ${card(`Fahrzeuge dieses Modells`, `<div class="list">${vs.map((v) => `<a class="list-item" href="#/fahrzeug/${v.id}">${plate(v.plate)}<div class="grow">${esc((U.cust(v.owner) || {}).name || '–')}</div><span class="muted">${esc(v.color)}</span></a>`).join('')}${fl.map((f) => `<a class="list-item" href="#/fuhrpark/${f.id}">${plate(f.plate)}<div class="grow">${esc(f.name)} ${badge('Fuhrpark', 'accent')}</div></a>`).join('') || (vs.length ? '' : '<div class="empty">Keine</div>')}</div>`, { flush: true, sub: vs.length + fl.length })}</div></div>`;
  };

  // ================= Tuning =================
  const TCATS = ['Motor', 'Turbo', 'Bremsen', 'Getriebe', 'Federung', 'Panzerung', 'Optik'];
  const tuneState = () => (S().tune ||= { vehicle: null, sel: {}, extras: [], pkgs: [] });
  A['tune-vehicle'] = (v) => { const t = tuneState(); t.vehicle = v || null; t.sel = {}; t.extras = []; t.pkgs = []; BX.render(); };
  A['tune-pick'] = (arg) => { const [cat, id] = arg.split('|'); const t = tuneState(); t.sel[cat] = t.sel[cat] === id ? undefined : id; t.pkgs = []; BX.render(); };
  A['tune-extra'] = (id) => { const t = tuneState(); t.extras = t.extras.includes(id) ? t.extras.filter((x) => x !== id) : [...t.extras, id]; t.pkgs = []; BX.render(); };
  A['tune-pkg'] = (id) => {
    const t = tuneState(); const p = U.byId(D.tuningPackages, id);
    if (t.pkgs.includes(id)) { t.pkgs = []; t.sel = {}; t.extras = []; BX.render(); return; }
    t.pkgs = [id]; t.sel = {}; t.extras = [];
    p.items.forEach((iid) => { const it = U.item(iid); if (!it) return; if (it.tuning) t.sel[it.tuning[0]] = iid; else t.extras.push(iid); });
    BX.render();
  };
  A['tune-clear'] = () => { const t = tuneState(); t.sel = {}; t.extras = []; t.pkgs = []; BX.render(); };
  A['tune-order'] = async (status) => {
    const t = tuneState();
    const items = [...Object.values(t.sel).filter(Boolean), ...t.extras];
    const by = document.getElementById('tuneBy');
    const r = await BX.call('POST', '/api/tuning/order', { vehicle: t.vehicle, items, packages: t.pkgs, status, by: by ? by.value : undefined }, (x) => `${status === 'quote' ? 'Angebot' : 'Auftrag'} ${x.no} angelegt`);
    if (r) { S().tune = null; location.hash = '#/auftrag/' + r.id; }
  };
  function configurator(q) {
    const t = tuneState();
    if (q.v && t.vehicle !== q.v) { t.vehicle = q.v; t.sel = {}; t.extras = []; t.pkgs = []; }
    const vopts = D.vehicles.filter((v) => v.status === 'active').map((v) => [v.id, `${v.plate} · ${v.make} ${v.model} · ${(U.cust(v.owner) || {}).name || ''}`]);
    const pick = `<div class="field" style="max-width:520px"><label>Fahrzeug</label>${U.select([['', '– Fahrzeug wählen –']].concat(vopts), t.vehicle || '', 'data-change="tune-vehicle"')}</div>`;
    if (!t.vehicle) return pick + `<div class="mt">${note('Wähle ein Kundenfahrzeug. Du siehst dann den aktuellen Tuning-Stand, alle passenden Upgrades mit den Preisen für die Fahrzeugklasse und kannst daraus direkt ein Angebot oder einen Auftrag machen.', 'info', 'gauge')}</div>`;
    const v = U.veh(t.vehicle), c = U.cust(v.owner) || {};
    const cur = Object.fromEntries(D.tuning.filter((x) => x.vehicle === v.id).map((x) => [x.category, x.level]));
    const items = D.catalog.filter((i) => i.active && i.tuning);
    const extras = D.catalog.filter((i) => i.active && !i.tuning && D.categories.some((cg) => cg.id === i.cat && /optik|lack/i.test(cg.name)));
    const cats = TCATS.filter((k) => items.some((i) => i.tuning[0] === k) || cur[k]);
    const pgDisc = (it) => D.groupDiscount(c.pg, it);
    const pkgDisc = {};
    t.pkgs.forEach((pid) => { const p = U.byId(D.tuningPackages, pid); p.items.forEach((i) => { pkgDisc[i] = Math.max(pkgDisc[i] || 0, p.discount); }); });
    const rows = cats.map((k) => {
      const opts = items.filter((i) => i.tuning[0] === k).sort((a, b) => a.tuning[1] - b.tuning[1]);
      const lv = cur[k] || 0;
      const chosen = t.sel[k] ? U.item(t.sel[k]) : null;
      const target = chosen ? chosen.tuning[1] : lv;
      return `<div class="tune-row"><div class="tr-head"><b>${esc(k)}</b><div class="stages">${[1, 2, 3].map((s) => `<span class="${s <= lv ? 'have' : s <= target ? 'new' : ''}"></span>`).join('')}</div><span class="muted" style="font-size:12px">${lv ? 'Stufe ' + lv : 'Serie'}${chosen ? ' → ' + target : ''}</span></div>
        <div class="chips">${opts.map((i) => { const done = i.tuning[1] <= lv; const miss = BX.missingQual(D.me.id, i); return `<button type="button" class="tune-opt ${t.sel[k] === i.id ? 'on' : ''}" ${done ? 'disabled title="schon verbaut"' : ''} data-action="tune-pick" data-arg="${esc(k)}|${i.id}"><span>${esc(i.name)}</span><b>${money(D.unitPrice(i, v.cls))}</b>${i.reqRaw.length ? `<small>${miss.length ? '⚠ ' : ''}${esc(i.reqRaw.map((r) => { const [kk, id] = r.split(':'); return kk === 'license' ? (U.ltype(id) || {}).name : (U.training(id) || {}).name; }).join(', '))}</small>` : ''}</button>`; }).join('') || '<span class="faint">keine Leistung</span>'}</div></div>`;
    }).join('');
    const exHtml = extras.length ? `<div class="tune-row"><div class="tr-head"><b>Extras</b></div><div class="chips">${extras.map((i) => `<button type="button" class="tune-opt ${t.extras.includes(i.id) ? 'on' : ''}" data-action="tune-extra" data-arg="${i.id}"><span>${esc(i.name)}</span><b>${money(D.unitPrice(i, v.cls))}</b></button>`).join('')}</div></div>` : '';
    const pk = (D.tuningPackages || []).filter((p) => p.active);
    const pkHtml = pk.length ? `<div class="pkg-row">${pk.map((p) => { const sum = p.items.reduce((s, i) => s + (U.item(i) ? D.unitPrice(U.item(i), v.cls) : 0), 0); return `<button type="button" class="pkg ${t.pkgs.includes(p.id) ? 'on' : ''}" data-action="tune-pkg" data-arg="${p.id}"><b>${esc(p.name)}</b><span class="muted">${p.items.length} Leistungen · −${p.discount} %</span><span><s class="faint">${money(sum)}</s> <b>${money(Math.round(sum * (1 - p.discount / 100)))}</b></span></button>`; }).join('')}</div>` : '';
    const lines = [...Object.values(t.sel).filter(Boolean), ...t.extras].map((id) => U.item(id)).filter(Boolean).map((it) => { const unit = D.unitPrice(it, v.cls); const disc = Math.max(pgDisc(it), pkgDisc[it.id] || 0); return { it, unit, disc, total: Math.round(unit * (1 - disc / 100) * 100) / 100 }; });
    const gross = lines.reduce((s, l) => s + l.unit, 0), total = lines.reduce((s, l) => s + l.total, 0);
    const summary = card('Zusammenstellung', lines.length ? `<div class="list">${lines.map((l) => `<div class="list-item" style="padding:7px 0"><div class="grow">${esc(l.it.name)}${l.disc ? `<div class="meta">−${l.disc} % ${pkgDisc[l.it.id] && pkgDisc[l.it.id] >= pgDisc(l.it) ? 'Paket' : 'Preisgruppe'}</div>` : ''}</div><b>${money(l.total)}</b></div>`).join('')}</div><hr><div class="row between"><span class="muted">Listenpreis</span><span>${money(gross)}</span></div><div class="row between"><span class="muted">Rabatt</span><span>−${money(gross - total)}</span></div><div class="row between mt" style="font-size:18px"><b>Gesamt</b><b>${money(total)}</b></div>
      ${lvl('orders') >= 3 ? `<div class="field mt"><label>Ausgeführt von</label>${U.select(staffOpts(), D.me.id, 'id="tuneBy"')}</div><div class="row mt">${btn('Als Angebot', { icon: 'file', action: 'tune-order', arg: 'quote' })}${btn('Als Auftrag', { cls: 'primary', icon: 'wrench', action: 'tune-order', arg: 'accepted' })}</div>` : ''}<div class="row mt">${btn('Leeren', { cls: 'sm ghost', action: 'tune-clear' })}</div>` : '<div class="empty">Wähle Upgrades oder ein Paket</div>', { sub: `${clsName(v.cls)} · ${(U.pg(c.pg) || { name: 'Standard' }).name}` });
    const m = model(v.modelId);
    return pick + `<div class="grid g-side mt"><div class="stack">${card('', `<div class="row" style="gap:16px">${BX.coverImg('model', v.modelId, null, 'tune-img')}<div><div class="row">${plate(v.plate, true)}${badge(clsName(v.cls), 'accent')}</div><div style="margin-top:8px;font-weight:650">${esc(v.make)} ${esc(v.model)}</div><div class="muted">${esc(c.name || '')}${c.warning ? ' · ⚠ ' + esc(c.warning) : ''}</div>${m && m.tuningNote ? `<div class="mt">${note(esc(m.tuningNote), 'info')}</div>` : ''}</div></div>`)}
      ${pkHtml ? card('Pakete', pkHtml) : ''}${card('Upgrades', rows + exHtml, { sub: 'Bereits Verbautes ist ausgegraut' })}</div><div class="stack sticky">${summary}</div></div>`;
  }
  const pkgFields = (p = {}) => [{ name: 'name', label: 'Name', value: p.name, required: true }, { name: 'discount', label: 'Paketrabatt %', type: 'number', step: '0.5', value: p.discount ?? 10 }, { name: 'description', label: 'Beschreibung', type: 'textarea', value: p.description, full: true }, { name: 'items', label: 'Leistungen', type: 'multi', options: D.catalog.filter((i) => i.active && D.categories.some((c) => c.id === i.cat && /tuning|optik|lack/i.test(c.name))).map((i) => [i.id, i.name]), value: p.items || [], full: true }, { name: 'active', label: 'Aktiv', type: 'checkbox', value: p.active !== false }];
  A['pkg-new'] = () => BX.form({ title: 'Neues Tuning-Paket', fields: pkgFields(), submit: async (v) => { await BX.api('POST', '/api/r/tuningPackages', { ...v, pos: D.tuningPackages.length }); return 'Paket angelegt'; } });
  A['pkg-edit'] = (id) => BX.form({ title: 'Paket bearbeiten', fields: pkgFields(U.byId(D.tuningPackages, id)), submit: async (v) => { await BX.api('PATCH', '/api/r/tuningPackages/' + id, v); return 'Gespeichert'; } });
  A['pkg-del'] = (id) => BX.confirm('Paket löschen', 'Das Paket wird gelöscht. Aufträge bleiben unverändert.', 'Löschen', () => BX.call('DELETE', '/api/r/tuningPackages/' + id, undefined, 'Gelöscht'));
  A['pkg-class'] = (v) => { S().pkgClass = v; BX.render(); };
  P.tuning = function (params, q) {
    const tab = q.tab || 'konfigurator';
    const head = pageHead('Tuning', 'Upgrades zusammenstellen, Pakete und Tuning-Stand der Kundenfahrzeuge', tab === 'pakete' && lvl('tuning') >= 3 ? btn('Neues Paket', { cls: 'primary', icon: 'plus', action: 'pkg-new' }) : '');
    const tabsHtml = U.tabs('#/tuning', [['konfigurator', 'Konfigurator'], ['pakete', 'Pakete', D.tuningPackages.length], ['uebersicht', 'Übersicht']], tab);
    if (tab === 'konfigurator') return head + tabsHtml + configurator(q);
    if (tab === 'pakete') {
      const cls = S().pkgClass || (D.vehicleClasses.find((c) => c.name === 'Sport') || D.vehicleClasses[0]).id;
      return head + tabsHtml + `<div class="row mb"><div class="field" style="width:220px"><label>Preise für Klasse</label>${U.select(D.vehicleClasses.map((c) => [c.id, c.name]), cls, 'data-change="pkg-class"')}</div></div><div class="grid g-3">${D.tuningPackages.map((p) => {
        const its = p.items.map((i) => U.item(i)).filter(Boolean);
        const sum = its.reduce((s, i) => s + D.unitPrice(i, cls), 0);
        const pr = Math.round(sum * (1 - p.discount / 100));
        return card(esc(p.name) + (p.active ? '' : ' ' + badge('inaktiv', '')), `<p class="muted">${esc(p.description)}</p><div class="list">${its.map((i) => `<div class="list-item" style="padding:6px 0"><span class="grow">${esc(i.name)}</span><span class="muted">${money(D.unitPrice(i, cls))}</span></div>`).join('')}</div><hr><div class="row between"><span class="muted">einzeln</span><s class="faint">${money(sum)}</s></div><div class="row between"><b>Paketpreis (−${p.discount} %)</b><b style="font-size:18px">${money(pr)}</b></div><div class="muted" style="font-size:12px">Ersparnis ${money(sum - pr)}</div>`,
          { actions: lvl('tuning') >= 3 ? btn('', { cls: 'sm ghost', icon: 'gear', action: 'pkg-edit', arg: p.id }) + (lvl('tuning') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'pkg-del', arg: p.id }) : '') : '' });
      }).join('') || card('', '<div class="empty">Noch keine Pakete</div>')}</div><div class="mt">${note('Pakete wählst du im Konfigurator. Der Paketrabatt gilt ohne Freigabe; liegt der Rabatt der Preisgruppe höher, gilt der.', 'info')}</div>`;
    }
    // Übersicht
    const tuned = {};
    D.tuning.forEach((t) => { (tuned[t.vehicle] ||= {})[t.category] = t.level; });
    const ids = Object.keys(tuned);
    const per = TCATS.map((k) => ({ label: k, s1: 0, s2: 0, s3: 0 }));
    D.tuning.forEach((t) => { const r = per.find((p) => p.label === t.category); if (r) r['s' + Math.min(3, t.level)]++; });
    const top = ids.map((id) => ({ v: U.veh(id), score: Object.values(tuned[id]).reduce((s, x) => s + x, 0), t: tuned[id] })).filter((x) => x.v).sort((a, b) => b.score - a.score).slice(0, 10);
    const rev = {};
    (D.orders || []).filter((o) => ['invoiced', 'picked_up', 'done'].includes(o.status)).forEach((o) => o.items.forEach((l) => { const it = U.item(l.item); if (it && it.tuning) rev[it.tuning[0]] = (rev[it.tuning[0]] || 0) + D.lineTotal(l); }));
    const revData = Object.entries(rev).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
    return head + tabsHtml + `<div class="grid g-4 mb">${kpi('Getunte Fahrzeuge', ids.length, `von ${D.vehicles.filter((v) => v.status === 'active').length}`, { icon: 'gauge', accent: true })}${kpi('Upgrades verbaut', D.tuning.length, '', { icon: 'wrench' })}${kpi('Tuning-Umsatz', money(revData.reduce((s, d) => s + d.v, 0)), 'fertige und abgerechnete Aufträge', { icon: 'coins' })}${kpi('Pakete', D.tuningPackages.filter((p) => p.active).length, '', { icon: 'box' })}</div>
      <div class="grid g-2">${card('Tuning-Stand nach Kategorie', U.barChart(per, { id: 'tuneStages', label: 'Fahrzeuge je Stufe', count: true, series: [{ key: 's1', label: 'Stufe 1', color: '#fbbf24' }, { key: 's2', label: 'Stufe 2', color: '#f97316' }, { key: 's3', label: 'Stufe 3', color: '#ef4444' }] }), { sub: 'Anzahl Fahrzeuge' })}${card('Umsatz je Kategorie', revData.length ? U.donut(revData, { id: 'tuneRev', label: 'Tuning-Umsatz je Kategorie' }) : '<div class="empty">Noch kein Tuning-Umsatz</div>')}</div>
      <div class="mt">${card('Am stärksten getunt', table([{ key: 'p', label: 'Fahrzeug' }, { key: 'c', label: 'Halter' }, ...TCATS.map((k) => ({ key: k, label: k, num: true })), { key: 'x', label: '' }], top.map((x) => ({ _href: '#/fahrzeug/' + x.v.id, p: `${plate(x.v.plate)} <span class="sub">${esc(x.v.make)} ${esc(x.v.model)}</span>`, c: esc((U.cust(x.v.owner) || {}).name || ''), ...Object.fromEntries(TCATS.map((k) => [k, x.t[k] ? `<b>${x.t[k]}</b>` : '<span class="faint">–</span>'])), x: lvl('orders') >= 3 ? `<a class="btn sm" href="#/tuning?v=${x.v.id}">Konfigurieren</a>` : '' })), { cls: 'no-stack', empty: 'Noch keine getunten Fahrzeuge' }), { flush: true })}</div>`;
  };

  // ================= Regelwerk =================
  BX.openRules = () => (D.ruleDocs || []).filter((d) => d.requireAck && (D.myAcks[d.id] || 0) < d.version && D.staff.some((s) => s.id === D.me.id && s.rank));
  A['rule-ack'] = (id) => BX.call('POST', `/api/rules/${id}/ack`, {}, 'Bestätigt – danke!');
  A['rule-scroll'] = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const ruleFields = (d = {}, isNew) => [
    { name: 'title', label: 'Titel', value: d.title, required: true, full: true },
    { name: 'body', label: 'Text (# Überschrift, - Liste, **fett**, > Hinweis, | Tabelle |)', type: 'textarea', value: d.body, full: true, attrs: 'style="min-height:360px;font-family:var(--mono);font-size:13px"' },
    { name: 'note', label: isNew ? 'Notiz zur ersten Fassung' : 'Was hat sich geändert?', value: isNew ? 'Erste Fassung' : '', full: true },
    { name: 'requireAck', label: 'Lesebestätigung verlangen', type: 'checkbox', value: d.requireAck !== false },
    ...(isNew ? [] : [{ name: 'newVersion', label: 'Als neue Fassung veröffentlichen', type: 'checkbox', value: true, hint: 'Alle müssen dann neu bestätigen. Aus = nur Korrektur (Tippfehler), Version bleibt' }]),
  ];
  A['rule-new'] = () => BX.form({ title: 'Neues Dokument', wide: true, cols: 1, fields: ruleFields({ body: '# Titel\n\n## Abschnitt\n- Punkt' }, true), submit: async (v) => { const r = await BX.api('POST', '/api/rules', v); setTimeout(() => { location.hash = '#/regelwerk?doc=' + r.id; }); return 'Dokument angelegt'; } });
  A['rule-edit'] = (id) => BX.form({ title: 'Dokument bearbeiten', wide: true, cols: 1, fields: ruleFields(U.byId(D.ruleDocs, id), false), submit: async (v) => { const r = await BX.api('PATCH', '/api/rules/' + id, v); return `Gespeichert (Version ${r.version})`; } });
  A['rule-del'] = (id) => BX.confirm('Dokument löschen', 'Das Dokument und alle Bestätigungen werden gelöscht.', 'Löschen', async () => { await BX.call('DELETE', '/api/rules/' + id, undefined, 'Gelöscht'); location.hash = '#/regelwerk'; });
  A['rule-move'] = (arg) => { const [id, dir] = arg.split(':'); return BX.call('POST', `/api/rules/${id}/move`, { dir }); };
  A['rule-versions'] = async (id) => {
    let vs;
    try { vs = await BX.api('GET', `/api/rules/${id}/versions`); } catch (e) { return BX.toast(e.message, 'bad'); }
    BX.openModal({ title: 'Fassungen', wide: true, body: `<div class="list">${vs.map((v) => `<details class="version"><summary><b>Version ${v.version}</b> · ${date(v.at)} · ${esc((U.user(v.by) || {}).name || '')}${v.note ? ' · <span class="muted">' + esc(v.note) + '</span>' : ''}</summary><div class="mt">${U.mdBlock(v.body, { prefix: 'v' + v.version }).html}</div></details>`).join('')}</div>`, foot: '<button class="btn" data-action="modal-close">Schließen</button>' });
  };
  P.regelwerk = function (params, q) {
    const docs = D.ruleDocs;
    const canW = lvl('rules') >= 3;
    const head = pageHead('Regelwerk', 'Dienstverordnung, Firmen-Kodex und weitere Regeln – nur für Mitarbeiter', canW ? btn('Neues Dokument', { cls: 'primary', icon: 'plus', action: 'rule-new' }) : '');
    if (!docs.length) return head + card('', '<div class="empty">Noch keine Dokumente</div>');
    const tab = q.tab || 'lesen';
    const doc = U.byId(docs, q.doc) || docs[0];
    const acked = (D.myAcks[doc.id] || 0) >= doc.version;
    const nav = `<div class="rule-nav">${docs.map((d, i) => { const ok = !d.requireAck || (D.myAcks[d.id] || 0) >= d.version; return `<a class="rule-link ${d.id === doc.id ? 'active' : ''}" href="#/regelwerk?doc=${d.id}">${icon('id', 'width="16" height="16"')}<span class="grow">${esc(d.title)}</span>${ok ? `<span class="qdot ok" title="bestätigt"></span>` : `<span class="badge accent">neu</span>`}${canW ? `<span class="rule-move"><button class="btn sm ghost" ${i === 0 ? 'disabled' : ''} data-action="rule-move" data-arg="${d.id}:up">▲</button><button class="btn sm ghost" ${i === docs.length - 1 ? 'disabled' : ''} data-action="rule-move" data-arg="${d.id}:down">▼</button></span>` : ''}</a>`; }).join('')}</div>`;
    const tabsHtml = canW ? U.tabs('#/regelwerk?doc=' + doc.id + '&', [['lesen', 'Lesen'], ['bestaetigungen', 'Bestätigungen']], tab).replace(/\?doc=([^&"]+)&\?tab=/g, '?doc=$1&tab=') : '';
    let main;
    if (tab === 'bestaetigungen' && canW) {
      const staff = D.staff.filter((s) => s.rank && ['active', 'leave'].includes(s.status));
      const rows = staff.map((s) => { const a = D.ruleAcks.find((x) => x.doc === doc.id && x.user === s.id); const st = !a ? badge('nie bestätigt', 'bad', true) : a.version >= doc.version ? badge('Version ' + a.version, 'ok', true) : badge('alte Version ' + a.version, 'warn', true); return { p: person(s, U.rank(s.rank).name), s: st, a: a ? date(a.at) : '–' }; });
      const okN = staff.filter((s) => D.ruleAcks.some((x) => x.doc === doc.id && x.user === s.id && x.version >= doc.version)).length;
      main = card(`Bestätigungen · ${esc(doc.title)} · Version ${doc.version}`, `<div class="row mb" style="padding:12px 16px 0">${bar(okN / Math.max(1, staff.length) * 100, okN === staff.length ? 'ok' : 'warn')}<b class="nowrap">${okN} / ${staff.length}</b></div>` + table([{ key: 'p', label: 'Mitarbeiter' }, { key: 's', label: 'Status' }, { key: 'a', label: 'Zuletzt bestätigt' }], rows), { flush: true });
    } else {
      const r = U.mdBlock(doc.body, { prefix: 'd' });
      const toc = r.toc.filter((x) => x.lv >= 2);
      main = `${doc.requireAck && !acked ? `<div class="mb">${note(`<b>Bitte lesen und bestätigen.</b> ${D.myAcks[doc.id] ? `Du hast Version ${D.myAcks[doc.id]} bestätigt – es gibt eine neue Fassung.` : 'Du hast dieses Dokument noch nicht bestätigt.'}`, 'warn', 'id')}</div>` : ''}
        <div class="grid rule-layout">${toc.length > 2 ? `<aside class="card rule-toc"><div class="card-body"><b>Inhalt</b>${toc.map((t) => `<a role="button" tabindex="0" data-action="rule-scroll" data-arg="${t.id}" class="toc-l${t.lv}">${esc(t.text)}</a>`).join('')}</div></aside>` : ''}
        ${card('', `<article class="rule-doc">${r.html}</article><hr><div class="row between"><span class="muted" style="font-size:12px">Version ${doc.version} · zuletzt geändert ${date(doc.updatedAt)} von ${esc((U.user(doc.updatedBy) || {}).name || '')}</span>${doc.requireAck ? (acked ? badge(`von dir bestätigt (Version ${D.myAcks[doc.id]})`, 'ok', true) : btn('Gelesen und akzeptiert', { cls: 'primary', icon: 'check', action: 'rule-ack', arg: doc.id })) : ''}</div>`, { actions: canW ? btn('Fassungen', { cls: 'sm ghost', action: 'rule-versions', arg: doc.id }) + btn('Bearbeiten', { cls: 'sm', icon: 'gear', action: 'rule-edit', arg: doc.id }) + (lvl('rules') >= 4 ? btn('', { cls: 'sm ghost', icon: 'trash', action: 'rule-del', arg: doc.id }) : '') : '' })}</div>`;
    }
    return head + `<div class="grid rule-page">${nav}<div>${tabsHtml}${main}</div></div>`;
  };
})();
