-- MathLens — skema database Supabase/PostgreSQL dengan Row Level Security.
-- STATUS: dirancang untuk produksi, BELUM dijalankan/diuji pada instance Supabase. Tinjau sebelum dipakai.
--
-- Sebelum menjalankan, tetapkan email Super Admin (jangan di frontend):
--   alter database postgres set app.super_admin_email = 'email-anda@contoh.id';
-- Peran hanya dapat diubah oleh service role atau Super Admin (lihat kebijakan user_roles).

create extension if not exists pgcrypto;

-- ---------- peran ----------
create type app_role as enum ('super_admin', 'admin_sekolah', 'guru');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  school_name text,
  teaching_level text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role app_role not null default 'guru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin');
$$;

-- Pengguna baru: profil + peran. super_admin hanya jika email cocok dengan app.super_admin_email.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);
  insert into user_roles (user_id, role) values (
    new.id,
    case when lower(new.email) = lower(nullif(current_setting('app.super_admin_email', true), '')) then 'super_admin'::app_role else 'guru'::app_role end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- data akademik ----------
create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null, grade_level text, academic_year text, semester text, subject text default 'Matematika',
  default_kkm numeric check (default_kkm between 0 and 100),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_code text not null, full_name text not null, is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, student_code)
);
create table student_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  contact_type text not null check (contact_type in ('siswa', 'ortu')),
  contact_name text, relationship text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone_number text check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{8,14}$'),
  is_verified boolean not null default false,
  consent_status text not null default 'belum' check (consent_status in ('belum', 'diberikan', 'ditolak')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table learning_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null, material text, learning_objectives text, learning_activities jsonb default '{}',
  learning_date date not null, meeting_number int, duration_minutes int,
  status text not null default 'draft' check (status in ('draft', 'direncanakan', 'selesai', 'diarsipkan')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table learning_indicators (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  learning_record_id uuid not null references learning_records(id) on delete cascade,
  indicator_code text not null, indicator_name text not null, indicator_description text, success_criteria text,
  student_threshold numeric check (student_threshold between 0 and 100),   -- ambang siswa mencapai indikator
  class_target numeric check (class_target between 0 and 100),             -- target % siswa; null = tidak ada target
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (learning_record_id, indicator_code)
);
create table assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  learning_record_id uuid references learning_records(id) on delete set null,
  title text not null,
  assessment_type text not null check (assessment_type in ('diagnostik', 'formatif', 'sumatif', 'latihan', 'tugas', 'proyek')),
  assessment_date date not null,
  total_score_mode text not null default 'auto' check (total_score_mode in ('auto', 'manual')),
  total_max_score numeric,                                   -- dipakai bila mode manual
  conversion_rule text check (conversion_rule in ('proporsional', 'langsung')),
  use_weights boolean not null default false, allow_decimal boolean not null default false,
  kkm_source text not null default 'default' check (kkm_source in ('default', 'khusus', 'target')),
  kkm_value numeric check (kkm_value between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'berjalan', 'selesai')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (total_score_mode = 'auto' or total_max_score > 0)
);
create table questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_no int not null, question_text text not null, question_type text not null default 'uraian', answer_key text,
  max_score numeric not null check (max_score > 0), weight numeric not null default 1 check (weight > 0),
  rubric text, teacher_note text, dimensions jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (assessment_id, question_no)
);
create table question_indicator_mappings (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  learning_indicator_id uuid not null references learning_indicators(id) on delete cascade,
  scoring_method text not null default 'whole' check (scoring_method in ('whole', 'separate')),
  max_indicator_score numeric check (max_indicator_score > 0),
  weight numeric default 1,
  created_at timestamptz not null default now(),
  unique (question_id, learning_indicator_id),
  check (scoring_method = 'whole' or max_indicator_score is not null)
);
create table student_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  submission_status text not null default 'belum_dinilai',
  document_path text,                                        -- path Storage privat, bukan URL publik
  teacher_note text, recommendation text,
  submitted_at timestamptz, created_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
-- score NULL = belum dinilai (berbeda dari 0).
create table question_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references student_submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  score numeric check (score >= 0), teacher_feedback text,
  scoring_status text not null default 'belum_dinilai',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);
create table indicator_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references student_submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  learning_indicator_id uuid not null references learning_indicators(id) on delete cascade,
  score numeric check (score >= 0), max_score numeric not null check (max_score > 0), teacher_feedback text,
  scoring_status text not null default 'belum_dinilai',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (submission_id, question_id, learning_indicator_id), check (score is null or score <= max_score)
);
-- Cache hasil; sumber kebenaran tetap question_scores. Hitung ulang lewat fungsi/trigger/job saat skor berubah.
create table assessment_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references student_submissions(id) on delete cascade,
  total_score numeric, max_total_score numeric, final_score numeric, kkm_value numeric,
  completion_status text check (completion_status in ('tuntas', 'belum_tuntas')),
  scoring_status text not null default 'belum_dinilai' check (scoring_status in ('belum_dinilai', 'parsial', 'lengkap')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  learning_record_id uuid references learning_records(id) on delete set null,
  assessment_id uuid references assessments(id) on delete cascade,
  report_type text not null check (report_type in ('individual', 'kelas', 'pertemuan', 'perkembangan')),
  report_status text not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Tautan aman: simpan HASH token (sha256), bukan token mentah. Pembukaan lewat Edge Function (service role).
create table report_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table report_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  assessment_id uuid references assessments(id) on delete set null,
  student_id uuid not null references students(id) on delete cascade,
  recipient_contact_id uuid not null references student_contacts(id) on delete restrict,
  channel text not null check (channel in ('wa_link', 'wa_api', 'email')),
  status text not null default 'draft' check (status in ('draft', 'siap_dibuka_wa', 'siap_dibuka_email', 'menunggu', 'diproses', 'terkirim', 'terkirim_manual', 'delivered', 'gagal', 'dibatalkan')),
  provider_message_id text, scheduled_at timestamptz, sent_at timestamptz, delivered_at timestamptz,
  error_code text, error_summary text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table report_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references report_delivery_jobs(id) on delete cascade,
  event_type text not null, event_status text, event_time timestamptz not null default now(), details jsonb,
  created_at timestamptz not null default now()
);
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  template_name text not null, channel text not null check (channel in ('whatsapp', 'email', 'indikator')),
  subject text, message_body text not null, is_global boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((is_global and owner_user_id is null) or (not is_global and owner_user_id is not null))
);
create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null, entity_type text, entity_id text, details jsonb,
  created_at timestamptz not null default now()
);

