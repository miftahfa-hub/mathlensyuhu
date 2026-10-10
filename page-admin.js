import { html, useState, useStore, Icon, Btn, Card, Badge, Stat, Empty, Notice, Field, Input, Textarea, Select, Check, PageHeader, toast, confirmDialog } from './ui.js';
import { store, auth, config, integrationStatus } from './lib-store.js';
import { uid, fmtDateTime } from './lib-core.js';
import { defaultCms, defaultSettings } from './lib-seed.js';
import { TemplateEditor } from './page-delivery.js';

const ROLE = { super_admin: ['Super Admin', 'violet'], admin_sekolah: ['Admin Sekolah', 'blue'], guru: ['Guru', 'green'] };
function allUserData() {
  return store.g.users.map((u) => { try { return { u, d: JSON.parse(localStorage.getItem(`mathlens:data:v1:${u.id}`) || 'null') }; } catch { return { u, d: null }; } });
}

export function AdminDashboard() {
  useStore();
  const g = store.g; const all = allUserData();
  const sum = (k) => all.reduce((n, { d }) => n + (d?.[k]?.length || 0), 0);
  const integ = integrationStatus();
  const real = g.users.filter((u) => !u.demo);
  return html`<div><${PageHeader} title="Dashboard Super Admin" sub="Statistik dihitung dari data di browser ini (mode penyimpanan lokal)." />
    ${!auth.superAdminConfigured() && html`<${Notice} kind="warn" title="SUPER_ADMIN_EMAIL belum dikonfigurasi">Peran Super Admin ditentukan oleh email di config.js.<//>`}
    <div class="grid g4 mb mt"><${Stat} icon="users" label="Total pengguna" value=${real.length} sub=${`+ ${g.users.length - real.length} akun demo`} /><${Stat} tone="green" icon="cap" label="Total guru" value=${real.filter((u) => u.role === 'guru').length} /><${Stat} tone="violet" icon="grid" label="Total kelas" value=${sum('classes')} sub="termasuk data demo" /><${Stat} tone="amber" icon="users" label="Total siswa" value=${sum('students')} sub="termasuk data demo" /></div>
    <div class="grid g4 mb"><${Stat} icon="edit" label="Total asesmen" value=${sum('assessments')} /><${Stat} tone="green" icon="file" label="Total pengiriman laporan" value=${sum('deliveries')} /><${Stat} tone="violet" icon="link" label="Tautan laporan aktif" value=${g.links.filter((l) => !l.revoked && new Date(l.expiresAt) > new Date()).length} /><${Stat} tone="amber" icon="shield" label="Entri audit log" value=${g.audit.length} /></div>
    <${Card} title="Status integrasi"><ul class="list">
      <li><span><b>Penyimpanan</b><div class="muted sm">Mode: ${config.storageMode}</div></span><${Badge} kind="amber">Lokal (browser)<//></li>
      <li><span><b>Email transaksional</b><div class="muted sm">EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME (di backend)</div></span><${Badge} kind=${integ.email ? 'green' : 'gray'}>${integ.email ? 'Dikonfigurasi (belum diuji)' : 'Belum aktif'}<//></li>
      <li><span><b>WhatsApp Business Platform</b><div class="muted sm">WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_WEBHOOK_VERIFY_TOKEN (di backend)</div></span><${Badge} kind=${integ.whatsappBusiness ? 'green' : 'gray'}>${integ.whatsappBusiness ? 'Dikonfigurasi (belum diuji)' : 'Belum aktif'}<//></li>
      <li><span><b>WhatsApp Share Link</b><div class="muted sm">Pesan disiapkan, guru mengirim manual</div></span><${Badge} kind="green">Tersedia<//></li></ul><//></div>`;
}

