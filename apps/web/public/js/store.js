/* Boxenstopp – Datenspeicher der Oberfläche (aus GET /api/state) und API-Client */
(function () {
  'use strict';
  const BX = (window.BX = window.BX || {});
  const D = (BX.data = { loaded: false });

  // ---------- API ----------
  BX.api = async function (method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let r;
    try { r = await fetch(url, opts); } catch (e) { throw new Error('Keine Verbindung zum Server.'); }
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
    if (!r.ok) {
      const err = new Error((data && data.message) || 'Fehler ' + r.status);
      err.status = r.status;
      err.code = data && data.error;
      if (r.status === 401 && BX.onUnauthorized && !url.startsWith('/api/auth/')) BX.onUnauthorized();
      throw err;
    }
    return data;
  };

  BX.load = async function () {
    const s = await BX.api('GET', '/api/state');
    for (const k of D._stateKeys || []) delete D[k];
    D._stateKeys = Object.keys(s);
    Object.assign(D, s, { loaded: true });
    return D;
  };

  // ---------- Konstanten ----------
  D.statuses = [
    ['quote', 'Angebot', 'violet'], ['accepted', 'Angenommen', 'info'], ['in_progress', 'In Arbeit', 'accent'], ['waiting_parts', 'Wartet auf Teile', 'warn'],
    ['done', 'Fertig', 'ok'], ['invoiced', 'Abgerechnet', ''], ['picked_up', 'Abgeholt', ''], ['rejected', 'Abgelehnt', 'bad'], ['cancelled', 'Storniert', 'bad'],
  ];
  BX.STATUSES = D.statuses;
  BX.MODULES = [
    ['staff', 'Mitarbeiter'], ['ranks', 'Ränge & Gruppen'], ['perms', 'Berechtigungen'], ['customers', 'Kunden'], ['vehicles', 'Fahrzeuge'],
    ['orders', 'Aufträge'], ['appointments', 'Termine'], ['callouts', 'Einsätze'], ['catalog', 'Preisliste'], ['stock', 'Lager'],
    ['invoices', 'Rechnungen'], ['accounts', 'Konten & Buchungen'], ['tax', 'Steuern'], ['payroll', 'Lohn & Provision'], ['reports', 'Berichte'],
    ['shifts', 'Dienstplan'], ['trainings', 'Schulungen'], ['licenses', 'Lizenzen'], ['stafffiles', 'Personalakten'], ['board', 'Schwarzes Brett'], ['settings', 'Firmen-Einstellungen'],
  ];
  BX.JOB_LABELS = {
    'recurring.run': ['Daueraufträge buchen', 'stündlich'], 'reminders.daily': ['Erinnerungen (Nachweise, Lizenzen, Rechnungen)', 'täglich 06:00'], 'stock.check': ['Mindestbestand prüfen', 'täglich 05:00'],
    'shifts.stale': ['Offene Schichten über 12 h', 'stündlich'], 'tax.reminder': ['Steuerzeitraum fällig', 'täglich 07:00'], 'backup.daily': ['Backup', 'täglich 03:00'], cleanup: ['Aufräumen', 'täglich 04:00'],
  };
  BX.WEBHOOK_EVENTS = ['Auftrag fertig', 'Rechnung erstellt', 'Einsatz neu', 'Dienstbeginn/-ende', 'Lager knapp', 'Lizenz läuft ab', 'Rechnung überfällig', 'Steuerzeitraum fällig', 'Ankündigung'];
  BX.TEMPLATES = ['Leitung', 'Meister', 'Mechaniker', 'Azubi', 'Praktikant', 'Buchhaltung', 'Nur lesen', 'keine Rechte'];

  // ---------- Rechenhilfen (gleiche Regeln wie der Server) ----------
  D.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  D.unitPrice = (item, cls) => {
    if (item.classPrices && item.classPrices[cls] != null) return Number(item.classPrices[cls]);
    const s = (item.surcharge && item.surcharge[cls]) || 0;
    return Math.round(Number(item.price) * (1 + Number(s) / 100) * 100) / 100;
  };
  D.groupDiscount = (pgId, item) => {
    const pg = (D.priceGroups || []).find((p) => p.id === pgId);
    if (!pg) return 0;
    if (pg.cats && pg.cats[item.cat] != null) return Number(pg.cats[item.cat]);
    return Number(pg.pct) || 0;
  };
  D.lineTotal = (l) => Math.round(Number(l.qty) * Math.round(Number(l.unit) * 100) * (1 - Number(l.disc) / 100)) / 100;
  D.orderTotal = (o) => Math.round(o.items.reduce((s, l) => s + D.lineTotal(l) * 100, 0)) / 100;
  D.orderGross = (o) => Math.round(o.items.reduce((s, l) => s + Number(l.qty) * Number(l.unit) * 100, 0)) / 100;

  // ---------- Rechte in der Oberfläche (der Server prüft ohnehin) ----------
  BX.perm = {
    level: (uid, mod) => {
      if (!D.me) return 0;
      if (uid === D.me.id) return D.me.levels[mod] || 0;
      const e = D.explain && D.explain[uid];
      return e ? e.levels[mod].level : 0;
    },
    explain: (uid, mod) => (D.explain && D.explain[uid] ? D.explain[uid].levels[mod] : { level: 0, source: '–' }),
    flag: (uid, key) => {
      if (uid === D.me.id) return D.me.flags[key];
      const e = D.explain && D.explain[uid];
      return e ? e.flags[key] : 0;
    },
    sys: (uid, perm) => uid === D.me.id && D.me.sys.includes(perm),
  };
})();
