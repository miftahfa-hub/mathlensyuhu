// Data demo MathLens. Semua nama dan kontak FIKTIF. Seluruh data ini diberi label "Data Demo" di UI.
import { round } from './lib-core.js';
import { MESSAGE_TEMPLATES } from './lib-narrative.js';

function rng(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

export const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_wa_ortu', name: 'WhatsApp — Orang Tua/Wali', channel: 'whatsapp', audience: 'ortu', subject: '', isGlobal: true, isActive: true,
    body: `Halo Bapak/Ibu {Nama Orang Tua/Wali},\n\nKami menyampaikan laporan perkembangan belajar matematika {Nama Siswa} untuk materi {Nama Materi}.\n\nRingkasan hasil asesmen:\n* Nilai: {Nilai Akhir}\n* KKM: {KKM}\n* Status: {Status Ketuntasan}\n\nLaporan lengkap, termasuk indikator pembelajaran dan rekomendasi tindak lanjut, dapat dilihat melalui tautan berikut:\n\n{Tautan Laporan}\n\nTerima kasih atas dukungan Bapak/Ibu dalam mendampingi proses belajar anak.\n\nSalam,\n{Nama Guru}\n{Nama Sekolah}`,
  },
  {
    id: 'tpl_wa_siswa', name: 'WhatsApp — Siswa', channel: 'whatsapp', audience: 'siswa', subject: '', isGlobal: true, isActive: true,
    body: `Halo {Nama Siswa}!\n\nHasil asesmen matematika pada materi {Nama Materi} sudah tersedia.\n\nRingkasan:\n* Nilai: {Nilai Akhir}\n* KKM: {KKM}\n* Status: {Status Ketuntasan}\n\nKamu dapat melihat laporan lengkap dan bagian yang perlu dipelajari kembali melalui tautan berikut:\n\n{Tautan Laporan}\n\nGunakan hasil ini sebagai panduan untuk belajar lebih baik pada pertemuan berikutnya. Semangat!`,
  },
  {
    id: 'tpl_em_ortu', name: 'Email — Orang Tua/Wali', channel: 'email', audience: 'ortu', subject: 'Laporan Belajar Matematika {Nama Siswa} — {Nama Materi}', isGlobal: true, isActive: true,
    body: `Yth. Bapak/Ibu {Nama Orang Tua/Wali},\n\nBerikut ringkasan hasil asesmen matematika {Nama Siswa} pada materi {Nama Materi}:\n\n- Nilai akhir: {Nilai Akhir}\n- KKM: {KKM}\n- Status ketuntasan: {Status Ketuntasan}\n\nLaporan lengkap beserta indikator dan rekomendasi tindak lanjut:\n{Tautan Laporan}\n\nHormat kami,\n{Nama Guru}\n{Nama Sekolah}`,
  },
  {
    id: 'tpl_em_siswa', name: 'Email — Siswa', channel: 'email', audience: 'siswa', subject: 'Hasil Asesmen Matematika — {Nama Materi}', isGlobal: true, isActive: true,
    body: `Halo {Nama Siswa},\n\nHasil asesmen matematika materi {Nama Materi} sudah tersedia.\n\n- Nilai akhir: {Nilai Akhir}\n- KKM: {KKM}\n- Status: {Status Ketuntasan}\n\nLihat laporan lengkap di sini:\n{Tautan Laporan}\n\nSalam,\n{Nama Guru}\n{Nama Sekolah}`,
  },
  {
    id: 'tpl_ind_pyth', name: 'Indikator — Teorema Pythagoras', channel: 'indikator', subject: 'Teorema Pythagoras', isGlobal: true, isActive: true,
    items: [
      ['Mengidentifikasi sisi-sisi segitiga siku-siku', 'Siswa dapat menunjukkan sisi miring dan sisi siku-siku.'],
      ['Menentukan hubungan panjang sisi', 'Siswa dapat menyatakan hubungan a² + b² = c².'],
      ['Menghitung panjang sisi yang belum diketahui', 'Siswa dapat menghitung salah satu sisi jika dua sisi lain diketahui.'],
      ['Menggunakan Teorema Pythagoras dalam masalah kontekstual', 'Siswa dapat memodelkan masalah nyata ke segitiga siku-siku.'],
      ['Menafsirkan hasil perhitungan sesuai konteks', 'Siswa dapat menyimpulkan hasil dalam satuan dan konteks masalah.'],
    ],
  },
];

