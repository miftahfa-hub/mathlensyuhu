import { html, useState, useStore, go, Icon, Btn, Card, Badge, Empty, Notice, Field, Select, Input, Textarea, PageHeader, Tabs, Chart, toast, download, downloadPdf } from './ui.js';
import { store, auth } from './lib-store.js';
import { fmt, fmtSigned, fmtDate, isNum, round, computeResult, resolveKkm, classStats, indicatorAnalysis, toCsv, COMPLETION_LABEL, STATE_LABEL, mean, median } from './lib-core.js';
import { classOpts, className, classById, studentsOf, statsFor, analysisFor, resultFor, settingsNow, kkmWord, completionBadge, TYPE_LABEL, LEARN_STATUS } from './page-common.js';
export { buildIndividual, IndividualReport, ReportView } from './page-report-doc.js';

const pdfName = (t) => `${t.replace(/[^\w]+/g, '-')}.pdf`;

function RpHead({ kicker, title, chips }) {
  return html`<header class="rp-hero"><div class="rp-deco a"></div><div class="rp-deco b"></div>
    <div class="rp-top"><span class="rp-brand"><i>∑</i>MathLens</span>${store.isDemoData() && html`<span class="rp-demo">Data Demo</span>`}</div>
    <div class="rp-kicker">${kicker}</div><div class="rp-name">${title}</div><div class="rp-chips">${chips.map((c) => html`<span>${c}</span>`)}</div></header>`;
}

