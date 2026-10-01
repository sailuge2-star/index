-- Supabase SQL Editor에서 실행. Authentication 설정에서 Anonymous Sign-Ins 활성화.
begin;
create table if not exists public.game_players (
 user_id uuid primary key references auth.users(id) on delete cascade,
 guest_number bigint generated always as identity unique,
 created_at timestamptz not null default now()
);
create table if not exists public.game_records (
 run_id uuid primary key,
 user_id uuid not null references public.game_players(user_id) on delete cascade,
 nickname text not null check(char_length(nickname) between 1 and 20),
 difficulty text not null check(difficulty in ('easy','normal','hard')),
 cleared boolean not null,
 survival integer not null check(survival between 0 and 1800),
 kills integer not null check(kills between 0 and 1000000),
 created_at timestamptz not null default now(),
 check(not cleared or survival=1800)
);
alter table public.game_players enable row level security;
alter table public.game_records enable row level security;
revoke all on public.game_players, public.game_records from anon, authenticated;
create index if not exists game_records_best on public.game_records(difficulty,user_id,cleared desc,survival desc,kills desc,created_at);
create or replace function public.game_guest_name() returns text
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 insert into public.game_players(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select guest_number into n from public.game_players where user_id=auth.uid();
 return '게스트'||n;
end; $$;
create or replace function public.game_save_record(p_run_id uuid,p_nickname text,p_difficulty text,p_cleared boolean,p_survival integer,p_kills integer) returns void
language plpgsql security definer set search_path = '' as $$
declare guest text;
begin
 guest:=public.game_guest_name();
 if exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception '관리자 기록은 등록하지 않습니다.'; end if;
 insert into public.game_records(run_id,user_id,nickname,difficulty,cleared,survival,kills)
 values(p_run_id,auth.uid(),coalesce(nullif(btrim(p_nickname),''),guest),p_difficulty,p_cleared,p_survival,p_kills)
 on conflict(run_id) do nothing;
end; $$;
create or replace function public.game_leaderboard(p_difficulty text default 'easy')
returns table(nickname text,cleared boolean,survival integer,kills integer,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select best.nickname,best.cleared,best.survival,best.kills,best.created_at
 from (
  select distinct on(r.user_id) r.* from public.game_records r
  where r.difficulty=p_difficulty
  order by r.user_id,r.cleared desc,r.survival desc,r.kills desc,r.created_at,r.run_id
 ) best order by best.cleared desc,best.survival desc,best.kills desc,best.created_at,best.run_id limit 50;
$$;
revoke all on function public.game_guest_name() from public;
revoke all on function public.game_save_record(uuid,text,text,boolean,integer,integer) from public;
revoke all on function public.game_leaderboard(text) from public;
grant execute on function public.game_guest_name() to authenticated;
grant execute on function public.game_save_record(uuid,text,text,boolean,integer,integer) to authenticated;
grant execute on function public.game_leaderboard(text) to anon,authenticated;
commit;
