import { html, useState, useStore, go, Icon, Btn, Field, Input, Select, Notice, Empty, toast, downloadPdf } from './ui.js';
import { store, auth } from './lib-store.js';
import { IndividualReport } from './page-reports.js';

const Logo = ({ dark }) => html`<a class=${'logo ' + (dark ? 'dark' : '')} href="#/"><i>∑</i>MathLens</a>`;

export function Landing() {
  useStore();
  const c = store.g.cms;
  const user = auth.user();
  const startDemo = (to) => { auth.startDemo(); go(to); };
  const sections = [['beranda', 'Beranda'], ['fitur', 'Fitur'], ['cara-kerja', 'Cara Kerja'], ['tentang', 'Tentang'], ['faq', 'FAQ']];
  const steps = ['Catat pembelajaran', 'Tentukan indikator', 'Buat asesmen dan rubrik', 'Nilai jawaban', 'Analisis hasil dan ketuntasan', 'Kirim laporan kepada siswa atau orang tua'];
  const scroll = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  return html`<div style=${{ '--primary': c.brand }}>
    <header class="l-nav"><div class="l-wrap"><${Logo} dark />
      <nav class="l-links">${sections.map(([id, l]) => html`<a class="lk" href=${'#' + id} onClick=${scroll(id)}>${l}</a>`)}
        ${user ? html`<${Btn} variant="primary" size="sm" onClick=${() => go(user.role === 'super_admin' ? '/admin' : '/app')}>Buka Aplikasi<//>` : html`<a href="#/masuk">Masuk</a><${Btn} variant="primary" size="sm" onClick=${() => go('/daftar')}>Daftar Gratis<//>`}</nav></div></header>
    <section class="hero" id="beranda"><div class="l-wrap">
      <div><span class="badge blue">${c.tagline}</span><h1 style=${{ marginTop: '14px' }}>${c.headline}</h1><h2>${c.subheadline}</h2><p class="d">${c.description}</p>
        <div class="row"><${Btn} variant="primary" size="lg" onClick=${() => go('/daftar')}>Mulai Sekarang<//><${Btn} size="lg" icon="eye" onClick=${() => startDemo('/app/laporan/a_pyth/s_15')}>Lihat Contoh Laporan<//></div>
        <p class="muted sm" style=${{ marginTop: '14px' }}>“Lihat Contoh Laporan” membuka akun demo berisi data fiktif — tanpa perlu mendaftar.</p></div>
      <div class="mock" aria-label="Contoh tampilan dashboard (ilustrasi)">
        <div class="row between"><div class="dots"><i></i><i></i><i></i></div><span class="badge violet">Ilustrasi · Data Demo</span></div>
        <div class="grid g3" style=${{ gap: '10px' }}>${[['Rata-rata', '76,3', 'blue'], ['Tuntas', '63%', 'green'], ['KKM', '75', 'violet']].map(([l, v, t]) => html`<div class=${'stat ' + t} style=${{ padding: '10px 12px' }}><div><div class="stat-v" style=${{ fontSize: '20px' }}>${v}</div><div class="stat-l">${l}</div></div></div>`)}</div>
        <div><div class="sm muted" style=${{ marginBottom: '6px' }}>Ketercapaian indikator</div>
          ${[['Sisi segitiga siku-siku', 86, 'green'], ['Hubungan panjang sisi', 78, 'blue'], ['Menghitung sisi', 72, 'blue'], ['Masalah kontekstual', 58, 'amber']].map(([l, v, t]) => html`<div style=${{ marginBottom: '8px' }}><div class="row between sm"><span>${l}</span><b>${v}%</b></div><div class="bar"><span class=${t} style=${{ width: v + '%' }}></span></div></div>`)}</div>
        <div class="row between sm" style=${{ background: '#f8fafc', padding: '10px 12px', borderRadius: '12px' }}><span><b>Aditya P.</b> · Nilai 82 · KKM 75</span><span class="badge green">Tuntas (+7)</span></div>
      </div></div></section>
    <section class="section alt" id="fitur"><div class="l-wrap"><h2 class="t">Fitur utama</h2><p class="st">Satu alur data yang konsisten dari pembelajaran sampai laporan.</p>
      <div class="grid g3">${c.features.map(([t, d, ic]) => html`<div class="fcard"><div class="stat-ic"><${Icon} n=${ic} size=${22} /></div><h4>${t}</h4><p>${d}</p></div>`)}</div></div></section>
    <section class="section" id="cara-kerja"><div class="l-wrap"><h2 class="t">Cara kerja</h2><p class="st">Enam tahap sederhana.</p>
      <div class="grid g3">${steps.map((s, i) => html`<div class="step"><b>${i + 1}</b><div><h4 style=${{ fontSize: '16px' }}>${s}</h4></div></div>`)}</div></div></section>
    <section class="section alt" id="tentang"><div class="l-wrap" style=${{ maxWidth: '780px' }}><h2 class="t">Tentang MathLens</h2>
      <p class="st" style=${{ maxWidth: 'none' }}>MathLens membantu guru memahami perkembangan pembelajaran matematika melalui asesmen berbasis indikator, penilaian fleksibel, analisis multidimensi, visualisasi hasil belajar, dan laporan yang sesuai dengan pembelajaran yang benar-benar dilaksanakan. MathLens bukan aplikasi resmi PISA dan tidak menghasilkan skor PISA resmi.</p></div></section>
    <section class="section" id="faq"><div class="l-wrap" style=${{ maxWidth: '800px' }}><h2 class="t">Pertanyaan umum</h2><p class="st"></p><div class="stack-s faq">${c.faq.map(([q, a]) => html`<details><summary>${q}</summary><p>${a}</p></details>`)}</div></div></section>
    <footer class="foot"><div class="l-wrap grid g3"><div><div class="logo"><i>∑</i>MathLens</div><p class="sm" style=${{ maxWidth: '320px' }}>${c.footer}</p></div>
      <div><h5>Navigasi</h5>${sections.map(([id, l]) => html`<a href=${'#' + id} onClick=${scroll(id)}>${l}</a>`)}</div>
      <div><h5>Informasi</h5><a href="#/" onClick=${(e) => { e.preventDefault(); toast('Pusat bantuan belum tersedia di versi ini.', 'warn'); }}>Pusat bantuan</a><a href="#/" onClick=${(e) => { e.preventDefault(); toast('Halaman kebijakan privasi perlu diisi sebelum peluncuran.', 'warn'); }}>Kebijakan privasi</a><a href="#/" onClick=${(e) => { e.preventDefault(); toast('Halaman ketentuan penggunaan perlu diisi sebelum peluncuran.', 'warn'); }}>Ketentuan penggunaan</a></div></div></footer>
  </div>`;
}

function AuthFrame({ title, sub, children }) {
  return html`<div class="auth"><div class="aside"><${Logo} /><h2>See Beyond Scores.</h2><p style=${{ opacity: 0.85 }}>Understand Every Answer. Discover Every Potential.</p></div>
    <div class="form"><div class="box stack"><div><h1 style=${{ fontSize: '26px' }}>${title}</h1><p class="muted">${sub}</p></div>${children}</div></div></div>`;
}

export function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const u = await auth.signIn(f.email, f.password); go(u.role === 'super_admin' ? '/admin' : '/app'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return html`<${AuthFrame} title="Masuk" sub="Masuk ke akun MathLens Anda.">
    <form class="stack" onSubmit=${submit}>
      ${err && html`<${Notice} kind="err">${err}<//>`}
      <${Field} label="Email"><${Input} type="email" required autocomplete="email" value=${f.email} onChange=${(v) => setF({ ...f, email: v })} /><//>
      <${Field} label="Kata sandi"><${Input} type="password" required autocomplete="current-password" value=${f.password} onChange=${(v) => setF({ ...f, password: v })} /><//>
      <${Btn} variant="primary" type="submit" disabled=${busy}>${busy ? 'Memeriksa…' : 'Masuk'}<//>
    </form>
    <${Btn} icon="sparkle" onClick=${() => { auth.startDemo(); go('/app'); }}>Coba dengan Data Demo<//>
    <p class="sm muted">Belum punya akun? <a href="#/daftar">Daftar gratis</a>. Akun di versi ini disimpan lokal di browser (belum terhubung server).</p><//>`;
}

