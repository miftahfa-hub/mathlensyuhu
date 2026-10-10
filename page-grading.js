import { html, useState, useEffect, useStore, go, Icon, Btn, Card, Badge, Stat, Empty, Notice, Modal, Field, Input, Textarea, Select, PageHeader, Progress, Tabs, Chart, AutoField, toast, confirmDialog } from './ui.js';
import { store, files } from './lib-store.js';
import { buildIndividual } from './page-reports.js';
import { autoTexts } from './lib-phrases.js';
import { uid, fmt, fmtSigned, fmtDate, isNum, round, dimensionAnalysis, DIMENSIONS, STATE_LABEL, mean } from './lib-core.js';
import { classOpts, className, classById, studentsOf, statsFor, analysisFor, resultFor, settingsNow, kkmWord, completionBadge, learningById } from './page-common.js';

const asessOpts = () => store.d.assessments.map((a) => [a.id, `${a.title} — ${className(a.classId)}`]);
const ensureSub = (d, aid, sid) => {
  let s = d.submissions.find((x) => x.assessmentId === aid && x.studentId === sid);
  if (!s) { s = { id: uid('sub'), assessmentId: aid, studentId: sid, scores: {}, ind: {}, feedback: {}, note: '', docs: [], updatedAt: '' }; d.submissions.push(s); }
  s.ind ||= {}; s.feedback ||= {}; s.docs ||= [];
  return s;
};
/** Validasi + simpan skor soal. Mengembalikan pesan galat atau null. */
function saveScore(a, sid, q, raw) {
  const t = String(raw).trim().replace(',', '.');
  if (t === '') { store.mutate((d) => { const s = ensureSub(d, a.id, sid); delete s.scores[q.id]; s.updatedAt = new Date().toISOString(); }); return null; }
  const v = Number(t);
  if (Number.isNaN(v)) return 'Skor harus berupa angka.';
  if (v < 0) return 'Skor tidak boleh negatif.';
  if (v > Number(q.maxScore)) return `Skor tidak boleh melebihi skor maksimal soal (${fmt(q.maxScore)}).`;
  if (!a.allowDecimal && !Number.isInteger(v)) return 'Skor desimal tidak diaktifkan pada asesmen ini.';
  store.mutate((d) => { const s = ensureSub(d, a.id, sid); s.scores[q.id] = v; s.updatedAt = new Date().toISOString(); });
  return null;
}
function saveIndScore(a, sid, q, m, raw) {
  const t = String(raw).trim().replace(',', '.');
  const v = t === '' ? null : Number(t);
  if (v !== null) {
    if (Number.isNaN(v)) return 'Skor harus berupa angka.';
    if (v < 0) return 'Skor tidak boleh negatif.';
    if (v > Number(m.maxScore)) return `Skor tidak boleh melebihi skor maksimal indikator (${fmt(m.maxScore)}).`;
    if (!a.allowDecimal && !Number.isInteger(v)) return 'Skor desimal tidak diaktifkan pada asesmen ini.';
  }
  store.mutate((d) => {
    const s = ensureSub(d, a.id, sid); s.ind[q.id] ||= {};
    if (v === null) delete s.ind[q.id][m.indicatorId]; else s.ind[q.id][m.indicatorId] = v;
    const seps = q.indicators.filter((x) => x.method === 'separate');
    if (seps.every((x) => isNum(s.ind[q.id][x.indicatorId]))) s.scores[q.id] = round(seps.reduce((n, x) => n + s.ind[q.id][x.indicatorId], 0)); else delete s.scores[q.id];
    s.updatedAt = new Date().toISOString();
  });
  return null;
}
function ScoreInput({ value, max, step, onCommit, label, readOnly }) {
  const [bad, setBad] = useState('');
  const commit = (e) => { const err = onCommit(e.target.value); if (err) { setBad(err); toast(err, 'err'); e.target.value = value ?? ''; } else setBad(''); };
  return html`<input key=${String(value)} class=${'inp sc ' + (bad ? 'bad' : '')} type="text" inputmode="decimal" defaultValue=${value ?? ''} placeholder=${'/' + fmt(max)} readOnly=${readOnly} title=${bad || `Skor maksimal ${fmt(max)}`} aria-label=${label} onBlur=${commit} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />`;
}

