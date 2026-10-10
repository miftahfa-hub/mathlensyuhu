// MathLens — logika murni (tanpa efek samping). Semua angka di dashboard, grafik, tabel,
// dan laporan dihitung dari fungsi-fungsi di file ini agar konsisten.

export const DIMENSIONS = {
  content: { label: 'Konten Matematika', items: ['Quantity', 'Change and Relationships', 'Space and Shape', 'Uncertainty and Data'] },
  process: { label: 'Proses Matematika', items: ['Formulating', 'Employing', 'Interpreting and Evaluating'] },
  context: { label: 'Konteks', items: ['Personal', 'Occupational', 'Societal', 'Scientific'] },
  competency: { label: 'Kompetensi Tambahan', items: ['Pemahaman konsep', 'Prosedur', 'Penalaran matematis', 'Pemecahan masalah', 'Pemodelan', 'Representasi', 'Komunikasi', 'Interpretasi', 'Ketelitian'] },
};

// ---------- utilitas umum ----------
export function uid(prefix = 'id') {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + '_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function newToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const round = (n, d = 2) => Math.round((Number(n) + Number.EPSILON) * 10 ** d) / 10 ** d;
export const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
export const fmt = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? '—' : String(round(n, d)).replace('.', ','));
export const fmtSigned = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + fmt(n));
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

// ---------- validasi kontak ----------
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
/** Normalisasi nomor WA ke format internasional. Mengembalikan null jika tidak valid. */
export function normalizePhone(raw, defaultCc = '62') {
  if (!raw) return null;
  let s = String(raw).replace(/[\s().-]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = defaultCc + s.slice(1);
  else if (!s.startsWith(defaultCc)) s = defaultCc + s;
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('620')) s = '62' + s.slice(3);
  if (s.length < 9 || s.length > 15) return null;
  return '+' + s;
}

// ---------- skor dan nilai ----------
export const sumMax = (qs) => round(qs.reduce((a, q) => a + (Number(q.maxScore) || 0), 0));

/** Kembalikan { sum, totalMax, mode, rule, needsRule } untuk sebuah asesmen. */
export function totalInfo(a) {
  const sum = sumMax(a.questions || []);
  if (a.useWeights || a.totalMode !== 'manual') return { sum, totalMax: sum, mode: 'auto', rule: null, needsRule: false };
  const T = Number(a.manualTotal);
  const needsRule = Number.isFinite(T) && T > 0 && round(T) !== sum;
  return { sum, totalMax: T, mode: 'manual', rule: needsRule ? a.conversionRule || null : 'sama', needsRule };
}

export function validateAssessment(a) {
  const e = [];
  if (!a.title?.trim()) e.push('Nama asesmen wajib diisi.');
  if (!a.classId) e.push('Kelas wajib dipilih.');
  if (!a.questions?.length) e.push('Tambahkan minimal satu soal.');
  (a.questions || []).forEach((q, i) => {
    const n = `Soal ${q.no ?? i + 1}`;
    if (!isNum(q.maxScore) || Number(q.maxScore) <= 0) e.push(`${n}: skor maksimal harus lebih besar dari 0.`);
    else if (!a.allowDecimal && !Number.isInteger(Number(q.maxScore))) e.push(`${n}: skor desimal belum diaktifkan.`);
    if (a.useWeights && (!isNum(q.weight) || Number(q.weight) <= 0)) e.push(`${n}: bobot harus lebih besar dari 0.`);
    const sep = (q.indicators || []).filter((m) => m.method === 'separate');
    if (sep.length) {
      if (sep.length !== q.indicators.length) e.push(`${n}: semua indikator pada soal ini harus memakai skor terpisah, atau tidak sama sekali.`);
      const tot = round(sep.reduce((x, m) => x + (Number(m.maxScore) || 0), 0));
      if (sep.some((m) => !isNum(m.maxScore) || Number(m.maxScore) <= 0)) e.push(`${n}: skor maksimal per indikator harus lebih besar dari 0.`);
      else if (tot !== round(Number(q.maxScore))) e.push(`${n}: jumlah skor maksimal indikator (${fmt(tot)}) harus sama dengan skor maksimal soal (${fmt(q.maxScore)}).`);
    }
  });
  const t = totalInfo(a);
  if (a.totalMode === 'manual' && !a.useWeights) {
    if (!isNum(a.manualTotal) || Number(a.manualTotal) <= 0) e.push('Skor maksimal keseluruhan manual harus lebih besar dari 0.');
    else if (t.needsRule && !a.conversionRule) e.push(`Skor maksimal manual (${fmt(a.manualTotal)}) berbeda dari jumlah skor soal (${fmt(t.sum)}). Pilih aturan konversi secara eksplisit.`);
  }
  if (isNum(a.kkmValue) && (Number(a.kkmValue) < 0 || Number(a.kkmValue) > 100)) e.push('Nilai KKM harus berada pada rentang 0–100.');
  return e;
}