export function Signup() {
  const [f, setF] = useState({ name: '', email: '', password: '', school: '', level: 'SMP/MTs' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const u = await auth.signUp(f); toast('Akun dibuat.'); go(u.role === 'super_admin' ? '/admin' : '/app'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const set = (k) => (v) => setF({ ...f, [k]: v });
  return html`<${AuthFrame} title="Daftar Gratis" sub="Buat akun guru. Data akun baru terpisah dari data demo.">
    <form class="stack" onSubmit=${submit}>
      ${err && html`<${Notice} kind="err">${err}<//>`}
      <${Field} label="Nama lengkap"><${Input} required value=${f.name} onChange=${set('name')} /><//>
      <${Field} label="Email"><${Input} type="email" required value=${f.email} onChange=${set('email')} /><//>
      <${Field} label="Kata sandi" hint="Minimal 8 karakter."><${Input} type="password" required minlength="8" value=${f.password} onChange=${set('password')} /><//>
      <${Field} label="Nama sekolah"><${Input} value=${f.school} onChange=${set('school')} /><//>
      <${Field} label="Jenjang"><${Select} value=${f.level} onChange=${set('level')} options=${['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK']} /><//>
      <${Btn} variant="primary" type="submit" disabled=${busy}>${busy ? 'Membuat akun…' : 'Daftar'}<//>
    </form>
    <p class="sm muted">Sudah punya akun? <a href="#/masuk">Masuk</a>. Peran Super Admin tidak dapat dipilih dari formulir ini.</p><//>`;
}

export function PublicReport({ params }) {
  useStore();
  const [code, setCode] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const res = store.resolveLink(params.token);
  if (res.error) return html`<div class="auth"><div class="form"><div class="box"><${Empty} icon="lock" title="Laporan tidak dapat dibuka" text=${res.error} /></div></div></div>`;
  const { d, a, st, teacher } = res;
  if (!ok) {
    return html`<div class="auth"><div class="form"><div class="box stack"><${Logo} dark /><h1 style=${{ fontSize: '22px' }}>Verifikasi untuk membuka laporan</h1>
      <p class="muted">Masukkan kode siswa untuk membuka laporan ini. Laporan hanya memuat data satu siswa.</p>
      ${err && html`<${Notice} kind="err">${err}<//>`}
      <${Field} label="Kode siswa"><${Input} value=${code} onChange=${setCode} autocomplete="off" /><//>
      <${Btn} variant="primary" onClick=${() => (code.trim().toLowerCase() === st.code.toLowerCase() ? setOk(true) : setErr('Kode siswa tidak cocok.'))}>Buka Laporan<//>
      <${Notice} kind="warn" title="Catatan versi lokal">Tautan ini hanya berfungsi di browser tempat data disimpan. Tautan lintas perangkat memerlukan backend (lihat backend/README.md).<//></div></div></div>`;
  }
  return html`<div class="content" style=${{ maxWidth: '980px', margin: '0 auto' }}><div class="row no-print mb"><${Logo} dark /><span class="grow"></span><${Btn} icon="printer" onClick=${() => window.print()}>Cetak<//><${Btn} variant="primary" icon="download" onClick=${() => downloadPdf('#report-doc', `Laporan-${st.name.replace(/\s+/g, '-')}.pdf`)}>Unduh PDF<//></div>
    <${IndividualReport} d=${d} a=${a} st=${st} teacher=${teacher} settings=${store.g.settings} /></div>`;
}