export function AdminUsers() {
  useStore();
  const [q, setQ] = useState(''); const [role, setRole] = useState('');
  const me = auth.user();
  const list = store.g.users.filter((u) => (!role || u.role === role) && (!q || (u.name + u.email).toLowerCase().includes(q.toLowerCase())));
  const act = (fn) => { try { fn(); toast('Perubahan disimpan dan dicatat di audit log.'); } catch (e) { toast(e.message, 'err'); } };
  return html`<div><${PageHeader} title="Manajemen Pengguna" sub="Peran Super Admin hanya ditentukan oleh SUPER_ADMIN_EMAIL, bukan oleh formulir." />
    <div class="row mb"><div style=${{ width: '260px' }}><${Input} placeholder="Cari nama / email…" value=${q} onChange=${setQ} /></div><div style=${{ width: '200px' }}><${Select} value=${role} onChange=${setRole} options=${Object.entries(ROLE).map(([k, v]) => [k, v[0]])} placeholder="Semua peran" /></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Terdaftar</th><th></th></tr></thead><tbody>${list.map((u) => html`<tr><td><b>${u.name}</b> ${u.demo && html`<${Badge} kind="violet">Data Demo<//>`}</td><td class="sm">${u.email}</td>
      <td>${u.role === 'super_admin' || u.id === me.id ? html`<${Badge} kind=${ROLE[u.role][1]}>${ROLE[u.role][0]}<//>` : html`<${Select} value=${u.role} onChange=${(v) => act(() => auth.setRole(u.id, v))} options=${[['guru', 'Guru'], ['admin_sekolah', 'Admin Sekolah']]} />`}</td>
      <td>${u.active ? html`<${Badge} kind="green">Aktif<//>` : html`<${Badge} kind="red">Nonaktif<//>`}</td><td class="sm">${fmtDateTime(u.createdAt)}</td>
      <td class="right">${u.role !== 'super_admin' && u.id !== me.id && html`<${Btn} size="sm" onClick=${async () => { if (await confirmDialog({ title: u.active ? 'Nonaktifkan akun?' : 'Aktifkan akun?', message: `${u.name} (${u.email})`, confirmLabel: u.active ? 'Nonaktifkan' : 'Aktifkan', danger: u.active })) act(() => auth.setActive(u.id, !u.active)); }}>${u.active ? 'Nonaktifkan' : 'Aktifkan'}<//>`}</td></tr>`)}</tbody></table></div>
    <p class="muted sm mt">Admin Sekolah tidak otomatis memperoleh akses ke jawaban individual siswa; kebijakan akses perlu ditetapkan sebelum diaktifkan di backend.</p></div>`;
}

