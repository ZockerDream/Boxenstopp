// Rechte: Werkstatt über Ränge/Gruppen/Personen (Stufen 0–4), Administration über Systemrollen.
import { q } from './db.js';
import { fail } from './lib.js';

export const MODULES = [
  'staff', 'ranks', 'perms', 'customers', 'vehicles', 'orders', 'appointments', 'callouts', 'catalog', 'stock',
  'invoices', 'accounts', 'tax', 'payroll', 'reports', 'shifts', 'trainings', 'licenses', 'stafffiles', 'board', 'settings',
];
export const FLAGS = {
  'rabatt.max_prozent': { label: 'Max. Rabatt ohne Freigabe', type: 'percent' },
  'auftrag.preis_aendern': { label: 'Vom Preis abweichen', type: 'bool' },
  'rechnung.storno': { label: 'Rechnungen stornieren', type: 'bool' },
  'kasse.abschluss': { label: 'Tagesabschluss', type: 'bool' },
  'personal.lohn_sehen': { label: 'Löhne anderer sehen', type: 'bool' },
};
export const SYS_PERMS = [
  ['user:read', 'Benutzer ansehen'], ['user:create', 'Benutzer anlegen & einladen'], ['user:update', 'Benutzer bearbeiten'], ['user:lock', 'Sperren, Ablauf, 2FA, Sitzungen'],
  ['user:delete', 'Benutzer löschen'], ['role:manage', 'Systemrollen verwalten'], ['server:read', 'Server-Übersicht'], ['server:settings', 'Sicherheit & Einstellungen'],
  ['backup:manage', 'Backups'], ['integration:manage', 'Webhooks & API-Schlüssel'], ['audit:read', 'Audit-Log'], ['ticket:manage', 'Tickets bearbeiten'],
];

// Lädt alle Rechte-Tabellen (klein, einmal je Anfrage)
export async function loadAuthz() {
  const [perms, flags, gm, roles, rolePerms] = await Promise.all([
    q('SELECT target_type, target_id, module, level FROM permissions'),
    q('SELECT target_type, target_id, flag, value FROM permission_flags'),
    q('SELECT group_id, user_id FROM group_members'),
    q('SELECT user_id, role_id FROM user_system_roles'),
    q('SELECT role_id, perm FROM system_role_perms'),
  ]);
  const A = { rank: {}, group: {}, user: {}, fRank: {}, fGroup: {}, fUser: {}, groupsOf: {}, rolesOf: {}, rolePerms: {} };
  for (const p of perms) ((A[p.target_type][p.target_id] ||= {})[p.module] = p.level);
  for (const f of flags) {
    const key = { rank: 'fRank', group: 'fGroup', user: 'fUser' }[f.target_type];
    (A[key][f.target_id] ||= {})[f.flag] = Number(f.value);
  }
  for (const g of gm) (A.groupsOf[g.user_id] ||= []).push(g.group_id);
  for (const r of roles) (A.rolesOf[r.user_id] ||= []).push(r.role_id);
  for (const r of rolePerms) (A.rolePerms[r.role_id] ||= []).push(r.perm);
  return A;
}

const inactive = (u) => !u || ['left', 'locked', 'pending', 'invited'].includes(u.status);

export function explain(A, u, mod) {
  if (inactive(u)) return { level: 0, source: 'kein Zugang' };
  if (u.is_owner) return { level: 4, source: 'Inhaber' };
  if (!u.rank_id) return { level: 0, source: 'kein Rang' };
  const own = A.user[u.id] && A.user[u.id][mod];
  if (own !== undefined) return { level: own, source: 'persönlich gesetzt' };
  let level = (A.rank[u.rank_id] && A.rank[u.rank_id][mod]) || 0;
  let source = 'Rang';
  for (const g of A.groupsOf[u.id] || []) {
    const v = A.group[g] && A.group[g][mod];
    if (v !== undefined && v > level) { level = v; source = 'Gruppe:' + g; }
  }
  return { level, source };
}
export const levelOf = (A, u, mod) => explain(A, u, mod).level;

export function flagOf(A, u, key) {
  const type = FLAGS[key].type;
  if (inactive(u)) return type === 'percent' ? 0 : false;
  if (u.is_owner) return type === 'percent' ? 100 : true;
  const own = A.fUser[u.id] && A.fUser[u.id][key];
  let v = own !== undefined ? own : ((u.rank_id && A.fRank[u.rank_id] && A.fRank[u.rank_id][key]) || 0);
  if (own === undefined) for (const g of A.groupsOf[u.id] || []) { const gv = A.fGroup[g] && A.fGroup[g][key]; if (gv !== undefined && gv > v) v = gv; }
  return type === 'percent' ? v : !!v;
}

export function sysPerms(A, u) {
  if (!u || ['left', 'locked', 'pending'].includes(u.status)) return [];
  const roles = A.rolesOf[u.id] || [];
  if (roles.includes('admin')) return SYS_PERMS.map((p) => p[0]);
  return [...new Set(roles.flatMap((r) => A.rolePerms[r] || []))];
}

// Hängt Prüf-Helfer an die Anfrage
export async function attachAuthz(req) {
  const A = await loadAuthz();
  req.A = A;
  req.level = (mod) => levelOf(A, req.user, mod);
  req.flag = (key) => flagOf(A, req.user, key);
  req.sys = (perm) => sysPerms(A, req.user).includes(perm);
  req.need = (mod, min) => { if (req.level(mod) < min) fail(403, 'Dafür fehlt dir das Recht.'); };
  req.needSys = (perm) => { if (!req.sys(perm)) fail(403, 'Dafür fehlt dir das Systemrecht ' + perm + '.'); };
}

// Niemand vergibt mehr, als er selbst hat
export function assertWithin(req, mod, level) {
  if (req.user.is_owner) return;
  if (level > req.level(mod)) fail(403, 'Du kannst keine höhere Stufe vergeben, als du selbst hast.');
}
