import { html, useState, useStore, go, Icon, Btn, Card, Badge, Empty, Notice, Modal, Field, Input, Textarea, Select, Check, PageHeader, toast, confirmDialog } from './ui.js';
import { store } from './lib-store.js';
import { uid, fmt, fmtDate, totalInfo, validateAssessment, sumMax, round, isNum, DIMENSIONS, resolveKkm, indicatorsOf } from './lib-core.js';
import { classOpts, className, classById, studentsOf, statsFor, settingsNow, kkmWord, stBadge, ASSESS_STATUS, TYPE_LABEL } from './page-common.js';

export function AssessmentsPage({ query }) {
  useStore();
  const [cid, setCid] = useState(query.kelas || '');
  const list = store.d.assessments.filter((a) => !cid || a.classId === cid).sort((a, b) => b.date.localeCompare(a.date));
  const remove = async (a) => {
    const n = store.d.submissions.filter((s) => s.assessmentId === a.id).length;
    if (await confirmDialog({ title: `Hapus asesmen "${a.title}"?`, message: n ? `Ada ${n} data penilaian siswa pada asesmen ini. Semuanya akan ikut terhapus permanen, begitu juga laporan yang bergantung padanya.` : 'Asesmen dan soalnya akan dihapus.', confirmLabel: 'Hapus', danger: true })) {
      store.mutate((d) => { d.assessments = d.assessments.filter((x) => x.id !== a.id); d.submissions = d.submissions.filter((x) => x.assessmentId !== a.id); }); store.audit('assessment.delete', 'assessment', a.id); toast('Asesmen dihapus.');
    }
  };
  return html`<div><${PageHeader} title="Soal & Asesmen" sub="Susun soal, skor maksimal tiap soal, rubrik, indikator, dan KKM." demo=${store.isDemoData()} actions=${html`<${Btn} variant="primary" icon="plus" onClick=${() => go('/app/asesmen/baru' + (cid ? '?kelas=' + cid : ''))}>Buat Asesmen<//>`} />
    <div class="row mb"><div style=${{ width: '240px' }}><${Select} value=${cid} onChange=${setCid} options=${classOpts(true)} placeholder="Semua kelas" /></div></div>
    ${list.length === 0 ? html`<${Card}><${Empty} icon="edit" title="Belum ada asesmen" text="Buat asesmen dari pembelajaran dan indikator yang sudah Anda catat." /><//>` : html`<div class="grid g2">${list.map((a) => {
      const s = statsFor(a); const t = totalInfo(a);
      return html`<${Card} title=${a.title} action=${stBadge(ASSESS_STATUS, a.status)}>
        <div class="muted sm mb">${className(a.classId)} · ${TYPE_LABEL[a.type]} · ${fmtDate(a.date)}</div>
        <div class="row mb"><${Badge}>${a.questions.length} soal<//><${Badge} kind="blue">Skor maks ${fmt(t.totalMax)}<//><${Badge} kind="violet">${kkmWord()} ${s.kkm.value === null ? '—' : fmt(s.kkm.value)}<//><${Badge} kind=${s.nValid ? 'green' : 'gray'}>${s.nValid}/${s.nStudents} dinilai<//></div>
        <div class="row gap-s"><${Btn} size="sm" icon="check" onClick=${() => go('/app/penilaian/' + a.id)}>Nilai<//><${Btn} size="sm" icon="edit" onClick=${() => go('/app/asesmen/' + a.id)}>Edit<//><${Btn} size="sm" icon="chart" onClick=${() => go('/app/analisis?asesmen=' + a.id)}>Analisis<//><span class="grow"></span>
          <${Btn} size="sm" variant="ghost" icon="copy" aria-label="Duplikasi" onClick=${() => { const id = uid('a'); store.mutate((d) => d.assessments.push({ ...JSON.parse(JSON.stringify(a)), id, title: a.title + ' (salinan)', status: 'draft', questions: a.questions.map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: uid('q') })) })); toast('Asesmen diduplikasi tanpa nilai siswa.'); }} /><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${() => remove(a)} /></div><//>`; })}</div>`}</div>`;
}

