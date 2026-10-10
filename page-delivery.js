import { html, useState, useStore, go, Icon, Btn, Card, Badge, Empty, Notice, Modal, Field, Input, Textarea, Select, Check, PageHeader, Tabs, WordMeter, toast, confirmDialog, copyText } from './ui.js';
import { store, auth, config, integrationStatus } from './lib-store.js';
import { uid, fmt, fmtDateTime, fillTemplate, TEMPLATE_VARS, isEmail, normalizePhone, COMPLETION_LABEL, STATE_LABEL } from './lib-core.js';
import { classOpts, className, studentsOf, statsFor, resultFor, settingsNow, kkmWord, classById, learningById } from './page-common.js';

export const JOB_STATUS = {
  draft: ['Draft', 'gray'], siap_dibuka_wa: ['Siap Dibuka di WhatsApp', 'blue'], siap_dibuka_email: ['Siap Dibuka di Aplikasi Email', 'blue'], menunggu: ['Menunggu Pengiriman', 'amber'], diproses: ['Diproses', 'amber'],
  terkirim: ['Terkirim (diterima penyedia)', 'green'], terkirim_manual: ['Terkirim (dikonfirmasi guru)', 'green'], delivered: ['Delivered (dikonfirmasi penyedia)', 'green'], gagal: ['Gagal', 'red'], dibatalkan: ['Dibatalkan', 'gray'],
};
const CHANNEL = { wa_link: 'WhatsApp (tautan)', wa_api: 'WhatsApp Business', email: 'Email' };
const REPORT_KIND = { ringkasan: 'Ringkasan hasil belajar', tautan: 'Tautan aman menuju laporan', pdf: 'Laporan lengkap (PDF)', ringkasan_pdf: 'Ringkasan + lampiran PDF' };
const eligible = (c) => c && c.verified && c.consent === 'diberikan';
const templatesFor = (channel) => [...store.g.templates.filter((t) => t.channel === channel && t.isActive), ...store.d.userTemplates.filter((t) => t.channel === channel)];
const logEvent = (d, jobId, type, status, details = '') => d.deliveryLogs.push({ id: uid('dl'), jobId, type, status, at: new Date().toISOString(), details });

function stripLink(body) {
  const paras = body.split(/\n\n/);
  const out = [];
  paras.forEach((p) => { if (p.includes('{Tautan Laporan}')) { if (out.length && /[:：]\s*$/.test(out[out.length - 1].trim())) out.pop(); } else out.push(p); });
  return out.join('\n\n');
}