export function AdminCms() {
  useStore();
  const [c, setC] = useState(() => JSON.parse(JSON.stringify(store.g.cms)));
  const set = (k) => (v) => setC({ ...c, [k]: v });
  const setList = (k, i, j, v) => setC({ ...c, [k]: c[k].map((r, x) => (x === i ? r.map((cell, y) => (y === j ? v : cell)) : r)) });
  const save = () => {
    if (!c.headline.trim()) return toast('Headline wajib diisi.', 'err');
    if (!/^#[0-9a-fA-F]{6}$/.test(c.brand)) return toast('Warna brand harus berformat #RRGGBB.', 'err');
    store.mutateGlobal((g) => { g.cms = c; }); store.audit('cms.update', 'cms', 'landing'); toast('Konten landing page disimpan.');
  };
  return html`<div><${PageHeader} title="Konten Landing Page" actions=${html`<${Btn} icon="eye" onClick=${() => window.open('#/', '_blank')}>Lihat<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`} />
    <div class="stack"><${Card} title="Hero"><div class="form-grid"><${Field} label="Headline"><${Input} value=${c.headline} onChange=${set('headline')} /><//><${Field} label="Subheadline"><${Input} value=${c.subheadline} onChange=${set('subheadline')} /><//><${Field} label="Tagline"><${Input} value=${c.tagline} onChange=${set('tagline')} /><//><${Field} label="Warna brand (#RRGGBB)"><${Input} value=${c.brand} onChange=${set('brand')} /><//><${Field} label="Deskripsi" class="full"><${Textarea} rows=${3} value=${c.description} onChange=${set('description')} /><//></div><//>
      <${Card} title="Fitur (6 kartu)"><div class="stack">${c.features.map((f, i) => html`<div class="form-grid"><${Field} label=${`Judul ${i + 1}`}><${Input} value=${f[0]} onChange=${(v) => setList('features', i, 0, v)} /><//><${Field} label="Deskripsi"><${Input} value=${f[1]} onChange=${(v) => setList('features', i, 1, v)} /><//></div>`)}</div><//>
      <${Card} title="FAQ" action=${html`<${Btn} size="sm" icon="plus" onClick=${() => setC({ ...c, faq: [...c.faq, ['Pertanyaan baru', 'Jawaban']] })}>Tambah<//>`}><div class="stack">${c.faq.map((f, i) => html`<div class="form-grid"><${Field} label="Pertanyaan"><${Input} value=${f[0]} onChange=${(v) => setList('faq', i, 0, v)} /><//><${Field} label="Jawaban"><${Textarea} rows=${2} value=${f[1]} onChange=${(v) => setList('faq', i, 1, v)} /><//><${Btn} size="sm" variant="ghost" icon="trash" onClick=${() => setC({ ...c, faq: c.faq.filter((_, x) => x !== i) })}>Hapus<//></div>`)}</div><//>
      <${Card} title="Footer"><${Field} label="Teks footer"><${Input} value=${c.footer} onChange=${set('footer')} /><//><div class="muted sm mt">Unggah logo memerlukan penyimpanan berkas di backend dan belum tersedia pada mode lokal.</div><//>
      <${Btn} onClick=${async () => { if (await confirmDialog({ title: 'Kembalikan ke bawaan?', message: 'Semua perubahan konten landing page akan hilang.', confirmLabel: 'Kembalikan', danger: true })) { setC(defaultCms()); store.mutateGlobal((g) => { g.cms = defaultCms(); }); store.audit('cms.reset', 'cms', 'landing'); } }}>Kembalikan ke bawaan<//></div></div>`;
}

export function AdminTemplates() {
  useStore();
  const [edit, setEdit] = useState(null);
  const list = store.g.templates;
  return html`<div><${PageHeader} title="Template Global" sub="Templat pesan dan indikator yang tersedia bagi semua guru. Guru memilihnya sendiri; tidak dianggap terpakai sebelum dipilih." actions=${html`<${Btn} variant="primary" icon="plus" onClick=${() => setEdit({})}>Templat Pesan Baru<//>`} />
    <${Card} pad=${false}><ul class="list" style=${{ padding: '0 20px' }}>${list.map((t) => html`<li><div><b>${t.name}</b> <${Badge}>${t.channel}<//> ${!t.isActive && html`<${Badge} kind="red">Nonaktif<//>`}${t.items ? html`<div class="muted sm">${t.items.length} indikator</div>` : html`<div class="muted sm" style=${{ whiteSpace: 'pre-wrap', maxHeight: '48px', overflow: 'hidden' }}>${t.body.slice(0, 120)}…</div>`}</div>
      <span class="row gap-s">${!t.items && html`<${Btn} size="sm" icon="edit" onClick=${() => setEdit(t)}>Edit<//>`}<${Btn} size="sm" onClick=${() => { store.mutateGlobal(() => { t.isActive = !t.isActive; }); store.audit('template.toggle', 'template', t.id, String(t.isActive)); }}>${t.isActive ? 'Nonaktifkan' : 'Aktifkan'}<//></span></li>`)}</ul><//>
    <p class="muted sm mt">Templat rubrik, dimensi analisis, dan laporan global belum memiliki editor pada versi ini.</p>
    ${edit && html`<${TemplateEditor} item=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSave=${(f) => { store.mutateGlobal((g) => { if (edit.id) Object.assign(g.templates.find((x) => x.id === edit.id), f); else g.templates.push({ ...f, id: uid('tpl'), isGlobal: true, isActive: true }); }); store.audit(edit.id ? 'template.update' : 'template.create', 'template', edit.id || f.name); toast('Templat disimpan.'); setEdit(null); }} />`}</div>`;
}

export function AdminSystem() {
  useStore();
  const [s, setS] = useState({ ...store.g.settings });
  const integ = integrationStatus();
  const save = () => {
    const days = Number(s.linkExpiryDays); const kkm = Number(s.defaultKkm);
    if (!(days >= 1 && days <= 365)) return toast('Masa berlaku tautan 1–365 hari.', 'err');
    if (!(kkm >= 0 && kkm <= 100)) return toast('KKM default 0–100.', 'err');
    store.mutateGlobal((g) => { g.settings = { ...g.settings, ...s, linkExpiryDays: days, defaultKkm: kkm }; }); store.audit('settings.update', 'settings', 'global', JSON.stringify({ days, kkm })); toast('Pengaturan sistem disimpan.');
  };
  return html`<div><${PageHeader} title="Pengaturan Sistem" actions=${html`<${Btn} variant="primary" onClick=${save}>Simpan<//>`} />
    <div class="grid g2"><${Card} title="Konfigurasi default"><div class="stack"><${Field} label="KKM default sistem (0–100)"><${Input} type="number" value=${s.defaultKkm} onChange=${(v) => setS({ ...s, defaultKkm: v })} /><//><${Field} label="Kebijakan kalimat penjelas pendek (< 30 kata) pada teks yang ditulis guru" hint="Teks otomatis sistem selalu ≥ 30 kata. Peringatan: guru boleh menyimpan teks pendek; Wajib: teks guru yang kalimatnya kurang dari 30 kata tidak dapat disimpan."><${Select} value=${s.shortSentencePolicy || 'peringatan'} onChange=${(v) => setS({ ...s, shortSentencePolicy: v })} options=${[['peringatan', 'Peringatan saja'], ['wajib', 'Wajib minimal 30 kata']]} /><//><${Field} label="Masa berlaku tautan laporan (hari)"><${Input} type="number" value=${s.linkExpiryDays} onChange=${(v) => setS({ ...s, linkExpiryDays: v })} /><//></div><//>
      <${Card} title="Pengaturan fitur"><div class="stack-s"><${Check} checked=${s.features.analysisDimensions} onChange=${(v) => setS({ ...s, features: { ...s.features, analysisDimensions: v } })}>Analisis multidimensi<//><${Check} checked=${s.features.uploads} onChange=${(v) => setS({ ...s, features: { ...s.features, uploads: v } })}>Unggah jawaban<//><${Check} checked=${s.features.delivery} onChange=${(v) => setS({ ...s, features: { ...s.features, delivery: v } })}>Distribusi laporan<//><div class="muted sm">Catatan: saklar fitur disimpan, tetapi belum menyembunyikan menu pada versi ini.</div></div><//>
      <${Card} title="Integrasi (status)"><ul class="list"><li><span>Email</span><${Badge} kind=${integ.email ? 'green' : 'gray'}>${integ.email ? 'Aktif (belum diuji)' : 'Belum aktif'}<//></li><li><span>WhatsApp Business</span><${Badge} kind=${integ.whatsappBusiness ? 'green' : 'gray'}>${integ.whatsappBusiness ? 'Aktif (belum diuji)' : 'Belum aktif'}<//></li></ul>
        <${Notice} title="Cara mengaktifkan">Kredensial diisi di environment backend (bukan di sini atau config.js), lalu set apiBase dan integrations pada config.js. Lihat backend/README.md.<//><//>
      <${Card} title="Ekspor"><p class="muted">PDF memakai dialog cetak browser; CSV tersedia pada laporan kelas dan individual.</p><//></div></div>`;
}

export function AdminAudit() {
  useStore();
  const [q, setQ] = useState('');
  const list = store.g.audit.filter((l) => !q || (l.action + l.actorEmail + l.entityType + l.details).toLowerCase().includes(q.toLowerCase()));
  return html`<div><${PageHeader} title="Audit Log" sub="Tindakan penting dicatat (maks. 500 entri terbaru pada mode lokal)." />
    <div class="row mb"><div style=${{ width: '280px' }}><${Input} placeholder="Cari tindakan / pelaku…" value=${q} onChange=${setQ} /></div></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="shield" title="Belum ada entri" /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pelaku</th><th>Tindakan</th><th>Entitas</th><th>Rincian</th></tr></thead><tbody>${list.map((l) => html`<tr><td class="sm">${fmtDateTime(l.at)}</td><td class="sm">${l.actorEmail}</td><td><${Badge}>${l.action}<//></td><td class="sm">${l.entityType} ${l.entityId}</td><td class="sm muted">${l.details}</td></tr>`)}</tbody></table></div>`}</div>`;
}
