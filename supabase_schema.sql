-- 뽀린걸 FAN SITE: Supabase setup
-- 1) Supabase SQL Editor에서 이 파일을 실행하세요.
-- 2) Storage에서 fanart 버킷을 만들고 Public을 켜세요.
-- 3) Project Settings > API에서 Project URL + Publishable key를 config.js에 입력하세요.

create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  nickname varchar(30) not null,
  message varchar(500) not null,
  created_at timestamptz not null default now(),
  status varchar(12) not null default 'approved' check (status in ('approved','hidden')),
  constraint guestbook_nickname_len check (char_length(trim(nickname)) between 1 and 30),
  constraint guestbook_message_len check (char_length(trim(message)) between 1 and 500)
);

create index if not exists guestbook_created_at_idx on public.guestbook(created_at desc);

create table if not exists public.fanart (
  id uuid primary key default gen_random_uuid(),
  nickname varchar(30) not null,
  title varchar(80) not null,
  description varchar(300),
  image_path text not null,
  created_at timestamptz not null default now(),
  status varchar(12) not null default 'pending' check (status in ('pending','approved','rejected')),
  constraint fanart_nickname_len check (char_length(trim(nickname)) between 1 and 30),
  constraint fanart_title_len check (char_length(trim(title)) between 1 and 80),
  constraint fanart_description_len check (description is null or char_length(description) <= 300)
);

create index if not exists fanart_created_at_idx on public.fanart(created_at desc);
create index if not exists fanart_status_idx on public.fanart(status);

alter table public.guestbook enable row level security;
alter table public.fanart enable row level security;

-- 기존에 일부 정책이 이미 만들어져 있어도 이 파일을 다시 실행할 수 있도록
-- 아래 정책들은 생성 전에 삭제한 뒤 동일한 이름으로 다시 만듭니다.
drop policy if exists "guestbook_public_read_approved" on public.guestbook;
drop policy if exists "guestbook_public_insert" on public.guestbook;
drop policy if exists "fanart_public_read_approved" on public.fanart;
drop policy if exists "fanart_public_insert_pending" on public.fanart;
drop policy if exists "fanart_storage_public_upload" on storage.objects;
drop policy if exists "fanart_storage_public_read" on storage.objects;
drop policy if exists "guestbook_admin_read_all" on public.guestbook;
drop policy if exists "guestbook_admin_update" on public.guestbook;
drop policy if exists "guestbook_admin_delete" on public.guestbook;
drop policy if exists "fanart_admin_read_all" on public.fanart;
drop policy if exists "fanart_admin_update" on public.fanart;
drop policy if exists "fanart_admin_delete" on public.fanart;
drop policy if exists "fanart_storage_admin_delete" on storage.objects;

-- 공개: 승인된 방명록만 읽기
create policy "guestbook_public_read_approved"
on public.guestbook for select
to anon, authenticated
using (status = 'approved');

-- 공개 작성: status는 approved 또는 hidden만 허용.
-- 사이트에서는 기본적으로 approved로 작성하지만, 운영자가 moderation을 원하면
-- 아래 policy의 with check를 'hidden'만 허용하도록 바꿀 수 있습니다.
create policy "guestbook_public_insert"
on public.guestbook for insert
to anon, authenticated
with check (
  status = 'approved'
  and char_length(trim(nickname)) between 1 and 30
  and char_length(trim(message)) between 1 and 500
);

-- 팬아트는 누구나 승인된 항목만 읽고, 업로드는 pending으로만 생성 가능
create policy "fanart_public_read_approved"
on public.fanart for select
to anon, authenticated
using (status = 'approved');

create policy "fanart_public_insert_pending"
on public.fanart for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(trim(nickname)) between 1 and 30
  and char_length(trim(title)) between 1 and 80
  and (description is null or char_length(description) <= 300)
);

-- Storage > New bucket: fanart, Public = ON
-- 업로드 객체 생성은 공개 방문자에게 허용하되, 사이트에서 이미지 타입/크기/경로를 검증합니다.
create policy "fanart_storage_public_upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'fanart');

create policy "fanart_storage_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'fanart');

-- 중요: service_role / secret key는 절대 브라우저 코드에 넣지 마세요.

-- =========================================
-- ADMIN AUTH / DASHBOARD
-- =========================================
-- 1) Supabase Authentication > Users에서 관리자 계정을 먼저 생성하세요.
-- 2) 아래 INSERT에서 이메일을 관리자 계정 이메일로 바꾸고 실행하세요.
-- 3) 관리자 페이지는 이 테이블에 등록된 auth.users만 접근할 수 있습니다.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_self_read" on public.admin_users;

create policy "admin_users_self_read"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

-- 예: insert into public.admin_users(user_id)
-- select id from auth.users where email = 'admin@example.com'
-- on conflict (user_id) do nothing;

-- 관리자만 전체 방명록을 읽고 수정/삭제할 수 있도록 허용
create policy "guestbook_admin_read_all"
on public.guestbook for select
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "guestbook_admin_update"
on public.guestbook for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "guestbook_admin_delete"
on public.guestbook for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- 관리자만 전체 팬아트를 읽고 검수/삭제할 수 있도록 허용
create policy "fanart_admin_read_all"
on public.fanart for select
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "fanart_admin_update"
on public.fanart for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "fanart_admin_delete"
on public.fanart for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- 팬아트 Storage 파일 삭제는 관리자만 가능
create policy "fanart_storage_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'fanart'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

-- =========================================
-- BGM PLAYLIST
-- =========================================
-- 관리자 페이지에서 업로드한 음악을 게스트 페이지의 플레이리스트로 사용합니다.
create table if not exists public.bgm_tracks (
  id uuid primary key default gen_random_uuid(),
  title varchar(100) not null,
  storage_path text not null unique,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists bgm_tracks_sort_order_idx on public.bgm_tracks(sort_order, created_at);
create index if not exists bgm_tracks_enabled_idx on public.bgm_tracks(enabled, sort_order);

alter table public.bgm_tracks enable row level security;

drop policy if exists "bgm_public_read_enabled" on public.bgm_tracks;
drop policy if exists "bgm_admin_read_all" on public.bgm_tracks;
drop policy if exists "bgm_admin_insert" on public.bgm_tracks;
drop policy if exists "bgm_admin_update" on public.bgm_tracks;
drop policy if exists "bgm_admin_delete" on public.bgm_tracks;

create policy "bgm_public_read_enabled"
on public.bgm_tracks for select
to anon, authenticated
using (enabled = true);

create policy "bgm_admin_read_all"
on public.bgm_tracks for select
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "bgm_admin_insert"
on public.bgm_tracks for insert
to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "bgm_admin_update"
on public.bgm_tracks for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "bgm_admin_delete"
on public.bgm_tracks for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- 공개 읽기용 BGM Storage 버킷
insert into storage.buckets (id, name, public)
values ('bgm', 'bgm', true)
on conflict (id) do update set public = true;

drop policy if exists "bgm_storage_public_read" on storage.objects;
drop policy if exists "bgm_storage_admin_insert" on storage.objects;
drop policy if exists "bgm_storage_admin_update" on storage.objects;
drop policy if exists "bgm_storage_admin_delete" on storage.objects;

create policy "bgm_storage_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'bgm');

create policy "bgm_storage_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bgm'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "bgm_storage_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bgm'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'bgm'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "bgm_storage_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'bgm'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);
