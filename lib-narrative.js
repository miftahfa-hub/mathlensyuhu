// Bahasa laporan MathLens. Murni (tanpa DOM) sehingga dapat diuji.
// Setiap kalimat penjelasan yang dihasilkan sistem berisi minimal MIN_WORDS kata (diuji di tests.html).
// Nama indikator, tujuan pembelajaran, dan angka diambil dari data guru; tidak ada indikator yang ditanam di sini.
import { fmt } from './lib-core.js';

export const MIN_WORDS = 30;

// ---------- hitung kata & periksa kalimat ----------
export const countWords = (t) => String(t || '').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const ABBR = /\b(mis|dst|dll|dsb|dkk|yth|cth|hlm|vs|no|dr|ir|prof|sd|smp|sma)\./gi;
/** Pecah teks menjadi kalimat. Hanya kalimat bertanda akhir (. ! ?) yang dihitung sebagai kalimat penjelasan;
 *  judul, label, daftar, dan salam penutup tanpa tanda akhir dibebaskan. Titik pada angka/singkatan tidak memecah kalimat. */
export function splitSentences(text) {
  const out = [];
  for (const rawLine of String(text || '').split(/\n+/)) {
    const line = rawLine.trim(); if (!line) continue;
    const safe = line.replace(ABBR, (m) => m.replace('.', '\u0001'));
    // Pisah hanya di tanda akhir yang diikuti spasi: "82.5", "PYT-1", dan alamat tautan tidak memecah kalimat.
    for (const part of safe.split(/(?<=[.!?])\s+/)) {
      const s = part.trim(); if (!s) continue;
      out.push({ text: s.replace(/\u0001/g, '.'), terminated: /[.!?]$/.test(s) });
    }
  }
  return out;
}
export function checkText(text, min = MIN_WORDS) {
  const sentences = splitSentences(text).map((s) => ({ ...s, words: countWords(s.text), counted: s.terminated }));
  const short = sentences.filter((s) => s.counted && s.words < min);
  return { sentences, short, totalWords: countWords(text), ok: short.length === 0 };
}