const blankQ = (no) => ({ id: uid('q'), no, text: '', type: 'uraian', key: '', maxScore: 10, weight: 1, rubric: '', note: '', indicators: [], dims: { content: [], process: [], context: [], competency: [] } });
const num = (v) => (v === null || v === undefined ? '' : v);

/** Menghitung dampak perubahan terhadap nilai yang sudah tersimpan (tanpa mengubah apa pun). */
function planImpact(oldA, newA, subs) {
  const mine = subs.filter((s) => s.assessmentId === newA.id && Object.values(s.scores || {}).some((v) => isNum(v)));
  const impacts = []; const fix = [];
  if (!oldA || !mine.length) return { impacts, fix, scored: mine.length };
  const removed = oldA.questions.filter((q) => !newA.questions.some((n) => n.id === q.id));
  if (removed.length) impacts.push(`${removed.length} soal dihapus (${removed.map((q) => 'No. ' + q.no).join(', ')}): skor soal tersebut pada ${mine.length} siswa ikut dihapus dan total/nilai akhir dihitung ulang.`);
  for (const nq of newA.questions) {
    const oq = oldA.questions.find((q) => q.id === nq.id); if (!oq) { impacts.push(`Soal baru No. ${nq.no}: siswa yang sudah dinilai menjadi "Penilaian Belum Lengkap" sampai soal ini diisi.`); continue; }
    if (Number(oq.maxScore) !== Number(nq.maxScore)) {
      const over = mine.filter((s) => isNum(s.scores[nq.id]) && Number(s.scores[nq.id]) > Number(nq.maxScore));
      impacts.push(`Soal No. ${nq.no}: skor maksimal ${fmt(oq.maxScore)} → ${fmt(nq.maxScore)}. Nilai akhir seluruh siswa dihitung ulang${over.length ? `; ${over.length} skor melebihi batas baru dan akan DIKOSONGKAN (perlu dinilai ulang)` : ''}.`);
      over.forEach((s) => fix.push([s.id, nq.id]));
    }
    const sepOld = oq.indicators.filter((m) => m.method === 'separate'); const sepNew = nq.indicators.filter((m) => m.method === 'separate');
    if (JSON.stringify(sepOld.map((m) => [m.indicatorId, m.maxScore])) !== JSON.stringify(sepNew.map((m) => [m.indicatorId, m.maxScore]))) impacts.push(`Soal No. ${nq.no}: pembagian skor per indikator berubah; skor indikator siswa yang tidak cocok akan dikosongkan dan harus dinilai ulang.`);
  }
  if (oldA.totalMode !== newA.totalMode || oldA.manualTotal !== newA.manualTotal || oldA.conversionRule !== newA.conversionRule || oldA.useWeights !== newA.useWeights) impacts.push('Aturan skor maksimal keseluruhan/konversi/bobot berubah: nilai akhir semua siswa dihitung ulang dengan aturan baru.');
  if (oldA.kkmSource !== newA.kkmSource || String(oldA.kkmValue) !== String(newA.kkmValue)) impacts.push(`${kkmWord()} berubah: status ketuntasan semua siswa dihitung ulang.`);
  return { impacts, fix, scored: mine.length };
}
function applyReconcile(d, newA) {
  d.submissions.filter((s) => s.assessmentId === newA.id).forEach((s) => {
    const qids = new Set(newA.questions.map((q) => q.id));
    Object.keys(s.scores).forEach((k) => { if (!qids.has(k)) delete s.scores[k]; });
    Object.keys(s.ind || {}).forEach((k) => { if (!qids.has(k)) delete s.ind[k]; });
    for (const q of newA.questions) {
      const seps = q.indicators.filter((m) => m.method === 'separate');
      if (seps.length) {
        const cur = s.ind?.[q.id] || {}; const next = {};
        seps.forEach((m) => { const v = cur[m.indicatorId]; if (isNum(v) && Number(v) <= Number(m.maxScore)) next[m.indicatorId] = Number(v); });
        s.ind[q.id] = next;
        s.scores[q.id] = seps.every((m) => isNum(next[m.indicatorId])) ? round(seps.reduce((x, m) => x + next[m.indicatorId], 0)) : null;
        if (s.scores[q.id] === null) delete s.scores[q.id];
      } else {
        if (s.ind) delete s.ind[q.id];
        if (isNum(s.scores[q.id]) && Number(s.scores[q.id]) > Number(q.maxScore)) delete s.scores[q.id];
      }
    }
  });
}

