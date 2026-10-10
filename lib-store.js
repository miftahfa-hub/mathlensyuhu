// Lapisan data MathLens (adapter 'local').
// PENTING: mode ini memakai localStorage/IndexedDB milik browser ini — BUKAN penyimpanan permanen di server.
// Untuk produksi, implementasikan antarmuka yang sama (load/save/mutate/auth) di atas Supabase
// (skema + RLS ada di backend/schema.sql). Halaman hanya memakai objek `store` dan `auth` di bawah.
import { uid, newToken, isEmail } from './lib-core.js';
import { buildDemo, emptyUserData, DEMO_USER, DEFAULT_TEMPLATES, defaultSettings, defaultCms } from './lib-seed.js';

const CFG = window.MATHLENS_CONFIG || {};
const G_KEY = 'mathlens:global:v1';
const D_KEY = (id) => `mathlens:data:v1:${id}`;
const S_KEY = 'mathlens:session:v1';
const SESSION_MS = 8 * 60 * 60 * 1000;

const listeners = new Set();
let saveError = null;
const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); saveError = null; return true; } catch (e) { saveError = e; return false; } };

function initGlobal() {
  return { users: [{ ...DEMO_USER }], settings: defaultSettings(), cms: defaultCms(), templates: DEFAULT_TEMPLATES, audit: [], links: [] };
}
let G = read(G_KEY) || initGlobal();
if (!G.users.some((u) => u.id === DEMO_USER.id)) G.users.push({ ...DEMO_USER });
G.settings = { ...defaultSettings(), ...G.settings };
// Migrasi aman: templat pesan bawaan versi lama diganti isinya (kalimat penjelas ≥ 30 kata); templat lain dan data pengguna tidak disentuh.
for (const dt of DEFAULT_TEMPLATES) {
  const i = G.templates.findIndex((t) => t.id === dt.id);
  if (i < 0) G.templates.push(dt);
  else if ((G.templates[i].ver || 1) < (dt.ver || 1)) G.templates[i] = { ...G.templates[i], body: dt.body, ver: dt.ver };
}
G.cms = { ...defaultCms(), ...G.cms };
let sess = read(S_KEY);
if (sess && sess.exp < Date.now()) { sess = null; localStorage.removeItem(S_KEY); }
let D = null;

function loadUserData(userId) {
  let d = read(D_KEY(userId));
  if (!d && userId === DEMO_USER.id) { d = buildDemo(); write(D_KEY(userId), d); }
  return d ? { ...emptyUserData(), ...d } : emptyUserData();
}
if (sess) D = loadUserData(sess.userId);
const notify = () => listeners.forEach((f) => f());

export const store = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get g() { return G; },
  get d() { return D || emptyUserData(); },
  get saveError() { return saveError; },
  mutate(fn) { if (!D || !sess) return; fn(D); write(D_KEY(sess.userId), D); notify(); },
  mutateGlobal(fn) { fn(G); write(G_KEY, G); notify(); },
  audit(action, entityType, entityId, details = '') {
    const u = auth.user();
    G.audit.unshift({ id: uid('log'), actorId: u?.id || null, actorEmail: u?.email || '-', action, entityType, entityId, details, at: new Date().toISOString() });
    G.audit = G.audit.slice(0, 500);
    write(G_KEY, G);
  },
  resetDemo() {
    write(D_KEY(DEMO_USER.id), buildDemo());
    if (sess?.userId === DEMO_USER.id) D = loadUserData(DEMO_USER.id);
    G.links = G.links.filter((l) => l.userId !== DEMO_USER.id);
    write(G_KEY, G); notify();
  },
  isDemoData() { return sess?.userId === DEMO_USER.id; },
  // ---- tautan laporan aman ----
  createLink({ assessmentId, studentId, days }) {
    const u = auth.user();
    const link = { token: newToken(), userId: u.id, assessmentId, studentId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + (days || G.settings.linkExpiryDays) * 864e5).toISOString(), revoked: false };
    G.links.push(link); write(G_KEY, G); notify();
    return link;
  },
  revokeLink(token) { const l = G.links.find((x) => x.token === token); if (l) { l.revoked = true; write(G_KEY, G); notify(); } },
  /** Menyelesaikan token → data hanya milik satu siswa. Mengembalikan null jika tidak valid. */
  resolveLink(token) {
    const l = G.links.find((x) => x.token === token);
    if (!l || l.revoked || new Date(l.expiresAt) < new Date()) return { error: l?.revoked ? 'Tautan telah dicabut oleh guru.' : l ? 'Tautan sudah kedaluwarsa.' : 'Tautan tidak ditemukan.' };
    const d = loadUserData(l.userId);
    const teacher = G.users.find((u) => u.id === l.userId);
    const a = d.assessments.find((x) => x.id === l.assessmentId);
    const st = d.students.find((x) => x.id === l.studentId);
    if (!a || !st) return { error: 'Laporan tidak tersedia.' };
    return { link: l, d, teacher, a, st };
  },
};