function GradeFields({ a, sid }) {
  const { sub, result } = resultFor(a, sid);
  const inds = store.d.indicators;
  const st = store.d.students.find((x) => x.id === sid);
  const b = buildIndividual(store.d, a, st, settingsNow());
  const auto = autoTexts({ a, st, b });
  return html`<div class="stack">
    ${a.questions.map((q) => {
      const seps = q.indicators.filter((m) => m.method === 'separate');
      return html`<div class="q-card"><div class="row between"><b>Soal ${q.no} <span class="muted sm">(maks ${fmt(q.maxScore)})</span></b>
        ${seps.length ? html`<span>Skor soal: <b>${isNum(sub?.scores?.[q.id]) ? fmt(sub.scores[q.id]) : 'belum lengkap'}</b></span>` : html`<${ScoreInput} value=${sub?.scores?.[q.id]} max=${q.maxScore} label=${`Skor soal ${q.no}`} onCommit=${(r) => saveScore(a, sid, q, r)} />`}</div>
        <div class="muted sm" style=${{ margin: '6px 0' }}>${q.text}</div>${q.rubric ? html`<div class="muted sm"><b>Rubrik:</b> ${q.rubric}</div>` : ''}
        ${seps.length ? html`<div class="stack-s mt">${seps.map((m) => { const ind = inds.find((i) => i.id === m.indicatorId); return html`<div class="row between"><span class="sm"><b>${ind?.code}</b> ${ind?.name}</span><${ScoreInput} value=${sub?.ind?.[q.id]?.[m.indicatorId]} max=${m.maxScore} label=${`Skor ${ind?.code} soal ${q.no}`} onCommit=${(r) => saveIndScore(a, sid, q, m, r)} /></div>`; })}</div>` : ''}
        <div class="mt"><${AutoField} key=${sid + q.id + auto.question(q).length} label="Catatan untuk siswa pada soal ini" rows=${3} auto=${auto.question(q)} value=${sub?.feedback?.[q.id] || ''} onSave=${(v) => store.mutate((d) => { ensureSub(d, a.id, sid).feedback[q.id] = v; })} /></div></div>`; })}
    <${AutoField} key=${sid + 'note' + auto.note.length} label="Catatan guru untuk siswa ini (tampil di laporan)" rows=${4} auto=${auto.note} value=${sub?.note || ''} onSave=${(v) => store.mutate((d) => { ensureSub(d, a.id, sid).note = v; })} />
    <div class="notice"><${Icon} n="info" size=${16} /><div><b>${STATE_LABEL[result.state]}</b> — ${result.explanation || 'Belum ada skor.'}</div></div></div>`;
}

