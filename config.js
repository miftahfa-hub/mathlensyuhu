// Konfigurasi publik MathLens. JANGAN menaruh secret/token di file ini: file ini dikirim ke browser.
// Secret (EMAIL_API_KEY, WHATSAPP_ACCESS_TOKEN, dst.) hanya boleh berada di environment backend.
window.MATHLENS_CONFIG = {
  // Mode penyimpanan. 'local' = localStorage/IndexedDB di browser ini (BUKAN penyimpanan permanen server).
  // Ganti ke 'supabase' setelah adapter backend diimplementasikan (lihat backend/README.md).
  storageMode: 'local',

  // Email Super Admin utama (padanan SUPER_ADMIN_EMAIL). Dikosongkan: isi dengan email Anda sendiri.
  // Pada mode lokal ini hanya menentukan peran saat pendaftaran/login di browser ini; di produksi
  // peran WAJIB diverifikasi di backend (lihat backend/schema.sql — fungsi is_super_admin()).
  superAdminEmail: 'miftahf261@gmail.com',

  // Alamat endpoint backend untuk pengiriman email/WhatsApp resmi. Kosong = integrasi belum aktif.
  apiBase: '',

  // Hanya menandai status; kredensial sebenarnya berada di backend.
  integrations: { email: false, whatsappBusiness: false },
};
