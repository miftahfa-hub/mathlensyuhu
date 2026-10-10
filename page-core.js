import { html, useState, useStore, go, Icon, Btn, Card, Badge, Stat, Empty, Notice, Modal, Field, Input, Textarea, Select, Check, PageHeader, Progress, Tabs, toast, confirmDialog, download } from './ui.js';
import { store } from './lib-store.js';
import { uid, fmt, fmtDate, fmtDateTime, isEmail, normalizePhone, indicatorAnalysis, toCsv, parseCsv, round } from './lib-core.js';
import { classOpts, className, activeClasses, studentsOf, statsFor, analysisFor, classById, learningById, settingsNow, kkmWord, stBadge, LEARN_STATUS, ASSESS_STATUS, TYPE_LABEL, completionBadge } from './page-common.js';

const num = (v) => (v === '' || v === null || v === undefined ? '' : v);

// =============== DASHBOARD ===============
export function Dashboard({ user }) {
  useStore();
  const d = store.d;
  const demo = store.isDemoData();
  const stats = d.assessments.map((a) => ({ a, s: statsFor(a) }));
  const followUp = [];
  stats.forEach(({ a, s }) => s.rows.filter((r) => r.result.completion === 'belum_tuntas').forEach((r) => followUp.push({ a, r })));
  const weak = [];
  d.assessments.forEach((a) => {
    analysisFor(a).filter((x) => x.status === 'ok' && x.threshold !== null && x.avg < x.threshold).forEach((x) => weak.push({ a, x }));
  });
  const jobs = d.deliveries;
  const jc = (s) => jobs.filter((j) => j.status === s).length;
  const lastLearn = [...d.learning].filter((l) => l.status === 'selesai').sort((a, b) => b.date.localeCompare(a.date))[0];
  const decidedAll = stats.reduce((n, { s }) => n + s.tuntas + s.belum, 0);
  const tuntasAll = stats.reduce((n, { s }) => n + s.tuntas, 0);
  const activity = [
    ...d.learning.map((l) => ({ t: l.date, text: `Pembelajaran: ${l.title}`, ic: 'book' })),
    ...d.assessments.map((a) => ({ t: a.date, text: `Asesmen: ${a.title}`, ic: 'edit' })),
    ...d.deliveries.map((j) => ({ t: j.createdAt, text: `Pengiriman laporan ${j.studentName} (${j.statusLabel || j.status})`, ic: 'send' })),
  ].sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 6);
  const quick = [['Tambah Kelas', '/app/kelas?baru=1', 'grid'], ['Tambah Siswa', '/app/siswa?baru=1', 'users'], ['Catat Pembelajaran', '/app/pembelajaran?baru=1', 'book'], ['Tambah Indikator', '/app/indikator?baru=1', 'target'], ['Buat Asesmen', '/app/asesmen/baru', 'edit'], ['Input Nilai', '/app/penilaian', 'check'], ['Kirim Laporan', '/app/kirim', 'send']];
  const hasData = d.classes.length > 0;
  return html`<div>
    <${PageHeader} title=${`Selamat datang, ${user.name.split(' ')[0] === 'Sari' ? 'Bu Sari' : user.name}!`} sub=${'Ringkasan pembelajaran dan asesmen Anda.'} demo=${demo} />
    <div class="row mb" style=${{ gap: '8px' }}>${quick.map(([l, p, ic]) => html`<${Btn} size="sm" icon=${ic} onClick=${() => go(p)}>${l}<//>`)}</div>
    ${!hasData && html`<${Notice} title="Mulai dari kelas">Belum ada data. Tambahkan kelas, lalu siswa, lalu catat pembelajaran. Anda juga dapat melihat contoh lengkap lewat <a href="#/masuk">akun demo</a>.<//>`}
    <div class="grid g5 mb mt">
      <${Stat} icon="grid" label="Kelas Aktif" value=${activeClasses().length} />
      <${Stat} icon="users" tone="violet" label="Total Siswa" value=${d.students.filter((s) => s.active !== false).length} />
      <${Stat} icon="book" tone="green" label="Pembelajaran Tercatat" value=${d.learning.filter((l) => l.status === 'selesai').length} sub=${`${d.learning.length} termasuk rencana/draft`} />
      <${Stat} icon="edit" tone="amber" label="Asesmen Berjalan" value=${d.assessments.filter((a) => a.status === 'berjalan').length} sub=${`${d.assessments.length} asesmen total`} />
      <${Stat} icon="file" label="Laporan Tersedia" value=${stats.reduce((n, { s }) => n + s.nValid, 0)} sub="laporan individual siap" />
    </div>
    <div class="grid g2">
      <${Card} title="Ringkasan ketuntasan" action=${html`<a href="#/app/analisis" class="sm">Analisis lengkap</a>`}>
        ${stats.length === 0 ? html`<${Empty} title="Belum ada asesmen" />` : html`<div class="stack-s">
          <div class="row between"><span class="muted sm">Seluruh asesmen (siswa bernilai valid)</span><b>${decidedAll ? round((tuntasAll / decidedAll) * 100) + '%' : 'Belum ada data penilaian'}</b></div>
          ${decidedAll ? html`<${Progress} value=${(tuntasAll / decidedAll) * 100} tone="green" />` : ''}
          <ul class="list">${stats.map(({ a, s }) => html`<li><div><a href=${`#/app/penilaian/${a.id}`}><b>${a.title}</b></a><div class="muted sm">${className(a.classId)} · ${kkmWord()} ${fmt(s.kkm.value)}</div></div>
            <div class="right">${s.pct === null ? html`<span class="muted sm">Belum ada data penilaian</span>` : html`<b>${s.pct}%</b><div class="muted sm">${s.tuntas} tuntas · ${s.belum} belum · ${s.nNotGraded + s.nPartial} belum lengkap</div>`}</div></li>`)}</ul></div>`}
      <//>
      <${Card} title="Pembelajaran terakhir" action=${html`<a href="#/app/pembelajaran" class="sm">Semua</a>`}>
        ${lastLearn ? html`<div class="stack-s"><b>${lastLearn.title}</b><div class="muted sm">${className(lastLearn.classId)} · ${fmtDate(lastLearn.date)} · Pertemuan ${lastLearn.meeting}</div><p>${lastLearn.objectives || 'Tujuan belum diisi.'}</p>${lastLearn.reflection ? html`<div class="notice"><div><strong>Refleksi guru</strong>${lastLearn.reflection}</div></div>` : ''}</div>` : html`<${Empty} icon="book" title="Belum ada pembelajaran selesai" />`}
      <//>
      <${Card} title="Indikator yang perlu penguatan">
        ${weak.length ? html`<ul class="list">${weak.map(({ a, x }) => html`<li><div><b>${x.indicator.code}</b> ${x.indicator.name}<div class="muted sm">${a.title}</div></div><div class="right"><b class="hl-bad">${x.avg}%</b><div class="muted sm">${x.share !== null ? `${x.share}% siswa mencapai KKM ${fmt(x.threshold)}` : 'rata-rata'}</div></div></li>`)}</ul>` : html`<${Empty} icon="target" title="Tidak ada indikator di bawah KKM" text="Ketercapaian indikator dinilai terhadap KKM asesmen. Belum ada data atau semua indikator sudah mencapai KKM." />`}
      <//>
      <${Card} title="Siswa yang memerlukan tindak lanjut">
        ${followUp.length ? html`<ul class="list">${followUp.slice(0, 6).map(({ a, r }) => html`<li><div><b>${r.student.name}</b><div class="muted sm">${a.title}</div></div><div class="right"><b class="hl-bad">${fmt(r.result.final)}</b><div class="muted sm">${fmt(r.result.diff)} dari ${kkmWord()}</div></div></li>`)}</ul>` : html`<${Empty} icon="check" title="Tidak ada siswa belum tuntas" text="Siswa yang belum dinilai tidak dihitung sebagai belum tuntas." />`}
      <//>
      <${Card} title="Aktivitas terbaru">${activity.length ? html`<ul class="list">${activity.map((x) => html`<li><span class="row gap-s"><${Icon} n=${x.ic} size=${16} />${x.text}</span><span class="muted sm">${fmtDate(x.t)}</span></li>`)}</ul>` : html`<${Empty} title="Belum ada aktivitas" />`}<//>
      <${Card} title="Status pengiriman laporan" action=${html`<a href="#/app/riwayat" class="sm">Riwayat</a>`}>
        ${jobs.length ? html`<div class="grid g3" style=${{ gap: '10px' }}>${[['Siap dibuka', jc('siap_dibuka_wa') + jc('siap_dibuka_email'), 'blue'], ['Terkirim', jc('terkirim_manual') + jc('terkirim') + jc('delivered'), 'green'], ['Gagal/Batal', jc('gagal') + jc('dibatalkan'), 'red']].map(([l, v, t]) => html`<div class=${'stat ' + (t === 'green' ? 'green' : t === 'red' ? 'red' : '')}><div><div class="stat-v">${v}</div><div class="stat-l">${l}</div></div></div>`)}</div>` : html`<${Empty} icon="send" title="Belum ada pengiriman" />`}
      <//>
    </div>
  </div>`;
}

// =============== KELAS ===============
export function ClassesPage({ query }) {
  useStore();
  const [edit, setEdit] = useState(query.baru ? { id: null } : null);
  const [view, setView] = useState('aktif');
  const list = store.d.classes.filter((c) => (view === 'aktif' ? !c.archived : c.archived));
  const remove = async (c) => {
    const ns = store.d.students.filter((s) => s.classId === c.id).length;
    const na = store.d.assessments.filter((a) => a.classId === c.id).length;
    if (ns || na) { toast(`Kelas ${c.name} memiliki ${ns} siswa dan ${na} asesmen. Arsipkan kelas ini, atau hapus data terkait lebih dulu.`, 'warn'); return; }
    if (await confirmDialog({ title: `Hapus kelas ${c.name}?`, message: 'Kelas kosong ini akan dihapus permanen.', confirmLabel: 'Hapus', danger: true })) { store.mutate((d) => { d.classes = d.classes.filter((x) => x.id !== c.id); }); toast('Kelas dihapus.'); }
  };
  return html`<div>
    <${PageHeader} title="Manajemen Kelas" sub="Kelola kelas, tahun ajaran, dan KKM default." demo=${store.isDemoData()} actions=${html`<${Btn} variant="primary" icon="plus" onClick=${() => setEdit({ id: null })}>Tambah Kelas<//>`} />
    <div class="mb"><${Tabs} tabs=${[['aktif', 'Aktif'], ['arsip', 'Diarsipkan']]} value=${view} onChange=${setView} /></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="grid" title=${view === 'aktif' ? 'Belum ada kelas' : 'Tidak ada kelas diarsipkan'} text="Tambahkan kelas untuk mulai menambahkan siswa dan asesmen." /><//>` : html`<div class="grid g2">${list.map((c) => {
      const ns = studentsOf(c.id).length; const asses = store.d.assessments.filter((a) => a.classId === c.id);
      return html`<${Card} title=${c.name} action=${html`<${Badge} kind="blue">${c.level}<//>`}>
        <div class="muted sm mb">Kelas ${c.grade} · ${c.subject} · ${c.year} · Semester ${c.semester} · ${kkmWord()} default ${c.kkm ? fmt(c.kkm) : 'belum diatur'}</div>
        <div class="row mb"><${Badge}>${ns} siswa<//><${Badge}>${asses.length} asesmen<//></div>
        <div class="row gap-s"><${Btn} size="sm" onClick=${() => go('/app/siswa?kelas=' + c.id)}>Daftar siswa<//><${Btn} size="sm" onClick=${() => go('/app/asesmen?kelas=' + c.id)}>Asesmen<//><${Btn} size="sm" onClick=${() => go('/app/laporan?kelas=' + c.id)}>Laporan<//>
          <span class="grow"></span><${Btn} size="sm" variant="ghost" icon="edit" onClick=${() => setEdit(c)} aria-label="Edit" /><${Btn} size="sm" variant="ghost" icon="archive" onClick=${() => { store.mutate(() => { c.archived = !c.archived; }); store.audit(c.archived ? 'class.archive' : 'class.unarchive', 'class', c.id); }} aria-label="Arsipkan" /><${Btn} size="sm" variant="ghost" icon="trash" onClick=${() => remove(c)} aria-label="Hapus" /></div><//>`; })}</div>`}
    ${edit && html`<${ClassForm} item=${edit} onClose=${() => { setEdit(null); if (query.baru) go('/app/kelas'); }} />`}
  </div>`;
}
function ClassForm({ item, onClose }) {
  const [f, setF] = useState(item.id ? { ...item } : { name: '', level: 'SMP/MTs', grade: '', year: '2026/2027', semester: 'Ganjil', subject: 'Matematika', kkm: settingsNow().defaultKkm });
  const [err, setErr] = useState({});
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Nama kelas wajib diisi.';
    if (f.kkm !== '' && (Number(f.kkm) < 0 || Number(f.kkm) > 100 || Number.isNaN(Number(f.kkm)))) e.kkm = 'Isi 0–100.';
    setErr(e); if (Object.keys(e).length) return;
    store.mutate((d) => { if (item.id) Object.assign(d.classes.find((c) => c.id === item.id), f, { kkm: f.kkm === '' ? '' : Number(f.kkm) }); else d.classes.push({ ...f, id: uid('c'), kkm: f.kkm === '' ? '' : Number(f.kkm), archived: false, createdAt: new Date().toISOString() }); });
    toast('Kelas disimpan.'); onClose();
  };
  return html`<${Modal} title=${item.id ? 'Edit Kelas' : 'Tambah Kelas'} onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`}>
    <div class="form-grid"><${Field} label="Nama kelas" error=${err.name}><${Input} value=${f.name} onChange=${set('name')} placeholder="VII A" /><//>
      <${Field} label="Jenjang"><${Select} value=${f.level} onChange=${set('level')} options=${['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK']} /><//>
      <${Field} label="Tingkat kelas"><${Input} value=${f.grade} onChange=${set('grade')} placeholder="VII" /><//>
      <${Field} label="Mata pelajaran"><${Input} value=${f.subject} onChange=${set('subject')} /><//>
      <${Field} label="Tahun ajaran"><${Input} value=${f.year} onChange=${set('year')} /><//>
      <${Field} label="Semester"><${Select} value=${f.semester} onChange=${set('semester')} options=${['Ganjil', 'Genap']} /><//>
      <${Field} label=${`${kkmWord()} default kelas/mata pelajaran (0–100)`} error=${err.kkm} hint="Dapat diganti per asesmen." class="full"><${Input} type="number" min="0" max="100" value=${num(f.kkm)} onChange=${set('kkm')} /><//></div><//>`;
}

