-- Supabase SQL Editor에서 한 번 실행하세요. 기존 public.admin_users를 사용합니다.
create table if not exists public.game_balance (
 id integer primary key check (id=1),
 player_hp integer not null default 100 check(player_hp between 1 and 10000),
 player_damage integer not null default 18 check(player_damage between 1 and 999),
 player_speed integer not null default 250 check(player_speed between 50 and 1000),
 enemy_multiplier numeric not null default 1 check(enemy_multiplier between 0.1 and 20),
 spawn_ms integer not null default 900 check(spawn_ms between 100 and 10000)
);
insert into public.game_balance(id) values(1) on conflict(id) do nothing;
alter table public.game_balance enable row level security;
grant select on public.game_balance to anon, authenticated;
grant insert, update on public.game_balance to authenticated;
drop policy if exists "game_balance_read" on public.game_balance;
create policy "game_balance_read" on public.game_balance for select to anon, authenticated using(true);
drop policy if exists "game_balance_insert_admin" on public.game_balance;
create policy "game_balance_insert_admin" on public.game_balance for insert to authenticated with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "game_balance_update_admin" on public.game_balance;
create policy "game_balance_update_admin" on public.game_balance for update to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
