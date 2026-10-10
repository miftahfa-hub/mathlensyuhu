> **Struktur berkas datar:** semua file berada di satu folder (tanpa subfolder). File JavaScript diberi awalan: `lib-*.js` (logika/data), `page-*.js` (halaman). Titik masuk: `index.html` lalu `main.js`. Skema database: `schema.sql`; contoh fungsi pengiriman: `send-report.example.ts`.

# MathLens — See Beyond Scores.

Platform asesmen & analisis pembelajaran matematika untuk guru: data pembelajaran → indikator → soal & skor → penilaian → nilai akhir & KKM → analisis indikator → laporan → pengiriman.

## Menjalankan

Tanpa langkah build (HTML + ES modules; Preact/htm dan Chart.js dimuat dari CDN, jadi perlu internet).

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Buka `http://localhost:8765/`. Tombol **Coba dengan Data Demo** membuka akun demo (Sari Rahmawati, data fiktif berlabel "Data Demo"). Uji logika inti: `http://localhost:8765/tests.html`.

## Status jujur: apa yang nyata, apa yang belum

| Area | Status |
|---|---|
| Perhitungan skor, KKM, ketuntasan, indikator, dimensi | Diimplementasikan di `src/lib/core.js`; 38 uji otomatis lulus (`tests.html`) |
| Alur UI kelas → siswa → pembelajaran → indikator → asesmen → penilaian → laporan → kirim | Diuji manual di browser (akun demo dan akun baru) |
| Penyimpanan | **Lokal**: localStorage + IndexedDB di browser ini. Bukan penyimpanan permanen/server. Menghapus data browser menghapus data MathLens |
| Login & peran | **Lokal** (PBKDF2 di browser). Cukup untuk demo; **bukan keamanan sungguhan** — penegakan peran yang aman harus di backend (`backend/schema.sql`: RLS + `is_super_admin()`) |
| Super Admin | Ditentukan oleh `superAdminEmail` di `config.js` (padanan `SUPER_ADMIN_EMAIL`), kosong secara bawaan. Tidak ada kata sandi bawaan, tidak ada formulir untuk memberi peran Super Admin |
| Tautan laporan aman | Token acak 256-bit, kedaluwarsa, dapat dicabut, verifikasi kode siswa. **Hanya berfungsi di browser yang sama** (data lokal); lintas perangkat butuh backend |
| WhatsApp | Mode **Share Link** (pesan disiapkan, guru kirim manual; status "Siap dibuka", tidak pernah otomatis "Terkirim"). WhatsApp Business otomatis: **belum aktif**, belum diuji |
| Email | Tanpa backend: dibuka di aplikasi email (`mailto:`), kirim manual. Pengiriman otomatis via backend: kerangka di `backend/send-report.example.ts`, **belum diuji** |
| Lampiran PDF di pesan | Belum tersedia (butuh backend). PDF laporan = dialog cetak browser → "Simpan sebagai PDF" |
| Pembacaan tulisan tangan otomatis | Tidak ada; guru menilai manual |
| Basis data Supabase + RLS | `backend/schema.sql` ditulis tetapi **belum dijalankan** pada instance Supabase; adapter `store` untuk Supabase belum ditulis |
| Editor template rubrik/dimensi/laporan global, unggah logo, saklar fitur yang menyembunyikan menu | Belum ada |

## Struktur

- `src/lib/core.js` — logika murni: skor, KKM, statistik kelas, indikator, dimensi, template, CSV.
- `src/lib/store.js` — adapter penyimpanan & autentikasi lokal. Untuk produksi, implementasikan antarmuka yang sama (`store.mutate`, `auth.*`, `files.*`) di atas Supabase tanpa mengubah halaman.
- `src/lib/seed.js` — data demo, template bawaan, konten landing bawaan.
- `src/pages/*` — landing/auth/laporan publik, dashboard & CRUD, asesmen, penilaian/unggah/analisis, laporan, distribusi, admin.
- `backend/` — skema SQL + RLS dan contoh Edge Function (belum diuji).
- `config.js` — konfigurasi publik; jangan isi secret.

## Aturan penilaian (ringkas)

- Skor maks keseluruhan otomatis = Σ skor maks soal. Mode manual yang berbeda dari Σ mewajibkan aturan konversi (proporsional / skor mentah langsung).
- Nilai akhir = total ÷ skor maks × 100; dengan bobot: Σ(skor/maks × bobot) ÷ Σ bobot × 100 (bobot diterapkan sekali).
- Skor kosong ≠ 0. Ada soal kosong → "Penilaian Belum Lengkap", tanpa nilai akhir/status. Siswa belum dinilai tidak masuk hitungan ketuntasan.
- Soal multi-indikator tanpa skor terpisah tidak diduplikasi ke tiap indikator; analisis indikator ditandai belum dapat dihitung. Indikator tanpa ambang/target tidak dinyatakan gagal.
- Mengubah/menghapus soal setelah ada skor menampilkan dampaknya dan meminta konfirmasi; skor yang melebihi batas baru dikosongkan (bukan diubah diam-diam).

## Memasang backend (garis besar)

1. Buat proyek Supabase, set `alter database postgres set app.super_admin_email = '…'`, jalankan `backend/schema.sql`, tinjau policy.
2. Deploy Edge Function dari contoh; set secret email/WhatsApp **hanya** di environment backend.
3. Tulis adapter Supabase untuk `store`/`auth`/`files`, lalu set `storageMode`, `apiBase`, `integrations` di `config.js`.
4. Uji nyata: pembuatan asesmen → penilaian → laporan → pengiriman, termasuk webhook status delivered.
