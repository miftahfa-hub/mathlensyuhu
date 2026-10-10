// CONTOH Supabase Edge Function (Deno) untuk pengiriman email / WhatsApp Business.
// STATUS: contoh kerangka, BELUM diuji terhadap penyedia sungguhan. Kredensial hanya dari environment backend.
//
// Env (set dengan `supabase secrets set`):
//   EMAIL_PROVIDER=resend | EMAIL_API_KEY | EMAIL_FROM_ADDRESS | EMAIL_FROM_NAME
//   WHATSAPP_ACCESS_TOKEN | WHATSAPP_PHONE_NUMBER_ID | WHATSAPP_BUSINESS_ACCOUNT_ID | WHATSAPP_WEBHOOK_VERIFY_TOKEN
//   SUPABASE_URL | SUPABASE_SERVICE_ROLE_KEY | SUPABASE_ANON_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  // Webhook verifikasi Meta (GET) dan status pengiriman (POST) — arahkan WhatsApp webhook ke /send-report/webhook
  if (url.pathname.endsWith('/webhook')) return handleWebhook(req, url);

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Tidak terautentikasi' }, 401);

  const { jobId } = await req.json();
  // RLS memastikan job ini milik guru yang login; kontak diambil dari DB, BUKAN dari body permintaan.
  const { data: job } = await userClient.from('report_delivery_jobs').select('*, student_contacts:recipient_contact_id(*)').eq('id', jobId).single();
  if (!job) return json({ error: 'Job tidak ditemukan' }, 404);
  const c = job.student_contacts;
  if (!c.is_verified || c.consent_status !== 'diberikan') return fail(userClient, job.id, 'KONTAK_BELUM_DIKONFIRMASI');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await admin.from('report_delivery_jobs').update({ status: 'diproses' }).eq('id', job.id);
  try {
    if (job.channel === 'email') {
      if (!EMAIL_RE.test(c.email ?? '')) return fail(admin, job.id, 'EMAIL_TIDAK_VALID');
      // TODO: susun isi dari template + data nilai di server; tolak jika masih ada placeholder {…}.
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('EMAIL_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${Deno.env.get('EMAIL_FROM_NAME')} <${Deno.env.get('EMAIL_FROM_ADDRESS')}>`, to: [c.email], subject: 'Laporan Belajar', text: '...' }), // satu penerima per email: tidak membocorkan alamat lain
      });
      if (!res.ok) throw new Error(`email ${res.status}`);
      const body = await res.json();
      // 'terkirim' = diterima penyedia. 'delivered' hanya setelah webhook penyedia mengonfirmasi.
      await admin.from('report_delivery_jobs').update({ status: 'terkirim', provider_message_id: body.id, sent_at: new Date().toISOString() }).eq('id', job.id);
    } else if (job.channel === 'wa_api') {
      // WhatsApp Business Platform: gunakan template pesan yang disetujui Meta untuk pesan di luar jendela 24 jam.
      const res = await fetch(`https://graph.facebook.com/v20.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: c.phone_number.replace('+', ''), type: 'template', template: { name: 'laporan_belajar', language: { code: 'id' }, components: [] } }),
      });
      if (!res.ok) throw new Error(`whatsapp ${res.status}`);
      const body = await res.json();
      await admin.from('report_delivery_jobs').update({ status: 'terkirim', provider_message_id: body.messages?.[0]?.id, sent_at: new Date().toISOString() }).eq('id', job.id);
    }
    await admin.from('report_delivery_logs').insert({ delivery_job_id: job.id, event_type: 'diterima penyedia', event_status: 'terkirim' });
    return json({ ok: true });
  } catch (e) {
    return fail(admin, job.id, 'PENYEDIA_GAGAL', String(e));
  }
});

async function handleWebhook(req: Request, url: URL) {
  if (req.method === 'GET') {
    return url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
      ? new Response(url.searchParams.get('hub.challenge')) : new Response('forbidden', { status: 403 });
  }
  // TODO: verifikasi tanda tangan X-Hub-Signature-256, lalu petakan status sent/delivered/read/failed ke report_delivery_jobs
  // berdasarkan provider_message_id. 'read' tidak sama dengan 'delivered'; jangan menyimpulkan dibaca dari terkirim.
  return new Response('ok');
}

async function fail(client: ReturnType<typeof createClient>, id: string, code: string, summary = '') {
  await client.from('report_delivery_jobs').update({ status: 'gagal', error_code: code, error_summary: summary.slice(0, 300) }).eq('id', id);
  return json({ error: code }, 422);
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