// =============== SISWA ===============
const emptyContact = (type, name = '') => ({ id: uid('ct'), type, name, relationship: type === 'siswa' ? 'Siswa' : '', email: '', phone: '', verified: false, consent: 'belum' });
export function StudentsPage({ query }) {
  useStore();
  const [cid, setCid] = useState(query.kelas || '');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(query.baru ? { id: null } : null);
  const [imp, setImp] = useState(false);
  const list = store.d.students.filter((s) => (!cid || s.classId === cid) && (!q || (s.name + s.code).toLowerCase().includes(q.toLowerCase())));
  const badge = (c) => !c || (!c.email && !c.phone) ? html`<span class="muted sm">Tidak ada kontak</span>` : c.verified && c.consent === 'diberikan' ? html`<${Badge} kind="green">Terverifikasi<//>` : html`<${Badge} kind="amber">Belum dikonfirmasi<//>`;
  const history = (s) => store.d.assessments.filter((a) => a.classId === s.classId).length;
  return html`<div>
    <${PageHeader} title="Manajemen Siswa" sub="Data siswa dan kontak orang tua/wali. Kontak bersifat opsional." demo=${store.isDemoData()} actions=${html`<${Btn} icon="upload" onClick=${() => setImp(true)}>Impor CSV<//><${Btn} variant="primary" icon="plus" onClick=${() => setEdit({ id: null })}>Tambah Siswa<//>`} />
    <div class="row mb"><div style=${{ width: '240px' }}><${Select} value=${cid} onChange=${setCid} options=${classOpts(true)} placeholder="Semua kelas" /></div><div style=${{ width: '260px' }}><${Input} placeholder="Cari nama / kode…" value=${q} onChange=${setQ} /></div><span class="muted sm">${list.length} siswa</span></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="users" title="Belum ada siswa" text=${activeClasses().length ? 'Tambahkan siswa secara manual atau impor CSV.' : 'Buat kelas terlebih dahulu.'} /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Kelas</th><th>Kontak siswa</th><th>Kontak orang tua/wali</th><th class="num">Asesmen kelas</th><th></th></tr></thead><tbody>
      ${list.map((s) => html`<tr><td class="mono">${s.code}</td><td><b>${s.name}</b></td><td>${className(s.classId)}</td><td>${badge(s.contacts.find((c) => c.type === 'siswa'))}</td><td>${badge(s.contacts.find((c) => c.type === 'ortu'))}</td><td class="num">${history(s)}</td>
        <td class="right"><${Btn} size="sm" variant="ghost" icon="file" onClick=${() => go('/app/laporan?siswa=' + s.id)} aria-label="Laporan" /><${Btn} size="sm" variant="ghost" icon="edit" onClick=${() => setEdit(s)} aria-label="Edit" /><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${async () => {
          const n = store.d.submissions.filter((x) => x.studentId === s.id).length;
          if (await confirmDialog({ title: `Hapus ${s.name}?`, message: n ? `Siswa ini memiliki ${n} data penilaian yang ikut terhapus. Pertimbangkan menonaktifkan siswa (Edit → status) agar riwayat tetap ada.` : 'Data siswa akan dihapus permanen.', confirmLabel: 'Hapus', danger: true })) { store.mutate((d) => { d.students = d.students.filter((x) => x.id !== s.id); d.submissions = d.submissions.filter((x) => x.studentId !== s.id); }); toast('Siswa dihapus.'); }
        }} /></td></tr>`)}</tbody></table></div>`}
    ${edit && html`<${StudentForm} item=${edit} defaultClass=${cid} onClose=${() => setEdit(null)} />`}
    ${imp && html`<${ImportCsv} defaultClass=${cid} onClose=${() => setImp(false)} />`}
  </div>`;
}
function StudentForm({ item, defaultClass, onClose }) {
  const init = item.id ? JSON.parse(JSON.stringify(item)) : { classId: defaultClass || activeClasses()[0]?.id || '', code: '', name: '', active: true, contacts: [emptyContact('siswa'), emptyContact('ortu')] };
  const [f, setF] = useState(init);
  const [err, setErr] = useState({});
  const setC = (i, k) => (v) => { const contacts = f.contacts.map((c, j) => (j === i ? { ...c, [k]: v, ...(k === 'email' || k === 'phone' ? { verified: false, consent: 'belum' } : {}) } : c)); setF({ ...f, contacts }); };
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Nama wajib diisi.';
    if (!f.classId) e.classId = 'Pilih kelas.';
    if (!f.code.trim()) e.code = 'Kode siswa wajib diisi.';
    else if (store.d.students.some((s) => s.code.toLowerCase() === f.code.trim().toLowerCase() && s.id !== item.id && s.classId === f.classId)) e.code = 'Kode sudah dipakai di kelas ini.';
    const contacts = f.contacts.map((c, i) => {
      const n = { ...c };
      if (n.email && !isEmail(n.email)) e['email' + i] = 'Format email tidak valid.';
      if (n.phone) { const p = normalizePhone(n.phone); if (!p) e['phone' + i] = 'Nomor tidak valid. Contoh: 081234567890.'; else n.phone = p; }
      if (n.verified && !n.email && !n.phone) e['ver' + i] = 'Tidak ada kontak untuk diverifikasi.';
      if (n.verified) n.consent = 'diberikan';
      return n;
    });
    setErr(e); if (Object.keys(e).length) return;
    store.mutate((d) => { const rec = { ...f, name: f.name.trim(), code: f.code.trim(), contacts }; if (item.id) Object.assign(d.students.find((s) => s.id === item.id), rec); else d.students.push({ ...rec, id: uid('s') }); });
    toast('Siswa disimpan.'); onClose();
  };
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const ctitle = ['Kontak siswa', 'Kontak orang tua/wali'];
  return html`<${Modal} wide title=${item.id ? 'Edit Siswa' : 'Tambah Siswa'} onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`}>
    <div class="form-grid"><${Field} label="Nama siswa" error=${err.name}><${Input} value=${f.name} onChange=${set('name')} /><//><${Field} label="Kode siswa" error=${err.code}><${Input} value=${f.code} onChange=${set('code')} /><//>
      <${Field} label="Kelas" error=${err.classId}><${Select} value=${f.classId} onChange=${set('classId')} options=${classOpts()} placeholder="Pilih kelas" /><//><div class="field"><span class="lbl">Status</span><${Check} checked=${f.active !== false} onChange=${(v) => set('active')(v)}>Siswa aktif<//></div></div>
    ${f.contacts.map((c, i) => html`<div class="q-card mt"><h4 style=${{ marginBottom: '10px' }}>${ctitle[i]}</h4><div class="form-grid">
      ${i === 1 && html`<${Field} label="Nama orang tua/wali"><${Input} value=${c.name} onChange=${setC(i, 'name')} /><//><${Field} label="Hubungan"><${Input} value=${c.relationship} onChange=${setC(i, 'relationship')} placeholder="Ayah / Ibu / Wali" /><//>`}
      <${Field} label="Email" error=${err['email' + i]}><${Input} type="email" value=${c.email} onChange=${setC(i, 'email')} /><//>
      <${Field} label="Nomor WhatsApp" error=${err['phone' + i]} hint="Disimpan sebagai +62…"><${Input} value=${c.phone} onChange=${setC(i, 'phone')} /><//>
      <div class="full"><${Check} checked=${c.verified} onChange=${setC(i, 'verified')}>Kontak ini telah saya konfirmasi dan penerima menyetujui menerima laporan<//>${err['ver' + i] ? html`<small class="err">${err['ver' + i]}</small>` : ''}</div></div></div>`)}<//>`;
}
function ImportCsv({ defaultClass, onClose }) {
  const [cid, setCid] = useState(defaultClass || activeClasses()[0]?.id || '');
  const [rows, setRows] = useState(null);
  const [errs, setErrs] = useState([]);
  const HEAD = ['nama', 'kode', 'email_siswa', 'wa_siswa', 'nama_wali', 'hubungan', 'email_wali', 'wa_wali'];
  const onFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const t = parseCsv(await file.text());
    const head = t[0].map((h) => h.trim().toLowerCase());
    if (!head.includes('nama')) { setErrs(['Kolom "nama" tidak ditemukan pada baris pertama.']); setRows(null); return; }
    const ix = (k) => head.indexOf(k);
    const out = []; const er = [];
    t.slice(1).forEach((r, i) => {
      const g = (k) => (ix(k) >= 0 ? (r[ix(k)] || '').trim() : '');
      const line = i + 2;
      if (!g('nama')) { er.push(`Baris ${line}: nama kosong, dilewati.`); return; }
      const se = g('email_siswa'); const we = g('email_wali');
      const sp = g('wa_siswa') ? normalizePhone(g('wa_siswa')) : ''; const wp = g('wa_wali') ? normalizePhone(g('wa_wali')) : '';
      if (se && !isEmail(se)) er.push(`Baris ${line}: email siswa tidak valid (dikosongkan).`);
      if (we && !isEmail(we)) er.push(`Baris ${line}: email wali tidak valid (dikosongkan).`);
      if (g('wa_siswa') && !sp) er.push(`Baris ${line}: nomor WA siswa tidak valid (dikosongkan).`);
      if (g('wa_wali') && !wp) er.push(`Baris ${line}: nomor WA wali tidak valid (dikosongkan).`);
      out.push({ name: g('nama'), code: g('kode'), se: isEmail(se) ? se : '', sp: sp || '', wn: g('nama_wali'), rel: g('hubungan'), we: isEmail(we) ? we : '', wp: wp || '' });
    });
    setRows(out); setErrs(er);
  };
  const run = () => {
    const existing = new Set(store.d.students.filter((s) => s.classId === cid).map((s) => s.code.toLowerCase()));
    let n = 0; let skipped = 0;
    store.mutate((d) => rows.forEach((r, i) => {
      const code = r.code || `${className(cid).replace(/\s/g, '')}-${String(existing.size + i + 1).padStart(2, '0')}`;
      if (existing.has(code.toLowerCase())) { skipped++; return; }
      existing.add(code.toLowerCase());
      const c1 = { ...emptyContact('siswa', r.name), email: r.se, phone: r.sp }; const c2 = { ...emptyContact('ortu', r.wn), relationship: r.rel, email: r.we, phone: r.wp };
      d.students.push({ id: uid('s'), classId: cid, code, name: r.name, active: true, contacts: [c1, c2] }); n++;
    }));
    toast(`${n} siswa diimpor${skipped ? `, ${skipped} dilewati (kode ganda)` : ''}. Kontak belum terverifikasi.`, skipped ? 'warn' : 'ok'); onClose();
  };
  return html`<${Modal} wide title="Impor Siswa dari CSV" onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" disabled=${!rows?.length || !cid} onClick=${run}>Impor ${rows?.length || ''} siswa<//>`}>
    <div class="stack"><${Field} label="Kelas tujuan"><${Select} value=${cid} onChange=${setCid} options=${classOpts()} placeholder="Pilih kelas" /><//>
      <div class="row"><${Btn} size="sm" icon="download" onClick=${() => download('templat-siswa.csv', toCsv([HEAD, ['Contoh Siswa', 'VII-A-01', '', '081200000001', 'Ibu Contoh', 'Ibu', 'ortu@contoh.test', '081200000002']]))}>Unduh templat CSV<//></div>
      <${Field} label="Berkas CSV" hint="Kolom: ${HEAD.join(', ')}. Hanya 'nama' yang wajib. Kontak yang diimpor otomatis berstatus belum terverifikasi."><input class="inp" type="file" accept=".csv,text/csv" onChange=${onFile} /><//>
      ${errs.length ? html`<${Notice} kind="warn" title="Perhatian">${errs.slice(0, 8).map((e) => html`<div>${e}</div>`)}${errs.length > 8 ? `…dan ${errs.length - 8} lainnya` : ''}<//>` : ''}
      ${rows && html`<div class="tbl-wrap" style=${{ maxHeight: '240px' }}><table class="tbl"><thead><tr><th>Nama</th><th>Kode</th><th>WA siswa</th><th>Wali</th><th>WA wali</th></tr></thead><tbody>${rows.slice(0, 50).map((r) => html`<tr><td>${r.name}</td><td>${r.code || '(otomatis)'}</td><td>${r.sp}</td><td>${r.wn}</td><td>${r.wp}</td></tr>`)}</tbody></table></div>`}</div><//>`;
}