function ClassReport({ a }) {
  const s = statsFor(a); const cls = classById(a.classId);
  const learning = store.d.learning.find((l) => l.id === a.learningId);
  const ia = analysisFor(a);
  const weak = ia.filter((x) => x.status === 'ok' && x.threshold !== null && x.avg < x.threshold);
  return html`<article class="rp" id="report-doc">
    <${RpHead} kicker="LAPORAN KELAS" title=${a.title} chips=${[`Kelas ${cls?.name}`, learning?.topic || a.title, `${TYPE_LABEL[a.type]} · ${fmtDate(a.date)}`]} />
    <div class="rp-body">
      <dl class="rp-kv"><dt>Jumlah siswa</dt><dd>${s.nStudents}</dd><dt>Sudah dinilai lengkap</dt><dd>${s.nValid} siswa (parsial ${s.nPartial}, belum dinilai ${s.nNotGraded})</dd><dt>KKM</dt><dd>${s.kkm.value === null ? '—' : fmt(s.kkm.value)} · ${s.kkm.source}</dd></dl>
      ${s.nValid === 0 ? html`<${Notice} kind="warn">Belum ada data penilaian.<//>` : html`
        <section class="rp-avoid"><div class="rp-stats4"><div><b>${fmt(s.mean)}</b><span>Rata-rata</span></div><div><b class="hl-ok">${s.tuntas}</b><span>Tuntas</span></div><div><b class="hl-bad">${s.belum}</b><span>Belum tuntas</span></div><div><b>${s.pct}%</b><span>Ketuntasan kelas</span></div></div>
        <p class="rp-note">Ketuntasan kelas = ${s.tuntas} ÷ ${s.tuntas + s.belum} siswa bernilai valid × 100%. Siswa yang belum dinilai tidak dihitung belum tuntas.</p></section>
        <section class="rp-avoid"><h2 class="rp-h"><i style=${{ background: '#3B82F6' }}></i>Distribusi nilai</h2><${Chart} data=${{ labels: s.bins.map((b) => b.label), datasets: [{ label: 'Siswa', data: s.bins.map((b) => b.count), backgroundColor: s.bins.map((b, i) => (i * 10 >= (s.kkm.value ?? 101) ? '#10B981' : '#93C5FD')), borderRadius: 6 }] }} options=${{ scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} height=${200} /></section>
        <section class="rp-avoid"><h2 class="rp-h"><i style=${{ background: '#10B981' }}></i>Ketercapaian indikator</h2><div class="rp-inds">${ia.map((x) => html`<div class="rp-ind"><div class="rp-itop"><span><b>${x.indicator.code}</b> ${x.indicator.name}</span>${x.status === 'ok' ? (x.threshold === null ? html`<em class="pill gray">${fmt(x.avg)}%</em>` : html`<em class=${'pill ' + (x.avg >= x.threshold ? 'green' : 'red')}>${x.avg >= x.threshold ? 'Di atas KKM' : 'Di bawah KKM'}</em>`) : html`<em class="pill gray">Belum dapat dihitung</em>`}</div>
          ${x.status === 'ok' ? html`<div class="rp-bar2"><span class=${x.threshold !== null && x.avg < x.threshold ? 'low' : ''} style=${{ width: x.avg + '%' }}></span>${x.threshold !== null ? html`<i style=${{ left: x.threshold + '%' }}></i>` : ''}</div><div class="rp-ival"><b>${fmt(x.avg)}%</b><span>${x.share !== null ? `${x.share}% siswa mencapai KKM` : ''}</span></div>` : html`<div class="rp-irem">${x.reason}</div>`}</div>`)}</div></section>
        <div class="rp-two rp-avoid"><section class="rp-card warn"><h2 class="rp-h"><i style=${{ background: '#F59E0B' }}></i>Siswa belum mencapai KKM</h2>${s.belum ? html`<ul>${s.rows.filter((r) => r.result.completion === 'belum_tuntas').map((r) => html`<li>${r.student.name} (${fmt(r.result.final)})</li>`)}</ul>` : html`<p class="muted">Tidak ada.</p>`}</section>
          <section class="rp-card good"><h2 class="rp-h"><i style=${{ background: '#10B981' }}></i>Rekomendasi kelas</h2><ul>${weak.length ? html`<li>Penguatan kelas pada indikator ${weak.map((x) => x.indicator.code).join(', ')}.</li>` : html`<li>Tidak ada indikator dengan rata-rata di bawah KKM.</li>`}${s.belum ? html`<li>Pendampingan atau remedial bagi ${s.belum} siswa yang belum tuntas.</li>` : ''}</ul></section></div>`}
    </div>
    <footer class="rp-foot"><span>Dibuat dengan MathLens · ${fmtDate(new Date())}</span><span></span></footer>
  </article>`;
}

function MeetingReport({ l }) {
  const asses = store.d.assessments.filter((a) => a.learningId === l.id);
  const inds = store.d.indicators.filter((i) => i.learningId === l.id);
  const done = l.status === 'selesai';
  const row = (k, v) => (v ? html`<dt>${k}</dt><dd>${v}</dd>` : '');
  const Sec = (title, color, body) => html`<section class="rp-avoid"><h2 class="rp-h"><i style=${{ background: color }}></i>${title}</h2>${body}</section>`;
  const empty = html`<p class="muted">Belum dicatat.</p>`;
  return html`<article class="rp" id="report-doc">
    <${RpHead} kicker="LAPORAN PERTEMUAN" title=${l.title} chips=${[`Kelas ${className(l.classId)}`, `Pertemuan ${l.meeting}`, fmtDate(l.date)]} />
    <div class="rp-body">
      ${!done && html`<${Notice} kind="warn" title=${`Status: ${LEARN_STATUS[l.status]?.[0]}`}>Ini adalah rencana atau catatan awal, belum dicatat sebagai pembelajaran yang terlaksana.<//>`}
      ${Sec('Identitas', '#3B82F6', html`<dl class="rp-kv">${row('Alokasi waktu', l.duration)}${row('Materi', l.topic + (l.subtopic ? ' — ' + l.subtopic : ''))}${row('Capaian Pembelajaran', l.cp)}${row('Prasyarat', l.prerequisites)}</dl>`)}
      ${Sec('Tujuan pembelajaran', '#2563EB', html`<p>${l.objectives || empty}</p>`)}
      ${Sec('Aktivitas yang dicatat guru', '#8B5CF6', (l.opening || l.core || l.closing || l.model || l.method) ? html`<dl class="rp-kv">${row('Model', l.model)}${row('Metode', l.method)}${row('Media', l.media)}${row('Pendahuluan', l.opening)}${row('Inti', l.core)}${row('Penutup', l.closing)}</dl>` : html`<p class="muted">Aktivitas belum dicatat.</p>`)}
      ${Sec('Indikator yang diukur', '#10B981', inds.length ? html`<ul class="rp-rec">${inds.map((i) => html`<li><i><${Icon} n="target" size=${13} /></i><span><b>${i.code}</b> ${i.name}</span></li>`)}</ul>` : html`<p class="muted">Belum ada indikator.</p>`)}
      ${Sec('Asesmen dan hasil', '#F59E0B', asses.length ? asses.map((a) => { const s = statsFor(a); return html`<div class="rp-ind"><div class="rp-itop"><span><b>${a.title}</b> (${TYPE_LABEL[a.type]})</span>${s.nValid ? html`<em class=${'pill ' + (s.pct >= 75 ? 'green' : 'red')}>${s.pct}% tuntas</em>` : html`<em class="pill gray">Belum ada data</em>`}</div><div class="rp-irem">${s.nValid ? `Rata-rata ${fmt(s.mean)}; ${s.tuntas} tuntas, ${s.belum} belum tuntas; KKM ${fmt(s.kkm.value)}.` : 'Belum ada data penilaian.'}</div></div>`; }) : html`<p class="muted">Belum ada asesmen.</p>`)}
      <div class="rp-two rp-avoid"><section class="rp-card good"><h2 class="rp-h"><i style=${{ background: '#10B981' }}></i>Refleksi guru</h2><p>${l.reflection || empty}</p>${l.obstacles ? html`<p><b>Kendala:</b> ${l.obstacles}</p>` : ''}</section>
        <section class="rp-card warn"><h2 class="rp-h"><i style=${{ background: '#F59E0B' }}></i>Rencana perbaikan</h2><p>${l.followUp || empty}</p></section></div>
    </div>
    <footer class="rp-foot"><span>Dibuat dengan MathLens · ${fmtDate(new Date())}</span><span></span></footer></article>`;
}

function ProgressReport({ cid, sid }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const list = store.d.assessments.filter((a) => a.classId === cid && (!from || a.date >= from) && (!to || a.date <= to)).sort((x, y) => x.date.localeCompare(y.date));
  const pts = list.map((a) => (sid ? { a, v: resultFor(a, sid).result.final } : { a, v: statsFor(a).mean })).filter((p) => p.v !== null);
  const mixed = new Set(pts.map((p) => p.a.type)).size > 1 || new Set(pts.map((p) => p.a.learningId)).size > 1;
  const who = sid ? store.d.students.find((s) => s.id === sid)?.name : 'Kelas ' + className(cid);
  return html`<article class="rp" id="report-doc">
    <${RpHead} kicker="LAPORAN PERKEMBANGAN" title=${who} chips=${[`Kelas ${className(cid)}`, `${pts.length} asesmen`]} />
    <div class="rp-body">
      <div class="row no-print"><${Field} label="Dari"><${Input} type="date" value=${from} onChange=${setFrom} /><//><${Field} label="Sampai"><${Input} type="date" value=${to} onChange=${setTo} /><//></div>
      ${pts.length < 2 ? html`<${Notice} kind="warn">Perlu minimal dua asesmen dengan nilai valid pada rentang ini.<//>` : html`<section class="rp-avoid"><${Chart} type="line" data=${{ labels: pts.map((p) => fmtDate(p.a.date)), datasets: [{ label: sid ? 'Nilai akhir' : 'Rata-rata kelas', data: pts.map((p) => round(p.v)), borderColor: '#2563EB', backgroundColor: '#2563EB', tension: 0.25 }] }} options=${{ scales: { y: { min: 0, max: 100 } } }} height=${240} /></section>
        ${mixed && html`<${Notice} kind="warn" title="Kesebandingan terbatas">Asesmen pada rentang ini berbeda jenis atau materi, sehingga indikator, rubrik, dan tingkat kesulitan tidak identik. Tafsirkan tren dengan hati-hati.<//>`}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Asesmen</th><th>Jenis</th><th class="num">${sid ? 'Nilai akhir' : 'Rata-rata'}</th></tr></thead><tbody>${pts.map((p) => html`<tr><td>${fmtDate(p.a.date)}</td><td>${p.a.title}</td><td>${TYPE_LABEL[p.a.type]}</td><td class="num">${fmt(p.v)}</td></tr>`)}</tbody></table></div>`}
    </div>
    <footer class="rp-foot"><span>Dibuat dengan MathLens · ${fmtDate(new Date())}</span><span></span></footer></article>`;
}

export function ReportsPage({ query }) {
  useStore();
  const d = store.d;
  const [tab, setTab] = useState(query.tab || 'individual');
  const [cid, setCid] = useState(query.kelas || d.classes.find((c) => !c.archived)?.id || '');
  const classAs = d.assessments.filter((a) => a.classId === cid);
  const [aid, setAid] = useState(query.asesmen || '');
  const a = classAs.find((x) => x.id === aid) || classAs[0];
  const [lid, setLid] = useState(query.pertemuan || '');
  const [sid, setSid] = useState(query.siswa || '');
  const l = d.learning.find((x) => x.id === lid) || d.learning.filter((x) => x.classId === cid)[0];
  const csv = () => {
    const s = statsFor(a);
    download(`laporan-kelas-${a.title.replace(/\W+/g, '-')}.csv`, toCsv([['No', 'Nama', 'Kode', ...a.questions.map((q) => `Soal ${q.no} (maks ${q.maxScore})`), 'Total skor', 'Skor maks', 'Nilai akhir', kkmWord(), 'Selisih', 'Status'], ...s.rows.map((r, i) => [i + 1, r.student.name, r.student.code, ...a.questions.map((q) => (isNum(r.sub?.scores?.[q.id]) ? r.sub.scores[q.id] : '')), r.result.state === 'kosong' ? '' : r.result.total, r.result.displayMax, r.result.final ?? '', r.result.kkm ?? '', r.result.diff ?? '', r.result.completion ? COMPLETION_LABEL[r.result.completion] : STATE_LABEL[r.result.state]])]), 'text/csv;charset=utf-8');
  };
  return html`<div><${PageHeader} title="Laporan" sub="Laporan dibuat dari data yang sama dengan penilaian dan analisis." demo=${store.isDemoData()} />
    <div class="row mb"><${Tabs} tabs=${[['individual', 'Individual'], ['kelas', 'Kelas'], ['pertemuan', 'Per Pertemuan'], ['perkembangan', 'Perkembangan']]} value=${tab} onChange=${setTab} /></div>
    <div class="row mb no-print"><div style=${{ width: '220px' }}><${Select} value=${cid} onChange=${(v) => { setCid(v); setAid(''); setLid(''); setSid(''); }} options=${classOpts(true)} placeholder="Pilih kelas" /></div>
      ${(tab === 'individual' || tab === 'kelas') && html`<div style=${{ width: '340px', maxWidth: '100%' }}><${Select} value=${a?.id || ''} onChange=${setAid} options=${classAs.map((x) => [x.id, x.title])} placeholder="Pilih asesmen" /></div>`}
      ${tab === 'pertemuan' && html`<div style=${{ width: '340px', maxWidth: '100%' }}><${Select} value=${l?.id || ''} onChange=${setLid} options=${d.learning.filter((x) => x.classId === cid).map((x) => [x.id, x.title])} placeholder="Pilih pembelajaran" /></div>`}
      ${tab === 'perkembangan' && html`<div style=${{ width: '260px' }}><${Select} value=${sid} onChange=${setSid} options=${studentsOf(cid).map((x) => [x.id, x.name])} placeholder="Seluruh kelas" /></div>`}
      <span class="grow"></span>${(tab === 'kelas' || tab === 'pertemuan' || tab === 'perkembangan') && html`<${Btn} icon="printer" onClick=${() => window.print()}>Cetak<//><${Btn} variant="primary" icon="download" onClick=${() => downloadPdf('#report-doc', pdfName(`Laporan-${tab}-${className(cid)}`))}>Unduh PDF<//>`}${tab === 'kelas' && a && html`<${Btn} icon="download" onClick=${csv}>CSV<//>`}</div>
    ${!cid ? html`<${Card}><${Empty} icon="file" title="Pilih kelas" /><//>`
      : tab === 'individual' ? (!a ? html`<${Card}><${Empty} icon="file" title="Belum ada asesmen di kelas ini" /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th class="num">Nilai akhir</th><th class="num">${kkmWord()}</th><th>Status</th><th></th></tr></thead><tbody>${statsFor(a).rows.map(({ student, result: r }) => html`<tr style=${query.siswa === student.id ? { background: '#eff6ff' } : {}}><td><b>${student.name}</b></td><td class="num">${r.final === null ? '—' : fmt(r.final)}</td><td class="num">${r.kkm === null ? '—' : fmt(r.kkm)}</td><td>${completionBadge(r)}</td><td class="right"><${Btn} size="sm" icon="eye" onClick=${() => go(`/app/laporan/${a.id}/${student.id}`)}>Lihat / PDF<//><${Btn} size="sm" icon="send" onClick=${() => go(`/app/kirim?asesmen=${a.id}&siswa=${student.id}`)}>Kirim<//></td></tr>`)}</tbody></table></div>`)
      : tab === 'kelas' ? (a ? html`<${ClassReport} a=${a} />` : html`<${Card}><${Empty} icon="file" title="Belum ada asesmen" /><//>`)
      : tab === 'pertemuan' ? (l ? html`<${MeetingReport} l=${l} />` : html`<${Card}><${Empty} icon="book" title="Belum ada pembelajaran di kelas ini" /><//>`)
      : html`<${ProgressReport} cid=${cid} sid=${sid} />`}
  </div>`;
}