// Isi pesan memakai kalimat penjelas ≥ 30 kata (lihat narrative.js dan tests.html). `ver` dipakai untuk memperbarui templat bawaan lama.
const TPL_KEY = { tpl_wa_ortu: 'wa_ortu', tpl_wa_siswa: 'wa_siswa', tpl_em_ortu: 'em_ortu', tpl_em_siswa: 'em_siswa' };
DEFAULT_TEMPLATES.forEach((t) => { if (TPL_KEY[t.id]) { t.body = MESSAGE_TEMPLATES[TPL_KEY[t.id]]; t.ver = 2; } });
export const DEFAULT_TEMPLATE_VER = 2;

export function defaultSettings() {
  return { defaultKkm: 75, shortSentencePolicy: 'peringatan', linkExpiryDays: 14, allowDecimalDefault: false, features: { analysisDimensions: true, uploads: true, delivery: true } };
}
export function defaultCms() {
  return {
    brand: '#2563EB',
    headline: 'See Beyond Scores.',
    subheadline: 'Pahami setiap jawaban. Temukan setiap potensi.',
    tagline: 'Understand Every Answer. Discover Every Potential.',
    description: 'MathLens membantu guru menghubungkan pembelajaran, indikator, soal, dan hasil asesmen untuk memahami perkembangan matematika siswa secara lebih mendalam.',
    features: [
      ['Data Pembelajaran Terstruktur', 'Catat materi, tujuan, aktivitas, dan refleksi dari pembelajaran yang benar-benar dilaksanakan.', 'book'],
      ['Indikator Pembelajaran per Soal', 'Hubungkan setiap soal dengan indikator, lengkap dengan skor terpisah bila diperlukan.', 'target'],
      ['Penilaian dan Skor Fleksibel', 'Atur skor maksimal tiap soal, bobot, KKM per asesmen, dan aturan konversi yang jelas.', 'edit'],
      ['Analisis Multidimensi', 'Petakan soal ke dimensi konten, proses, konteks, dan kompetensi sesuai kebutuhan guru.', 'chart'],
      ['Laporan Otomatis', 'Laporan individual, kelas, per pertemuan, dan perkembangan dari data yang sama.', 'file'],
      ['Pengiriman via WhatsApp dan Email', 'Siapkan pesan, tinjau, lalu kirim ke siswa atau orang tua dengan kontak terverifikasi.', 'send'],
    ],
    faq: [
      ['Apakah MathLens menghasilkan skor PISA resmi?', 'Tidak. MathLens bukan aplikasi resmi PISA. Dimensi bergaya PISA hanya kerangka pemetaan yang Anda atur sendiri.'],
      ['Apakah pesan WhatsApp terkirim otomatis?', 'Secara bawaan MathLens menyiapkan pesan melalui tautan WhatsApp yang Anda tinjau dan kirim sendiri. Pengiriman otomatis hanya tersedia bila integrasi WhatsApp Business resmi telah dikonfigurasi dan diuji.'],
      ['Apakah siswa yang belum dinilai dianggap belum tuntas?', 'Tidak. Skor kosong dibedakan dari nol, dan siswa yang belum dinilai tidak masuk hitungan ketuntasan.'],
      ['Bagaimana keamanan laporan siswa?', 'Laporan dibagikan lewat tautan acak berbatas waktu yang dapat dicabut. Setiap tautan hanya membuka laporan satu siswa.'],
      ['Apakah KKM harus sama untuk semua asesmen?', 'Tidak. Anda dapat memakai KKM default kelas, KKM khusus asesmen, atau target ketercapaian yang Anda tentukan.'],
    ],
    footer: 'MathLens — platform asesmen dan analisis pembelajaran matematika untuk guru.',
  };
}

export function emptyUserData() {
  return { classes: [], students: [], learning: [], indicators: [], assessments: [], submissions: [], deliveries: [], deliveryLogs: [], userTemplates: [] };
}

