-- LiftLog RLS policy maintenance.
-- Run this in Supabase SQL Editor to resolve auth_rls_initplan warnings and
-- remove the stale duplicate profiles update policy. This does not reset data.

begin;

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table sessions enable row level security;
alter table measurements enable row level security;
alter table templates enable row level security;
alter table settings enable row level security;

drop policy if exists "own read" on profiles;
drop policy if exists "own insert" on profiles;
drop policy if exists "own update" on profiles;
drop policy if exists "update_own_profile" on profiles;
create policy "own read" on profiles for select using ((select auth.uid()) = id);
create policy "own insert" on profiles for insert with check ((select auth.uid()) = id);
create policy "own update" on profiles for update using ((select auth.uid()) = id);

drop policy if exists "own read" on exercises;
drop policy if exists "own insert" on exercises;
drop policy if exists "own update" on exercises;
drop policy if exists "own delete" on exercises;
create policy "own read" on exercises for select using ((select auth.uid()) = owner);
create policy "own insert" on exercises for insert with check ((select auth.uid()) = owner);
create policy "own update" on exercises for update using ((select auth.uid()) = owner);
create policy "own delete" on exercises for delete using ((select auth.uid()) = owner);

drop policy if exists "own read" on sessions;
drop policy if exists "own insert" on sessions;
drop policy if exists "own update" on sessions;
drop policy if exists "own delete" on sessions;
create policy "own read" on sessions for select using ((select auth.uid()) = owner);
create policy "own insert" on sessions for insert with check ((select auth.uid()) = owner);
create policy "own update" on sessions for update using ((select auth.uid()) = owner);
create policy "own delete" on sessions for delete using ((select auth.uid()) = owner);

drop policy if exists "own read" on measurements;
drop policy if exists "own insert" on measurements;
drop policy if exists "own update" on measurements;
drop policy if exists "own delete" on measurements;
create policy "own read" on measurements for select using ((select auth.uid()) = owner);
create policy "own insert" on measurements for insert with check ((select auth.uid()) = owner);
create policy "own update" on measurements for update using ((select auth.uid()) = owner);
create policy "own delete" on measurements for delete using ((select auth.uid()) = owner);

drop policy if exists "own read" on templates;
drop policy if exists "own insert" on templates;
drop policy if exists "own update" on templates;
drop policy if exists "own delete" on templates;
create policy "own read" on templates for select using ((select auth.uid()) = owner);
create policy "own insert" on templates for insert with check ((select auth.uid()) = owner);
create policy "own update" on templates for update using ((select auth.uid()) = owner);
create policy "own delete" on templates for delete using ((select auth.uid()) = owner);

drop policy if exists "own read" on settings;
drop policy if exists "own upsert" on settings;
drop policy if exists "own update" on settings;
create policy "own read" on settings for select using ((select auth.uid()) = owner);
create policy "own upsert" on settings for insert with check ((select auth.uid()) = owner);
create policy "own update" on settings for update using ((select auth.uid()) = owner);

commit;
