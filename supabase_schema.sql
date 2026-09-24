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