export const KKM_LABELS = { asesmen: 'KKM asesmen', kelas: 'KKM kelas' };
/** Satu KKM saja: nilai pada asesmen bila diisi, jika tidak memakai KKM kelas, lalu KKM default akun. */
export function resolveKkm(a, cls, settings) {
  if (isNum(a.kkmValue)) return { value: Number(a.kkmValue), source: KKM_LABELS.asesmen, label: 'KKM' };
  const v = isNum(cls?.kkm) ? Number(cls.kkm) : isNum(settings?.defaultKkm) ? Number(settings.defaultKkm) : null;
  return { value: v, source: KKM_LABELS.kelas, label: 'KKM' };
}

/** Indikator sebuah asesmen: semua indikator aktif pada data pembelajarannya + yang dipetakan ke soal. Diisi sekali, otomatis terhubung. */
export function indicatorsOf(d, a) {
  const mapped = new Set((a.questions || []).flatMap((q) => (q.indicators || []).map((m) => m.indicatorId)));
  return d.indicators.filter((i) => (a.learningId && i.learningId === a.learningId && i.status !== 'nonaktif') || mapped.has(i.id));
}

/** Menghitung hasil satu siswa untuk satu asesmen. Skor kosong (null) ≠ 0. */
export function computeResult(a, sub, kkmInfo) {
  const qs = a.questions || [];
  const info = totalInfo(a);
  const res = {
    state: 'kosong', answered: 0, nQuestions: qs.length, total: null, max: info.sum, displayTotal: null, displayMax: info.totalMax,
    final: null, kkm: kkmInfo?.value ?? null, kkmSource: kkmInfo?.source, diff: null, completion: null, explanation: '',
  };
  const scores = qs.map((q) => {
    const v = sub?.scores?.[q.id];
    return isNum(v) ? Number(v) : null;
  });
  res.answered = scores.filter((s) => s !== null).length;
  res.total = round(scores.reduce((x, s) => x + (s ?? 0), 0));
  if (res.answered === 0) return res;
  if (res.answered < qs.length) {
    res.state = 'parsial';
    res.explanation = `Baru ${res.answered} dari ${qs.length} soal dinilai. Soal kosong tidak dihitung sebagai nol, sehingga nilai akhir belum tersedia.`;
    return res;
  }
  res.state = 'lengkap';
  if (a.useWeights) {
    const wsum = qs.reduce((x, q) => x + Number(q.weight || 1), 0);
    const part = qs.map((q, i) => (scores[i] / Number(q.maxScore)) * Number(q.weight || 1));
    res.final = round((part.reduce((x, y) => x + y, 0) / wsum) * 100);
    res.displayTotal = res.total;
    res.displayMax = info.sum;
    res.explanation = `Nilai akhir = Σ( skor ÷ skor maksimal soal × bobot ) ÷ Σ bobot × 100. Total skor mentah ${fmt(res.total)} dari ${fmt(info.sum)} hanya informasi; bobot diterapkan satu kali.`;
  } else if (info.mode === 'manual' && info.needsRule) {
    if (a.conversionRule === 'proporsional') {
      res.displayTotal = round((res.total / info.sum) * info.totalMax);
      res.final = round((res.total / info.sum) * 100);
      res.explanation = `Konversi proporsional: skor mentah ${fmt(res.total)}/${fmt(info.sum)} dikonversi menjadi ${fmt(res.displayTotal)}/${fmt(info.totalMax)}; nilai akhir = ${fmt(res.displayTotal)} ÷ ${fmt(info.totalMax)} × 100.`;
    } else {
      res.displayTotal = Math.min(res.total, info.totalMax);
      res.final = round((res.displayTotal / info.totalMax) * 100);
      res.explanation = `Skor mentah dipakai langsung (maks. ${fmt(info.totalMax)}): nilai akhir = ${fmt(res.displayTotal)} ÷ ${fmt(info.totalMax)} × 100.`;
    }
  } else {
    res.displayTotal = res.total;
    res.final = round((res.total / info.totalMax) * 100);
    res.explanation = `Nilai akhir = total skor ÷ skor maksimal keseluruhan × 100 = ${fmt(res.total)} ÷ ${fmt(info.totalMax)} × 100.`;
  }
  if (res.kkm !== null) {
    res.diff = round(res.final - res.kkm);
    res.completion = res.final >= res.kkm ? 'tuntas' : 'belum_tuntas';
    res.explanation += ` Dibandingkan KKM ${fmt(res.kkm)} (${res.kkmSource}): ${fmtSigned(res.diff)} → ${res.completion === 'tuntas' ? 'Tuntas' : 'Belum Tuntas'}.`;
  } else res.explanation += ' KKM belum ditetapkan sehingga status ketuntasan belum dapat ditentukan.';
  // Langkah penentuan status dalam kalimat pendek (dipakai laporan agar tidak ambigu).
  const kw = kkmInfo?.label || 'KKM';
  res.steps = [`Skor yang diperoleh: ${fmt(res.displayTotal)} dari skor maksimal ${fmt(res.displayMax)}.`];
  if (a.useWeights) res.steps.push(`Nilai akhir dihitung dengan bobot soal: Σ(skor ÷ skor maks soal × bobot) ÷ Σ bobot × 100 = ${fmt(res.final)}.`);
  else res.steps.push(`Nilai akhir = ${fmt(res.displayTotal)} ÷ ${fmt(res.displayMax)} × 100 = ${fmt(res.final)}.`);
  if (res.kkm !== null) {
    res.steps.push(`Pembanding: ${kw} = ${fmt(res.kkm)} (${res.kkmSource}).`);
    res.steps.push(res.completion === 'tuntas'
      ? `Nilai akhir ${fmt(res.final)} sama dengan atau di atas ${kw} ${fmt(res.kkm)} (selisih ${fmtSigned(res.diff)}), maka status: TUNTAS.`
      : `Nilai akhir ${fmt(res.final)} masih di bawah ${kw} ${fmt(res.kkm)} (selisih ${fmtSigned(res.diff)}), maka status: BELUM TUNTAS.`);
  } else res.steps.push(`${kw} belum ditetapkan, sehingga status ketuntasan belum dapat ditentukan.`);
  return res;
}