export function GradingPage({ params }) {
  useStore();
  const [aid, setAid] = useState(params.id || store.d.assessments[0]?.id || '');
  const [detail, setDetail] = useState(null);
  const a = store.d.assessments.find((x) => x.id === aid);
  const s = a ? statsFor(a) : null;
  return html`<div><${PageHeader} title="Penilaian" sub="Masukkan skor setiap soal. Skor kosong bukan nol." demo=${store.isDemoData()} actions=${html`<${Btn} icon="upload" onClick=${() => go('/app/unggah')}>Unggah jawaban<//>`} />
    <div class="row mb"><div style=${{ width: '420px', maxWidth: '100%' }}><${Select} value=${aid} onChange=${(v) => { setAid(v); go('/app/penilaian/' + v); }} options=${asessOpts()} placeholder="Pilih asesmen" /></div>${a && html`<${Badge} kind="violet">${kkmWord()} ${s.kkm.value === null ? 'belum diatur' : fmt(s.kkm.value)} · ${s.kkm.source}<//>`}</div>
    ${!a ? html`<${Card}><${Empty} icon="check" title="Pilih atau buat asesmen" action=${html`<${Btn} variant="primary" onClick=${() => go('/app/asesmen/baru')}>Buat Asesmen<//>`} /><//>` : html`
      <div class="grid g4 mb"><${Stat} icon="users" label="Sudah dinilai lengkap" value=${`${s.nValid}/${s.nStudents}`} sub=${`${s.nPartial} parsial · ${s.nNotGraded} belum`} /><${Stat} tone="green" icon="check" label="Tuntas" value=${s.tuntas} /><${Stat} tone="red" icon="alert" label="Belum tuntas" value=${s.belum} /><${Stat} tone="violet" icon="chart" label="Ketuntasan kelas" value=${s.pct === null ? '—' : s.pct + '%'} sub=${s.pct === null ? 'Belum ada data penilaian' : ''} /></div>
      ${studentsOf(a.classId).length === 0 ? html`<${Card}><${Empty} icon="users" title="Kelas belum memiliki siswa" /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Nama siswa</th>${a.questions.map((q) => html`<th class="num">Soal ${q.no}<br/><span style=${{ fontWeight: 400, textTransform: 'none' }}>maks ${fmt(q.maxScore)}</span></th>`)}<th class="num">Total skor</th><th class="num">Nilai akhir</th><th class="num">${kkmWord()}</th><th>Status</th><th></th></tr></thead><tbody>
        ${s.rows.map(({ student, sub, result: r }, i) => html`<tr><td>${i + 1}</td><td style=${{ whiteSpace: 'nowrap' }}><b>${student.name}</b></td>
          ${a.questions.map((q) => { const sep = q.indicators.some((m) => m.method === 'separate'); return html`<td class="num">${sep ? html`<button class="btn sm" style=${{ minWidth: '74px' }} onClick=${() => setDetail(student.id)} title="Skor dihitung dari skor indikator">${isNum(sub?.scores?.[q.id]) ? fmt(sub.scores[q.id]) : 'isi…'}</button>` : html`<${ScoreInput} value=${sub?.scores?.[q.id]} max=${q.maxScore} label=${`${student.name} soal ${q.no}`} onCommit=${(v) => saveScore(a, student.id, q, v)} />`}</td>`; })}
          <td class="num">${r.state === 'kosong' ? '—' : fmt(r.total) + ' / ' + fmt(r.max)}</td><td class="num"><b>${r.final === null ? '—' : fmt(r.final)}</b></td><td class="num">${r.kkm === null ? '—' : fmt(r.kkm)}</td><td>${completionBadge(r)}${r.diff !== null ? html`<div class="muted sm">${fmtSigned(r.diff)}</div>` : ''}</td>
          <td class="right"><${Btn} size="sm" variant="ghost" icon="eye" aria-label="Detail" onClick=${() => setDetail(student.id)} /></td></tr>`)}</tbody></table></div>
        <p class="muted sm mt">Ketik skor lalu tekan Enter/pindah kolom. Soal dengan skor per indikator (tombol, bukan kolom isian) diisi di jendela detail; skor soalnya dihitung otomatis. Soal kosong membuat status "Penilaian Belum Lengkap" dan nilai akhir belum ditetapkan.</p>`}
      ${detail && (() => { const st = store.d.students.find((x) => x.id === detail); const { sub, result } = resultFor(a, detail); return html`<${Modal} wide title=${`Penilaian — ${st.name}`} onClose=${() => setDetail(null)} footer=${html`<${Btn} onClick=${() => go('/app/laporan/' + a.id + '/' + st.id)}>Lihat laporan<//><${Btn} variant="primary" onClick=${() => { setDetail(null); toast('Penilaian tersimpan.'); }}>Selesai<//>`}>
        <div class="score-hero"><div><b>${result.final === null ? '—' : fmt(result.final)}</b><span>Nilai akhir</span></div><div><b>${result.state === 'kosong' ? '—' : fmt(result.total) + '/' + fmt(result.max)}</b><span>Total skor</span></div><div><b>${result.kkm === null ? '—' : fmt(result.kkm)}</b><span>${kkmWord()}</span></div><div><b>${result.diff === null ? '—' : fmtSigned(result.diff)}</b><span>Selisih</span></div></div>
        <div class="mb">${completionBadge(result)} <span class="muted sm">${(sub?.docs || []).length} berkas jawaban</span></div><${GradeFields} a=${a} sid=${detail} /><//>`; })()}`}
  </div>`;
}

// =============== UNGGAH JAWABAN ===============
const OK_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export function UploadsPage() {
  useStore();
  const [aid, setAid] = useState(store.d.assessments[0]?.id || '');
  const [sid, setSid] = useState('');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(null);
  const a = store.d.assessments.find((x) => x.id === aid);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const pick = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!OK_TYPES.includes(f.type) || !/\.(jpe?g|png|pdf)$/i.test(f.name)) { toast('Format tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.', 'err'); e.target.value = ''; return; }
    if (f.size > 10 * 1024 * 1024) { toast('Ukuran berkas maksimal 10 MB.', 'err'); e.target.value = ''; return; }
    setFile(f); setUrl(URL.createObjectURL(f));
  };
  const saveFile = async () => {
    if (!file) { toast('Pilih berkas terlebih dahulu.', 'warn'); return; }
    const id = uid('f');
    try { await files.put(id, file); } catch { toast('Gagal menyimpan berkas di browser (penyimpanan penuh/diblokir).', 'err'); return; }
    store.mutate((d) => { ensureSub(d, aid, sid).docs.push({ id, name: file.name, type: file.type, size: file.size, at: new Date().toISOString() }); });
    toast('Berkas jawaban tersimpan (khusus browser ini).'); setFile(null); setUrl('');
  };
  const sub = a && sid ? store.d.submissions.find((x) => x.assessmentId === aid && x.studentId === sid) : null;
  const view = async (doc) => { const b = await files.get(doc.id); if (!b) { toast('Berkas tidak ditemukan.', 'err'); return; } setOpen({ doc, url: URL.createObjectURL(b) }); };
  return html`<div><${PageHeader} title="Unggah Foto Lembar Jawaban" sub="Simpan bukti jawaban siswa, lalu beri skor secara manual." demo=${store.isDemoData()} />
    <${Notice} kind="info" title="Akses terbatas, tanpa pembacaan otomatis">Berkas disimpan di penyimpanan browser ini dan tidak memiliki alamat publik. Pembacaan tulisan tangan otomatis belum tersedia; guru menentukan seluruh skor.<//>
    <div class="grid g2 mt">
      <${Card} title="1–3. Pilih dan unggah"><div class="stack">
        <${Field} label="Asesmen"><${Select} value=${aid} onChange=${(v) => { setAid(v); setSid(''); }} options=${asessOpts()} placeholder="Pilih asesmen" /><//>
        <${Field} label="Siswa"><${Select} value=${sid} onChange=${setSid} options=${a ? studentsOf(a.classId).map((s) => [s.id, `${s.code} — ${s.name}`]) : []} placeholder="Pilih siswa" /><//>
        <${Field} label="Berkas (JPG, JPEG, PNG, PDF · maks 10 MB)"><input class="inp" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange=${pick} disabled=${!sid} /><//>
        ${url && html`<div class="q-card"><div class="muted sm mb">Pratinjau: ${file.name} (${round(file.size / 1024, 0)} KB)</div>${file.type === 'application/pdf' ? html`<iframe src=${url} style=${{ width: '100%', height: '360px', border: 0 }} title="Pratinjau PDF"></iframe>` : html`<img src=${url} alt="Pratinjau jawaban" style=${{ maxWidth: '100%', borderRadius: '10px' }} />`}</div>`}
        <${Btn} variant="primary" icon="upload" disabled=${!file || !sid} onClick=${saveFile}>Simpan berkas<//>
        ${sub?.docs?.length ? html`<div><b class="sm">Berkas tersimpan</b><ul class="list">${sub.docs.map((d) => html`<li><span class="sm">${d.name} <span class="muted">· ${fmtDate(d.at)}</span></span><span><${Btn} size="sm" icon="eye" onClick=${() => view(d)}>Buka<//><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${async () => { if (await confirmDialog({ title: 'Hapus berkas?', message: d.name, confirmLabel: 'Hapus', danger: true })) { await files.del(d.id); store.mutate(() => { sub.docs = sub.docs.filter((x) => x.id !== d.id); }); } }} /></span></li>`)}</ul></div>` : ''}</div><//>
      <${Card} title="4–6. Beri skor dan catatan">${a && sid ? html`<${GradeFields} a=${a} sid=${sid} />` : html`<${Empty} icon="edit" title="Pilih asesmen dan siswa" text="Form skor muncul di sini; perubahan tersimpan saat Anda berpindah kolom." />`}<//></div>
    ${open && html`<${Modal} wide title=${open.doc.name} onClose=${() => { URL.revokeObjectURL(open.url); setOpen(null); }}>${open.doc.type === 'application/pdf' ? html`<iframe src=${open.url} style=${{ width: '100%', height: '70vh', border: 0 }} title="PDF"></iframe>` : html`<img src=${open.url} alt=${open.doc.name} style=${{ maxWidth: '100%' }} />`}<//>`}</div>`;
}

// =============== ANALISIS ===============
const COLORS = ['#2563EB', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
export function AnalysisPage({ query }) {
  useStore();
  const [aid, setAid] = useState(query.asesmen || store.d.assessments[0]?.id || '');
  const [dim, setDim] = useState('content');
  const [sid, setSid] = useState('');
  const d = store.d;
  const a = d.assessments.find((x) => x.id === aid);
  if (!a) return html`<div><${PageHeader} title="Analisis Pembelajaran" /><${Card}><${Empty} icon="chart" title="Belum ada asesmen" text="Analisis muncul setelah ada asesmen dengan nilai." /><//></div>`;
  const students = studentsOf(a.classId);
  const s = statsFor(a);
  const ia = analysisFor(a);
  const iaOk = ia.filter((x) => x.status === 'ok');
  const best = [...iaOk].sort((x, y) => y.avg - x.avg)[0];
  const weak = iaOk.filter((x) => x.threshold !== null && x.avg < x.threshold);
  const da = dimensionAnalysis(a, d.submissions, students, dim);
  const classAs = d.assessments.filter((x) => x.classId === a.classId).sort((x, y) => x.date.localeCompare(y.date)).map((x) => ({ x, st: statsFor(x) }));
  const stuId = sid || students[0]?.id;
  const prog = classAs.map(({ x }) => ({ x, r: resultFor(x, stuId).result })).filter((p) => p.r.final !== null);
  const few = s.nValid > 0 && s.nValid < 5;
  return html`<div><${PageHeader} title="Analisis Pembelajaran" sub="Semua angka dihitung dari skor valid yang sama dengan halaman penilaian dan laporan." demo=${store.isDemoData()} />
    <div class="row mb"><div style=${{ width: '420px', maxWidth: '100%' }}><${Select} value=${aid} onChange=${setAid} options=${asessOpts()} /></div><${Badge} kind="violet">${kkmWord()} ${s.kkm.value === null ? '—' : fmt(s.kkm.value)}<//></div>
    ${s.nValid === 0 ? html`<${Card}><${Empty} icon="chart" title="Belum ada data penilaian" text="Analisis belum dapat dilakukan karena belum ada siswa dengan nilai akhir valid pada asesmen ini." action=${html`<${Btn} variant="primary" onClick=${() => go('/app/penilaian/' + a.id)}>Mulai menilai<//>`} /><//>` : html`
    ${few && html`<div class="mb"><${Notice} kind="warn">Baru ${s.nValid} siswa yang bernilai valid; interpretasi statistik kelas terbatas.<//></div>`}
    <div class="grid g4 mb"><${Stat} label="Rata-rata" value=${fmt(s.mean)} icon="chart" /><${Stat} label="Median" value=${fmt(s.median)} tone="violet" icon="chart" /><${Stat} label="Tertinggi / terendah" value=${`${fmt(s.max)} / ${fmt(s.min)}`} tone="green" icon="chart" /><${Stat} label="Ketuntasan kelas" value=${s.pct + '%'} sub=${`${s.tuntas} tuntas · ${s.belum} belum tuntas (dari ${s.nValid} valid)`} tone="amber" icon="check" /></div>
    <div class="grid g2">
      <${Card} title="Distribusi nilai akhir"><${Chart} data=${{ labels: s.bins.map((b) => b.label), datasets: [{ label: 'Jumlah siswa', data: s.bins.map((b) => b.count), backgroundColor: s.bins.map((b, i) => (i * 10 >= (s.kkm.value ?? 101) ? '#10B981' : '#93C5FD')), borderRadius: 6 }] }} options=${{ scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /><div class="muted sm">Hijau: rentang di atas ${kkmWord()}. Dihitung dari ${s.nValid} siswa; ${s.nStudents - s.nValid} belum bernilai valid tidak dihitung.</div><//>
      <${Card} title="Ketercapaian indikator">${iaOk.length ? html`<${Chart} type="bar" data=${{ labels: iaOk.map((x) => x.indicator.code), datasets: [{ label: 'Rata-rata ketercapaian (%)', data: iaOk.map((x) => x.avg), backgroundColor: '#2563EB', borderRadius: 6 }] }} options=${{ indexAxis: 'y', scales: { x: { min: 0, max: 100 } } }} />` : html`<${Empty} icon="target" title="Analisis indikator belum dapat dihitung" text="Hubungkan indikator dengan soal dan gunakan skor terpisah per indikator bila satu soal mengukur beberapa indikator." />`}<//>
    </div>
    <${Card} class="mt" title="Rincian indikator" pad=${false}><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indikator</th><th class="num">Siswa dihitung</th><th class="num">Rata-rata</th><th class="num">Siswa mencapai KKM</th><th>Keterangan</th></tr></thead><tbody>${ia.length === 0 ? html`<tr><td colspan="6"><${Empty} title="Asesmen belum memilih indikator" /></td></tr>` : ia.map((x) => x.status !== 'ok' ? html`<tr><td><b>${x.indicator.code}</b> ${x.indicator.name}</td><td colspan="4" class="muted sm">${x.reason}</td></tr>` : html`<tr><td><b>${x.indicator.code}</b> ${x.indicator.name}</td><td class="num">${x.n}</td><td class="num"><b>${x.avg}%</b></td><td class="num">${x.share === null ? '—' : `${x.reached} (${x.share}%)`}</td><td class="sm muted">${x.partial ? 'Sebagian soal multi-indikator tanpa skor terpisah tidak dihitung. ' : ''}${x.threshold === null ? 'KKM belum ditetapkan.' : x.avg >= x.threshold ? `Rata-rata di atas KKM ${fmt(x.threshold)}.` : `Rata-rata di bawah KKM ${fmt(x.threshold)}.`}</td></tr>`)}</tbody></table></div><//>
    <div class="grid g2 mt"><${Card} title="Indikator tertinggi">${best ? html`<b>${best.indicator.code}</b> ${best.indicator.name}<div class="hl-ok"><b>${best.avg}%</b></div>` : html`<span class="muted">Belum tersedia.</span>`}<//>
      <${Card} title="Indikator yang memerlukan penguatan">${weak.length ? weak.map((x) => html`<div class="mb"><b>${x.indicator.code}</b> ${x.indicator.name} — <b class="hl-bad">${x.avg}%</b> <span class="muted sm">${x.share !== null ? `· ${x.share}% siswa mencapai KKM` : ''}</span></div>`) : html`<span class="muted">Tidak ada indikator dengan rata-rata di bawah KKM.</span>`}<//></div>
    <div class="grid g2 mt">
      <${Card} title="Perbandingan hasil asesmen (kelas yang sama)">${classAs.filter((c) => c.st.nValid).length > 1 ? html`<${Chart} data=${{ labels: classAs.filter((c) => c.st.nValid).map((c) => c.x.title.slice(0, 22)), datasets: [{ label: 'Rata-rata', data: classAs.filter((c) => c.st.nValid).map((c) => round(c.st.mean)), backgroundColor: '#2563EB', borderRadius: 6 }, { label: 'Ketuntasan (%)', data: classAs.filter((c) => c.st.nValid).map((c) => c.st.pct), backgroundColor: '#10B981', borderRadius: 6 }] }} options=${{ scales: { y: { min: 0, max: 100 } } }} /><div class="muted sm">Bandingkan dengan hati-hati: materi, indikator, rubrik, dan skala tiap asesmen dapat berbeda.</div>` : html`<${Empty} icon="chart" title="Perlu minimal dua asesmen bernilai" text="Perbandingan belum dapat ditampilkan." />`}<//>
      <${Card} title="Perkembangan siswa" action=${html`<div style=${{ width: '200px' }}><${Select} value=${stuId} onChange=${setSid} options=${students.map((x) => [x.id, x.name])} /></div>`}>${prog.length > 1 ? html`<${Chart} type="line" data=${{ labels: prog.map((p) => fmtDate(p.x.date)), datasets: [{ label: 'Nilai akhir', data: prog.map((p) => p.r.final), borderColor: '#8B5CF6', backgroundColor: '#8B5CF6', tension: 0.25 }] }} options=${{ scales: { y: { min: 0, max: 100 } } }} /><div class="muted sm">Hanya asesmen yang sudah dinilai lengkap. Skala 0–100; bandingkan dengan hati-hati.</div>` : html`<${Empty} icon="chart" title="Data perkembangan belum cukup" text="Perlu minimal dua asesmen yang sudah dinilai lengkap untuk siswa ini." />`}<//>
    </div>
    <${Card} class="mt" title="Dimensi kompetensi (bergaya PISA, pemetaan guru)" action=${html`<${Tabs} tabs=${Object.entries(DIMENSIONS).map(([k, v]) => [k, v.label])} value=${dim} onChange=${setDim} />`}>
      ${da.items.length === 0 ? html`<${Empty} icon="layers" title="Soal belum dipetakan ke dimensi ini" text="Atur pemetaan pada pengaturan soal (menu Soal & Asesmen)." />` : da.n === 0 ? html`<${Empty} title="Belum ada siswa dengan semua soal dinilai" />` : html`<${Chart} data=${{ labels: da.items.map((x) => x.value), datasets: [{ label: 'Skor diperoleh (%)', data: da.items.map((x) => x.pct), backgroundColor: COLORS, borderRadius: 6 }] }} options=${{ scales: { y: { min: 0, max: 100 } } }} height=${240} />`}
      <div class="muted sm mt">MathLens bukan aplikasi resmi PISA dan tidak menghasilkan skor PISA. Persentase = skor soal yang Anda petakan ÷ skor maksimalnya, dari ${da.n} siswa dengan penilaian lengkap. Satu jawaban salah tidak dianggap sebagai bukti miskonsepsi.</div><//>`}</div>`;
}