export function AssessmentEditor({ params, query }) {
  useStore();
  const isNew = params.id === 'baru';
  const orig = isNew ? null : store.d.assessments.find((x) => x.id === params.id);
  const [a, setA] = useState(() => orig ? JSON.parse(JSON.stringify(orig)) : {
    id: uid('a'), title: '', classId: query.kelas || store.d.classes.find((c) => !c.archived)?.id || '', learningId: '', objectives: '', type: 'formatif', date: new Date().toISOString().slice(0, 10), totalMode: 'auto', manualTotal: '', conversionRule: null,
    useWeights: false, allowDecimal: !!settingsNow().allowDecimalDefault, kkmSource: 'default', kkmValue: '', status: 'draft', indicatorIds: [], questions: [blankQ(1)],
  });
  const [errs, setErrs] = useState([]);
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState(0);
  if (!isNew && !orig) return html`<${Card}><${Empty} title="Asesmen tidak ditemukan" action=${html`<${Btn} onClick=${() => go('/app/asesmen')}>Kembali<//>`} /><//>`;
  const set = (k) => (v) => setA({ ...a, [k]: v });
  const t = totalInfo(a);
  const inds = store.d.indicators.filter((i) => i.learningId === a.learningId);
  const chosenInds = indicatorsOf(store.d, a);
  const setQ = (idx, patch) => setA({ ...a, questions: a.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)) });
  const renumber = (qs) => qs.map((q, i) => ({ ...q, no: i + 1 }));
  const addQ = () => { setA({ ...a, questions: [...a.questions, blankQ(a.questions.length + 1)] }); setOpen(a.questions.length); };
  const dupQ = (i) => { const c = JSON.parse(JSON.stringify(a.questions[i])); c.id = uid('q'); const qs = [...a.questions]; qs.splice(i + 1, 0, c); setA({ ...a, questions: renumber(qs) }); setOpen(i + 1); };
  const delQ = async (i) => {
    const hasScores = orig && store.d.submissions.some((s) => s.assessmentId === a.id && isNum(s.scores?.[a.questions[i].id]));
    if (a.questions.length === 1) { toast('Asesmen minimal memiliki satu soal.', 'warn'); return; }
    if (hasScores && !(await confirmDialog({ title: `Hapus Soal ${a.questions[i].no}?`, message: 'Soal ini sudah memiliki skor siswa. Skor tersebut akan dihapus saat Anda menyimpan asesmen, dan nilai akhir dihitung ulang. Rincian dampak ditampilkan lagi sebelum menyimpan.', confirmLabel: 'Hapus dari draf', danger: true }))) return;
    setA({ ...a, questions: renumber(a.questions.filter((_, j) => j !== i)) });
  };
  const toggleInd = (id) => {
    setA((p) => {
      const on = p.indicatorIds.includes(id);
      return { ...p, indicatorIds: on ? p.indicatorIds.filter((x) => x !== id) : [...p.indicatorIds, id], questions: on ? p.questions.map((q) => ({ ...q, indicators: q.indicators.filter((m) => m.indicatorId !== id) })) : p.questions };
    });
  };
  const save = async () => {
    const e = validateAssessment(a);
    if (a.questions.some((q) => !q.text.trim())) e.push('Isi teks semua soal (atau hapus soal kosong).');
    setErrs(e); if (e.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); toast(`${e.length} masalah perlu diperbaiki.`, 'err'); return; }
    const plan = planImpact(orig, a, store.d.submissions);
    if (plan.impacts.length) {
      const ok = await confirmDialog({ title: 'Perubahan memengaruhi nilai yang sudah tersimpan', confirmLabel: 'Terapkan perubahan', danger: true,
        message: html`<p>${plan.scored} siswa sudah memiliki skor pada asesmen ini. Dampak perubahan:</p><ul>${plan.impacts.map((x) => html`<li>${x}</li>`)}</ul><p>Tidak ada nilai yang diubah sampai Anda menekan "Terapkan perubahan".</p>` });
      if (!ok) return;
    }
    store.mutate((d) => {
      const clean = { ...a, questions: a.questions.map((q) => ({ ...q, maxScore: Number(q.maxScore), weight: Number(q.weight) || 1, indicators: q.indicators.map((m) => ({ ...m, maxScore: m.method === 'separate' ? Number(m.maxScore) : '' })) })), manualTotal: a.manualTotal === '' ? '' : Number(a.manualTotal) };
      const i = d.assessments.findIndex((x) => x.id === a.id);
      if (i >= 0) d.assessments[i] = clean; else d.assessments.push(clean);
      if (orig) applyReconcile(d, clean);
    });
    store.audit(orig ? 'assessment.update' : 'assessment.create', 'assessment', a.id, plan.impacts.length ? `${plan.impacts.length} dampak` : '');
    toast('Asesmen disimpan.'); go('/app/asesmen');
  };
  const mappedCount = (m) => a.questions.filter((q) => q.indicators.some((x) => x.indicatorId === m.id)).length;
  return html`<div>
    <${PageHeader} title=${isNew ? 'Buat Asesmen' : 'Edit Asesmen'} sub="Kelas → pembelajaran → tujuan → indikator → soal → skor → rubrik → KKM → pratinjau → simpan." demo=${store.isDemoData()} actions=${html`<${Btn} variant="ghost" onClick=${() => go('/app/asesmen')}>Batal<//><${Btn} icon="eye" onClick=${() => setPreview(true)}>Pratinjau<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`} />
    ${errs.length ? html`<div class="mb"><${Notice} kind="err" title="Perbaiki hal berikut sebelum menyimpan">${errs.map((e) => html`<div>• ${e}</div>`)}<//></div>` : ''}
    <div class="stack">
    <${Card} title="1–4. Identitas, pembelajaran, tujuan, dan indikator"><div class="form-grid">
      <${Field} label="Nama asesmen" class="full"><${Input} value=${a.title} onChange=${set('title')} placeholder="Mis. Asesmen Sumatif Teorema Pythagoras" /><//>
      <${Field} label="Kelas"><${Select} value=${a.classId} onChange=${(v) => setA({ ...a, classId: v, learningId: '', indicatorIds: [], questions: a.questions.map((q) => ({ ...q, indicators: [] })) })} options=${classOpts()} placeholder="Pilih kelas" /><//>
      <${Field} label="Data pembelajaran" hint="Materi dan indikator mengikuti pembelajaran yang dipilih."><${Select} value=${a.learningId} onChange=${(v) => setA({ ...a, learningId: v, indicatorIds: [], objectives: store.d.learning.find((l) => l.id === v)?.objectives || a.objectives, questions: a.questions.map((q) => ({ ...q, indicators: [] })) })} options=${store.d.learning.filter((l) => l.classId === a.classId).map((l) => [l.id, l.title])} placeholder="Pilih pembelajaran" /><//>
      <${Field} label="Tujuan pembelajaran" class="full"><${Textarea} rows=${2} value=${a.objectives} onChange=${set('objectives')} /><//>
      <${Field} label="Jenis asesmen"><${Select} value=${a.type} onChange=${set('type')} options=${Object.entries(TYPE_LABEL)} /><//><${Field} label="Tanggal"><${Input} type="date" value=${a.date} onChange=${set('date')} /><//>
      <${Field} label="Status"><${Select} value=${a.status} onChange=${set('status')} options=${Object.entries(ASSESS_STATUS).map(([k, v]) => [k, v[0]])} /><//>
      <div class="full"><span class="lbl">Indikator yang diukur</span>${!a.learningId ? html`<div class="muted sm">Pilih data pembelajaran untuk menampilkan indikatornya.</div>` : inds.length === 0 ? html`<${Notice} kind="warn">Pembelajaran ini belum punya indikator. <a href="#/app/indikator?baru=1">Tambah indikator</a>.<//>` : html`<div class="stack-s" style=${{ marginTop: '6px' }}><div class="muted sm">Terhubung otomatis dari data pembelajaran. Pada tiap soal, tinggal centang indikator yang diukur.</div>${inds.map((i) => html`<div class="row gap-s"><${Badge} kind="blue">${i.code}<//> <span>${i.name}</span> <span class="muted sm">· dipakai di ${mappedCount(i)} soal</span></div>`)}</div>`}</div></div><//>

    <${Card} title="6 & 8. Skor maksimal keseluruhan dan ${kkmWord()}"><div class="grid g2">
      <div class="stack">
        <div class="field"><span class="lbl">Skor maksimal keseluruhan</span>
          <label class="chk"><input type="radio" name="tm" checked=${a.totalMode !== 'manual'} onChange=${() => setA({ ...a, totalMode: 'auto', conversionRule: null })} /><span><b>Otomatis</b> — jumlah skor maksimal semua soal (disarankan)</span></label>
          <label class="chk"><input type="radio" name="tm" checked=${a.totalMode === 'manual'} disabled=${a.useWeights} onChange=${() => setA({ ...a, totalMode: 'manual', manualTotal: a.manualTotal || t.sum })} /><span><b>Manual</b> — target ditentukan guru${a.useWeights ? ' (tidak tersedia saat bobot aktif)' : ''}</span></label></div>
        ${a.totalMode === 'manual' && !a.useWeights && html`<${Field} label="Skor maksimal keseluruhan (manual)"><${Input} type="number" min="0" step="any" value=${num(a.manualTotal)} onChange=${set('manualTotal')} /><//>
          ${t.needsRule && html`<${Notice} kind="warn" title=${`Berbeda dari jumlah skor soal (${fmt(t.sum)})`}>Pilih aturan konversi — sistem tidak mengabaikan perbedaan ini.
            <div class="stack-s" style=${{ marginTop: '8px' }}>
              <label class="chk"><input type="radio" name="cr" checked=${a.conversionRule === 'proporsional'} onChange=${() => set('conversionRule')('proporsional')} /><span><b>Proporsional</b>: skor dikonversi ke skala ${fmt(a.manualTotal)} (skor × ${fmt(a.manualTotal)}/${fmt(t.sum)}).</span></label>
              <label class="chk"><input type="radio" name="cr" checked=${a.conversionRule === 'langsung'} onChange=${() => set('conversionRule')('langsung')} /><span><b>Skor mentah langsung</b>: total skor dibagi ${fmt(a.manualTotal)} (dibatasi maksimal ${fmt(a.manualTotal)}).</span></label></div><//>`}`}
        <${Check} checked=${a.allowDecimal} onChange=${set('allowDecimal')}>Izinkan skor desimal<//>
        <${Check} checked=${a.useWeights} onChange=${(v) => setA({ ...a, useWeights: v, totalMode: v ? 'auto' : a.totalMode, conversionRule: v ? null : a.conversionRule })}>Gunakan bobot soal<//>
        ${a.useWeights && html`<${Notice}>Rumus: nilai akhir = Σ( skor ÷ skor maks soal × bobot ) ÷ Σ bobot × 100. Bobot diterapkan satu kali; total skor mentah hanya informasi.<//>`}</div>
      <div class="stack">
        <${Field} label=${`${kkmWord()} asesmen ini (0–100)`} hint=${`Kosongkan untuk memakai ${kkmWord()} kelas (${resolveKkm({}, classById(a.classId), settingsNow()).value ?? 'belum diatur'}). Satu ${kkmWord()} ini dipakai untuk status ketuntasan dan ketercapaian indikator.`}><${Input} type="number" min="0" max="100" value=${num(a.kkmValue)} onChange=${set('kkmValue')} /><//>
        <div class="stat" style=${{ boxShadow: 'none' }}><div class="stat-ic"><${Icon} n="target" /></div><div><div class="stat-l">Skor maksimal keseluruhan saat ini</div><div class="stat-v">${fmt(t.totalMax)}</div><div class="stat-s">Jumlah skor soal: ${fmt(t.sum)} · ${a.questions.length} soal</div></div></div></div></div><//>

    <${Card} title="5–7. Soal, skor maksimal, dan rubrik" action=${html`<${Btn} variant="primary" size="sm" icon="plus" onClick=${addQ}>Tambah Soal<//>`} pad=${false}>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Soal</th><th class="num">Skor maks</th>${a.useWeights ? html`<th class="num">Bobot</th>` : ''}<th>Indikator</th><th></th></tr></thead><tbody>
        ${a.questions.map((q, i) => html`<tr><td><b>${q.no}</b></td><td style=${{ maxWidth: '360px' }}><div style=${{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>${q.text || html`<i class="muted">(belum diisi)</i>`}</div></td>
          <td class="num"><input class=${'inp sc ' + (!isNum(q.maxScore) || Number(q.maxScore) <= 0 ? 'bad' : '')} type="number" min="0" step=${a.allowDecimal ? 'any' : '1'} value=${num(q.maxScore)} onInput=${(e) => setQ(i, { maxScore: e.target.value })} aria-label=${`Skor maksimal soal ${q.no}`} /></td>
          ${a.useWeights ? html`<td class="num"><input class="inp sc" type="number" min="0" step="any" value=${num(q.weight)} onInput=${(e) => setQ(i, { weight: e.target.value })} aria-label=${`Bobot soal ${q.no}`} /></td>` : ''}
          <td>${q.indicators.length ? q.indicators.map((m) => html`<${Badge} kind=${m.method === 'separate' ? 'violet' : 'blue'}>${store.d.indicators.find((x) => x.id === m.indicatorId)?.code}<//> `) : html`<span class="muted sm">—</span>`}</td>
          <td class="right"><${Btn} size="sm" onClick=${() => setOpen(open === i ? -1 : i)}>${open === i ? 'Tutup' : 'Atur'}<//><${Btn} size="sm" variant="ghost" icon="copy" aria-label="Duplikasi" onClick=${() => dupQ(i)} /><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${() => delQ(i)} /></td></tr>`)}
        <tr><td></td><td class="right"><b>Total</b></td><td class="num"><b>${fmt(t.sum)}</b></td>${a.useWeights ? html`<td class="num"><b>${fmt(a.questions.reduce((x, q) => x + (Number(q.weight) || 0), 0))}</b></td>` : ''}<td colspan="2" class="muted sm">dihitung otomatis</td></tr></tbody></table></div>
      ${a.questions.map((q, i) => open === i && html`<${QuestionEditor} q=${q} a=${a} chosen=${chosenInds} onChange=${(p) => setQ(i, p)} />`)}
    <//></div>
    <div class="row mt" style=${{ justifyContent: 'flex-end' }}><${Btn} variant="ghost" onClick=${() => go('/app/asesmen')}>Batal<//><${Btn} icon="eye" onClick=${() => setPreview(true)}>Pratinjau<//><${Btn} variant="primary" onClick=${save}>Simpan Asesmen<//></div>
    ${preview && html`<${Modal} wide title=${'Pratinjau — ' + (a.title || 'Tanpa judul')} onClose=${() => setPreview(false)}>
      <p class="muted mb">${className(a.classId)} · ${TYPE_LABEL[a.type]} · ${fmtDate(a.date)} · Skor maksimal ${fmt(t.totalMax)}</p>
      ${a.questions.map((q) => html`<div class="q-card mb"><div class="row between"><b>Soal ${q.no}</b><${Badge} kind="blue">${fmt(q.maxScore)} poin<//></div><p style=${{ margin: '8px 0' }}>${q.text || '(belum diisi)'}</p>${q.rubric ? html`<div class="muted sm"><b>Rubrik:</b> ${q.rubric}</div>` : ''}${q.indicators.length ? html`<div class="muted sm">Indikator: ${q.indicators.map((m) => store.d.indicators.find((x) => x.id === m.indicatorId)?.code + (m.method === 'separate' ? ` (${fmt(m.maxScore)})` : '')).join(', ')}</div>` : ''}</div>`)}<//>`}
  </div>`;
}

function QuestionEditor({ q, a, chosen, onChange }) {
  const setM = (id, patch) => onChange({ indicators: q.indicators.map((m) => (m.indicatorId === id ? { ...m, ...patch } : m)) });
  const toggle = (id) => onChange({ indicators: q.indicators.some((m) => m.indicatorId === id) ? q.indicators.filter((m) => m.indicatorId !== id) : [...q.indicators, { indicatorId: id, method: q.indicators.length ? 'separate' : 'whole', maxScore: '' }] });
  const multi = q.indicators.length > 1;
  const sepSum = round(q.indicators.filter((m) => m.method === 'separate').reduce((x, m) => x + (Number(m.maxScore) || 0), 0));
  const anySep = q.indicators.some((m) => m.method === 'separate');
  const toggleDim = (k, v) => { const cur = q.dims[k] || []; onChange({ dims: { ...q.dims, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }); };
  return html`<div style=${{ padding: '20px', borderTop: '1px solid var(--border)', background: '#fafcff' }}>
    <h4 style=${{ marginBottom: '12px' }}>Soal ${q.no}</h4>
    <div class="form-grid">
      <${Field} label="Isi soal" class="full"><${Textarea} rows=${3} value=${q.text} onChange=${(v) => onChange({ text: v })} /><//>
      <${Field} label="Jenis soal"><${Select} value=${q.type} onChange=${(v) => onChange({ type: v })} options=${[['uraian', 'Uraian'], ['pilihan_ganda', 'Pilihan ganda'], ['isian', 'Isian singkat'], ['proyek', 'Tugas/proyek']]} /><//>
      <${Field} label="Kunci jawaban"><${Input} value=${q.key} onChange=${(v) => onChange({ key: v })} /><//>
      <${Field} label="Rubrik penilaian" class="full" hint="Deskripsikan kriteria untuk skor penuh, sebagian, dan minimal."><${Textarea} rows=${2} value=${q.rubric} onChange=${(v) => onChange({ rubric: v })} /><//>
      <${Field} label="Catatan guru" class="full"><${Input} value=${q.note} onChange=${(v) => onChange({ note: v })} /><//>
    </div>
    <h4 style=${{ margin: '18px 0 8px' }}>Indikator yang diukur</h4>
    ${chosen.length === 0 ? html`<div class="muted sm">Pilih indikator pada bagian 1–4 terlebih dahulu.</div>` : html`<div class="stack-s">${chosen.map((i) => { const m = q.indicators.find((x) => x.indicatorId === i.id); return html`<div class="row"><div style=${{ minWidth: '260px', flex: 1 }}><${Check} checked=${!!m} onChange=${() => toggle(i.id)}><b>${i.code}</b> ${i.name}<//></div>
      ${m && multi && html`<${Select} value=${m.method} onChange=${(v) => setM(i.id, { method: v })} options=${[['separate', 'Skor terpisah'], ['whole', 'Tanpa skor terpisah']]} style=${{ width: '190px' }} />`}
      ${m && m.method === 'separate' && html`<input class="inp sc" style=${{ width: '90px' }} type="number" min="0" step="any" placeholder="Skor maks" value=${num(m.maxScore)} onInput=${(e) => setM(i.id, { maxScore: e.target.value })} aria-label=${`Skor maksimal indikator ${i.code}`} />`}</div>`; })}</div>`}
    ${multi && !anySep && html`<div class="mt"><${Notice} kind="warn">Soal ini mengukur beberapa indikator tetapi tanpa skor terpisah. Skor soal <b>tidak</b> diduplikasi ke tiap indikator, sehingga ketercapaian indikator belum dapat dihitung terpisah dari soal ini. Pilih "Skor terpisah" untuk mengaktifkannya.<//></div>`}
    ${anySep && html`<div class="mt"><${Notice} kind=${sepSum === round(Number(q.maxScore)) ? 'ok' : 'warn'}>Jumlah skor maksimal indikator: <b>${fmt(sepSum)}</b> dari skor soal <b>${fmt(q.maxScore)}</b>. ${sepSum === round(Number(q.maxScore)) ? 'Konsisten.' : 'Harus sama agar dapat disimpan. Saat menilai, skor soal dihitung otomatis dari skor indikator.'}<//></div>`}
    <h4 style=${{ margin: '18px 0 8px' }}>Pemetaan dimensi (opsional, bergaya PISA)</h4>
    <div class="grid g2" style=${{ gap: '8px' }}>${Object.entries(DIMENSIONS).map(([k, dim]) => html`<details class="q-card" style=${{ padding: '10px 14px' }}><summary><b>${dim.label}</b> ${(q.dims[k] || []).length ? html`<${Badge} kind="violet">${q.dims[k].length}<//>` : ''}</summary><div class="stack-s" style=${{ marginTop: '8px' }}>${dim.items.map((v) => html`<${Check} checked=${(q.dims[k] || []).includes(v)} onChange=${() => toggleDim(k, v)}>${v}<//>`)}</div></details>`)}</div>
  </div>`;
}

export function QuestionBank() {
  useStore();
  const [q, setQ] = useState('');
  const [copy, setCopy] = useState(null);
  const rows = store.d.assessments.flatMap((a) => a.questions.map((qq) => ({ a, q: qq }))).filter(({ q: x, a }) => !q || (x.text + a.title).toLowerCase().includes(q.toLowerCase()));
  const targets = store.d.assessments.filter((a) => !store.d.submissions.some((s) => s.assessmentId === a.id && Object.keys(s.scores || {}).length));
  const doCopy = (to) => {
    store.mutate((d) => { const ta = d.assessments.find((x) => x.id === to); ta.questions.push({ ...JSON.parse(JSON.stringify(copy.q)), id: uid('q'), no: ta.questions.length + 1, indicators: [] }); });
    toast('Soal disalin. Petakan ulang indikatornya di asesmen tujuan.'); setCopy(null);
  };
  return html`<div><${PageHeader} title="Bank Soal" sub="Semua soal dari asesmen Anda. Salin soal untuk dipakai ulang." demo=${store.isDemoData()} />
    <div class="row mb"><div style=${{ width: '300px' }}><${Input} placeholder="Cari soal / asesmen…" value=${q} onChange=${setQ} /></div><span class="muted sm">${rows.length} soal</span></div>
    ${rows.length === 0 ? html`<${Card}><${Empty} icon="layers" title="Bank soal kosong" text="Soal yang Anda buat pada asesmen akan muncul di sini." /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Asesmen</th><th>No.</th><th>Soal</th><th class="num">Skor maks</th><th>Dimensi</th><th></th></tr></thead><tbody>${rows.map(({ a, q: x }) => html`<tr><td class="sm">${a.title}</td><td>${x.no}</td><td style=${{ maxWidth: '380px' }}>${x.text}</td><td class="num">${fmt(x.maxScore)}</td><td class="sm">${[...Object.values(x.dims || {}).flat()].slice(0, 3).join(', ') || '—'}</td><td class="right"><${Btn} size="sm" icon="copy" onClick=${() => setCopy({ a, q: x })}>Salin ke…<//></td></tr>`)}</tbody></table></div>`}
    ${copy && html`<${Modal} title="Salin soal ke asesmen" onClose=${() => setCopy(null)}><p class="mb muted">Hanya asesmen yang belum memiliki skor siswa yang ditampilkan, agar nilai historis tidak berubah.</p>
      ${targets.length ? html`<ul class="list">${targets.map((t) => html`<li><span>${t.title} <span class="muted sm">· ${className(t.classId)}</span></span><${Btn} size="sm" variant="primary" onClick=${() => doCopy(t.id)}>Pilih<//></li>`)}</ul>` : html`<${Empty} title="Tidak ada asesmen tujuan" text="Buat asesmen baru terlebih dahulu." />`}<//>`}</div>`;
}