export const STATE_LABEL = { kosong: 'Belum Dinilai', parsial: 'Penilaian Belum Lengkap', lengkap: 'Selesai Dinilai' };
export const COMPLETION_LABEL = { tuntas: 'Tuntas', belum_tuntas: 'Belum Tuntas' };

/** Statistik kelas. Hanya nilai akhir valid yang dihitung. */
export function classStats(a, subs, students, cls, settings) {
  const kk = resolveKkm(a, cls, settings);
  const rows = students.map((s) => {
    const sub = subs.find((x) => x.assessmentId === a.id && x.studentId === s.id);
    return { student: s, sub, result: computeResult(a, sub, kk) };
  });
  const valid = rows.filter((r) => r.result.final !== null);
  const finals = valid.map((r) => r.result.final);
  const tuntas = valid.filter((r) => r.result.completion === 'tuntas').length;
  const belum = valid.filter((r) => r.result.completion === 'belum_tuntas').length;
  const decided = tuntas + belum;
  const bins = Array.from({ length: 10 }, (_, i) => ({ label: i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`, count: 0 }));
  finals.forEach((f) => { bins[Math.min(9, Math.floor(f / 10))].count++; });
  return {
    kkm: kk, rows, nStudents: students.length, nValid: valid.length, nPartial: rows.filter((r) => r.result.state === 'parsial').length,
    nNotGraded: rows.filter((r) => r.result.state === 'kosong').length,
    mean: mean(finals), median: median(finals), max: finals.length ? Math.max(...finals) : null, min: finals.length ? Math.min(...finals) : null,
    tuntas, belum, pct: decided ? round((tuntas / decided) * 100) : null, bins,
  };
}

// ---------- indikator ----------
function entriesFor(a, sub, indId) {
  const out = []; let usable = false; let ambiguous = false;
  for (const q of a.questions || []) {
    const m = (q.indicators || []).find((x) => x.indicatorId === indId);
    if (!m) continue;
    if (m.method === 'separate') {
      usable = true;
      const v = sub?.ind?.[q.id]?.[indId];
      out.push({ score: isNum(v) ? Number(v) : null, max: Number(m.maxScore) });
    } else if (q.indicators.length === 1) {
      usable = true;
      const v = sub?.scores?.[q.id];
      out.push({ score: isNum(v) ? Number(v) : null, max: Number(q.maxScore) });
    } else ambiguous = true;
  }
  return { out, usable, ambiguous };
}

/** Ketercapaian indikator. Tidak menduplikasi skor soal ke banyak indikator. */
export function indicatorAnalysis(a, indicators, subs, students, kkm = null) {
  return indicators.map((ind) => {
    const def = entriesFor(a, null, ind.id);
    const mapped = (a.questions || []).some((q) => (q.indicators || []).some((m) => m.indicatorId === ind.id));
    if (!mapped) return { indicator: ind, status: 'tidak_dipetakan', reason: 'Belum dihubungkan dengan soal pada asesmen ini.' };
    if (!def.usable) return { indicator: ind, status: 'tidak_tersedia', reason: 'Soal yang mengukur indikator ini memuat beberapa indikator tanpa skor terpisah, sehingga ketercapaian indikator belum dapat dihitung terpisah.' };
    const per = [];
    for (const s of students) {
      const sub = subs.find((x) => x.assessmentId === a.id && x.studentId === s.id);
      const { out } = entriesFor(a, sub, ind.id);
      if (out.length && out.every((e) => e.score !== null)) {
        const mx = out.reduce((x, e) => x + e.max, 0);
        per.push({ studentId: s.id, pct: round((out.reduce((x, e) => x + e.score, 0) / mx) * 100) });
      }
    }
    if (!per.length) return { indicator: ind, status: 'belum_ada_data', reason: 'Belum ada siswa dengan skor lengkap untuk indikator ini.', per };
    // Satu-satunya patokan adalah KKM asesmen: indikator tercapai bila persentase capaian ≥ KKM.
    const thr = isNum(kkm) ? Number(kkm) : null;
    const reached = thr === null ? null : per.filter((p) => p.pct >= thr).length;
    const share = reached === null ? null : round((reached / per.length) * 100);
    return { indicator: ind, status: 'ok', partial: def.ambiguous, per, n: per.length, avg: round(mean(per.map((p) => p.pct))), threshold: thr, reached, share };
  });
}

export function dimensionAnalysis(a, subs, students, dimKey) {
  const stat = {};
  for (const q of a.questions || []) {
    for (const v of q.dims?.[dimKey] || []) {
      stat[v] ||= { value: v, score: 0, max: 0, nQ: 0 };
      stat[v].nQ++;
    }
  }
  const complete = students.map((s) => subs.find((x) => x.assessmentId === a.id && x.studentId === s.id)).filter((sub) => sub && (a.questions || []).every((q) => isNum(sub.scores?.[q.id])));
  for (const sub of complete) {
    for (const q of a.questions) for (const v of q.dims?.[dimKey] || []) {
      stat[v].score += Number(sub.scores[q.id]); stat[v].max += Number(q.maxScore);
    }
  }
  return { n: complete.length, items: Object.values(stat).map((x) => ({ ...x, pct: x.max ? round((x.score / x.max) * 100) : null })) };
}

// ---------- templat pesan ----------
export function fillTemplate(body, vars) {
  const missing = [];
  const text = String(body || '').replace(/\{([^{}]+)\}/g, (m, k) => {
    const key = k.trim();
    const v = vars[key];
    if (v === undefined || v === null || String(v).trim() === '') { missing.push(key); return m; }
    return String(v);
  });
  return { text, missing: [...new Set(missing)] };
}
export const TEMPLATE_VARS = ['Nama Orang Tua/Wali', 'Nama Siswa', 'Nama Materi', 'Nilai Akhir', 'KKM', 'Status Ketuntasan', 'Tautan Laporan', 'Nama Guru', 'Nama Sekolah'];

export function toCsv(rows) {
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // cegah injeksi formula spreadsheet
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  const src = text.replace(/^﻿/, '');
  const delim = (src.split('\n')[0].match(/;/g) || []).length > (src.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
