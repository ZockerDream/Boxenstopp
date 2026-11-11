/* Boxenstopp – UI-Helfer für das Mockup (kein Framework, nur Strings). */
(function () {
  'use strict';
  const D = window.BX.data;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n, opts) => {
    const neg = n < 0;
    const v = Math.abs(Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    return (neg ? '−' : (opts && opts.sign && n > 0 ? '+' : '')) + '$ ' + v;
  };
  const date = (iso) => { if (!iso) return '–'; const [d, t] = String(iso).split(' '); const [y, m, dd] = d.split('-'); return dd + '.' + m + '.' + y + (t ? ' ' + t : ''); };
  const shortDate = (iso) => { const [, m, d] = iso.split('-'); return d + '.' + m + '.'; };
  const weekday = (iso) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(iso + 'T12:00:00Z').getUTCDay()];
  const daysUntil = (iso) => Math.round((new Date(iso + 'T12:00:00Z') - new Date(D.TODAY + 'T12:00:00Z')) / 86400000);

  const byId = (list, id) => list.find((x) => x.id === id);
  const user = (id) => byId(D.staff, id);
  const cust = (id) => byId(D.customers, id);
  const veh = (id) => byId(D.vehicles, id);
  const rank = (id) => byId(D.ranks, id);
  const group = (id) => byId(D.groups, id);
  const cls = (id) => byId(D.vehicleClasses, id);
  const pg = (id) => byId(D.priceGroups, id);
  const training = (id) => byId(D.trainings, id);
  const ltype = (id) => byId(D.licenseTypes, id);
  const part = (id) => byId(D.parts, id);
  const cat = (id) => byId(D.categories, id);
  const item = (id) => byId(D.catalog, id);

  const initials = (name) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (u, size) => u ? `<span class="avatar ${size || ''}" style="background:${u.color}" title="${esc(u.name)}">${esc(initials(u.name))}</span>` : '';
  const person = (u, sub) => u ? `<span class="person">${avatar(u, 'sm')}<span>${esc(u.name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span></span>` : '<span class="faint">–</span>';
  const plate = (p, lg) => `<span class="plate${lg ? ' lg' : ''}">${esc(p)}</span>`;
  const badge = (text, tone, dot) => `<span class="badge ${tone || ''}">${dot ? '<span class="d"></span>' : ''}${esc(text)}</span>`;
  const chip = (t) => `<span class="chip-tag">${esc(t)}</span>`;

  const statusMeta = (key) => { const s = D.statuses.find((x) => x[0] === key); return { key, label: s[1], tone: s[2] }; };
  const statusBadge = (key) => { const s = statusMeta(key); return badge(s.label, s.tone, true); };
  const invStatus = { open: ['Offen', 'info'], partial: ['Teilweise bezahlt', 'warn'], paid: ['Bezahlt', 'ok'], overdue: ['Überfällig', 'bad'], cancelled: ['Storniert', ''] };
  const invBadge = (s) => badge(invStatus[s][0], invStatus[s][1], true);
  const kindLabel = { flat: ['Pauschal', 'accent'], labor: ['Arbeit', 'info'], part: ['Teil', 'violet'], bundle: ['Set', 'ok'] };
  const kindBadge = (k) => badge(kindLabel[k][0], kindLabel[k][1]);
  const custKind = { person: 'Privatperson', company: 'Firma/Fraktion', authority: 'Behörde' };
  const userStatus = { active: ['Aktiv', 'ok'], leave: ['Beurlaubt', 'warn'], locked: ['Gesperrt', 'bad'], left: ['Ausgeschieden', ''], invited: ['Eingeladen', 'info'], pending: ['Wartet auf Freigabe', 'violet'] };
  const levelNames = ['Kein Zugriff', 'Eigene', 'Lesen', 'Lesen & Schreiben', 'Verwalten'];

  // Gültigkeit eines Nachweises / einer Lizenz
  const validity = (until) => {
    if (until === undefined) return { cls: 'none', label: 'Fehlt', tone: '' };
    if (until === null) return { cls: 'ok', label: 'Unbefristet', tone: 'ok' };
    const d = daysUntil(until);
    if (d < 0) return { cls: 'bad', label: 'Abgelaufen', tone: 'bad', d };
    if (d <= 30) return { cls: 'warn', label: 'Läuft in ' + d + ' T. ab', tone: 'warn', d };
    return { cls: 'ok', label: 'Gültig bis ' + date(until), tone: 'ok', d };
  };

  const ICONS = {
    dash: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z',
    cal: 'M7 2v3M17 2v3M3 8h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    truck: 'M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    car: 'M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3v-4zM7 14h.01M17 14h.01',
    tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
    box: 'M21 8 12 3 3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
    coins: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
    file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    bank: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3l9-5z',
    percent: 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 0V5a2 2 0 0 1 2-2h11M16 13.5h.01',
    chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    grad: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5',
    card: 'M3 6h18v12H3zM7 10h4M7 14h7M16 10h1',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
    pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M3 21h18',
    layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    server: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
    userkey: 'M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM3 21v-2a5 5 0 0 1 5-5h3M17 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm2 2h3M21 16v2',
    bug: 'M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1A3 3 0 0 1 15 7.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6 13H2M22 13h-4M6.5 8.5 3 6M17.5 8.5 21 6M6 17l-3 2M18 17l3 2',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    menu: 'M3 6h18M3 12h18M3 18h18',
    plus: 'M12 5v14M5 12h14',
    x: 'M18 6 6 18M6 6l12 12',
    print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    image: 'M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19',
    alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
    check: 'M20 6 9 17l-5-5',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
    id: 'M3 5h18v14H3zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 17c.7-2 2.2-3 4-3s3.3 1 4 3M15 9h4M15 13h3',
    star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
    play: 'M6 4l14 8-14 8z',
    trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    gauge: 'M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0',
    steer: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3.5 10.5 10 12M20.5 10.5 14 12M12 14v7',
  };
  const icon = (name, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}><path d="${ICONS[name] || ICONS.info}"/></svg>`;

  // Tabellen mit data-label für die Handy-Ansicht
  function table(cols, rows, opts) {
    opts = opts || {};
    const head = cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('');
    const body = rows.length ? rows.map((r) => {
      const attrs = r._href ? ` class="clickable${r._dim ? ' dim' : ''}" data-href="${esc(r._href)}"` : (r._dim ? ' class="dim"' : '');
      return `<tr${attrs}${r._filter ? ` data-filter-text="${esc(r._filter.toLowerCase())}"` : ''}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}" data-label="${esc(c.label)}">${r[c.key] == null ? '' : r[c.key]}</td>`).join('')}</tr>`;
    }).join('') : `<tr><td colspan="${cols.length}" data-label=""><div class="empty">${esc(opts.empty || 'Keine Einträge')}</div></td></tr>`;
    const foot = opts.foot ? `<tfoot><tr>${opts.foot.map((f, i) => `<td class="${cols[i] && cols[i].num ? 'num' : ''}" data-label="${f ? esc(cols[i].label) : ''}">${f || ''}</td>`).join('')}</tr></tfoot>` : '';
    return `<div class="table-wrap"><table class="table ${opts.cls || ''}" ${opts.id ? `id="${opts.id}"` : ''}><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
  }

  const card = (title, body, opts) => {
    opts = opts || {};
    const head = title ? `<div class="card-head"><h2>${title}${opts.sub ? ` <span class="sub">· ${opts.sub}</span>` : ''}</h2>${opts.actions || ''}</div>` : '';
    return `<section class="card ${opts.cls || ''}">${head}<div class="card-body ${opts.flush ? 'flush' : ''}">${body}</div>${opts.foot ? `<div class="card-foot">${opts.foot}</div>` : ''}</section>`;
  };
  const kpi = (label, value, delta, opts) => {
    opts = opts || {};
    return `<section class="card kpi ${opts.accent ? 'accent' : ''}"><div class="label">${opts.icon ? icon(opts.icon, 'width="14" height="14"') : ''}${esc(label)}</div><div class="value">${value}</div>${delta ? `<div class="delta ${opts.dir || ''}">${delta}</div>` : ''}</section>`;
  };
  const pageHead = (title, sub, actions, crumbs) => `<div class="page-head"><div class="titles">${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="actions">${actions || ''}</div></div>`;
  const btn = (label, opts) => {
    opts = opts || {};
    const attrs = [opts.action ? `data-action="${opts.action}"` : '', opts.arg ? `data-arg="${esc(opts.arg)}"` : '', opts.disabled ? 'disabled' : '', opts.title ? `title="${esc(opts.title)}"` : ''].join(' ');
    const inner = `${opts.icon ? icon(opts.icon) : ''}${esc(label)}`;
    if (opts.href) return `<a class="btn ${opts.cls || ''}" href="${opts.href}">${inner}</a>`;
    return `<button type="button" class="btn ${opts.cls || ''}" ${attrs}>${inner}</button>`;
  };
  const tabs = (base, list, active) => `<nav class="tabs">${list.map(([key, label, count]) => `<a href="${base}?tab=${key}" class="${key === active ? 'active' : ''}">${esc(label)}${count != null ? `<span class="count">${count}</span>` : ''}</a>`).join('')}</nav>`;
  const note = (text, tone, ic) => `<div class="note ${tone || ''}">${icon(ic || (tone === 'bad' || tone === 'warn' ? 'alert' : 'info'))}<div>${text}</div></div>`;
  const bar = (pct, tone) => `<div class="bar ${tone || ''}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
  const toggle = (on, arg) => `<span class="toggle ${on ? 'on' : ''}" data-action="toggle" ${arg ? `data-arg="${esc(arg)}"` : ''} role="switch" aria-checked="${on}" tabindex="0"></span>`;
  const field = (label, control, opts) => `<div class="field ${opts && opts.full ? 'full' : ''}"><label>${esc(label)}</label>${control}${opts && opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ''}</div>`;
  const input = (value, opts) => `<input class="input ${opts && opts.mono ? 'mono' : ''}" value="${esc(value)}" ${opts && opts.type ? `type="${opts.type}"` : ''} ${opts && opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts && opts.attrs ? opts.attrs : ''}>`;
  const select = (options, value, attrs) => `<select class="input" ${attrs || ''}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // ---------- Diagramme (SVG) ----------
  function barChart(data, opts) {
    opts = opts || {};
    const W = 640, H = opts.h || 200, P = { l: 44, r: 8, t: 10, b: 24 };
    const keys = opts.keys || ['rev'];
    const colors = opts.colors || ['var(--accent)', 'var(--surface-3)'];
    const max = Math.max(...data.flatMap((d) => keys.map((k) => d[k]))) * 1.1 || 1;
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const bw = iw / data.length;
    const inner = keys.length > 1 ? bw * 0.72 / keys.length : bw * 0.6;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Diagramm')}">`;
    for (let i = 0; i <= 4; i++) {
      const y = P.t + ih - ih * i / 4;
      s += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text x="${P.l - 6}" y="${y + 3}" text-anchor="end">${Math.round(max * i / 4 / 1000)}k</text>`;
    }
    data.forEach((d, i) => {
      keys.forEach((k, j) => {
        const h = ih * d[k] / max;
        const x = P.l + i * bw + (bw - inner * keys.length) / 2 + j * inner;
        s += `<rect x="${x.toFixed(1)}" y="${(P.t + ih - h).toFixed(1)}" width="${(inner - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${colors[j]}"><title>${esc(d.label)}: ${money(d[k])}</title></rect>`;
      });
      s += `<text x="${P.l + i * bw + bw / 2}" y="${H - 7}" text-anchor="middle">${esc(d.label)}</text>`;
    });
    return s + '</svg>';
  }
  function areaChart(data, opts) {
    opts = opts || {};
    const W = 640, H = opts.h || 190, P = { l: 44, r: 10, t: 12, b: 24 };
    const max = Math.max(...data.map((d) => d.v)) * 1.15 || 1;
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const pts = data.map((d, i) => [P.l + iw * i / (data.length - 1), P.t + ih - ih * d.v / max]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Verlauf')}"><defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i <= 3; i++) { const y = P.t + ih - ih * i / 3; s += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text x="${P.l - 6}" y="${y + 3}" text-anchor="end">${(max * i / 3 / 1000).toFixed(1)}k</text>`; }
    s += `<path d="${line} L${pts[pts.length - 1][0]} ${P.t + ih} L${pts[0][0]} ${P.t + ih} Z" fill="url(#ag)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
    pts.forEach((p, i) => {
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 4 : 2.5}" fill="var(--accent)"><title>${esc(data[i].label)}: ${money(data[i].v)}</title></circle>`;
      if (i % 2 === (data.length - 1) % 2) s += `<text x="${p[0]}" y="${H - 7}" text-anchor="middle">${esc(data[i].label)}</text>`;
    });
    return s + '</svg>';
  }
  const PALETTE = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#ec4899', '#84cc16'];
  function donut(data, opts) {
    opts = opts || {};
    const total = data.reduce((s, d) => s + d.v, 0) || 1;
    const R = 54, C = 2 * Math.PI * R;
    let off = 0;
    let s = `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="${esc(opts.label || 'Anteile')}"><circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="18"/>`;
    data.forEach((d, i) => {
      const len = C * d.v / total;
      s += `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="18" stroke-dasharray="${(len - 1.5).toFixed(2)} ${(C - len + 1.5).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(d.label)}: ${money(d.v)}</title></circle>`;
      off += len;
    });
    s += `<text x="70" y="66" text-anchor="middle" style="font-size:10px;fill:var(--muted)">${esc(opts.center || 'Gesamt')}</text><text x="70" y="84" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--text)">${esc(opts.centerValue || money(total))}</text></svg>`;
    const legend = data.map((d, i) => `<div><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(d.label)}<b>${opts.fmt ? opts.fmt(d.v) : money(d.v)}</b></div>`).join('');
    return `<div class="donut-wrap">${s}<div class="donut-legend">${legend}</div></div>`;
  }
  const spark = (vals) => {
    const max = Math.max(...vals, 1);
    return `<svg viewBox="0 0 ${vals.length * 12} 24" width="${vals.length * 12}" height="24">${vals.map((v, i) => `<rect x="${i * 12 + 1}" y="${24 - 22 * v / max}" width="9" height="${22 * v / max}" rx="2" fill="${i === vals.length - 1 ? 'var(--accent)' : 'var(--border-strong)'}"/>`).join('')}</svg>`;
  };

  window.BX.ui = {
    esc, money, date, shortDate, weekday, daysUntil, byId, user, cust, veh, rank, group, cls, pg, training, ltype, part, cat, item,
    initials, avatar, person, plate, badge, chip, statusMeta, statusBadge, invBadge, invStatus, kindBadge, kindLabel, custKind, userStatus, levelNames,
    validity, icon, table, card, kpi, pageHead, btn, tabs, note, bar, toggle, field, input, select, md, barChart, areaChart, donut, spark, PALETTE,
  };
})();