create index on classes (teacher_id);          create index on students (class_id);
create index on student_contacts (student_id); create index on learning_records (teacher_id, class_id);
create index on learning_indicators (learning_record_id); create index on assessments (teacher_id, class_id);
create index on questions (assessment_id);     create index on student_submissions (assessment_id, student_id);
create index on question_scores (submission_id); create index on report_delivery_jobs (teacher_id, status);
create index on report_links (expires_at);     create index on admin_audit_logs (created_at desc);

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','classes','students','student_contacts','learning_records','learning_indicators','assessments','questions','question_indicator_mappings','student_submissions','question_scores','indicator_scores','assessment_results','reports','report_links','report_delivery_jobs','report_delivery_logs','message_templates','admin_audit_logs']
  loop execute format('alter table %I enable row level security', t); end loop; end $$;

-- profil: baca/ubah milik sendiri; Super Admin membaca semua
create policy profiles_self on profiles for select using (id = auth.uid() or is_super_admin());
create policy profiles_self_upd on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- peran: pengguna hanya MEMBACA peran sendiri. Tidak ada policy insert/update/delete untuk pengguna biasa,
-- sehingga tidak ada jalur dari frontend untuk mengubah peran. Perubahan peran lewat Edge Function (service role) + audit.
create policy roles_read on user_roles for select using (user_id = auth.uid() or is_super_admin());

-- tabel milik guru (teacher_id)
do $$ declare t text; begin
  foreach t in array array['classes','learning_records','learning_indicators','assessments','reports','report_delivery_jobs']
  loop execute format('create policy %I on %I for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid())', t || '_owner', t); end loop; end $$;

create policy students_owner on students for all
  using (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy contacts_owner on student_contacts for all
  using (exists (select 1 from students s join classes c on c.id = s.class_id where s.id = student_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from students s join classes c on c.id = s.class_id where s.id = student_id and c.teacher_id = auth.uid()));
create policy questions_owner on questions for all
  using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
create policy qim_owner on question_indicator_mappings for all
  using (exists (select 1 from questions q join assessments a on a.id = q.assessment_id where q.id = question_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from questions q join assessments a on a.id = q.assessment_id where q.id = question_id and a.teacher_id = auth.uid()));
create policy submissions_owner on student_submissions for all
  using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
do $$ declare t text; begin
  foreach t in array array['question_scores','indicator_scores','assessment_results']
  loop execute format($f$create policy %I on %I for all
    using (exists (select 1 from student_submissions s join assessments a on a.id = s.assessment_id where s.id = submission_id and a.teacher_id = auth.uid()))
    with check (exists (select 1 from student_submissions s join assessments a on a.id = s.assessment_id where s.id = submission_id and a.teacher_id = auth.uid()))$f$, t || '_owner', t); end loop; end $$;
create policy dlogs_owner on report_delivery_logs for select
  using (exists (select 1 from report_delivery_jobs j where j.id = delivery_job_id and j.teacher_id = auth.uid()));
-- report_links: guru mengelola tautan miliknya; pembacaan publik HANYA lewat Edge Function.
create policy links_owner on report_links for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- templat: global terbaca semua pengguna login, hanya Super Admin yang mengubah; templat pribadi milik sendiri
create policy tpl_read on message_templates for select using (is_global or owner_user_id = auth.uid());
create policy tpl_own on message_templates for all using (owner_user_id = auth.uid() and not is_global) with check (owner_user_id = auth.uid() and not is_global);
create policy tpl_admin on message_templates for all using (is_super_admin() and is_global) with check (is_super_admin() and is_global);

-- audit log: hanya Super Admin yang membaca; penulisan lewat service role/Edge Function
create policy audit_read on admin_audit_logs for select using (is_super_admin());

-- Catatan: Super Admin sengaja TIDAK diberi akses ke jawaban/skor individual siswa pada policy di atas.
-- Admin Sekolah: tetapkan kebijakan akses (mis. agregat saja) sebelum menambahkan policy untuk peran ini.

-- ---------- Storage (jalankan di Supabase Storage) ----------
-- Bucket privat 'answer-sheets', path '{teacher_id}/{assessment_id}/{student_id}/{file}':
--   create policy "owner read"  on storage.objects for select using (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);
--   create policy "owner write" on storage.objects for insert with check (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);
-- Batasi tipe (jpg/png/pdf) dan ukuran (mis. 10 MB) di konfigurasi bucket.