export function buildDemo() {
  const r = rng(20261010);
  const d = emptyUserData();
  const cls = (id, name, grade, kkm) => ({ id, name, level: 'SMP/MTs', grade, year: '2026/2027', semester: 'Ganjil', subject: 'Matematika', kkm, archived: false, createdAt: day(-60) });
  d.classes = [cls('c_7a', 'VII A', 'VII', 75), cls('c_7b', 'VII B', 'VII', 75), cls('c_8a', 'VIII A', 'VIII', 75), cls('c_8b', 'VIII B', 'VIII', 75)];

  const names = {
    c_7a: ['Kevin Maulana', 'Laila Zahra', 'Mario Hakim', 'Nadia Permata', 'Omar Fauzi', 'Putri Ayu', 'Qori Ramadhan', 'Rizky Firmansyah'],
    c_7b: ['Salsa Amelia', 'Tegar Wicaksono', 'Umi Kalsum', 'Vino Pradana', 'Wulan Sari', 'Yoga Mahendra'],
    c_8a: ['Aditya Pratama', 'Bunga Lestari', 'Cahya Nugraha', 'Dewi Anggraini', 'Eko Saputra', 'Fitri Handayani', 'Galih Prakoso', 'Hana Safitri', 'Indra Wijaya', 'Jasmine Putri'],
    c_8b: ['Zaki Alfarizi', 'Alya Rahmi', 'Bagas Setiawan', 'Citra Dewanti', 'Dimas Anggara', 'Elsa Maharani'],
  };
  let n = 0;
  for (const [cid, list] of Object.entries(names)) {
    list.forEach((name, i) => {
      n++;
      const phone = (k) => `+62812000${String(n * 10 + k).padStart(4, '0')}`;
      const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
      const contacts = [
        { id: `ct_${n}_s`, type: 'siswa', name, relationship: 'Siswa', email: i % 3 === 0 ? '' : `${slug}@contoh-demo.test`, phone: i % 4 === 0 ? '' : phone(1), verified: i % 5 !== 1, consent: i % 5 !== 1 ? 'diberikan' : 'belum' },
        { id: `ct_${n}_w`, type: 'ortu', name: `${i % 2 ? 'Sulastri' : 'Hendra'} ${name.split(' ')[1]}`, relationship: i % 2 ? 'Ibu' : 'Ayah', email: i === 2 ? '' : `ortu.${slug}@contoh-demo.test`, phone: i === 3 ? '' : phone(2), verified: i !== 4 && i !== 6, consent: i !== 4 && i !== 6 ? 'diberikan' : 'belum' },
      ];
      d.students.push({ id: `s_${n}`, classId: cid, code: `${cid.slice(2).toUpperCase()}-${String(i + 1).padStart(2, '0')}`, name, active: true, contacts });
    });
  }

  d.learning = [
    {
      id: 'l_pyth', title: 'Teorema Pythagoras — Pertemuan 3', classId: 'c_8a', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 3, date: day(-14), duration: '2 × 40 menit',
      topic: 'Teorema Pythagoras', subtopic: 'Menghitung sisi segitiga siku-siku & masalah kontekstual', cp: 'Peserta didik dapat menggunakan Teorema Pythagoras untuk menyelesaikan masalah.',
      objectives: 'Siswa mampu menghitung panjang sisi segitiga siku-siku dan menerapkan Teorema Pythagoras pada masalah kontekstual.', prerequisites: 'Bilangan kuadrat dan akar kuadrat.',
      model: 'Problem Based Learning', method: 'Diskusi kelompok dan latihan terbimbing', media: 'Papan tulis, kertas berpetak, proyektor',
      opening: 'Apersepsi tentang bilangan kuadrat dan akar.', core: 'Eksplorasi segitiga siku-siku pada kertas berpetak, penurunan hubungan a²+b²=c², latihan menghitung sisi, dan soal kontekstual tangga bersandar.', closing: 'Rangkuman bersama dan kuis singkat.',
      reflection: 'Sebagian siswa masih ragu menentukan sisi miring pada gambar yang diputar.', obstacles: 'Waktu diskusi kelompok kurang.', followUp: 'Latihan tambahan tentang identifikasi sisi pada posisi segitiga berbeda.',
      assessmentType: 'Sumatif', assessmentGoal: 'Mengukur ketercapaian indikator Pythagoras', technique: 'Tes tertulis', instrument: 'Uraian 5 soal', successCriteria: 'Nilai akhir ≥ KKM', status: 'selesai',
    },
    {
      id: 'l_lin', title: 'Persamaan Linear Satu Variabel — Pertemuan 2', classId: 'c_7a', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 2, date: day(-10), duration: '2 × 40 menit',
      topic: 'Persamaan Linear', subtopic: 'Menyusun dan menyelesaikan PLSV', cp: '', objectives: 'Siswa mampu menyusun dan menyelesaikan persamaan linear satu variabel dari masalah sehari-hari.', prerequisites: 'Operasi bilangan bulat.',
      model: 'Discovery Learning', method: 'Tanya jawab dan latihan', media: 'Lembar kerja', opening: 'Tebak bilangan.', core: 'Menyusun persamaan dari cerita, menyelesaikan dengan operasi invers.', closing: 'Refleksi singkat.',
      reflection: '', obstacles: '', followUp: '', assessmentType: 'Formatif', assessmentGoal: 'Memantau pemahaman PLSV', technique: 'Kuis tertulis', instrument: 'Uraian 4 soal', successCriteria: 'Nilai ≥ KKM kuis', status: 'selesai',
    },
    { id: 'l_bil', title: 'Bilangan Bulat — Pertemuan 5', classId: 'c_7b', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 5, date: day(-30), duration: '2 × 40 menit', topic: 'Bilangan Bulat', subtopic: 'Operasi campuran', cp: '', objectives: 'Siswa mampu melakukan operasi campuran bilangan bulat.', prerequisites: '', model: 'Direct Instruction', method: 'Ceramah dan latihan', media: 'Garis bilangan', opening: '', core: '', closing: '', reflection: '', obstacles: '', followUp: '', assessmentType: 'Latihan', assessmentGoal: '', technique: '', instrument: '', successCriteria: '', status: 'selesai' },
    { id: 'l_perb', title: 'Perbandingan — Pertemuan 1', classId: 'c_8b', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 1, date: day(+5), duration: '2 × 40 menit', topic: 'Perbandingan', subtopic: 'Perbandingan senilai', cp: '', objectives: 'Siswa mampu menyelesaikan masalah perbandingan senilai.', prerequisites: '', model: '', method: '', media: '', opening: '', core: '', closing: '', reflection: '', obstacles: '', followUp: '', assessmentType: '', assessmentGoal: '', technique: '', instrument: '', successCriteria: '', status: 'direncanakan' },
    { id: 'l_stat', title: 'Statistika — Pertemuan 1', classId: 'c_8a', subject: 'Matematika', year: '2026/2027', semester: 'Ganjil', meeting: 1, date: day(+12), duration: '2 × 40 menit', topic: 'Statistika', subtopic: 'Ukuran pemusatan data', cp: '', objectives: '', prerequisites: '', model: '', method: '', media: '', opening: '', core: '', closing: '', reflection: '', obstacles: '', followUp: '', assessmentType: '', assessmentGoal: '', technique: '', instrument: '', successCriteria: '', status: 'draft' },
  ];

  const ind = (id, lid, code, name, desc, extra = {}) => ({ id, learningId: lid, code, name, description: desc, objective: '', topic: '', criteria: '', weight: '', status: 'aktif', ...extra });
  const py = DEFAULT_TEMPLATES[4].items;
  d.indicators = [
    ...py.map(([n, desc], i) => ind(`i_p${i + 1}`, 'l_pyth', `PYT-${i + 1}`, n, desc, { topic: 'Teorema Pythagoras', criteria: 'Capaian indikator ≥ KKM' })),
    ind('i_l1', 'l_lin', 'PLSV-1', 'Menyatakan masalah sehari-hari ke dalam persamaan linear', ''),
    ind('i_l2', 'l_lin', 'PLSV-2', 'Menyelesaikan persamaan linear satu variabel', ''),
    ind('i_l3', 'l_lin', 'PLSV-3', 'Menafsirkan penyelesaian sesuai konteks', ''),
    ind('i_b1', 'l_bil', 'BIL-1', 'Melakukan operasi hitung campuran bilangan bulat', ''),
    ind('i_b2', 'l_bil', 'BIL-2', 'Menyelesaikan masalah kontekstual bilangan bulat', ''),
  ];

  const q = (id, no, text, type, key, max, rubric, inds, dims = {}) => ({ id, no, text, type, key, maxScore: max, weight: 1, rubric, note: '', indicators: inds, dims: { content: [], process: [], context: [], competency: [], ...dims } });
  const whole = (indicatorId) => ({ indicatorId, method: 'whole', maxScore: '' });
  const sep = (indicatorId, maxScore) => ({ indicatorId, method: 'separate', maxScore });
  const rub = (a, b, c) => `Skor penuh: ${a}. Sebagian: ${b}. Minim: ${c}.`;
  const pyth = {
    id: 'a_pyth', title: 'Asesmen Sumatif Teorema Pythagoras', classId: 'c_8a', learningId: 'l_pyth', objectives: 'Menghitung sisi segitiga siku-siku dan menerapkannya pada masalah kontekstual.', type: 'sumatif', date: day(-7),
    totalMode: 'auto', manualTotal: '', conversionRule: null, useWeights: false, allowDecimal: false, kkmSource: 'default', kkmValue: '', status: 'selesai', indicatorIds: ['i_p1', 'i_p2', 'i_p3', 'i_p4', 'i_p5'],
    questions: [
      q('q_p1', 1, 'Pada segitiga siku-siku PQR dengan siku-siku di Q, tentukan sisi miring dan tuliskan hubungan panjang ketiga sisinya.', 'uraian', 'PR sisi miring; PQ² + QR² = PR²', 10, rub(10, 5, 2), [sep('i_p1', 4), sep('i_p2', 6)], { content: ['Space and Shape'], process: ['Employing'], competency: ['Pemahaman konsep'] }),
      q('q_p2', 2, 'Sebuah segitiga siku-siku memiliki sisi 6 cm dan 8 cm. Tunjukkan bahwa kuadrat sisi miring sama dengan jumlah kuadrat kedua sisi lain.', 'uraian', '10 cm; 36+64=100', 15, rub(15, 8, 3), [whole('i_p2')], { content: ['Space and Shape'], process: ['Employing'], competency: ['Penalaran matematis'] }),
      q('q_p3', 3, 'Hitung panjang sisi siku-siku yang belum diketahui jika sisi miring 13 cm dan sisi lain 5 cm.', 'uraian', '12 cm', 20, rub(20, 10, 4), [whole('i_p3')], { content: ['Space and Shape'], process: ['Employing'], competency: ['Prosedur'] }),
      q('q_p4', 4, 'Tangga 5 m bersandar pada dinding dengan jarak kaki tangga ke dinding 3 m. Berapa tinggi ujung tangga dari tanah? Tuliskan model matematikanya.', 'uraian', '4 m', 25, rub(25, 12, 5), [sep('i_p3', 10), sep('i_p4', 15)], { content: ['Space and Shape'], process: ['Formulating', 'Employing'], context: ['Personal'], competency: ['Pemodelan', 'Pemecahan masalah'] }),
      q('q_p5', 5, 'Sebuah layang-layang terbang pada ketinggian 12 m dan jarak mendatar pemegangnya 5 m dari titik di bawah layang-layang. Tentukan panjang benang dan tafsirkan hasilnya dalam konteks masalah.', 'uraian', '13 m (panjang benang minimal, tanpa lengkung)', 30, rub(30, 15, 6), [sep('i_p4', 12), sep('i_p5', 18)], { content: ['Space and Shape'], process: ['Formulating', 'Interpreting and Evaluating'], context: ['Societal'], competency: ['Interpretasi', 'Komunikasi'] }),
    ],
  };
  const lin = {
    id: 'a_lin', title: 'Kuis Persamaan Linear', classId: 'c_7a', learningId: 'l_lin', objectives: 'Menyusun dan menyelesaikan PLSV.', type: 'formatif', date: day(-9),
    totalMode: 'auto', manualTotal: '', conversionRule: null, useWeights: false, allowDecimal: false, kkmSource: 'khusus', kkmValue: 70, status: 'selesai', indicatorIds: ['i_l1', 'i_l2', 'i_l3'],
    questions: [
      q('q_l1', 1, 'Tulis persamaan dari: "Tiga kali suatu bilangan ditambah 4 sama dengan 19".', 'uraian', '3x + 4 = 19', 20, rub(20, 10, 3), [whole('i_l1')], { content: ['Change and Relationships'], process: ['Formulating'] }),
      q('q_l2', 2, 'Selesaikan 5x − 7 = 18.', 'uraian', 'x = 5', 20, rub(20, 10, 3), [whole('i_l2')], { content: ['Change and Relationships'], process: ['Employing'] }),
      q('q_l3', 3, 'Harga 4 buku dan 1 pulpen Rp27.000, pulpen Rp3.000. Susun persamaan, selesaikan, dan tafsirkan.', 'uraian', 'Rp6.000', 30, rub(30, 15, 5), [whole('i_l2'), whole('i_l3')], { context: ['Personal'], process: ['Formulating', 'Interpreting and Evaluating'] }),
      q('q_l4', 4, 'Periksa apakah x = 4 penyelesaian dari 2x + 3 = 12 dan jelaskan alasannya.', 'uraian', 'Bukan', 30, rub(30, 15, 5), [whole('i_l3')], { competency: ['Penalaran matematis', 'Komunikasi'] }),
    ],
  };
  d.assessments = [pyth, lin];

  // ----- skor siswa (konsisten: skor soal = jumlah skor indikator bila terpisah) -----
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const makeSub = (a, student, ability, opts = {}) => {
    const sub = { id: `sub_${a.id}_${student.id}`, assessmentId: a.id, studentId: student.id, scores: {}, ind: {}, feedback: {}, note: '', docs: [], updatedAt: new Date().toISOString() };
    for (const qq of a.questions) {
      if (opts.skipFrom && qq.no >= opts.skipFrom) continue;
      const seps = qq.indicators.filter((m) => m.method === 'separate');
      if (seps.length) {
        sub.ind[qq.id] = {}; let tot = 0;
        for (const m of seps) { const v = Math.round(Number(m.maxScore) * clamp(ability + (r() - 0.5) * 0.35)); sub.ind[qq.id][m.indicatorId] = v; tot += v; }
        sub.scores[qq.id] = tot;
      } else sub.scores[qq.id] = Math.round(Number(qq.maxScore) * clamp(ability + (r() - 0.5) * 0.3));
    }
    return sub;
  };
  const setExact = (sub, scores, ind) => { scores.forEach((s, i) => { sub.scores[`q_p${i + 1}`] = s; }); Object.entries(ind).forEach(([k, v]) => { sub.ind[k] = v; }); };

  const s8a = d.students.filter((s) => s.classId === 'c_8a');
  const abilities = [0.82, 0.9, 0.55, 0.7, 0.62, 0.95, 0.48, 0.78];
  s8a.forEach((s, i) => {
    if (i === 9) return; // belum dinilai sama sekali
    const sub = makeSub(pyth, s, abilities[i] ?? 0.7, i === 8 ? { skipFrom: 4 } : {});
    if (i === 0) {
      // contoh pada spesifikasi: 8 + 12 + 17 + 21 + 24 = 82 → nilai akhir 82, KKM 75, selisih +7, Tuntas
      setExact(sub, [8, 12, 17, 21, 24], { q_p1: { i_p1: 3, i_p2: 5 }, q_p4: { i_p3: 8, i_p4: 13 }, q_p5: { i_p4: 10, i_p5: 14 } });
      sub.feedback.q_p5 = 'Pemodelan yang kamu buat sudah tepat dan langkah perhitunganmu mudah diikuti, sehingga langkah berikutnya adalah melengkapi penafsiran hasil dengan satuan dan konteks masalah agar kesimpulan jawabanmu menjadi lebih utuh dan jelas.';
      sub.note = 'Kamu menunjukkan prosedur dan penalaran yang kuat selama mengerjakan asesmen ini, sehingga langkah belajar berikutnya adalah melatih penafsiran hasil perhitungan sesuai konteks agar setiap jawabanmu disertai kesimpulan yang lengkap dan mudah dipahami orang lain.';
    }
    d.submissions.push(sub);
  });
  d.students.filter((s) => s.classId === 'c_7a').forEach((s, i) => {
    if (i === 7) return;
    d.submissions.push(makeSub(lin, s, [0.9, 0.72, 0.6, 0.8, 0.5, 0.85, 0.66][i] ?? 0.7));
  });

  d.deliveries = [];
  d.deliveryLogs = [];
  d.userTemplates = [];
  return d;
}

export const DEMO_USER = { id: 'demo_sari', email: 'sari.demo@mathlens.example', name: 'Sari Rahmawati', school: 'SMP Contoh Demo', level: 'SMP/MTs', role: 'guru', active: true, demo: true, createdAt: new Date().toISOString() };
export { round };