// =============== PEMBELAJARAN ===============
const L_EMPTY = { title: '', classId: '', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 1, date: new Date().toISOString().slice(0, 10), duration: '2 × 40 menit', topic: '', subtopic: '', cp: '', objectives: '', prerequisites: '', model: '', method: '', media: '', opening: '', core: '', closing: '', reflection: '', obstacles: '', followUp: '', assessmentType: '', assessmentGoal: '', technique: '', instrument: '', successCriteria: '', status: 'draft' };
export function LearningPage({ query }) {
  useStore();
  const [edit, setEdit] = useState(query.baru ? { id: null } : null);
  const [st, setSt] = useState('');
  const list = store.d.learning.filter((l) => !st || l.status === st).sort((a, b) => b.date.localeCompare(a.date));
  return html`<div>
    <${PageHeader} title="Data Pembelajaran" sub="Catat pembelajaran yang benar-benar dilaksanakan. Laporan membedakan rencana dari pelaksanaan." demo=${store.isDemoData()} actions=${html`<${Btn} variant="primary" icon="plus" onClick=${() => setEdit({ id: null })}>Catat Pembelajaran<//>`} />
    <div class="mb"><${Tabs} tabs=${[['', 'Semua'], ...Object.entries(LEARN_STATUS).map(([k, v]) => [k, v[0]])]} value=${st} onChange=${setSt} /></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="book" title="Belum ada data pembelajaran" text="Catat materi, tujuan, aktivitas, dan refleksi pembelajaran Anda." /><//>` : html`<div class="grid g2">${list.map((l) => html`<${Card} title=${l.title} action=${stBadge(LEARN_STATUS, l.status)}>
      <div class="muted sm mb">${className(l.classId)} · Pertemuan ${l.meeting} · ${fmtDate(l.date)} · ${l.duration}</div><p class="mb"><b>${l.topic}</b>${l.subtopic ? ' — ' + l.subtopic : ''}</p><p class="muted sm mb">${l.objectives || 'Tujuan pembelajaran belum diisi.'}</p>
      <div class="row gap-s"><${Badge} kind="blue">${store.d.indicators.filter((i) => i.learningId === l.id).length} indikator<//><${Badge}>${store.d.assessments.filter((a) => a.learningId === l.id).length} asesmen<//><span class="grow"></span>
        <${Btn} size="sm" icon="file" onClick=${() => go('/app/laporan?tab=pertemuan&pertemuan=' + l.id)}>Laporan<//><${Btn} size="sm" variant="ghost" icon="copy" aria-label="Duplikasi" onClick=${() => { store.mutate((d) => d.learning.push({ ...l, id: uid('l'), title: l.title + ' (salinan)', status: 'draft' })); toast('Pembelajaran diduplikasi sebagai draft.'); }} /><${Btn} size="sm" variant="ghost" icon="edit" aria-label="Edit" onClick=${() => setEdit(l)} /><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${async () => {
          const na = store.d.assessments.filter((a) => a.learningId === l.id).length;
          if (await confirmDialog({ title: `Hapus "${l.title}"?`, message: na ? `${na} asesmen terkait akan kehilangan tautan pembelajaran (asesmen dan nilainya tidak dihapus). Indikator pada pembelajaran ini ikut dihapus.` : 'Catatan pembelajaran dan indikatornya akan dihapus.', confirmLabel: 'Hapus', danger: true })) store.mutate((d) => { d.learning = d.learning.filter((x) => x.id !== l.id); d.indicators = d.indicators.filter((i) => i.learningId !== l.id); d.assessments.forEach((a) => { if (a.learningId === l.id) a.learningId = ''; }); });
        }} /></div><//>`)}</div>`}
    ${edit && html`<${LearningForm} item=${edit} onClose=${() => { setEdit(null); if (query.baru) go('/app/pembelajaran'); }} />`}
  </div>`;
}
function LearningForm({ item, onClose }) {
  const [f, setF] = useState(item.id ? { ...item } : { ...L_EMPTY, classId: activeClasses()[0]?.id || '' });
  const [err, setErr] = useState({});
  const [tab, setTab] = useState('id');
  const [draft, setDraft] = useState([]);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const T = (k, label, rows = 3, cls = 'full') => html`<${Field} label=${label} class=${cls}><${Textarea} rows=${rows} value=${f[k]} onChange=${set(k)} /><//>`;
  const I = (k, label, p = {}) => html`<${Field} label=${label}><${Input} value=${f[k]} onChange=${set(k)} ...${p} /><//>`;
  const save = () => {
    const e = {};
    if (!f.title.trim()) e.title = 'Nama pembelajaran wajib diisi.';
    if (!f.classId) e.classId = 'Pilih kelas.';
    if (!f.date) e.date = 'Tanggal wajib diisi.';
    if (f.status === 'selesai' && !f.objectives.trim()) e.objectives = 'Pembelajaran berstatus Selesai perlu tujuan pembelajaran.';
    setErr(e); if (Object.keys(e).length) { setTab('id'); return; }
    const bad = draft.find((r) => (r.name.trim() || r.code.trim()) && !(r.code.trim() && r.name.trim()));
    if (bad) { setTab('indikator'); setErr({ ind: 'Lengkapi kode dan nama indikator, atau hapus barisnya.' }); return; }
    store.mutate((d) => {
      const lid = item.id || uid('l');
      if (item.id) Object.assign(d.learning.find((l) => l.id === item.id), f); else d.learning.push({ ...f, id: lid, meeting: Number(f.meeting) || 1 });
      draft.filter((r) => r.code.trim() && r.name.trim()).forEach((r) => d.indicators.push({ id: uid('i'), learningId: lid, code: r.code.trim(), name: r.name.trim(), description: '', objective: '', topic: f.topic || '', criteria: '', weight: '', status: 'aktif' }));
    });
    toast('Pembelajaran disimpan.'); onClose();
  };
  return html`<${Modal} wide title=${item.id ? 'Edit Pembelajaran' : 'Catat Pembelajaran'} onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`}>
    <div class="mb"><${Tabs} tabs=${[['id', 'Identitas'], ['materi', 'Materi'], ['aktivitas', 'Aktivitas'], ['asesmen', 'Asesmen'], ['indikator', 'Indikator']]} value=${tab} onChange=${setTab} /></div>
    <div class="form-grid">
    ${tab === 'id' && html`<${Field} label="Nama pembelajaran" error=${err.title} class="full"><${Input} value=${f.title} onChange=${set('title')} /><//>
      <${Field} label="Kelas" error=${err.classId}><${Select} value=${f.classId} onChange=${set('classId')} options=${classOpts()} placeholder="Pilih kelas" /><//>${I('subject', 'Mata pelajaran')}${I('year', 'Tahun ajaran')}
      <${Field} label="Semester"><${Select} value=${f.semester} onChange=${set('semester')} options=${['Ganjil', 'Genap']} /><//><${Field} label="Pertemuan ke-"><${Input} type="number" min="1" value=${f.meeting} onChange=${set('meeting')} /><//>
      <${Field} label="Tanggal pelaksanaan" error=${err.date}><${Input} type="date" value=${f.date} onChange=${set('date')} /><//>${I('duration', 'Alokasi waktu')}
      <${Field} label="Status" hint="Laporan hanya menyebut aktivitas sebagai terlaksana jika berstatus Selesai."><${Select} value=${f.status} onChange=${set('status')} options=${Object.entries(LEARN_STATUS).map(([k, v]) => [k, v[0]])} /><//>`}
    ${tab === 'materi' && html`${I('topic', 'Materi pokok')}${I('subtopic', 'Submateri')}${T('cp', 'Capaian Pembelajaran (jika relevan)', 2)}
      <${Field} label="Tujuan Pembelajaran" error=${err.objectives} class="full"><${Textarea} rows=${3} value=${f.objectives} onChange=${set('objectives')} /><//>${T('prerequisites', 'Prasyarat pembelajaran', 2)}`}
    ${tab === 'aktivitas' && html`${I('model', 'Model pembelajaran')}${I('method', 'Metode pembelajaran')}${I('media', 'Media')}<div></div>${T('opening', 'Aktivitas pendahuluan', 2)}${T('core', 'Aktivitas inti', 3)}${T('closing', 'Aktivitas penutup', 2)}${T('reflection', 'Refleksi guru', 2)}${T('obstacles', 'Kendala pembelajaran', 2)}${T('followUp', 'Tindak lanjut', 2)}`}
    ${tab === 'asesmen' && html`<${Field} label="Jenis asesmen"><${Select} value=${f.assessmentType} onChange=${set('assessmentType')} options=${Object.entries(TYPE_LABEL)} placeholder="—" /><//>${I('technique', 'Teknik asesmen')}${I('instrument', 'Instrumen')}${I('assessmentGoal', 'Tujuan asesmen')}${T('successCriteria', 'Kriteria keberhasilan', 2)}`}
    ${tab === 'indikator' && html`<div class="full">${err.ind && html`<${Notice} kind="err">${err.ind}<//>`}<${IndicatorsInline} lid=${item.id} draft=${draft} setDraft=${setDraft} /></div>`}
    </div><//>`;
}

