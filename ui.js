import { h, render, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import htm from 'htm';
import { store } from './lib-store.js';
import { checkText, MIN_WORDS } from './lib-narrative.js';

export const html = htm.bind(h);
export { h, render, Fragment, useState, useEffect, useRef, useMemo, useCallback };

// ---------- ikon ----------
const P = {
  home: ['M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
  printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  layers: ['M12 2l10 5-10 5L2 7z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  cap: ['M22 10L12 5 2 10l10 5z', 'M6 12v5c3 2 9 2 12 0v-5'],
  archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
  sparkle: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'],
  chevron: ['M9 18l6-6-6-6'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15'],
};
export function Icon({ n, size = 18, class: cls = '' }) {
  return html`<svg class=${'ic ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(P[n] || P.info).map((d) => html`<path d=${d} />`)}</svg>`;
}

// ---------- router ----------
export function useRoute() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => { const f = () => { setHash(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const [path, qs = ''] = hash.slice(1).split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)), hash };
}
export const go = (p) => { location.hash = p; };
export function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((n) => n + 1)), []);
  return store;
}

// ---------- toast & dialog ----------
const bus = new EventTarget();
export const toast = (msg, kind = 'ok') => bus.dispatchEvent(new CustomEvent('toast', { detail: { msg, kind, id: Math.random() } }));
export const confirmDialog = (opts) => new Promise((resolve) => bus.dispatchEvent(new CustomEvent('confirm', { detail: { ...opts, resolve } })));
export function Overlays() {
  const [toasts, setToasts] = useState([]);
  const [dlg, setDlg] = useState(null);
  useEffect(() => {
    const t = (e) => { setToasts((l) => [...l, e.detail]); setTimeout(() => setToasts((l) => l.filter((x) => x.id !== e.detail.id)), 4500); };
    const c = (e) => setDlg(e.detail);
    bus.addEventListener('toast', t); bus.addEventListener('confirm', c);
    return () => { bus.removeEventListener('toast', t); bus.removeEventListener('confirm', c); };
  }, []);
  const close = (v) => { dlg.resolve(v); setDlg(null); };
  return html`<${Fragment}>
    <div class="toasts" role="status" aria-live="polite">${toasts.map((t) => html`<div class=${'toast ' + t.kind} key=${t.id}><${Icon} n=${t.kind === 'err' ? 'alert' : t.kind === 'warn' ? 'alert' : 'check'} size=${16} /> <span>${t.msg}</span></div>`)}</div>
    ${dlg && html`<${Modal} title=${dlg.title} onClose=${() => close(false)} footer=${html`<${Fragment}><${Btn} variant="ghost" onClick=${() => close(false)}>Batal<//><${Btn} variant=${dlg.danger ? 'danger' : 'primary'} onClick=${() => close(true)}>${dlg.confirmLabel || 'Lanjutkan'}<//><//>`}>
      <div class="prose">${dlg.message}</div><//>`}
  <//>`;
}

