import { html, go, Icon, Btn, Card, Badge, Notice, Empty, AutoField, toast, download, downloadPdf } from './ui.js';
import { store, auth } from './lib-store.js';
import { fmt, fmtSigned, fmtDate, isNum, computeResult, resolveKkm, indicatorAnalysis, indicatorsOf, toCsv, COMPLETION_LABEL, STATE_LABEL } from './lib-core.js';
import * as N from './lib-narrative.js';
import { factsFrom, autoTexts } from './lib-phrases.js';
import { className, settingsNow, TYPE_LABEL, LEARN_STATUS } from './page-common.js';

const lines = (t) => String(t || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

/** Data laporan individual dihitung dari objek data `d` (aman dipakai juga untuk tautan laporan). */
export function buildIndividual(d, a, st, settings) {
  const cls = d.classes.find((c) => c.id === a.classId);
  const kk = resolveKkm(a, cls, settings);
  const sub = d.submissions.find((s) => s.assessmentId === a.id && s.studentId === st.id);
  const r = computeResult(a, sub, kk);
  const students = d.students.filter((s) => s.classId === a.classId && s.active !== false);
  const ia = indicatorAnalysis(a, indicatorsOf(d, a), d.submissions, students, kk.value).map((x) => ({ ...x, mine: x.per?.find((p) => p.studentId === st.id)?.pct ?? null }));
  const strengths = ia.filter((x) => x.mine !== null && x.threshold !== null && x.mine >= x.threshold);
  const areas = ia.filter((x) => x.mine !== null && x.threshold !== null && x.mine < x.threshold);
  return { cls, kk, sub, r, ia, strengths, areas, learning: d.learning.find((l) => l.id === a.learningId) };
}

function Ring({ value, tone }) {
  const R = 58; const C = 2 * Math.PI * R; const v = Math.max(0, Math.min(100, value ?? 0));
  const col = { ok: '#10B981', bad: '#EF4444', warn: '#F59E0B' }[tone] || '#94A3B8';
  return html`<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label=${`Nilai akhir ${value ?? '-'}`}>
    <circle cx="70" cy="70" r=${R} fill="none" stroke="#E2E8F0" stroke-width="14" />
    <circle cx="70" cy="70" r=${R} fill="none" stroke=${col} stroke-width="14" stroke-linecap="round" stroke-dasharray=${`${(v / 100) * C} ${C}`} transform="rotate(-90 70 70)" />
    <text x="70" y="72" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="38" fill="#102A56">${value === null || value === undefined ? '—' : fmt(value, 1)}</text>
    <text x="70" y="94" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="#64748B">NILAI AKHIR</text></svg>`;
}
const Sec = ({ title, color = '#2563EB', children, avoid = true }) => html`<section class=${avoid ? 'rp-avoid' : ''}><h2 class="rp-h"><i style=${{ background: color }}></i>${title}</h2>${children}</section>`;
const Paras = ({ list }) => list.map((p) => html`<p class="rp-p">${p}</p>`);
const toneOf = (t) => (t === 'ok' ? 'green' : t === 'bad' ? 'amber' : 'gray');

/** Laporan untuk siswa dan orang tua. Bahasa sederhana; rincian teknis ada pada panel guru. */
export function IndividualReport({ d, a, st, teacher, settings }) {
  const b = buildIndividual(d, a, st, settings);
  const { r, sub, kk } = b;
  const f = factsFrom({ a, st, b });
  const status = N.statusText(r);
  const ind = (id) => d.indicators.find((i) => i.id === id);
  const tone = status.tone;
  const mastered = N.masteredText(f);
  const train = sub?.areaText ? { paragraphs: lines(sub.areaText), items: N.trainText(f).items } : N.trainText(f);
  const noteParas = sub?.note ? lines(sub.note) : N.autoTeacherNote(f);
  const recParas = sub?.recommendation ? lines(sub.recommendation) : N.autoRecommendation(f);
  return html`<article class="rp" id="report-doc">
    <header class="rp-hero"><div class="rp-deco a"></div><div class="rp-deco b"></div>
      <div class="rp-top"><span class="rp-brand"><i>∑</i>MathLens</span>${teacher?.demo && html`<span class="rp-demo">Data Demo</span>`}</div>
      <div class="rp-kicker">LAPORAN HASIL BELAJAR MATEMATIKA</div>
      <div class="rp-name">${st.name}</div>
      <div class="rp-chips"><span>Kelas ${b.cls?.name || '—'}</span><span>${f.topic}</span><span>${TYPE_LABEL[a.type]} · ${fmtDate(a.date)}</span></div></header>
    <div class="rp-body">
      <${Sec} title="Ringkasan Hasil Belajar" color="#3B82F6"><div class="rp-score">
        <div class="rp-ring"><${Ring} value=${r.final} tone=${tone} /></div>
        <div class="rp-stats">
          <div><b>${r.state === 'lengkap' ? fmt(r.displayTotal) : '—'}<small> / ${fmt(r.displayMax)}</small></b><span>Skor yang diperoleh</span></div>
          <div><b>${r.kkm === null ? '—' : fmt(r.kkm)}</b><span>KKM</span></div>
          <div><b class=${r.diff === null ? '' : r.diff >= 0 ? 'hl-ok' : 'hl-bad'}>${r.diff === null ? '—' : fmtSigned(r.diff)}</b><span>Selisih dari KKM</span></div></div></div>
        <p class="rp-p">${N.summaryText({ r, topic: f.topic, assessment: a.title })}</p><//>
      <${Sec} title="Status Ketuntasan" color="#8B5CF6"><div class=${'rp-verdict ' + tone}><div class="rp-vic"><${Icon} n=${tone === 'ok' ? 'check' : 'info'} size=${26} /></div><div><div class="rp-vb">${status.label}</div><p class="rp-vp">${status.text}</p></div></div>
        <div class="rp-meta"><span>Nilai akhir <b>${r.final === null ? '—' : fmt(r.final)}</b></span><span>KKM <b>${r.kkm === null ? '—' : fmt(r.kkm)}</b></span><span>Sumber KKM <b>${kk.source}</b></span></div><//>
      <${Sec} title="Hasil pada Setiap Soal" color="#2563EB" avoid=${false}><div class="rp-tw"><table class="rp-table"><thead><tr><th>Nomor</th><th>Kemampuan yang Dinilai</th><th class="num">Skor yang Diperoleh</th><th class="num">Skor Maksimal</th><th>Catatan untuk Siswa</th></tr></thead><tbody>${a.questions.map((q) => {
        const v = sub?.scores?.[q.id]; const has = isNum(v);
        const names = q.indicators.map((m) => ind(m.indicatorId)?.name).filter(Boolean);
        const note = sub?.feedback?.[q.id] ? lines(sub.feedback[q.id]) : N.questionNote({ score: has ? v : null, max: q.maxScore, names, hasRubric: !!(q.rubric && q.rubric.trim()) });
        return html`<tr class="rp-avoid"><td class="c">${q.no}</td><td>${names.length ? names.join('; ') : html`<span class="muted">Kemampuan belum dipetakan oleh guru</span>`}</td><td class="num"><b>${has ? fmt(v) : 'Belum dinilai'}</b></td><td class="num">${fmt(q.maxScore)}</td><td class="note">${note.map((p) => html`<p>${p}</p>`)}</td></tr>`; })}</tbody></table></div><//>
      <${Sec} title="Perkembangan Kemampuan Belajar" color="#10B981" avoid=${false}>${b.ia.length === 0 ? html`<p class="rp-p">Pembelajaran ini belum memiliki indikator yang dapat ditampilkan, sehingga guru perlu menambahkan indikator dan memetakannya ke soal sebelum perkembangan kemampuan dapat dijelaskan dengan lebih lengkap dan akurat.</p>` : html`<div class="rp-inds">${b.ia.map((x) => {
        const t = N.indicatorText({ name: x.indicator.name, mine: x.mine ?? null, thr: x.threshold ?? null, status: x.status });
        const ok = x.status === 'ok' && x.mine !== null; const thr = x.threshold;
        const explain = sub?.indRemark?.[x.indicator.id] ? lines(sub.indRemark[x.indicator.id]) : [t.explain];
        return html`<div class="rp-ind rp-avoid"><div class="rp-itop"><span><b>${x.indicator.code}</b> ${x.indicator.name}</span><em class=${'pill ' + toneOf(t.tone)}>${t.label}</em></div>
          <div class="rp-bar2"><span class=${t.tone === 'bad' ? 'low' : ''} style=${{ width: (ok ? x.mine : 0) + '%' }}></span>${thr !== null && thr !== undefined ? html`<i style=${{ left: thr + '%' }} title=${'KKM ' + fmt(thr)}></i>` : ''}</div>
          <div class="rp-ival"><span>Capaian <b>${ok ? fmt(x.mine) + '%' : 'belum tersedia'}</b></span><span>Target (KKM) <b>${thr === null || thr === undefined ? 'belum ditetapkan' : fmt(thr) + '%'}</b></span></div>
          ${explain.map((p) => html`<p class="rp-p">${p}</p>`)}<p class="rp-p adv"><b>Saran:</b> ${t.advice}</p></div>`; })}</div>`}<//>
      <${Sec} title="Hal yang Sudah Kamu Kuasai" color="#10B981"><${Paras} list=${mastered.paragraphs} />${mastered.items.length ? html`<ul class="rp-tags">${mastered.items.map((s) => html`<li>${s}</li>`)}</ul>` : ''}<//>
      <${Sec} title="Hal yang Perlu Terus Dilatih" color="#F59E0B"><${Paras} list=${train.paragraphs} />${train.items.length ? html`<ul class="rp-tags warn">${train.items.map((s) => html`<li>${s}</li>`)}</ul>` : ''}<//>
      <${Sec} title="Catatan Guru" color="#8B5CF6"><div class="rp-quote">${noteParas.map((p) => html`<p>${p}</p>`)}${teacher?.name ? html`<div class="rp-sign">— ${teacher.name}</div>` : ''}</div>${!sub?.note && html`<p class="rp-note">Catatan ini disusun otomatis dan dapat diganti guru dengan catatan pribadi.</p>`}<//>
      <${Sec} title="Langkah Belajar Berikutnya" color="#F59E0B"><ul class="rp-rec">${recParas.map((s) => html`<li><i><${Icon} n="check" size=${13} /></i><span>${s}</span></li>`)}</ul>${!sub?.recommendation && html`<p class="rp-note">Langkah ini disusun otomatis dari hasil penilaian dan dapat disesuaikan oleh guru.</p>`}<//>
    </div>
    <footer class="rp-foot"><span>Dibuat dengan MathLens · ${fmtDate(new Date())}</span><span>${[teacher?.name, teacher?.school].filter(Boolean).join(' · ')}</span></footer>
  </article>`;
}

const patchSub = (aid, sid, fn) => store.mutate((d) => {
  let s = d.submissions.find((x) => x.assessmentId === aid && x.studentId === sid);
  if (!s) { s = { id: 'sub_' + aid + '_' + sid, assessmentId: aid, studentId: sid, scores: {}, ind: {}, feedback: {}, note: '', docs: [] }; d.submissions.push(s); }
  fn(s);
});

/** Panel guru: rincian teknis, pilihan kalimat, penghitung kata, dan penandaan versi final. */
function Customizer({ a, st, b }) {
  const auto = autoTexts({ a, st, b });
  const sid = st.id; const sub = b.sub;
  const noRubric = a.questions.filter((q) => !(q.rubric && q.rubric.trim()));
  const unavailable = b.ia.filter((x) => x.status === 'tidak_tersedia');
  return html`<div class="stack mt no-print">
    <${Card} title="Rincian perhitungan (khusus guru)" action=${sub?.reportFinal ? html`<${Badge} kind="green">Versi final disimpan<//>` : html`<${Badge}>Belum final<//>`}>
      ${b.r.steps ? html`<ol class="rp-steps">${b.r.steps.map((s) => html`<li>${s}</li>`)}</ol>` : html`<p class="muted">Rincian tersedia setelah seluruh soal dinilai.</p>`}
      <p class="rp-note">${b.r.explanation}</p>
      ${noRubric.length ? html`<div class="mt"><${Notice} kind="warn" title="Rubrik belum diisi">Soal nomor ${noRubric.map((q) => q.no).join(', ')} belum memiliki rubrik, sehingga umpan balik otomatis dibuat berhati-hati dan tidak menyebut penyebab kesalahan. Lengkapi rubrik di menu Soal & Asesmen.<//></div>` : ''}
      ${unavailable.length ? html`<div class="mt"><${Notice} kind="warn" title="Capaian indikator belum dapat dihitung">${unavailable.map((x) => x.indicator.code).join(', ')}: soal mengukur beberapa indikator tanpa skor terpisah. Persentase tidak dibuat berdasarkan dugaan.<//></div>` : ''}
      <div class="row mt"><${Btn} variant=${sub?.reportFinal ? 'secondary' : 'primary'} icon="check" onClick=${() => { patchSub(a.id, sid, (s) => { s.reportFinal = !s.reportFinal; s.reportFinalAt = new Date().toISOString(); }); toast(sub?.reportFinal ? 'Penanda final dicabut.' : 'Versi final disimpan. Teks yang Anda tulis dipakai apa adanya pada laporan.'); }}>${sub?.reportFinal ? 'Cabut penanda final' : 'Simpan sebagai versi final'}<//><span class="muted sm">Pratinjau laporan ada di atas; perubahan langsung terlihat di sana.</span></div><//>
    <${Card} title="Sesuaikan isi laporan" action=${html`<${Badge} kind="blue">Terisi otomatis dari nilai siswa<//>`}>
      <div class="stack">
        <${Notice}>Semua bagian di bawah sudah terisi otomatis sesuai nilai, indikator, dan tujuan pembelajaran siswa ini, dengan kalimat penjelas minimal ${N.MIN_WORDS} kata. Anda boleh menyuntingnya; teks hasil suntingan Anda tidak pernah ditimpa dan dipakai apa adanya pada laporan.<//>
        <${AutoField} key=${sid + 'note' + auto.note.length} label="Catatan guru" rows=${4} auto=${auto.note} value=${sub?.note || ''} onSave=${(v) => patchSub(a.id, sid, (s) => { s.note = v; })} />
        <${AutoField} key=${sid + 'area' + auto.area.length} label="Hal yang perlu terus dilatih" rows=${4} auto=${auto.area} value=${sub?.areaText || ''} onSave=${(v) => patchSub(a.id, sid, (s) => { s.areaText = v; })} />
        <${AutoField} key=${sid + 'rec' + auto.rec.length} label="Langkah belajar berikutnya" rows=${4} auto=${auto.rec} value=${sub?.recommendation || ''} onSave=${(v) => patchSub(a.id, sid, (s) => { s.recommendation = v; })} />
        ${b.ia.filter((x) => x.status === 'ok').length ? html`<div><b>Penjelasan per indikator</b><div class="stack mt">${b.ia.filter((x) => x.status === 'ok').map((x) => html`<${AutoField} key=${sid + x.indicator.id + auto.indicator[x.indicator.id].length} label=${`${x.indicator.code} · ${x.indicator.name}`} rows=${3} auto=${auto.indicator[x.indicator.id]} value=${sub?.indRemark?.[x.indicator.id] || ''} onSave=${(v) => patchSub(a.id, sid, (s) => { s.indRemark = { ...(s.indRemark || {}), [x.indicator.id]: v }; })} />`)}</div></div>` : ''}
        <div><b>Catatan untuk siswa pada setiap soal</b><div class="stack mt">${a.questions.map((q) => html`<${AutoField} key=${sid + q.id + auto.question(q).length} label=${`Soal ${q.no}`} rows=${3} auto=${auto.question(q)} value=${sub?.feedback?.[q.id] || ''} onSave=${(v) => patchSub(a.id, sid, (s) => { s.feedback = { ...(s.feedback || {}), [q.id]: v }; })} />`)}</div></div>
      </div><//></div>`;
}

export function ReportView({ params }) {
  const a = store.d.assessments.find((x) => x.id === params.aid);
  const st = store.d.students.find((x) => x.id === params.sid);
  if (!a || !st) return html`<${Card}><${Empty} title="Laporan tidak ditemukan" action=${html`<${Btn} onClick=${() => go('/app/laporan')}>Kembali<//>`} /><//>`;
  const teacher = auth.user() || {};
  const b = buildIndividual(store.d, a, st, settingsNow());
  const fname = `Laporan-${st.name.replace(/\s+/g, '-')}-${a.title.replace(/[^\w]+/g, '-')}.pdf`;
  const csv = () => download(`laporan-${st.code}-${a.title.replace(/\W+/g, '-')}.csv`, toCsv([['Siswa', st.name], ['Kelas', className(a.classId)], ['Asesmen', a.title], [], ['No', 'Skor', 'Skor maks'], ...a.questions.map((q) => [q.no, isNum(b.sub?.scores?.[q.id]) ? b.sub.scores[q.id] : '', q.maxScore]), [], ['Total skor', b.r.state === 'lengkap' ? b.r.displayTotal : ''], ['Skor maks', b.r.displayMax], ['Nilai akhir', b.r.final ?? ''], ['KKM', b.r.kkm ?? ''], ['Selisih', b.r.diff ?? ''], ['Status', b.r.completion ? COMPLETION_LABEL[b.r.completion] : STATE_LABEL[b.r.state]]]));
  return html`<div><div class="row no-print mb"><${Btn} variant="ghost" onClick=${() => go('/app/laporan?kelas=' + a.classId + '&asesmen=' + a.id)}>← Kembali<//><span class="grow"></span>
    <${Btn} icon="printer" onClick=${() => window.print()}>Cetak<//><${Btn} variant="primary" icon="download" onClick=${() => downloadPdf('#report-doc', fname)}>Unduh PDF<//><${Btn} icon="download" onClick=${csv}>CSV<//><${Btn} icon="send" onClick=${() => go(`/app/kirim?asesmen=${a.id}&siswa=${st.id}`)}>Kirim Laporan<//></div>
    <${IndividualReport} d=${store.d} a=${a} st=${st} teacher=${teacher} settings=${settingsNow()} />
    <${Customizer} a=${a} st=${st} b=${b} /></div>`;
}