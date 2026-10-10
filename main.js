import { html, render, useState, useStore, useRoute, go, Icon, Overlays, Empty, Btn, DemoBadge, confirmDialog, toast } from './ui.js';
import { store, auth } from './lib-store.js';
import { Landing, Login, Signup, PublicReport } from './page-public.js';
import { Dashboard, ClassesPage, StudentsPage, LearningPage, IndicatorsPage, SettingsPage } from './page-core.js';
import { AssessmentsPage, AssessmentEditor, QuestionBank } from './page-assessments.js';
import { GradingPage, UploadsPage, AnalysisPage } from './page-grading.js';
import { ReportsPage, ReportView } from './page-reports.js';
import { SendPage, ContactsPage, HistoryPage, TemplatesPage } from './page-delivery.js';
import { AdminDashboard, AdminUsers, AdminCms, AdminTemplates, AdminSystem, AdminAudit } from './page-admin.js';

const routes = [
  ['/', Landing], ['/masuk', Login], ['/daftar', Signup], ['/r/:token', PublicReport],
  ['/app', Dashboard], ['/app/kelas', ClassesPage], ['/app/siswa', StudentsPage], ['/app/pembelajaran', LearningPage], ['/app/indikator', IndicatorsPage],
  ['/app/asesmen', AssessmentsPage], ['/app/asesmen/:id', AssessmentEditor], ['/app/bank-soal', QuestionBank],
  ['/app/penilaian', GradingPage], ['/app/penilaian/:id', GradingPage], ['/app/unggah', UploadsPage], ['/app/analisis', AnalysisPage],
  ['/app/laporan', ReportsPage], ['/app/laporan/:aid/:sid', ReportView],
  ['/app/kirim', SendPage], ['/app/kontak', ContactsPage], ['/app/riwayat', HistoryPage], ['/app/template', TemplatesPage], ['/app/pengaturan', SettingsPage],
  ['/admin', AdminDashboard], ['/admin/pengguna', AdminUsers], ['/admin/cms', AdminCms], ['/admin/template', AdminTemplates], ['/admin/sistem', AdminSystem], ['/admin/audit', AdminAudit],
];
function match(path) {
  for (const [pat, C] of routes) {
    const a = pat.split('/'); const b = path.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    if (a.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { C, params };
  }
  return null;
}

const NAV = [
  ['Utama', [['/app', 'home', 'Dashboard'], ['/app/kelas', 'grid', 'Kelas'], ['/app/siswa', 'users', 'Siswa']]],
  ['Pembelajaran', [['/app/pembelajaran', 'book', 'Data Pembelajaran'], ['/app/indikator', 'target', 'Indikator'], ['/app/asesmen', 'edit', 'Soal & Asesmen'], ['/app/bank-soal', 'layers', 'Bank Soal']]],
  ['Penilaian', [['/app/penilaian', 'check', 'Penilaian'], ['/app/unggah', 'upload', 'Unggah Jawaban'], ['/app/analisis', 'chart', 'Analisis']]],
  ['Laporan', [['/app/laporan', 'file', 'Laporan'], ['/app/kirim', 'send', 'Kirim Laporan'], ['/app/kontak', 'mail', 'Kontak Siswa & Ortu'], ['/app/riwayat', 'clock', 'Riwayat Pengiriman'], ['/app/template', 'message', 'Template Pesan']]],
  ['Akun', [['/app/pengaturan', 'settings', 'Pengaturan & KKM']]],
];
const ADMIN_NAV = [['Super Admin', [['/admin', 'home', 'Dashboard Admin'], ['/admin/pengguna', 'users', 'Pengguna'], ['/admin/cms', 'edit', 'Konten Landing'], ['/admin/template', 'layers', 'Template Global'], ['/admin/sistem', 'settings', 'Pengaturan Sistem'], ['/admin/audit', 'shield', 'Audit Log']]]];

function Shell({ user, path, children, admin }) {
  const [open, setOpen] = useState(false);
  const nav = admin ? ADMIN_NAV : NAV;
  const demo = store.isDemoData();
  return html`<div class="shell">
    <div class=${'scrim ' + (open ? 'open' : '')} onClick=${() => setOpen(false)}></div>
    <aside class=${'side ' + (open ? 'open' : '')}>
      <a class="logo" href=${admin ? '#/admin' : '#/app'}><i>∑</i>MathLens</a>
      <nav class="nav" onClick=${() => setOpen(false)}>${nav.map(([g, items]) => html`<h6>${g}</h6>${items.map(([p, ic, l]) => html`<a href=${'#' + p} class=${path === p || (p !== '/app' && p !== '/admin' && path.startsWith(p + '/')) ? 'on' : ''}><${Icon} n=${ic} size=${18} />${l}</a>`)}`)}
        ${auth.isAdmin() && html`<h6>Peralihan</h6><a href=${admin ? '#/app' : '#/admin'}><${Icon} n="shield" />${admin ? 'Ke Area Guru' : 'Ke Area Admin'}</a>`}
      </nav>
    </aside>
    <div class="main">
      <header class="top">
        <div class="row"><button class="icon-btn menu-btn" onClick=${() => setOpen(true)} aria-label="Buka menu"><${Icon} n="menu" /></button>
          <span class="muted sm hide-sm">${admin ? 'Area Super Admin' : 'Area Guru'} · penyimpanan lokal browser</span></div>
        <div class="row">
          <div class="hide-sm" style=${{ textAlign: 'right', lineHeight: 1.2 }}><div style=${{ fontWeight: 600, fontSize: '14px' }}>${user.name}</div><div class="muted sm">${user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin_sekolah' ? 'Admin Sekolah' : 'Guru'}</div></div>
          <div class="avatar">${user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
          <${Btn} variant="ghost" size="sm" icon="logout" onClick=${() => { auth.signOut(); go('/'); }}>Keluar<//>
        </div>
      </header>
      ${demo && !admin && html`<div class="demo-banner"><${DemoBadge} /> <span class="grow">Anda memakai <b>Data Demo</b> (fiktif, tersimpan di browser ini). Untuk data sungguhan, daftar akun baru — datanya terpisah dari data demo.</span>
        <${Btn} size="sm" onClick=${async () => { if (await confirmDialog({ title: 'Reset data demo?', message: 'Semua perubahan pada data demo akan dikembalikan ke kondisi awal. Data akun lain tidak terpengaruh.', confirmLabel: 'Reset Data Demo', danger: true })) { store.resetDemo(); toast('Data demo dikembalikan.'); } }}>Reset data demo<//></div>`}
      <main class="content">${children}</main>
    </div></div>`;
}

function Forbidden({ why }) {
  return html`<div class="auth"><div class="form"><div class="box"><${Empty} icon="lock" title="Akses ditolak" text=${why} action=${html`<${Btn} variant="primary" onClick=${() => go('/masuk')}>Masuk<//>`} /></div></div></div>`;
}

function App() {
  useStore();
  const { path, query, hash } = useRoute();
  const m = match(path);
  const user = auth.user();
  if (!m) return html`<div class="auth"><div class="form"><div class="box"><${Empty} title="Halaman tidak ditemukan" action=${html`<${Btn} onClick=${() => go('/')}>Ke Beranda<//>`} /></div></div></div>`;
  const { C, params } = m;
  if (path.startsWith('/admin')) {
    if (!user) return html`<${Forbidden} why="Silakan masuk terlebih dahulu." />`;
    if (user.role !== 'super_admin') return html`<${Forbidden} why="Halaman ini hanya untuk Super Admin." />`;
    return html`<${Shell} user=${user} path=${path} admin><${C} key=${hash} params=${params} query=${query} /><//>`;
  }
  if (path.startsWith('/app')) {
    if (!user) return html`<${Forbidden} why="Silakan masuk terlebih dahulu." />`;
    return html`<${Shell} user=${user} path=${path}><${C} key=${hash} params=${params} query=${query} user=${user} /><//>`;
  }
  return html`<${C} key=${hash} params=${params} query=${query} />`;
}

render(html`<${App} /><${Overlays} />`, document.getElementById('app'));
