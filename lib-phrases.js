// Adaptor antara data laporan (hasil buildIndividual) dan mesin bahasa narrative.js.
import * as N from './lib-narrative.js';

/** Ubah hasil buildIndividual menjadi "fakta" sederhana yang dibaca mesin bahasa. */
export function factsFrom({ a, st, b }) {
  return {
    student: st, assessment: a.title, topic: b.learning?.topic || a.title,
    objective: a.objectives || b.learning?.objectives || '', r: b.r,
    indicators: b.ia.map((x) => ({ id: x.indicator.id, code: x.indicator.code, name: x.indicator.name, mine: x.mine ?? null, thr: x.threshold ?? null, status: x.status, reason: x.reason })),
  };
}

const GENERIC_Q = 'Pada soal berikutnya, cobalah menuliskan langkah penyelesaian secara runtut dan menjelaskan alasan di balik setiap langkah, karena penjelasan yang jelas membantu guru memahami cara berpikirmu dan membantumu menemukan bagian yang perlu diperbaiki.';

/** Pilihan kalimat untuk satu soal, mengikuti skor, rubrik, dan indikator soal tersebut. */
export function questionOptions(q, score, names) {
  return [...N.questionNote({ score, max: q.maxScore, names, hasRubric: !!(q.rubric && q.rubric.trim()) }), GENERIC_Q];
}

/** Semua pilihan untuk panel "Sesuaikan isi laporan". */
export function reportOptions({ a, st, b }) {
  const f = factsFrom({ a, st, b });
  const indicator = {};
  for (const x of f.indicators) {
    const t = N.indicatorText(x);
    indicator[x.id] = [t.explain, t.advice];
  }
  return {
    facts: f,
    general: N.feedbackGroups(f), // [{title, options}]
    area: N.trainOptions(f),
    rec: N.recommendationOptions(f),
    indicator,
    questionNames: (q) => (q.indicators || []).map((m) => f.indicators.find((x) => x.id === m.indicatorId)?.name).filter(Boolean),
  };
}

/** Penjelasan indikator bawaan (dipakai bila guru tidak menulis sendiri). */
export const defaultIndicatorRemark = (x) => N.indicatorText({ name: x.indicator.name, mine: x.mine ?? null, thr: x.threshold ?? null, status: x.status }).explain;

/** Teks otomatis (sesuai nilai siswa) untuk tiap bagian yang dapat disunting guru. */
export function autoTexts({ a, st, b }) {
  const f = factsFrom({ a, st, b });
  const indicator = {};
  for (const x of f.indicators) indicator[x.id] = N.indicatorText(x).explain;
  const hasRubric = (q) => !!(q.rubric && q.rubric.trim());
  const nameOf = (q) => (q.indicators || []).map((m) => f.indicators.find((x) => x.id === m.indicatorId)?.name).filter(Boolean);
  return {
    note: N.autoTeacherNote(f).join('\n'),
    area: N.trainText(f).paragraphs.join('\n'),
    rec: N.autoRecommendation(f).join('\n'),
    indicator,
    question: (q) => N.questionNote({ score: b.sub?.scores?.[q.id] ?? null, max: q.maxScore, names: nameOf(q), hasRubric: hasRubric(q) }).join('\n'),
  };
}