function buildPlan({ a, studentIds, audience, channels, kind, tplIds, user }) {
  const rows = [];
  const learning = learningById(a.learningId);
  for (const sid of studentIds) {
    const st = store.d.students.find((s) => s.id === sid);
    const { result: r } = resultFor(a, sid);
    const types = audience === 'keduanya' ? ['siswa', 'ortu'] : [audience];
    for (const type of types) {
      const contact = st.contacts.find((c) => c.type === type);
      for (const ch of channels) {
        const base = { student: st, contact, channel: ch, type, ok: false, reason: '', text: '', subject: '' };
        const chKind = ch === 'email' ? 'email' : 'whatsapp';
        if (r.state !== 'lengkap') { rows.push({ ...base, reason: `Penilaian belum lengkap (${STATE_LABEL[r.state]}).`, incomplete: true }); continue; }
        if (!contact) { rows.push({ ...base, reason: 'Kontak belum tersedia.' }); continue; }
        const addr = ch === 'email' ? contact.email : contact.phone;
        if (!addr) { rows.push({ ...base, reason: ch === 'email' ? 'Email belum diisi.' : 'Nomor WhatsApp belum diisi.' }); continue; }
        if (ch === 'email' && !isEmail(addr)) { rows.push({ ...base, reason: 'Format email tidak valid.' }); continue; }
        if (ch !== 'email' && !normalizePhone(addr)) { rows.push({ ...base, reason: 'Nomor WhatsApp tidak valid.' }); continue; }
        if (!eligible(contact)) { rows.push({ ...base, reason: 'Kontak belum dikonfirmasi/disetujui.' }); continue; }
        const tpl = templatesFor(chKind).find((t) => t.id === (tplIds[chKind + ':' + type] || '')) || templatesFor(chKind).find((t) => t.audience === type);
        if (!tpl) { rows.push({ ...base, reason: 'Tidak ada templat untuk penerima/media ini.' }); continue; }
        const body = kind === 'ringkasan' ? stripLink(tpl.body) : tpl.body;
        const vars = { 'Nama Orang Tua/Wali': type === 'ortu' ? contact.name : 'x', 'Nama Siswa': st.name, 'Nama Materi': learning?.topic || a.title, 'Nilai Akhir': fmt(r.final), KKM: r.kkm === null ? '' : fmt(r.kkm), 'Status Ketuntasan': r.completion ? COMPLETION_LABEL[r.completion] : '', 'Tautan Laporan': '[tautan-aman]', 'Nama Guru': user.name, 'Nama Sekolah': user.school };
        const t = fillTemplate(body, vars); const sub = fillTemplate(tpl.subject || '', vars);
        const miss = [...new Set([...t.missing, ...sub.missing])];
        if (miss.length) { rows.push({ ...base, reason: `Placeholder belum terisi: ${miss.map((m) => `{${m}}`).join(', ')}.` }); continue; }
        rows.push({ ...base, ok: true, addr, tpl, body, subjectTpl: tpl.subject || '', vars, text: t.text.replace('[tautan-aman]', '[tautan aman dibuat saat pengiriman]'), subject: sub.text });
      }
    }
  }
  return rows;
}