// ---------- komponen dasar ----------
export function Btn({ variant = 'secondary', size, icon, children, class: cls = '', ...rest }) {
  return html`<button type="button" class=${`btn ${variant} ${size || ''} ${cls}`} ...${rest}>${icon && html`<${Icon} n=${icon} size=${size === 'sm' ? 15 : 17} />`}${children}</button>`;
}
export const Card = ({ title, action, children, class: cls = '', pad = true }) => html`<section class=${'card ' + cls}>${(title || action) && html`<header class="card-h"><h3>${title}</h3>${action}</header>`}<div class=${pad ? 'card-b' : ''}>${children}</div></section>`;
export const Badge = ({ kind = 'gray', children }) => html`<span class=${'badge ' + kind}>${children}</span>`;
export const DemoBadge = () => html`<span class="badge violet demo-badge" title="Data fiktif untuk demonstrasi">Data Demo</span>`;
export function Empty({ icon = 'layers', title, text, action }) {
  return html`<div class="empty"><div class="empty-ic"><${Icon} n=${icon} size=${26} /></div><h4>${title}</h4>${text && html`<p>${text}</p>`}${action}</div>`;
}
export const Notice = ({ kind = 'info', title, children }) => html`<div class=${'notice ' + kind}><${Icon} n=${kind === 'info' ? 'info' : 'alert'} size=${18} /><div>${title && html`<strong>${title}</strong>`}<div>${children}</div></div></div>`;
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);
  return html`<div class="modal-bg" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'modal ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <header><h3>${title}</h3><button class="icon-btn" onClick=${onClose} aria-label="Tutup"><${Icon} n="x" /></button></header>
      <div class="modal-b">${children}</div>${footer && html`<footer>${footer}</footer>`}
    </div></div>`;
}
export const Field = ({ label, hint, error, children, class: cls = '' }) => html`<label class=${'field ' + cls}><span class="lbl">${label}</span>${children}${hint && !error ? html`<small>${hint}</small>` : ''}${error ? html`<small class="err">${error}</small>` : ''}</label>`;
export const Input = ({ onChange, ...p }) => html`<input class="inp" onInput=${(e) => onChange?.(e.target.value)} ...${p} />`;
export const Textarea = ({ onChange, rows = 3, ...p }) => html`<textarea class="inp" rows=${rows} onInput=${(e) => onChange?.(e.target.value)} ...${p} />`;
export const Select = ({ onChange, options, value, placeholder, ...p }) => html`<select class="inp" value=${value} onChange=${(e) => onChange?.(e.target.value)} ...${p}>${placeholder !== undefined && html`<option value="">${placeholder}</option>`}${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value=${v} selected=${String(v) === String(value)}>${l}</option>`; })}</select>`;
export const Check = ({ checked, onChange, children, disabled }) => html`<label class="chk"><input type="checkbox" checked=${checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} /><span>${children}</span></label>`;
export const Tabs = ({ tabs, value, onChange }) => html`<div class="tabs" role="tablist">${tabs.map(([v, l]) => html`<button role="tab" aria-selected=${v === value} class=${v === value ? 'on' : ''} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
export function PageHeader({ title, sub, actions, demo }) {
  return html`<div class="page-h"><div><h1>${title} ${demo && html`<${DemoBadge} />`}</h1>${sub && html`<p>${sub}</p>`}</div><div class="page-a">${actions}</div></div>`;
}
export const Stat = ({ label, value, sub, tone = 'blue', icon = 'chart' }) => html`<div class=${'stat ' + tone}><div class="stat-ic"><${Icon} n=${icon} /></div><div><div class="stat-v">${value}</div><div class="stat-l">${label}</div>${sub && html`<div class="stat-s">${sub}</div>`}</div></div>`;
export const Progress = ({ value, tone = 'blue' }) => html`<div class="bar" role="progressbar" aria-valuenow=${value ?? 0} aria-valuemin="0" aria-valuemax="100"><span class=${tone} style=${{ width: Math.max(0, Math.min(100, value ?? 0)) + '%' }}></span></div>`;

export function Chart({ type = 'bar', data, options = {}, height = 260 }) {
  const ref = useRef();
  const key = JSON.stringify(data) + type + JSON.stringify(options);
  useEffect(() => {
    if (!window.Chart || !ref.current) return undefined;
    const c = new window.Chart(ref.current, { type, data, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, plugins: { legend: { display: data.datasets.length > 1, labels: { font: { family: 'Inter' } } } }, ...options } });
    return () => c.destroy();
  }, [key]);
  return html`<div style=${{ height: height + 'px', position: 'relative' }}><canvas ref=${ref} role="img" aria-label="Grafik"></canvas></div>`;
}

export function download(name, content, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast('Tersalin ke papan klip.'); } catch { toast('Gagal menyalin; salin secara manual.', 'warn'); } };

// ---------- isian dengan pilihan jawaban ----------
/** Penghitung kata + peringatan kalimat penjelas < MIN_WORDS. Teks guru tidak pernah diubah otomatis. */
export function WordMeter({ text }) {
  const c = checkText(text);
  if (!text.trim()) return null;
  return html`<div class=${'wm ' + (c.ok ? 'ok' : 'warn')} aria-live="polite"><b>${c.totalWords} kata · ${c.sentences.filter((s) => s.counted).length} kalimat</b>${c.ok ? html` · semua kalimat penjelas sudah ${MIN_WORDS} kata atau lebih` : html` · ${c.short.length} kalimat kurang dari ${MIN_WORDS} kata:<ul>${c.short.slice(0, 4).map((s) => html`<li>“${s.text.length > 70 ? s.text.slice(0, 70) + '…' : s.text}” (${s.words} kata)</li>`)}</ul><span>Tambahkan penjelasan yang relevan agar kalimat lebih informatif, atau tekan "Kembalikan otomatis". Teks Anda tidak diubah tanpa persetujuan.</span>`}</div>`;
}

/** Isian otomatis: terisi dari hasil siswa. Guru boleh mengedit; hanya teks yang berbeda dari otomatis yang disimpan sebagai
 *  catatan guru, dan teks itu tidak pernah ditimpa. "Kembalikan otomatis" menghapus suntingan. */
export function AutoField({ label, auto, value = '', rows = 3, onSave, hint }) {
  const edited = !!(value && value.trim());
  const [v, setV] = useState(edited ? value : auto);
  const save = (txt) => {
    const t = txt.trim();
    const isAuto = !t || t === auto.trim();
    const policy = store.g.settings.shortSentencePolicy || 'peringatan';
    if (!isAuto && policy === 'wajib' && !checkText(t).ok) { toast(`Kebijakan sekolah mewajibkan setiap kalimat penjelas minimal ${MIN_WORDS} kata. Teks belum disimpan.`, 'err'); return; }
    onSave(isAuto ? '' : t);
  };
  const isAutoNow = v.trim() === auto.trim();
  return html`<div class="field"><div class="row between"><span class="lbl">${label}</span>${isAutoNow ? html`<span class="badge blue">Otomatis dari nilai siswa</span>` : html`<span class="badge violet">Disunting guru</span>`}</div>
    <textarea class="inp" rows=${rows} value=${v} onInput=${(e) => setV(e.target.value)} onBlur=${() => save(v)} />
    <${WordMeter} text=${v} />
    <div class="row between"><small>${hint || 'Isi dibuat otomatis dari nilai dan indikator siswa ini. Anda dapat mengedit; satu baris menjadi satu paragraf.'}</small>${!isAutoNow ? html`<button type="button" class="btn sm ghost" onClick=${() => { setV(auto); onSave(''); }}>Kembalikan otomatis</button>` : ''}</div></div>`;
}

// ---------- unduh PDF (html2pdf.js dimuat saat dibutuhkan) ----------
let pdfLib;
const loadPdfLib = () => pdfLib || (pdfLib = new Promise((res, rej) => {
  if (window.html2pdf) return res(window.html2pdf);
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  s.onload = () => res(window.html2pdf); s.onerror = () => { pdfLib = null; rej(new Error('Pustaka PDF gagal dimuat (periksa koneksi internet).')); };
  document.head.appendChild(s);
}));
export async function downloadPdf(selector, filename) {
  const el = document.querySelector(selector);
  if (!el) { toast('Laporan tidak ditemukan di halaman.', 'err'); return; }
  toast('Menyiapkan PDF…', 'warn');
  try {
    const lib = await loadPdfLib();
    el.classList.add('pdf-mode');
    await lib().set({ margin: [8, 8, 10, 8], filename, image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['.rp-avoid'] } }).from(el).save();
    toast('PDF diunduh: ' + filename);
  } catch (e) { toast(e.message || 'Gagal membuat PDF.', 'err'); } finally { el.classList.remove('pdf-mode'); }
}
