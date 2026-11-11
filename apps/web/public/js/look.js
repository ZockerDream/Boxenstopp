/* Boxenstopp – Darstellung je Mitarbeiter (Modus, Farbtheme, Design V1/V2 Glass) und Firmenlogo.
   Darstellung: am Benutzer gespeichert (users.ui.look), zusätzlich im Browser für den schnellen Start. Logo: Firmen-Einstellung. */
(function () {
  'use strict';
  const BX = window.BX;
  const U = BX.ui;
  const KEY = 'bx-look';

  const ACCENTS = [
    ['amber', 'Bernstein', '#f59e0b'], ['racing', 'Racing-Rot', '#f87171'], ['rose', 'Rosé', '#fb7185'], ['indigo', 'Indigo', '#818cf8'],
    ['ocean', 'Ozean', '#38bdf8'], ['emerald', 'Smaragd', '#34d399'], ['lime', 'Limette', '#a3e635'], ['mono', 'Mono', '#9ca3af'],
  ];
  const BACKGROUNDS = [
    ['garage', 'Werkstatt bei Nacht', 'radial-gradient(1200px 700px at 15% 10%, rgba(245,158,11,.45), transparent 60%), radial-gradient(900px 600px at 85% 90%, rgba(239,68,68,.35), transparent 60%), linear-gradient(160deg, #0b0d12, #1b1f29 60%, #2a1a0a)'],
    ['dusk', 'Dämmerung', 'linear-gradient(135deg, #1e1b4b 0%, #6d28d9 35%, #db2777 65%, #f59e0b 100%)'],
    ['ocean', 'Hafen', 'radial-gradient(1000px 600px at 80% 0%, rgba(56,189,248,.5), transparent 60%), linear-gradient(160deg, #082f49, #0f766e)'],
    ['forest', 'Wald', 'radial-gradient(900px 600px at 20% 20%, rgba(163,230,53,.35), transparent 60%), linear-gradient(160deg, #052e16, #14532d 50%, #1c1917)'],
    ['asphalt', 'Asphalt', 'repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 14px), radial-gradient(1000px 700px at 50% 0%, #374151, #0b0d12)'],
    ['none', 'Ohne Bild', 'none'],
  ];
  const LOGO_PRESETS = ['wrench', 'gear', 'steer', 'gauge', 'car', 'truck', 'star', 'shield'];
  const DEFAULTS = { mode: 'dark', accent: 'amber', ui: 'v1', bg: 'garage', custom: null, blur: 16, glass: 62, dim: 25, mobileBlur: false };

  let local = {};
  try { local = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { local = {}; }
  const prefs = Object.assign({}, DEFAULTS, local);
  const sysLight = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const resolvedMode = () => (prefs.mode === 'system' ? (sysLight() ? 'light' : 'dark') : prefs.mode);

  function apply() {
    const r = document.documentElement;
    r.setAttribute('data-theme', resolvedMode());
    r.setAttribute('data-accent', prefs.accent);
    r.setAttribute('data-ui', prefs.ui);
    r.setAttribute('data-mobile-blur', prefs.mobileBlur ? 'on' : 'off');
    r.style.setProperty('--blur', prefs.blur + 'px');
    r.style.setProperty('--glass', prefs.glass + '%');
    r.style.setProperty('--dim', (prefs.dim / 100).toFixed(2));
    const bg = document.getElementById('bg');
    if (bg) {
      const img = prefs.bg === 'custom' && prefs.custom ? `url("${prefs.custom}")` : (BACKGROUNDS.find((b) => b[0] === prefs.bg) || BACKGROUNDS[0])[2];
      bg.style.backgroundImage = img;
      bg.style.backgroundColor = getComputedStyle(r).getPropertyValue('--bg');
    }
  }
  let syncTimer = null;
  function save() {
    let ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { ok = false; }
    if (BX.data && BX.data.me) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        const ui = Object.assign({}, BX.data.me.ui || {}, { look: prefs });
        BX.data.me.ui = ui;
        BX.api('PATCH', '/api/me', { ui }).catch((e) => BX.toast && BX.toast('Darstellung nicht gespeichert: ' + e.message));
      }, 600);
    }
    return ok;
  }
  const set = (k, v) => { prefs[k] = v; const ok = save(); apply(); return ok; };
  // Nach dem Login: gespeicherte Darstellung des Benutzers übernehmen
  function adoptServer(ui) {
    if (ui && ui.look) { Object.assign(prefs, DEFAULTS, ui.look); try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* egal */ } }
    apply();
  }

  const logo = () => (BX.data && BX.data.logo) || { kind: 'preset', preset: 'wrench' };
  function logoHtml(cls, l) {
    const lg = l || logo();
    if (lg.kind === 'image' && lg.data) return `<span class="brand-mark img ${cls || ''}"><img src="${U.esc(lg.data)}" alt="Firmenlogo"></span>`;
    return `<span class="brand-mark ${cls || ''}">${U.icon(lg.preset || 'wrench')}</span>`;
  }
  function readImage(file, maxKb, cb, allowSvg) {
    if (!file) return;
    const types = allowSvg ? /^image\/(png|jpeg|webp|svg\+xml)$/ : /^image\/(png|jpeg|webp)$/;
    if (!types.test(file.type)) { cb(new Error('Nur PNG, JPEG oder WebP')); return; }
    if (file.size > maxKb * 1024) { cb(new Error(`Datei zu groß (max. ${maxKb >= 1024 ? maxKb / 1024 + ' MB' : maxKb + ' KB'})`)); return; }
    const fr = new FileReader();
    fr.onload = () => cb(null, fr.result);
    fr.onerror = () => cb(new Error('Datei nicht lesbar'));
    fr.readAsDataURL(file);
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => { if (prefs.mode === 'system') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  BX.look = { prefs, ACCENTS, BACKGROUNDS, LOGO_PRESETS, DEFAULTS, apply, save, set, adoptServer, logo, logoHtml, readImage, resolvedMode };
})();