export function SendPage({ query }) {
  useStore();
  const user = auth.user();
  const integ = integrationStatus();
  const d = store.d;
  const pre = d.assessments.find((x) => x.id === query.asesmen);
  const [cid, setCid] = useState(pre?.classId || d.classes.find((c) => !c.archived)?.id || '');
  const classAs = d.assessments.filter((a) => a.classId === cid);
  const [aid, setAid] = useState(pre?.id || '');
  const a = classAs.find((x) => x.id === aid) || classAs[0];
  const [sel, setSel] = useState(query.siswa ? { [query.siswa]: true } : {});
  const [audience, setAudience] = useState('ortu');
  const [chs, setChs] = useState({ wa_link: true, email: false, wa_api: false });
  const [kind, setKind] = useState('tautan');
  const [tplIds, setTplIds] = useState({});
  const [preview, setPreview] = useState(null);
  const [edits, setEdits] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const students = a ? studentsOf(a.classId) : [];
  const stats = a ? statsFor(a) : null;
  const ids = students.filter((s) => sel[s.id]).map((s) => s.id);
  const channels = Object.keys(chs).filter((k) => chs[k]);
  const plan = a ? buildPlan({ a, studentIds: ids, audience, channels, kind, tplIds, user }) : [];
  const ok = plan.filter((p) => p.ok);
  const editedFor = (p) => edits[p.student.id + p.type + p.channel];
  const messageOf = (p) => editedFor(p) ?? p.text;

  const send = async () => {
    if (!ok.length) return;
    const go1 = await confirmDialog({ title: `Siapkan ${ok.length} pengiriman?`, confirmLabel: 'Konfirmasi', message: html`<p>${ids.length} siswa, ${ok.length} pesan akan disiapkan. ${plan.length - ok.length} dilewati (kontak/penilaian belum memenuhi syarat).</p><p>Setiap penerima hanya mendapat laporan miliknya sendiri. WhatsApp via tautan <b>tidak</b> terkirim otomatis — Anda meninjau dan menekan kirim di WhatsApp.</p>` });
    if (!go1) return;
    setBusy(true);
    const out = [];
    for (const p of ok) {
      const link = store.createLink({ assessmentId: a.id, studentId: p.student.id });
      const url = `${location.origin}${location.pathname}#/r/${link.token}`;
      const fill = (txt) => fillTemplate(txt, { ...p.vars, 'Tautan Laporan': url }).text;
      const text = editedFor(p) !== undefined ? editedFor(p).replace('[tautan aman dibuat saat pengiriman]', url) : fill(p.body);
      if (/\{[^{}]+\}/.test(text)) { out.push({ p, status: 'gagal', error: 'Masih ada placeholder yang belum terisi.' }); continue; }
      const job = { id: uid('job'), assessmentId: a.id, studentId: p.student.id, studentName: p.student.name, contactId: p.contact.id, recipientName: p.contact.name, recipientRole: p.type === 'siswa' ? 'Siswa' : 'Orang tua/wali', address: p.channel === 'email' ? p.contact.email : normalizePhone(p.contact.phone), channel: p.channel, reportKind: kind, message: text, subject: fillTemplate(p.subjectTpl, p.vars).text, linkToken: link.token, status: 'draft', createdAt: new Date().toISOString(), sentAt: null, sender: user.name, error: '' };
      if (kind === 'ringkasan') { store.revokeLink(link.token); job.linkToken = ''; }
      if (p.channel === 'wa_link') job.status = 'siap_dibuka_wa';
      else if (p.channel === 'email' && !integ.email) job.status = 'siap_dibuka_email';
      else job.status = 'menunggu';
      store.mutate((dd) => { dd.deliveries.unshift(job); logEvent(dd, job.id, 'dibuat', job.status); });
      if (job.status === 'menunggu') {
        // Pengiriman via backend resmi. Belum diuji di build ini.
        try {
          store.mutate((dd) => { const j = dd.deliveries.find((x) => x.id === job.id); j.status = 'diproses'; logEvent(dd, job.id, 'dikirim ke backend', 'diproses'); });
          const res = await fetch(`${config.apiBase}/send-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, channel: p.channel, to: job.address, subject: job.subject, message: job.message }) });
          if (!res.ok) throw new Error(`Backend menjawab ${res.status}`);
          store.mutate((dd) => { const j = dd.deliveries.find((x) => x.id === job.id); j.status = 'terkirim'; j.sentAt = new Date().toISOString(); logEvent(dd, job.id, 'diterima penyedia', 'terkirim', 'Menunggu webhook untuk status delivered.'); });
          job.status = 'terkirim';
        } catch (e) {
          store.mutate((dd) => { const j = dd.deliveries.find((x) => x.id === job.id); j.status = 'gagal'; j.error = e.message; logEvent(dd, job.id, 'gagal', 'gagal', e.message); });
          job.status = 'gagal'; job.error = e.message;
        }
      }
      out.push({ p, job, status: job.status });
    }
    plan.filter((p) => !p.ok).forEach((p) => out.push({ p, status: 'dilewati', error: p.reason }));
    setBusy(false); setResult(out); setPreview(null); setEdits({});
    store.audit('report.prepare', 'delivery', a.id, `${ok.length} pesan`);
  };

  return html`<div><${PageHeader} title="Kirim Laporan" sub="Pilih kelas → siswa → laporan → penerima → media → bentuk → pratinjau → konfirmasi." demo=${store.isDemoData()} />
    <div class="grid g2" style=${{ alignItems: 'start' }}>
    <div class="stack">
      <${Card} title="1–3. Kelas, laporan, dan siswa"><div class="stack">
        <${Field} label="Kelas"><${Select} value=${cid} onChange=${(v) => { setCid(v); setAid(''); setSel({}); setResult(null); }} options=${classOpts(true)} placeholder="Pilih kelas" /><//>
        <${Field} label="Laporan (asesmen)"><${Select} value=${a?.id || ''} onChange=${(v) => { setAid(v); setResult(null); }} options=${classAs.map((x) => [x.id, x.title])} placeholder="Pilih asesmen" /><//>
        ${a && html`<div><div class="row between"><span class="lbl">Siswa</span><span><${Btn} size="sm" variant="ghost" onClick=${() => setSel(Object.fromEntries(students.map((s) => [s.id, true])))}>Pilih semua<//><${Btn} size="sm" variant="ghost" onClick=${() => setSel({})}>Kosongkan<//></span></div>
          <div class="stack-s" style=${{ maxHeight: '300px', overflow: 'auto', marginTop: '6px' }}>${stats.rows.map(({ student, result: r }) => html`<${Check} checked=${!!sel[student.id]} onChange=${(v) => setSel({ ...sel, [student.id]: v })}>${student.name} ${r.state !== 'lengkap' ? html`<${Badge} kind="amber">${STATE_LABEL[r.state]}<//>` : html`<span class="muted sm">· ${fmt(r.final)} · ${COMPLETION_LABEL[r.completion] || ''}</span>`}<//>`)}</div></div>`}</div><//>
      <${Card} title="4–6. Penerima, media, bentuk laporan"><div class="stack">
        <${Field} label="Penerima"><${Select} value=${audience} onChange=${setAudience} options=${[['siswa', 'Siswa'], ['ortu', 'Orang tua/wali'], ['keduanya', 'Siswa dan orang tua/wali']]} /><//>
        <div class="field"><span class="lbl">Media</span>
          <${Check} checked=${chs.wa_link} onChange=${(v) => setChs({ ...chs, wa_link: v })}>WhatsApp — pesan disiapkan, <b>Anda kirim manual</b> (Share Link)<//>
          <${Check} checked=${chs.email} onChange=${(v) => setChs({ ...chs, email: v })}>Email ${integ.email ? '— otomatis via backend (belum diuji)' : html`— <b>integrasi belum aktif</b>: pesan dibuka di aplikasi email Anda untuk dikirim manual`}<//>
          <${Check} checked=${chs.wa_api} disabled=${!integ.whatsappBusiness} onChange=${(v) => setChs({ ...chs, wa_api: v })}>WhatsApp Business otomatis ${integ.whatsappBusiness ? '(belum diuji)' : html`<${Badge}>Belum aktif<//>`}<//>
          ${!integ.whatsappBusiness && html`<small>WhatsApp Business memerlukan backend dan variabel WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_WEBHOOK_VERIFY_TOKEN (lihat backend/README.md).</small>`}</div>
        <${Field} label="Bentuk laporan"><${Select} value=${kind} onChange=${setKind} options=${[['ringkasan', REPORT_KIND.ringkasan], ['tautan', REPORT_KIND.tautan], ['pdf', REPORT_KIND.pdf + ' — perlu backend'], ['ringkasan_pdf', REPORT_KIND.ringkasan_pdf + ' — perlu backend']]} /><//>
        ${(kind === 'pdf' || kind === 'ringkasan_pdf') && html`<${Notice} kind="warn">Lampiran PDF hanya dapat dikirim melalui backend; versi ini belum memilikinya. Gunakan "Tautan aman" (pemilik tautan dapat mencetak/menyimpan PDF dari halaman laporan).<//>`}
        ${['siswa', 'ortu'].flatMap((ty) => (audience === ty || audience === 'keduanya' ? ['whatsapp', 'email'].filter((c) => (c === 'whatsapp' ? chs.wa_link || chs.wa_api : chs.email)).map((c) => html`<${Field} label=${`Templat ${c === 'whatsapp' ? 'WhatsApp' : 'Email'} — ${ty === 'siswa' ? 'siswa' : 'orang tua/wali'}`}><${Select} value=${tplIds[c + ':' + ty] || templatesFor(c).find((t) => t.audience === ty)?.id || ''} onChange=${(v) => setTplIds({ ...tplIds, [c + ':' + ty]: v })} options=${templatesFor(c).map((t) => [t.id, t.name])} /><//>`) : []))}
      </div><//>
    </div>
    <div class="stack">
      <${Card} title="7–9. Pratinjau dan konfirmasi">
        ${!a || ids.length === 0 ? html`<${Empty} icon="send" title="Pilih siswa" text="Pratinjau pesan muncul setelah Anda memilih siswa." />` : html`
          <div class="row mb"><${Badge} kind="green">${ok.length} siap<//><${Badge} kind=${plan.length - ok.length ? 'amber' : 'gray'}>${plan.length - ok.length} dilewati<//></div>
          <ul class="list">${plan.map((p) => html`<li><div><b>${p.student.name}</b> <span class="muted sm">→ ${p.type === 'siswa' ? 'Siswa' : p.contact?.name || 'Orang tua/wali'} · ${CHANNEL[p.channel]}</span>${!p.ok && html`<div class="sm hl-bad">${p.incomplete ? 'Ditandai: ' : 'Dilewati: '}${p.reason}</div>`}</div>${p.ok && html`<${Btn} size="sm" icon="eye" onClick=${() => setPreview({ p })}>Pratinjau<//>`}</li>`)}</ul>
          <div class="row mt" style=${{ justifyContent: 'flex-end' }}><${Btn} variant="primary" icon="send" disabled=${!ok.length || busy} onClick=${send}>${busy ? 'Memproses…' : `Konfirmasi & Siapkan (${ok.length})`}<//></div>`}<//>
      ${result && html`<${Card} title="Hasil"><${Notice} kind="info">Status "Siap dibuka" berarti pesan sudah disiapkan, <b>belum</b> terkirim. Tandai "Terkirim" di Riwayat setelah Anda mengirimnya.<//>
        <ul class="list">${result.map((r) => html`<li><div><b>${r.p.student.name}</b> <span class="muted sm">· ${r.p.type === 'siswa' ? 'Siswa' : r.p.contact?.name || 'Orang tua/wali'} · ${CHANNEL[r.p.channel]}</span>${r.error && html`<div class="sm hl-bad">${r.error}</div>`}</div>
          <span class="row gap-s">${r.job ? html`<${Badge} kind=${JOB_STATUS[r.job.status][1]}>${JOB_STATUS[r.job.status][0]}<//>` : html`<${Badge}>Dilewati<//>`}${r.job && (r.job.status === 'siap_dibuka_wa' || r.job.status === 'siap_dibuka_email') && html`<${OpenButton} job=${r.job} />`}</span></li>`)}</ul><//>`}
    </div></div>
    ${preview && (() => { const p = preview.p; const key = p.student.id + p.type + p.channel; return html`<${Modal} title=${`Pratinjau — ${p.student.name}`} onClose=${() => setPreview(null)} footer=${html`<${Btn} onClick=${() => { const e = { ...edits }; delete e[key]; setEdits(e); }}>Kembalikan templat<//><${Btn} variant="primary" onClick=${() => setPreview(null)}>Selesai<//>`}>
      <p class="muted sm mb">${CHANNEL[p.channel]} → ${p.type === 'siswa' ? 'Siswa' : p.contact.name} (${p.channel === 'email' ? p.contact.email : normalizePhone(p.contact.phone)})</p>
      ${p.channel === 'email' && html`<${Field} label="Subjek"><${Input} value=${p.subject} disabled /><//>`}
      <${Field} label="Isi pesan (dapat diedit sebelum dikirim)"><${Textarea} rows=${14} value=${edits[key] ?? p.text} onChange=${(v) => setEdits({ ...edits, [key]: v })} /><//><//>`; })()}
  </div>`;
}

function OpenButton({ job }) {
  const open = () => {
    const url = job.channel === 'email'
      ? `mailto:${encodeURIComponent(job.address)}?subject=${encodeURIComponent(job.subject)}&body=${encodeURIComponent(job.message)}`
      : `https://wa.me/${job.address.replace('+', '')}?text=${encodeURIComponent(job.message)}`;
    window.open(url, '_blank', 'noopener');
  };
  return html`<${Btn} size="sm" icon=${job.channel === 'email' ? 'mail' : 'message'} onClick=${open}>${job.channel === 'email' ? 'Buka Email' : 'Buka WhatsApp'}<//>`;
}

export function HistoryPage() {
  useStore();
  const [st, setSt] = useState('');
  const d = store.d;
  const jobs = d.deliveries.filter((j) => !st || j.status === st);
  const set = (j, status, note) => store.mutate((dd) => { const x = dd.deliveries.find((y) => y.id === j.id); x.status = status; if (status === 'terkirim_manual') x.sentAt = new Date().toISOString(); logEvent(dd, j.id, note, status); });
  const [logs, setLogs] = useState(null);
  return html`<div><${PageHeader} title="Riwayat Pengiriman" sub="Status permintaan dibedakan dari pesan benar-benar terkirim, delivered, atau dibaca." demo=${store.isDemoData()} />
    <div class="row mb"><div style=${{ width: '280px' }}><${Select} value=${st} onChange=${setSt} options=${Object.entries(JOB_STATUS).map(([k, v]) => [k, v[0]])} placeholder="Semua status" /></div><span class="muted sm">${jobs.length} catatan</span></div>
    ${jobs.length === 0 ? html`<${Card}><${Empty} icon="clock" title="Belum ada pengiriman" text="Riwayat muncul setelah Anda menyiapkan laporan." action=${html`<${Btn} variant="primary" onClick=${() => go('/app/kirim')}>Kirim Laporan<//>`} /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Siswa</th><th>Penerima</th><th>Media</th><th>Jenis laporan</th><th>Status</th><th>Pengirim</th><th></th></tr></thead><tbody>
      ${jobs.map((j) => { const link = store.g.links.find((l) => l.token === j.linkToken); return html`<tr><td class="sm">${fmtDateTime(j.createdAt)}</td><td><b>${j.studentName}</b></td><td class="sm">${j.recipientName}<div class="muted">${j.recipientRole}</div></td><td>${CHANNEL[j.channel]}</td><td class="sm">${REPORT_KIND[j.reportKind]}${link ? html`<div class="muted">${link.revoked ? 'tautan dicabut' : 'berlaku s.d. ' + fmtDateTime(link.expiresAt)}</div>` : ''}</td>
        <td><${Badge} kind=${JOB_STATUS[j.status][1]}>${JOB_STATUS[j.status][0]}<//>${j.error ? html`<div class="sm hl-bad">${j.error}</div>` : ''}</td><td class="sm">${j.sender}</td>
        <td class="right" style=${{ whiteSpace: 'nowrap' }}>${(j.status === 'siap_dibuka_wa' || j.status === 'siap_dibuka_email') && html`<${OpenButton} job=${j} /><${Btn} size="sm" icon="check" onClick=${() => set(j, 'terkirim_manual', 'ditandai terkirim oleh guru')}>Tandai terkirim<//>`}
          ${link && !link.revoked && html`<${Btn} size="sm" variant="ghost" icon="link" aria-label="Salin tautan" onClick=${() => copyText(`${location.origin}${location.pathname}#/r/${link.token}`)} /><${Btn} size="sm" variant="ghost" icon="lock" aria-label="Cabut tautan" onClick=${async () => { if (await confirmDialog({ title: 'Cabut akses tautan?', message: 'Penerima tidak lagi dapat membuka laporan lewat tautan ini.', confirmLabel: 'Cabut', danger: true })) { store.revokeLink(link.token); toast('Tautan dicabut.'); } }} />`}
          ${['siap_dibuka_wa', 'siap_dibuka_email', 'draft', 'menunggu'].includes(j.status) && html`<${Btn} size="sm" variant="ghost" icon="x" aria-label="Batalkan" onClick=${() => { set(j, 'dibatalkan', 'dibatalkan oleh guru'); if (link) store.revokeLink(link.token); }} />`}
          <${Btn} size="sm" variant="ghost" icon="clock" aria-label="Log" onClick=${() => setLogs(j)} /></td></tr>`; })}</tbody></table></div>`}
    ${logs && html`<${Modal} title=${`Log — ${logs.studentName}`} onClose=${() => setLogs(null)}><ul class="list">${d.deliveryLogs.filter((l) => l.jobId === logs.id).map((l) => html`<li><span>${l.type}${l.details ? html`<div class="muted sm">${l.details}</div>` : ''}</span><span class="muted sm">${fmtDateTime(l.at)}</span></li>`)}</ul><//>`}
  </div>`;
}

export function ContactsPage() {
  useStore();
  const [cid, setCid] = useState('');
  const [only, setOnly] = useState(false);
  const rows = store.d.students.filter((s) => !cid || s.classId === cid).flatMap((s) => s.contacts.map((c) => ({ s, c }))).filter(({ c }) => c.email || c.phone).filter(({ c }) => !only || !eligible(c));
  const toggle = async (s, c) => {
    if (!eligible(c)) { if (!(await confirmDialog({ title: 'Konfirmasi kontak', message: `Apakah Anda sudah memastikan kontak ${c.name || s.name} benar dan penerima setuju menerima laporan?`, confirmLabel: 'Ya, terverifikasi' }))) return; }
    store.mutate(() => { c.verified = !eligible(c); c.consent = c.verified ? 'diberikan' : 'belum'; });
  };
  return html`<div><${PageHeader} title="Kontak Siswa & Orang Tua" sub="Laporan hanya dikirim ke kontak yang sudah dikonfirmasi. Ubah data kontak di menu Siswa." demo=${store.isDemoData()} />
    <div class="row mb"><div style=${{ width: '240px' }}><${Select} value=${cid} onChange=${setCid} options=${classOpts(true)} placeholder="Semua kelas" /></div><${Check} checked=${only} onChange=${setOnly}>Hanya yang belum dikonfirmasi<//></div>
    ${rows.length === 0 ? html`<${Card}><${Empty} icon="mail" title="Tidak ada kontak" text="Tambahkan email/WhatsApp pada data siswa." /><//>` : html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th>Kontak</th><th>Email</th><th>WhatsApp</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(({ s, c }) => html`<tr><td><b>${s.name}</b><div class="muted sm">${className(s.classId)}</div></td><td class="sm">${c.type === 'siswa' ? 'Siswa' : `${c.name || '—'} (${c.relationship || 'Orang tua/wali'})`}</td><td class="sm">${c.email || '—'}</td><td class="sm">${c.phone || '—'}</td><td>${eligible(c) ? html`<${Badge} kind="green">Terverifikasi<//>` : html`<${Badge} kind="amber">Belum dikonfirmasi<//>`}</td><td class="right"><${Btn} size="sm" onClick=${() => toggle(s, c)}>${eligible(c) ? 'Cabut' : 'Konfirmasi'}<//></td></tr>`)}</tbody></table></div>`}</div>`;
}

export function TemplateEditor({ item, onClose, onSave, owner }) {
  const [f, setF] = useState(item ? { ...item } : { name: '', channel: 'whatsapp', audience: 'ortu', subject: '', body: '' });
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const unknown = [...new Set([...(f.body + ' ' + f.subject).matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim()))].filter((v) => !TEMPLATE_VARS.includes(v));
  const save = () => {
    if (!f.name.trim()) return setErr('Nama templat wajib diisi.');
    if (!f.body.trim()) return setErr('Isi pesan wajib diisi.');
    if (f.channel === 'email' && !f.subject.trim()) return setErr('Subjek email wajib diisi.');
    if (unknown.length) return setErr(`Placeholder tidak dikenal: ${unknown.map((u) => `{${u}}`).join(', ')}.`);
    onSave(f);
  };
  return html`<${Modal} wide title=${item ? 'Edit Templat' : 'Templat Baru'} onClose=${onClose} footer=${html`<${Btn} variant="ghost" onClick=${onClose}>Batal<//><${Btn} variant="primary" onClick=${save}>Simpan<//>`}>
    <div class="form-grid">${err && html`<div class="full"><${Notice} kind="err">${err}<//></div>`}
      <${Field} label="Nama templat" class="full"><${Input} value=${f.name} onChange=${set('name')} /><//>
      <${Field} label="Media"><${Select} value=${f.channel} onChange=${set('channel')} options=${[['whatsapp', 'WhatsApp'], ['email', 'Email']]} /><//><${Field} label="Penerima"><${Select} value=${f.audience || 'ortu'} onChange=${set('audience')} options=${[['ortu', 'Orang tua/wali'], ['siswa', 'Siswa']]} /><//>
      ${f.channel === 'email' && html`<${Field} label="Subjek" class="full"><${Input} value=${f.subject} onChange=${set('subject')} /><//>`}
      <${Field} label="Isi pesan" class="full"><${Textarea} rows=${12} value=${f.body} onChange=${set('body')} /><//>
      <div class="full"><${WordMeter} text=${f.body} /></div>
      <div class="full sm muted">Placeholder tersedia: ${TEMPLATE_VARS.map((v) => `{${v}}`).join(' ')}</div></div><//>`;
}

export function TemplatesPage() {
  useStore();
  const [edit, setEdit] = useState(null);
  const mine = store.d.userTemplates;
  const glob = store.g.templates.filter((t) => t.channel !== 'indikator' && t.isActive);
  const row = (t, own) => html`<li><div><b>${t.name}</b> <${Badge} kind=${t.channel === 'email' ? 'blue' : 'green'}>${t.channel === 'email' ? 'Email' : 'WhatsApp'}<//> ${own ? '' : html`<${Badge} kind="violet">Global<//>`}<div class="muted sm" style=${{ whiteSpace: 'pre-wrap', maxHeight: '60px', overflow: 'hidden' }}>${t.body.slice(0, 140)}…</div></div>
    <span class="row gap-s">${own ? html`<${Btn} size="sm" icon="edit" onClick=${() => setEdit(t)}>Edit<//><${Btn} size="sm" variant="ghost" icon="trash" aria-label="Hapus" onClick=${async () => { if (await confirmDialog({ title: 'Hapus templat?', message: t.name, confirmLabel: 'Hapus', danger: true })) store.mutate((d) => { d.userTemplates = d.userTemplates.filter((x) => x.id !== t.id); }); }} />` : html`<${Btn} size="sm" icon="copy" onClick=${() => { store.mutate((d) => d.userTemplates.push({ ...t, id: uid('tpl'), name: t.name + ' (salinan saya)', isGlobal: false })); toast('Disalin ke templat Anda.'); }}>Salin untuk diedit<//>`}</span></li>`;
  return html`<div><${PageHeader} title="Template Pesan" sub="Templat dapat diedit sebelum dikirim. Templat global hanya dapat diubah Super Admin." demo=${store.isDemoData()} actions=${html`<${Btn} variant="primary" icon="plus" onClick=${() => setEdit({})}>Templat Baru<//>`} />
    <div class="grid g2"><${Card} title="Templat saya">${mine.length ? html`<ul class="list">${mine.map((t) => row(t, true))}</ul>` : html`<${Empty} icon="message" title="Belum ada templat pribadi" text="Salin templat global untuk menyesuaikannya." />`}<//><${Card} title="Templat global"><ul class="list">${glob.map((t) => row(t, false))}</ul><//></div>
    ${edit && html`<${TemplateEditor} item=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSave=${(f) => { store.mutate((d) => { if (edit.id) Object.assign(d.userTemplates.find((x) => x.id === edit.id), f); else d.userTemplates.push({ ...f, id: uid('tpl'), isGlobal: false, isActive: true }); }); toast('Templat disimpan.'); setEdit(null); }} />`}</div>`;
}