// ---------- berkas jawaban (IndexedDB) ----------
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('mathlens-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export const files = {
  async put(id, blob) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async get(id) { const db = await idb(); return new Promise((res, rej) => { const r = db.transaction('files').objectStore('files').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async del(id) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
};

// ---------- autentikasi (lokal) ----------
async function hashPw(pw, saltB64) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
const roleFor = (email, current) => {
  const su = (CFG.superAdminEmail || '').trim().toLowerCase();
  if (su && email.toLowerCase() === su) return 'super_admin';
  return current === 'super_admin' ? 'guru' : current || 'guru';
};
function start(user) {
  sess = { userId: user.id, exp: Date.now() + SESSION_MS };
  write(S_KEY, sess); D = loadUserData(user.id); notify();
}

export const auth = {
  user() { return sess ? G.users.find((u) => u.id === sess.userId && u.active) || null : null; },
  superAdminConfigured: () => !!(CFG.superAdminEmail || '').trim(),
  async signUp({ name, email, password, school, level }) {
    if (!name?.trim()) throw new Error('Nama wajib diisi.');
    if (!isEmail(email)) throw new Error('Format email tidak valid.');
    if ((password || '').length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    if (G.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('Email sudah terdaftar.');
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const user = { id: uid('u'), email: email.trim(), name: name.trim(), school: school?.trim() || '', level: level || '', role: roleFor(email.trim()), active: true, salt, hash: await hashPw(password, salt), createdAt: new Date().toISOString() };
    G.users.push(user); write(G_KEY, G);
    store.audit('user.signup', 'user', user.id, `role=${user.role}`);
    start(user);
    return user;
  },
  async signIn(email, password) {
    const u = G.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase() && !x.demo);
    if (!u || !u.hash || (await hashPw(password, u.salt)) !== u.hash) throw new Error('Email atau kata sandi salah.');
    if (!u.active) throw new Error('Akun dinonaktifkan. Hubungi administrator.');
    const role = roleFor(u.email, u.role);
    if (role !== u.role) { u.role = role; write(G_KEY, G); }
    store.audit('user.signin', 'user', u.id);
    start(u);
    return u;
  },
  startDemo() { start(G.users.find((u) => u.id === DEMO_USER.id)); },
  signOut() { sess = null; D = null; localStorage.removeItem(S_KEY); notify(); },
  isAdmin() { return auth.user()?.role === 'super_admin'; },
  /** Hanya Super Admin; tidak dapat menetapkan super_admin dan tidak dapat mengubah peran sendiri. */
  setRole(userId, role) {
    if (!auth.isAdmin()) throw new Error('Hanya Super Admin yang dapat mengubah peran.');
    if (!['guru', 'admin_sekolah'].includes(role)) throw new Error('Peran tidak diizinkan.');
    const u = G.users.find((x) => x.id === userId);
    if (!u || u.id === auth.user().id || u.role === 'super_admin') throw new Error('Peran pengguna ini tidak dapat diubah.');
    store.mutateGlobal(() => { u.role = role; });
    store.audit('user.role', 'user', u.id, `role=${role}`);
  },
  setActive(userId, active) {
    if (!auth.isAdmin()) throw new Error('Hanya Super Admin.');
    const u = G.users.find((x) => x.id === userId);
    if (!u || u.id === auth.user().id || u.role === 'super_admin') throw new Error('Akun ini tidak dapat dinonaktifkan.');
    store.mutateGlobal(() => { u.active = active; });
    store.audit(active ? 'user.activate' : 'user.deactivate', 'user', u.id);
  },
};

export const config = CFG;
export const integrationStatus = () => ({
  email: !!(CFG.integrations?.email && CFG.apiBase),
  whatsappBusiness: !!(CFG.integrations?.whatsappBusiness && CFG.apiBase),
});
