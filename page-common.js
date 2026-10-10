import { html, Badge } from './ui.js';
import { store } from './lib-store.js';
import { classStats, computeResult, resolveKkm, indicatorAnalysis, indicatorsOf } from './lib-core.js';

export const settingsNow = () => ({ ...store.g.settings, ...(store.d.prefs || {}) });
export const kkmWord = () => 'KKM';
export const classById = (id) => store.d.classes.find((c) => c.id === id);
export const studentById = (id) => store.d.students.find((s) => s.id === id);
export const learningById = (id) => store.d.learning.find((l) => l.id === id);
export const className = (id) => classById(id)?.name || '—';
export const activeClasses = () => store.d.classes.filter((c) => !c.archived);
export const classOpts = (all) => (all ? store.d.classes : activeClasses()).map((c) => [c.id, `${c.name} — ${c.year}`]);
export const studentsOf = (classId) => store.d.students.filter((s) => s.classId === classId && s.active !== false);
export function statsFor(a) {
  const cls = classById(a.classId);
  return classStats(a, store.d.submissions, studentsOf(a.classId), cls, settingsNow());
}
/** Analisis indikator satu asesmen; indikator diambil otomatis dari data pembelajarannya, patokan = KKM asesmen. */
export function analysisFor(a) {
  const d = store.d;
  const kk = resolveKkm(a, classById(a.classId), settingsNow());
  return indicatorAnalysis(a, indicatorsOf(d, a), d.submissions, studentsOf(a.classId), kk.value);
}
export function resultFor(a, studentId) {
  const sub = store.d.submissions.find((s) => s.assessmentId === a.id && s.studentId === studentId);
  return { sub, result: computeResult(a, sub, resolveKkm(a, classById(a.classId), settingsNow())) };
}
export const TYPE_LABEL = { diagnostik: 'Diagnostik', formatif: 'Formatif', sumatif: 'Sumatif', latihan: 'Latihan', tugas: 'Tugas', proyek: 'Proyek' };
export const ASSESS_STATUS = { draft: ['Draft', 'gray'], berjalan: ['Berjalan', 'blue'], selesai: ['Selesai', 'green'] };
export const LEARN_STATUS = { draft: ['Draft', 'gray'], direncanakan: ['Direncanakan', 'amber'], selesai: ['Selesai', 'green'], diarsipkan: ['Diarsipkan', 'violet'] };
export const stBadge = (map, k) => html`<${Badge} kind=${map[k]?.[1] || 'gray'}>${map[k]?.[0] || k}<//>`;
export const completionBadge = (r) =>
  r.state === 'kosong' ? html`<${Badge}>Belum Dinilai<//>`
    : r.state === 'parsial' ? html`<${Badge} kind="amber">Penilaian Belum Lengkap<//>`
      : r.completion === 'tuntas' ? html`<${Badge} kind="green">Tuntas<//>`
        : r.completion === 'belum_tuntas' ? html`<${Badge} kind="red">Belum Tuntas<//>`
          : html`<${Badge} kind="amber">KKM belum ditetapkan<//>`;