// =============== INDIKATOR ===============
export function IndicatorsPage({ query }) {
  useStore();
  const [lid, setLid] = useState('');
  const [edit, setEdit] = useState(query.baru ? { id: null } : null);
  const [tpl, setTpl] = useState(false);
  const [cp, setCp] = useState(false);
  const d = store.d;
  const list = d.indicators.filter((i) => !lid || i.learningId === lid);
  const nQ = (id) => d.assessments.reduce((n, a) => n + a.questions.filter((q) => q.indicators.some((m) => m.indicatorId === id)).length, 0);
  const ach = (i) => {
    const out = [];
    d.assessments.forEach((a) => { const r = analysisFor(a).find((x) => x.indicator.id === i.id); if (r && r.status !== 'tidak_dipetakan') out.push({ a, r }); });
    return out;
  };
  return html`<div>
    <${PageHeader} title="Indikator Pembelajaran" sub="Indikator dikelola per pembelajaran, lalu dihubungkan dengan soal." demo=${store.isDemoData()} actions=${html`<${Btn} icon="copy" onClick=${() => setCp(true)}>Salin dari pembelajaran lain<//><${Btn} icon="layers" onClick=${() => setTpl(true)}>Gunakan templat<//><${Btn} variant="primary" icon="plus" onClick=${() => setEdit({ id: null })}>Tambah Indikator<//>`} />
    <div class="row mb"><div style=${{ width: '340px', maxWidth: '100%' }}><${Select} value=${lid} onChange=${setLid} options=${d.learning.map((l) => [l.id, `${l.title} (${className(l.classId)})`])} placeholder="Semua pembelajaran" /></div></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="target" title="Belum ada indikator" text=${d.learning.length ? 'Tambahkan indikator atau gunakan templat. Templat tidak dianggap terpakai sebelum Anda memilihnya.' : 'Catat pembelajaran terlebih dahulu.'} /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Indikator</th><th>Pembelajaran</th><th>Kriteria</th><th class="num">Soal</th><th>Ketercapaian</th><th></th></tr></thead><tbody>
      ${list.map((i) => { const a = ach(i); return html`<tr><td class="mono"><b>${i.code}</b></td><td>${i.name}${i.status !== 'aktif' ? html` <${Badge}>${i.status}<//>` : ''}</td><td class="sm">${learningById(i.learningId)?.title || '—'}</td>
        <td class="sm">${i.criteria || 'Capaian ≥ KKM'}</td><td class="num">${nQ(i.id)}</td>
        <td class="sm">${a.length === 0 ? html`<span class="muted">Belum diasesmen</span>` : a.map(({ a: as, r }) => html`<div>${r.status === 'ok' ? html`<b>${r.avg}%</b> <span class="muted">rata-rata · ${as.title}</span>` : html`<span class="muted">${r.reason}</span>`}</div>`)}</td>
        <td class="right"><${Btn} size="sm" variant="ghost" icon="edit" aria-label="Edit" onClick=${() => setEdit(i)} /><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${async () => {
          const n = nQ(i.id);
          if (await confirmDialog({ title: `Hapus indikator ${i.code}?`, message: n ? `Indikator ini terhubung ke ${n} soal. Tautan itu akan dilepas dan analisis indikator untuk asesmen terkait berubah; skor soal tidak diubah.` : 'Indikator akan dihapus.', confirmLabel: 'Hapus', danger: true })) store.mutate((dd) => { dd.indicators = dd.indicators.filter((x) => x.id !== i.id); dd.assessments.forEach((as) => { as.indicatorIds = (as.indicatorIds || []).filter((x) => x !== i.id); as.questions.forEach((q) => { q.indicators = q.indicators.filter((m) => m.indicatorId !== i.id); }); }); });
        }} /></td></tr>`; })}</tbody></table></div>`}
    ${edit && html`<${IndicatorForm} item=${edit} defaultLid=${lid} onClose=${() => { setEdit(null); if (query.baru) go('/app/indikator'); }} />`}
    ${tpl && html`<${TemplatePicker} onClose=${() => setTpl(false)} />`}
    ${cp && html`<${CopyIndicators} onClose=${() => setCp(false)} />`}
  </div>`;
}
function IndicatorForm({ item, defaultLid, onClose }) {
  const [f, setF] = useState(item.id ? { ...item } : { learningId: defaultLid || store.d.learning[0]?.id || '', code: '', name: '', description: '', objective: '', topic: '', criteria: '', weight: '', status: 'aktif' });
  const [err, setErr] = useState({});
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const save = () => {
    const e = {};
    if (!f.learningId) e.learningId = 'Pilih pembelajaran.';
    if (!f.code.trim()) e.code = 'Kode wajib diisi.';
    else if (store.d.indicators.some((i) => i.code === f.code.trim() && i.learningId === f.learningId && i.id !== item.id)) e.code = 'Kode sudah dipakai pada pembelajaran ini.';
    if (!f.name.trim()) e.name = 'Nama indikator wajib diisi.';
    if (f.weight !== '' && !(Number(f.weight) > 0)) e.weight = 'Bobot harus > 0.';
    setErr(e); if (Object.keys(e).length) return;
    store.mutate((d) => { if (item.id) Object.assign(d.indicators.find((i) => i.id === item.id), f); else d.indicators.push({ ...f, id: uid('i') }); });
    toast('Indikator disimpan.'); onClose();
  };
  return html`<${Modal} wide title=${item.id ? 'Edit Indikator' : 'Tambah Indikator'} onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`}>
    <div class="form-grid"><${Field} label="Pembelajaran" error=${err.learningId} class="full"><${Select} value=${f.learningId} onChange=${set('learningId')} options=${store.d.learning.map((l) => [l.id, l.title])} placeholder="Pilih pembelajaran" /><//>
      <${Field} label="Kode indikator" error=${err.code}><${Input} value=${f.code} onChange=${set('code')} placeholder="PYT-1" /><//><${Field} label="Status"><${Select} value=${f.status} onChange=${set('status')} options=${['aktif', 'nonaktif']} /><//>
      <${Field} label="Nama indikator" error=${err.name} class="full"><${Input} value=${f.name} onChange=${set('name')} /><//>
      <${Field} label="Deskripsi" class="full"><${Textarea} rows=${2} value=${f.description} onChange=${set('description')} /><//>
      <${Field} label="Tujuan pembelajaran terkait" class="full"><${Textarea} rows=${2} value=${f.objective} onChange=${set('objective')} /><//>
      <${Field} label="Materi"><${Input} value=${f.topic} onChange=${set('topic')} /><//><${Field} label="Bobot (opsional)" error=${err.weight}><${Input} type="number" min="0" step="any" value=${num(f.weight)} onChange=${set('weight')} /><//>
      <${Field} label="Kriteria ketercapaian (opsional)" class="full"><${Input} value=${f.criteria} onChange=${set('criteria')} placeholder="Mis. siswa dapat menghitung sisi miring dengan benar" /><//></div>
    <div class="notice mt"><${Icon} n="info" size=${16} /><div>Indikator cukup diisi satu kali di sini. Otomatis tersedia di asesmen, penilaian, analisis, dan laporan pada pembelajaran ini. Ketercapaian dinilai terhadap ${kkmWord()} asesmen.</div></div><//>`;
}
function TemplatePicker({ onClose }) {
  const tpls = store.g.templates.filter((t) => t.channel === 'indikator' && t.isActive);
  const [t, setT] = useState(tpls[0]?.id || '');
  const [lid, setLid] = useState(store.d.learning[0]?.id || '');
  const [sel, setSel] = useState({});
  const cur = tpls.find((x) => x.id === t);
  const use = () => {
    const items = cur.items.filter((_, i) => sel[i] !== false);
    store.mutate((d) => { const n = d.indicators.filter((i) => i.learningId === lid).length; items.forEach(([name, desc], i) => d.indicators.push({ id: uid('i'), learningId: lid, code: `${(cur.subject || cur.subject || 'IND').slice(0, 3).toUpperCase()}-${n + i + 1}`, name, description: desc, objective: '', topic: cur.subject || '', criteria: '', weight: '', status: 'aktif' })); });
    toast(`${items.length} indikator ditambahkan dari templat.`); onClose();
  };
  return html`<${Modal} title="Gunakan templat indikator" onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" disabled=${!cur || !lid} onClick=${use}>Tambahkan indikator terpilih<//>`}>
    ${tpls.length === 0 ? html`<${Empty} title="Belum ada templat" />` : html`<div class="stack"><${Field} label="Templat"><${Select} value=${t} onChange=${(v) => { setT(v); setSel({}); }} options=${tpls.map((x) => [x.id, x.name])} /><//>
      <${Field} label="Tambahkan ke pembelajaran"><${Select} value=${lid} onChange=${setLid} options=${store.d.learning.map((l) => [l.id, l.title])} placeholder="Pilih pembelajaran" /><//>
      <div class="stack-s">${cur?.items.map(([n, ds], i) => html`<${Check} checked=${sel[i] !== false} onChange=${(v) => setSel({ ...sel, [i]: v })}><b>${n}</b><div class="muted sm">${ds}</div><//>`)}</div></div>`}<//>`;
}
function CopyIndicators({ onClose }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const src = store.d.indicators.filter((i) => i.learningId === from);
  const run = () => { store.mutate((d) => src.forEach((i) => d.indicators.push({ ...i, id: uid('i'), learningId: to }))); toast(`${src.length} indikator disalin.`); onClose(); };
  const opts = store.d.learning.map((l) => [l.id, l.title]);
  return html`<${Modal} title="Salin indikator dari pembelajaran lain" onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" disabled=${!src.length || !to || to === from} onClick=${run}>Salin ${src.length || ''} indikator<//>`}>
    <div class="stack"><${Field} label="Sumber"><${Select} value=${from} onChange=${setFrom} options=${opts} placeholder="Pilih pembelajaran sumber" /><//><${Field} label="Tujuan"><${Select} value=${to} onChange=${setTo} options=${opts.filter(([v]) => v !== from)} placeholder="Pilih pembelajaran tujuan" /><//>
      ${from && html`<div class="muted sm">${src.length} indikator akan disalin (tautan ke soal tidak ikut disalin).</div>`}</div><//>`;
}

// =============== PENGATURAN & KKM ===============
export function SettingsPage({ user }) {
  useStore();
  const s = settingsNow();
  const [p, setP] = useState({ defaultKkm: s.defaultKkm, allowDecimalDefault: !!s.allowDecimalDefault });
  const [prof, setProf] = useState({ name: user.name, school: user.school, level: user.level });
  return html`<div><${PageHeader} title="Pengaturan & KKM" sub="Preferensi akun dan kriteria ketuntasan." demo=${store.isDemoData()} />
    <div class="grid g2">
      <${Card} title="KKM & Ketuntasan"><div class="stack">
        <${Field} label="KKM default akun (0–100)" hint="Dipakai bila kelas tidak punya KKM sendiri."><${Input} type="number" min="0" max="100" value=${p.defaultKkm} onChange=${(v) => setP({ ...p, defaultKkm: v })} /><//>
        <${Check} checked=${p.allowDecimalDefault} onChange=${(v) => setP({ ...p, allowDecimalDefault: v })}>Aktifkan skor desimal secara default pada asesmen baru<//>
        <${Notice}>Aturan: nilai akhir ≥ KKM → Tuntas; ${'<'} KKM → Belum Tuntas. KKM yang sama dipakai untuk menilai ketercapaian indikator. Nilai ini menjadi KKM awal; dapat diganti per kelas dan per asesmen.<//>
        <${Btn} variant="primary" onClick=${() => { const v = Number(p.defaultKkm); if (!(v >= 0 && v <= 100)) { toast('Nilai default harus 0–100.', 'err'); return; } store.mutate((d) => { d.prefs = { ...(d.prefs || {}), defaultKkm: v, allowDecimalDefault: p.allowDecimalDefault }; }); toast('Pengaturan disimpan.'); }}>Simpan<//></div><//>
      <${Card} title="Profil"><div class="stack">
        <${Field} label="Nama"><${Input} value=${prof.name} onChange=${(v) => setProf({ ...prof, name: v })} /><//><${Field} label="Email"><${Input} value=${user.email} disabled /><//>
        <${Field} label="Sekolah"><${Input} value=${prof.school} onChange=${(v) => setProf({ ...prof, school: v })} /><//><${Field} label="Jenjang"><${Select} value=${prof.level} onChange=${(v) => setProf({ ...prof, level: v })} options=${['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK']} /><//>
        <${Btn} variant="primary" disabled=${user.demo} onClick=${() => { if (!prof.name.trim()) { toast('Nama wajib diisi.', 'err'); return; } store.mutateGlobal((g) => Object.assign(g.users.find((u) => u.id === user.id), prof)); toast('Profil disimpan.'); }}>Simpan profil<//>
        ${user.demo && html`<span class="muted sm">Profil akun demo tidak dapat diubah.</span>`}</div><//>
      ${store.isDemoData() && html`<${Card} title="Data demo"><p class="muted mb">Kembalikan data demo ke kondisi awal. Data akun lain tidak terpengaruh.</p><${Btn} icon="refresh" onClick=${async () => { if (await confirmDialog({ title: 'Reset data demo?', message: 'Semua perubahan pada data demo akan hilang.', confirmLabel: 'Reset', danger: true })) { store.resetDemo(); toast('Data demo dikembalikan.'); } }}>Reset data demo<//><//>`}
    </div></div>`;
}

/** Isian indikator di dalam form pembelajaran: diisi sekali, langsung tersedia di semua modul. */
function IndicatorsInline({ lid, draft, setDraft }) {
  const existing = lid ? store.d.indicators.filter((i) => i.learningId === lid) : [];
  const upd = (i, k, v) => setDraft(draft.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const nextCode = (n) => `IND-${existing.length + n + 1}`;
  return html`<div class="stack">
    <${Notice}>Indikator cukup diisi di sini <b>satu kali</b>. Setelah disimpan, otomatis tersedia di asesmen, penilaian, analisis, dan laporan untuk pembelajaran ini. Tambah atau ubah nanti lewat menu Indikator.<//>
    ${existing.length ? html`<div><b class="sm">Indikator yang sudah ada</b><ul class="list">${existing.map((i) => html`<li><span><b>${i.code}</b> ${i.name}</span></li>`)}</ul></div>` : ''}
    <b class="sm">Tambah indikator</b>
    ${draft.map((r, i) => html`<div class="row" style=${{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><div style=${{ width: '110px' }}><${Input} placeholder=${nextCode(i)} value=${r.code} onChange=${(v) => upd(i, 'code', v)} aria-label="Kode indikator" /></div><div class="grow"><${Input} placeholder="Nama indikator, mis. Menghitung panjang sisi segitiga siku-siku" value=${r.name} onChange=${(v) => upd(i, 'name', v)} aria-label="Nama indikator" /></div><${Btn} variant="ghost" icon="trash" aria-label="Hapus baris" onClick=${() => setDraft(draft.filter((_, j) => j !== i))} /></div>`)}
    <div><${Btn} size="sm" icon="plus" onClick=${() => setDraft([...draft, { code: nextCode(draft.length), name: '' }])}>Tambah baris indikator<//></div></div>`;
}