// ---------- utilitas ----------
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : '');
const cut = (s, n = 140) => { const t = String(s || '').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export const joinList = (arr) => (arr.length <= 1 ? arr.join('') : arr.length === 2 ? arr.join(' dan ') : arr.slice(0, -1).join(', ') + ', dan ' + arr[arr.length - 1]);
const FOCUS_FALLBACK = 'kemampuan yang dinilai pada soal ini';
const focusOf = (names) => (names && names.length ? joinList(names.map(lc)) : FOCUS_FALLBACK);

// ---------- status ketuntasan ----------
/** Label singkat + kalimat penjelas (≥30 kata). Tidak menetapkan status bila data belum valid. */
export function statusText(r) {
  if (r.state === 'kosong') return { label: 'Belum Dinilai', tone: 'warn', text: 'Hasil asesmen belum tersedia pada laporan ini, sehingga belum ada dasar yang cukup untuk menentukan status ketuntasan atau memberikan kesimpulan mengenai pencapaian tujuan pembelajaran yang sedang dinilai oleh guru pada pembelajaran ini.' };
  if (r.state === 'parsial') return { label: 'Penilaian Berlangsung', tone: 'warn', text: 'Nilai akhir belum dapat ditetapkan karena masih terdapat bagian penilaian yang belum selesai, sehingga status ketuntasan baru akan ditampilkan setelah seluruh skor yang diperlukan tersedia dan telah diperiksa oleh guru.' };
  if (r.completion === null) return { label: 'Target Belum Ditetapkan', tone: 'warn', text: 'Nilai asesmen sudah tercatat dan dapat digunakan untuk melihat hasil pengerjaanmu, tetapi guru belum menentukan ambang ketuntasan sehingga status ketuntasan belum dapat ditetapkan secara objektif dan adil bagi semua siswa yang mengikuti asesmen yang sama.' };
  if (r.completion === 'tuntas') return { label: 'Tuntas', tone: 'ok', text: 'Nilaimu telah mencapai target ketuntasan yang ditetapkan untuk asesmen ini, dan hasil tersebut dapat menjadi dasar untuk mempertahankan kemampuan yang sudah berkembang serta melanjutkan pembelajaran menuju tantangan berikutnya secara bertahap dan dengan rasa percaya diri yang semakin baik.' };
  return { label: 'Perlu Penguatan', tone: 'bad', text: 'Kamu telah berusaha menyelesaikan asesmen ini, dan hasil yang diperoleh menunjukkan bahwa masih ada bagian pembelajaran yang perlu diperkuat melalui latihan terarah, pembahasan bersama guru, serta kesempatan untuk memperbaiki pemahaman.' };
}

/** Kalimat pembuka ringkasan hasil belajar. */
export function summaryText({ r, topic, assessment }) {
  const t = topic || 'matematika';
  if (r.state !== 'lengkap') return `Laporan ini merangkum perkembangan belajarmu pada materi ${t} melalui ${assessment}, tetapi sebagian hasil penilaian belum lengkap sehingga nilai akhir dan kesimpulan lebih lanjut akan disampaikan setelah guru selesai memeriksa seluruh jawaban.`;
  return `Laporan ini merangkum hasil ${assessment} pada materi ${t}, dengan nilai akhir ${fmt(r.final)} dari rentang nol sampai seratus, sehingga kamu dan keluarga dapat melihat kemampuan yang sudah berkembang serta bagian yang masih dapat dilatih.`;
}

// ---------- hasil pada setiap soal ----------
/** Catatan untuk siswa pada satu soal. names = nama indikator soal (dinamis). */
export function questionNote({ score, max, names, hasRubric }) {
  const focus = focusOf(names);
  const none = score === null || score === undefined || score === '';
  if (none) return ['Penilaian untuk soal ini masih berlangsung, sehingga catatan mengenai kemampuan yang sudah kamu tunjukkan dan bagian yang perlu diperbaiki akan diberikan setelah guru menyelesaikan pemeriksaan jawaban dan seluruh skor yang diperlukan untuk soal ini sudah tersedia secara lengkap.'];
  const pct = (Number(score) / Number(max)) * 100;
  const ref = hasRubric ? 'sesuai rubrik penilaian yang ditetapkan guru' : 'berdasarkan skor yang tercatat';
  const cautious = 'Skor yang tercatat memberikan gambaran tentang hasil pengerjaanmu pada soal ini, tetapi penjelasan yang lebih spesifik mengenai ketepatan konsep dan langkah penyelesaian masih memerlukan rubrik atau catatan penilaian dari guru.';
  if (Number(score) === 0) return [`Skor nol pada soal ini menunjukkan bahwa jawaban belum memperoleh poin ${ref}, sehingga hasilnya sebaiknya dibahas bersama guru untuk memahami bagian yang perlu diperbaiki tanpa menyimpulkan bahwa seluruh materi belum kamu pahami.`];
  if (pct >= 90) return [`Kamu telah menunjukkan pemahaman yang sangat baik pada ${focus} dalam soal ini ${ref}, sehingga kamu dapat mempertahankan pencapaian tersebut sambil mencoba menerapkan konsep yang sama pada soal dengan konteks dan tingkat tantangan berbeda.`];
  if (pct >= 70) return [`Kamu sudah menunjukkan pemahaman yang baik pada ${focus} ${ref}, dan langkah berikutnya adalah memeriksa kembali bagian kecil yang masih dapat diperbaiki agar kamu semakin teliti serta mampu menjelaskan alasan di balik jawabanmu.`];
  if (pct >= 50) return [`Kamu sudah menunjukkan pemahaman pada beberapa bagian soal yang berkaitan dengan ${focus}, dan langkah berikutnya adalah memperhatikan bagian yang masih perlu diperbaiki agar kamu semakin teliti serta mampu menjelaskan alasan di balik jawabanmu.`, ...(hasRubric ? [] : [cautious])];
  return [`Hasil pada soal ini menunjukkan bahwa ${focus} masih perlu diperkuat melalui latihan bertahap, pembahasan contoh penyelesaian, dan pemeriksaan kembali terhadap langkah-langkah yang kamu gunakan ketika menjawab pertanyaan agar kamu semakin percaya diri.`, ...(hasRubric ? [] : [cautious])];
}

// ---------- perkembangan kemampuan (per indikator) ----------
/** x: {name, mine, thr, status}. Mengembalikan label, tone, penjelasan, dan saran (masing-masing satu kalimat ≥30 kata). */
export function indicatorText(x) {
  const n = lc(x.name);
  if (x.status === 'tidak_tersedia') return { label: 'Data Belum Lengkap', tone: 'warn', explain: `Skor soal yang mengukur kemampuan ${n} juga mengukur indikator lain tanpa pembagian skor yang jelas, sehingga persentase capaian untuk kemampuan ini belum dapat dihitung secara terpisah dan guru perlu menetapkan skor per indikator terlebih dahulu.`, advice: `Sambil menunggu guru melengkapi pembagian skor, kamu tetap dapat berlatih ${n} menggunakan soal sederhana dan mencatat langkah penyelesaianmu agar dapat dibahas bersama guru pada pertemuan berikutnya, sehingga kemampuan tersebut tetap berkembang secara bertahap dan terarah.` };
  if (x.status === 'tidak_dipetakan' || x.status === 'belum_ada_data' || x.mine === null || x.mine === undefined) return { label: 'Data Belum Lengkap', tone: 'warn', explain: `Data penilaian yang tersedia belum cukup untuk menggambarkan kemampuanmu pada ${n} secara menyeluruh, sehingga guru perlu melengkapi penilaian atau memberikan kegiatan lanjutan sebelum menyampaikan kesimpulan yang lebih spesifik pada saat laporan ini disusun.`, advice: `Kamu dapat tetap berlatih ${n} dengan contoh yang sudah dibahas di kelas, kemudian menyimpan pertanyaan yang muncul supaya dapat didiskusikan bersama guru ketika penilaian untuk bagian ini sudah dilengkapi, sehingga kamu tidak kehilangan kesempatan untuk memperbaiki pemahaman.` };
  if (x.thr === null || x.thr === undefined) return { label: 'Target Belum Ditetapkan', tone: 'warn', explain: `Hasil penilaian pada kemampuan ${n} telah tercatat dan dapat digunakan untuk melihat perkembangan belajarmu, tetapi guru belum menetapkan target khusus sehingga ketercapaian indikator belum dapat dikategorikan berdasarkan suatu ambang tertentu.`, advice: `Gunakan persentase capaian ini sebagai gambaran awal untuk melanjutkan latihan ${n}, dan tanyakan kepada guru target yang diharapkan agar kamu mengetahui seberapa jauh langkah belajar berikutnya perlu dilakukan sehingga usaha belajarmu memiliki arah yang jelas.` };
  if (x.mine >= x.thr) return { label: 'Tercapai', tone: 'ok', explain: `Kamu telah mencapai target pada kemampuan ${n} berdasarkan hasil penilaian yang tersedia, sehingga kamu dapat mempertahankan pencapaian tersebut dan mencoba menerapkan pemahamanmu pada situasi atau permasalahan yang lebih beragam, baik di dalam kelas maupun dalam kehidupan sehari-hari.`, advice: `Untuk memperkuat pencapaian ini, cobalah mengerjakan soal dengan konteks yang berbeda dan jelaskan alasan setiap langkah penyelesaian dengan kata-katamu sendiri, sehingga kemampuan ${n} tetap kuat dan fleksibel, baik ketika dipakai di dalam kelas maupun saat menghadapi permasalahan sehari-hari.` };
  return { label: 'Perlu Penguatan', tone: 'bad', explain: `Kamu sedang mengembangkan kemampuan ${n} dan masih memerlukan latihan tambahan, terutama pada bagian yang belum memenuhi kriteria keberhasilan, agar pemahamanmu semakin kuat dan kamu lebih percaya diri saat menyelesaikan soal.`, advice: `Mulailah dari contoh penyelesaian yang sederhana untuk ${n}, kerjakan beberapa soal bertahap dengan mencatat langkahmu, lalu diskusikan bagian yang masih membingungkan bersama guru sebelum mencoba soal yang lebih menantang, karena perkembangan yang stabil dibangun dari latihan yang dilakukan sedikit demi sedikit.` };
}

// ---------- hal yang sudah dikuasai / perlu dilatih ----------
export function masteredText(f) {
  const ok = f.indicators.filter((x) => x.status === 'ok' && x.mine !== null && x.thr !== null && x.mine >= x.thr);
  const judged = f.indicators.filter((x) => x.status === 'ok' && x.mine !== null && x.thr !== null);
  if (!judged.length) return { paragraphs: ['Hasil penilaian yang tersedia belum cukup untuk menentukan kemampuan mana yang telah mencapai target, sehingga guru perlu melengkapi pemetaan indikator atau menetapkan kriteria keberhasilan sebelum memberikan kesimpulan khusus yang benar-benar didukung oleh bukti penilaian.'], items: [] };
  if (ok.length === judged.length) return { paragraphs: ['Selamat, kamu telah mencapai target pada seluruh indikator yang dinilai dalam asesmen ini, dan selanjutnya kamu dapat mempertahankan pencapaian tersebut melalui kegiatan pengayaan serta penerapan konsep pada permasalahan yang lebih menantang.'], items: ok.map((x) => x.name) };
  if (ok.length) return { paragraphs: ['Pada beberapa indikator, kamu telah menunjukkan kemampuan yang sesuai dengan target pembelajaran, dan pencapaian tersebut dapat menjadi modal untuk memperkuat pemahaman pada indikator lain yang masih memerlukan latihan tambahan, sambil tetap menikmati proses belajar secara bertahap.'], items: ok.map((x) => x.name) };
  return { paragraphs: ['Pada penilaian kali ini belum ada indikator yang mencapai target, tetapi hasil tersebut adalah gambaran awal yang berguna, sehingga kamu dapat memulai penguatan dari kemampuan dengan persentase tertinggi sambil berdiskusi dengan guru.'], items: [] };
}
export function trainText(f) {
  const judged = f.indicators.filter((x) => x.status === 'ok' && x.mine !== null && x.thr !== null);
  const weak = judged.filter((x) => x.mine < x.thr);
  if (!judged.length) return { paragraphs: ['Data yang tersedia belum cukup untuk menentukan bagian pembelajaran yang paling memerlukan penguatan, sehingga guru perlu meninjau jawaban dan rubrik penilaian sebelum memberikan rekomendasi latihan yang lebih spesifik dan benar-benar sesuai dengan kebutuhanmu.'], items: [] };
  if (!weak.length) return { paragraphs: ['Berdasarkan hasil penilaian yang tersedia, belum ada kemampuan yang berada di bawah target, sehingga kamu dapat memusatkan latihan pada penguatan dan pengayaan agar pemahamanmu tetap terjaga serta semakin fleksibel pada berbagai bentuk soal.'], items: [] };
  return { paragraphs: ['Beberapa kemampuan masih perlu diperkuat berdasarkan hasil penilaian yang tersedia, sehingga kamu dapat memulai latihan dari bagian yang paling mendasar, mempelajari contoh penyelesaian, dan meminta bantuan guru ketika menemukan kesulitan.', ...weak.map((x) => `Pada kemampuan ${lc(x.name)}, hasil penilaian menunjukkan bahwa target belum tercapai, sehingga kamu disarankan mempelajari kembali konsep terkait dan berlatih menggunakan soal bertahap sebelum mencoba permasalahan yang lebih kompleks, dengan tetap menikmati proses belajar secara bertahap.`)], items: weak.map((x) => x.name) };
}

// ---------- catatan guru otomatis (dipakai bila guru belum menulis) ----------
export function autoTeacherNote(f) {
  if (f.r.state !== 'lengkap') return ['Terima kasih atas usaha yang telah kamu tunjukkan selama mengikuti pembelajaran, dan catatan guru yang lebih lengkap akan ditambahkan setelah seluruh bagian asesmen selesai diperiksa sehingga kamu dapat memahami hasil belajarmu dengan lebih menyeluruh.'];
  const grp = Object.fromEntries(feedbackGroups(f).map((g) => [g.title, g.options]));
  const good = f.indicators.filter((x) => x.status === 'ok' && x.thr !== null && x.mine !== null && x.mine >= x.thr);
  const weak = f.indicators.filter((x) => x.status === 'ok' && x.thr !== null && x.mine !== null && x.mine < x.thr);
  const out = [grp['Apresiasi usaha belajar'][0]];
  if (good.length) out.push(grp['Pemahaman konsep'][1] || grp['Pemahaman konsep'][0]);
  if (weak.length) out.push(grp['Latihan tambahan'][0]);
  else if (good.length) out.push(grp['Pengayaan'][0]);
  return out;
}

// ---------- langkah belajar berikutnya ----------
export function autoRecommendation(f) {
  const r = f.r;
  if (r.state !== 'lengkap') return ['Penilaian perlu dilengkapi terlebih dahulu agar guru dapat mengidentifikasi kemampuan yang sudah berkembang, menentukan bagian yang memerlukan penguatan, dan menyusun rekomendasi belajar berdasarkan bukti yang memadai dan dapat dipertanggungjawabkan kepada siswa maupun orang tua.'];
  const judged = f.indicators.filter((x) => x.status === 'ok' && x.mine !== null && x.thr !== null);
  const weak = judged.filter((x) => x.mine < x.thr);
  const out = [];
  if (r.completion === 'belum_tuntas') out.push('Pelajari kembali materi yang berkaitan dengan indikator yang masih perlu diperkuat, kerjakan latihan secara bertahap, dan diskusikan kesulitanmu bersama guru sebelum mengikuti asesmen lanjutan untuk mengetahui perkembangan kemampuanmu secara lebih jelas dan menyeluruh.');
  if (weak.length) out.push(`Fokuskan latihan pada kemampuan ${joinList(weak.map((x) => lc(x.name)))} melalui contoh penyelesaian dan soal bertahap, kemudian tinjau kembali hasil latihan bersama guru untuk menentukan langkah belajar selanjutnya yang paling sesuai dengan kebutuhan dan kecepatan belajarmu.`);
  if (judged.length && !weak.length) out.push('Pertahankan pencapaianmu melalui latihan pengayaan yang memiliki konteks berbeda, dan cobalah menjelaskan strategi penyelesaian yang kamu gunakan agar pemahamanmu semakin kuat serta dapat diterapkan pada permasalahan yang lebih beragam, baik di dalam kelas maupun dalam kehidupan sehari-hari.');
  if (!out.length) out.push('Hasil asesmen sudah tercatat, tetapi ambang ketuntasan atau target indikator belum ditetapkan, sehingga guru perlu melengkapi kriteria tersebut sebelum menyusun langkah belajar yang lebih spesifik dan dapat dipertanggungjawabkan kepada siswa.');
  return out;
}

// ---------- pilihan umpan balik guru (8 kategori) ----------
export function feedbackGroups(f) {
  const topic = f.topic || 'materi ini';
  const obj = cut(f.objective, 110);
  const good = f.indicators.filter((x) => x.status === 'ok' && x.thr !== null && x.mine !== null && x.mine >= x.thr);
  const weak = f.indicators.filter((x) => x.status === 'ok' && x.thr !== null && x.mine !== null && x.mine < x.thr);
  const g = [
    ['Apresiasi usaha belajar', ['Terima kasih atas usaha yang telah kamu tunjukkan selama mengikuti pembelajaran dan menyelesaikan asesmen ini, karena proses berlatih secara konsisten dapat membantumu mengenali kemampuan yang sudah berkembang serta bagian yang masih perlu diperbaiki.']],
    ['Pemahaman konsep', [`Kamu telah menunjukkan pemahaman pada materi ${topic} yang dinilai, dan langkah berikutnya adalah memperkuat kemampuan tersebut melalui latihan yang bervariasi agar kamu semakin percaya diri dalam menerapkan konsep pada permasalahan baru.`, ...(good.length ? [`Hasil penilaian menunjukkan bahwa kemampuan ${joinList(good.map((x) => lc(x.name)))} sudah memenuhi target, sehingga kamu dapat menjadikannya pijakan untuk mempelajari bagian lain yang masih memerlukan latihan tambahan dengan lebih tenang, bertahap, dan percaya diri.`] : [])]],
    ['Ketelitian dan prosedur', ['Saat menyelesaikan soal berikutnya, cobalah membaca pertanyaan dengan lebih cermat, menuliskan langkah penyelesaian secara runtut, serta memeriksa kembali perhitungan dan jawaban agar hasil yang kamu berikan sesuai dengan pertanyaan dan setiap kekeliruan kecil dapat segera kamu temukan sendiri.']],
    ['Kemampuan menjelaskan alasan', ['Kamu dapat meningkatkan kualitas jawabanmu dengan menuliskan alasan di balik setiap langkah penyelesaian, karena penjelasan yang runtut membantu guru memahami cara berpikirmu dan membantumu menemukan sendiri bagian yang perlu diperbaiki.']],
    ['Perkembangan belajar', ['Hasil asesmen ini adalah gambaran kemampuanmu pada saat penilaian dilakukan, sehingga kamu dapat menggunakannya sebagai titik awal untuk menyusun target belajar berikutnya dan membandingkannya dengan hasil asesmen selanjutnya secara bijak.']],
    ['Latihan tambahan', [weak.length ? `Kamu dapat memperkuat kemampuan ${joinList(weak.map((x) => lc(x.name)))} dengan mempelajari kembali contoh penyelesaian, mengerjakan latihan dari tingkat sederhana menuju tingkat yang lebih kompleks, dan mendiskusikan kesulitan bersama guru sampai kamu merasa cukup yakin untuk mencoba soal berikutnya.` : 'Kamu dapat memperkuat kemampuan yang masih perlu dikembangkan dengan mempelajari kembali contoh penyelesaian, mengerjakan latihan dari tingkat sederhana menuju tingkat yang lebih kompleks, dan mendiskusikan kesulitan bersama guru sampai kamu merasa cukup yakin untuk mencoba soal berikutnya.']],
    ['Pengayaan', ['Kamu dapat melanjutkan perkembangan belajarmu dengan mencoba soal yang memiliki konteks berbeda, menjelaskan alasan di balik setiap langkah penyelesaian, dan menerapkan konsep yang sudah dikuasai pada permasalahan baru yang belum pernah kamu temui sebelumnya.']],
  ];
  if (obj) g[4][1].push(`Terus berlatih secara bertahap agar tujuan pembelajaran dapat tercapai, yaitu ${obj}, dan jangan ragu bertanya kepada guru apabila ada langkah penyelesaian yang masih terasa membingungkan atau perlu dibahas ulang.`);
  g.push(['Catatan khusus guru', []]);
  return g.map(([title, options]) => ({ title, options }));
}

// ---------- pilihan area latihan & rekomendasi ----------
export function trainOptions(f) {
  const topic = f.topic || 'materi ini';
  const obj = cut(f.objective, 110);
  const o = trainText(f).paragraphs.slice();
  o.push('Latih kembali langkah penyelesaian secara runtut dengan memperhatikan urutan pengerjaan, alasan penggunaan setiap langkah, dan pemeriksaan hasil akhir agar proses penyelesaianmu menjadi lebih tepat serta mudah dijelaskan kepada guru maupun teman sekelasmu.');
  o.push('Biasakan membaca pertanyaan dengan cermat, mencatat informasi yang diketahui, menentukan hal yang ditanyakan, memeriksa perhitungan, dan memastikan jawaban akhir benar-benar sesuai dengan konteks permasalahan yang ditanyakan, sehingga kesalahan kecil dapat ditemukan sebelum jawaban dikumpulkan.');
  o.push(`Pelajari kembali konsep dasar pada materi ${topic} menggunakan contoh konkret, gambar, tabel, atau representasi yang sesuai, kemudian coba terapkan pemahamanmu pada soal yang sederhana sebelum melanjutkan ke soal yang lebih sulit.`);
  if (obj) o.push(`Arahkan latihanmu pada tujuan pembelajaran berikut, yaitu ${obj}, dengan memilih soal yang berkaitan langsung dengan kemampuan tersebut dan membahas hasilnya bersama guru untuk memastikan pemahamanmu semakin kuat.`);
  return [...new Set(o)];
}
export function recommendationOptions(f) {
  const topic = f.topic || 'materi ini';
  const o = autoRecommendation(f).slice();
  o.push('Pelajari kembali konsep dasar yang berkaitan dengan indikator tersebut menggunakan contoh konkret, gambar, tabel, atau representasi yang sesuai dengan materi, kemudian coba terapkan pemahamanmu pada soal yang sederhana sebelum melanjutkan ke soal yang lebih sulit dan beragam.');
  o.push('Latih kembali langkah penyelesaian secara runtut dengan memperhatikan urutan pengerjaan, alasan penggunaan setiap langkah, dan pemeriksaan hasil akhir agar proses penyelesaianmu menjadi lebih tepat serta mudah dijelaskan kepada guru maupun teman sekelasmu.');
  o.push('Biasakan membaca pertanyaan dengan cermat, mencatat informasi yang diketahui, menentukan hal yang ditanyakan, memeriksa perhitungan, dan memastikan jawaban akhir benar-benar sesuai dengan konteks permasalahan yang ditanyakan, sehingga kesalahan kecil dapat ditemukan sebelum jawaban dikumpulkan.');
  o.push(`Pertahankan pencapaianmu pada materi ${topic} melalui latihan pengayaan yang memiliki konteks berbeda, dan cobalah menjelaskan strategi penyelesaian yang kamu gunakan agar pemahamanmu semakin kuat serta dapat diterapkan pada permasalahan yang lebih beragam.`);
  o.push('Orang tua atau wali dapat mendampingi latihan singkat di rumah dengan meminta anak menjelaskan langkah penyelesaian secara lisan, karena kegiatan menjelaskan membantu anak menyadari bagian yang sudah dipahami dan bagian yang masih perlu dilatih.');
  return [...new Set(o)];
}

// ---------- pesan untuk siswa / orang tua ----------
export const MESSAGE_TEMPLATES = {
  wa_siswa: `Halo {Nama Siswa}, laporan hasil asesmen matematika pada materi {Nama Materi} yang baru saja kamu ikuti sudah tersedia dan dapat kamu gunakan untuk mengetahui kemampuan yang telah berkembang serta bagian pembelajaran yang masih perlu kamu latih.\n\nRingkasan:\n* Nilai: {Nilai Akhir}\n* KKM: {KKM}\n* Status: {Status Ketuntasan}\n\nSilakan buka laporan melalui tautan berikut untuk melihat nilai akhir, indikator pembelajaran, catatan guru, dan rekomendasi kegiatan belajar yang dapat membantumu mempersiapkan diri dengan lebih baik dalam menghadapi pembelajaran berikutnya di kelas.\n\n{Tautan Laporan}\n\nTeruslah berusaha dan gunakan hasil asesmen ini sebagai panduan untuk memperbaiki strategi belajar, memahami kesulitan, serta mengembangkan kemampuan matematika secara bertahap sesuai tujuan pembelajaran yang telah ditetapkan oleh gurumu bersama teman-teman sekelas dalam pembelajaran ini.\n\nSalam,\n{Nama Guru}\n{Nama Sekolah}`,
  wa_ortu: `Halo Bapak/Ibu {Nama Orang Tua/Wali}, dengan hormat kami menyampaikan laporan perkembangan belajar matematika {Nama Siswa} pada materi {Nama Materi} sebagai informasi mengenai hasil asesmen dan kemampuan yang telah ditunjukkan selama proses pembelajaran di kelas, sehingga Bapak/Ibu dapat mengikuti perkembangan belajar anak dengan lebih jelas.\n\nRingkasan:\n* Nilai: {Nilai Akhir}\n* KKM: {KKM}\n* Status: {Status Ketuntasan}\n\nLaporan lengkap memuat nilai akhir, status ketuntasan, perkembangan indikator pembelajaran, serta saran tindak lanjut yang dapat digunakan sebagai bahan pendampingan belajar anak di rumah sesuai kebutuhan dan hasil penilaian, dan dapat dibuka melalui tautan berikut.\n\n{Tautan Laporan}\n\nTerima kasih atas perhatian dan dukungan Bapak/Ibu dalam mendampingi proses belajar anak, karena komunikasi antara guru dan keluarga dapat membantu menciptakan tindak lanjut pembelajaran yang lebih terarah serta sesuai kebutuhan siswa.\n\nSalam,\n{Nama Guru}\n{Nama Sekolah}`,
};
MESSAGE_TEMPLATES.em_siswa = MESSAGE_TEMPLATES.wa_siswa;
MESSAGE_TEMPLATES.em_ortu = MESSAGE_TEMPLATES.wa_ortu.replace('Halo Bapak/Ibu', 'Yth. Bapak/Ibu');
