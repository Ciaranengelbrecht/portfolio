-- Run this in Supabase SQL Editor (SQL > New query) and click Run
-- It creates JSON-based tables mirroring your local data, sets update triggers,
-- and enforces Row Level Security so each user only sees their own rows.

-- Optional: user profile (handy for future)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  themeV2 jsonb, -- stores { key: 'theme-name', customAccent?, prefersSystem? }
  program jsonb -- stores customizable training program
);

-- Backfill (safe idempotent add) if the column was added after initial setup
do $$ begin
  if not exists (
    select 1 from information_schema.columns where table_name='profiles' and column_name='themev2'
  ) then
    alter table profiles add column themeV2 jsonb;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name='profiles' and column_name='program'
  ) then
    alter table profiles add column program jsonb;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name='profiles' and column_name='program_history'
  ) then
    alter table profiles add column program_history jsonb default '[]'::jsonb;
  end if;
end $$;

-- (Optional) Enable RLS & policies for profiles if you want to restrict access
alter table profiles enable row level security;
-- Recreate policies idempotently with distinct names
drop policy if exists "own read" on profiles;
drop policy if exists "own insert" on profiles;
drop policy if exists "own update" on profiles;
drop policy if exists "update_own_profile" on profiles;
create policy "own read" on profiles for select using ((select auth.uid()) = id);
create policy "own insert" on profiles for insert with check ((select auth.uid()) = id);
create policy "own update" on profiles for update using ((select auth.uid()) = id);

-- Core collections as JSONB payloads keyed by text IDs + owner
create table if not exists exercises (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists sessions (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists measurements (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists templates (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists settings (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Touch updated_at automatically on update
create extension if not exists moddatetime with schema extensions;
drop trigger if exists exercises_updated on exercises;
drop trigger if exists sessions_updated on sessions;
drop trigger if exists measurements_updated on measurements;
drop trigger if exists templates_updated on templates;
drop trigger if exists settings_updated on settings;
create trigger exercises_updated before update on exercises for each row execute function extensions.moddatetime(updated_at);
create trigger sessions_updated before update on sessions for each row execute function extensions.moddatetime(updated_at);
create trigger measurements_updated before update on measurements for each row execute function extensions.moddatetime(updated_at);
create trigger templates_updated before update on templates for each row execute function extensions.moddatetime(updated_at);
create trigger settings_updated before update on settings for each row execute function extensions.moddatetime(updated_at);

-- Row Level Security: only owner can see/edit/delete their rows
alter table exercises enable row level security;
alter table sessions enable row level security;
alter table measurements enable row level security;
alter table templates enable row level security;
alter table settings enable row level security;

-- Policies per table (drop first for idempotency)
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

-- ============================================================================
-- Performance indexes for owner-scoped workloads
-- ============================================================================
-- These match the most common app queries:
--   WHERE owner = (select auth.uid())
-- and owner-scoped ordering by updated_at when needed.

create index if not exists exercises_owner_idx on exercises(owner);
create index if not exists exercises_owner_updated_idx on exercises(owner, updated_at);

create index if not exists sessions_owner_idx on sessions(owner);
create index if not exists sessions_owner_updated_idx on sessions(owner, updated_at);

create index if not exists measurements_owner_idx on measurements(owner);
create index if not exists measurements_owner_updated_idx on measurements(owner, updated_at);

create index if not exists templates_owner_idx on templates(owner);
create index if not exists templates_owner_updated_idx on templates(owner, updated_at);

create index if not exists settings_owner_idx on settings(owner);
create index if not exists settings_owner_updated_idx on settings(owner, updated_at);

-- ============================================================================
-- One-call app snapshot for faster overseas startup/background sync
-- ============================================================================
-- The app sends a JSON object of per-store last-seen updated_at timestamps:
--   { "sessions": "2026-06-20T00:00:00.000Z", ... }
-- Each store returns changed rows, the full current id list for delete
-- reconciliation, and latestUpdatedAt for the next incremental request.

create or replace function public.get_liftlog_app_snapshot(since jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with current_owner as (
    select auth.uid() as uid
  )
  select jsonb_build_object(
    'profile',
      coalesce((
        select jsonb_build_object(
          'id', p.id,
          'themev2', p.themev2,
          'program', p.program,
          'program_history', coalesce(p.program_history, '[]'::jsonb)
        )
        from profiles p, current_owner co
        where p.id = co.uid
      ), 'null'::jsonb),
    'stores',
      jsonb_build_object(
        'settings',
          (select jsonb_build_object(
            'rows', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data, 'updated_at', r.updated_at) order by r.updated_at), '[]'::jsonb),
            'ids', coalesce((select jsonb_agg(coalesce(nullif(s.data->>'id', ''), regexp_replace(s.id, '^[^:]+:', '')) order by s.id) from settings s, current_owner co where s.owner = co.uid), '[]'::jsonb),
            'latestUpdatedAt', (select max(s.updated_at) from settings s, current_owner co where s.owner = co.uid)
          ) from settings r, current_owner co where r.owner = co.uid and (nullif(since->>'settings', '') is null or r.updated_at > nullif(since->>'settings', '')::timestamptz)),
        'exercises',
          (select jsonb_build_object(
            'rows', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data, 'updated_at', r.updated_at) order by r.updated_at), '[]'::jsonb),
            'ids', coalesce((select jsonb_agg(coalesce(nullif(e.data->>'id', ''), regexp_replace(e.id, '^[^:]+:', '')) order by e.id) from exercises e, current_owner co where e.owner = co.uid), '[]'::jsonb),
            'latestUpdatedAt', (select max(e.updated_at) from exercises e, current_owner co where e.owner = co.uid)
          ) from exercises r, current_owner co where r.owner = co.uid and (nullif(since->>'exercises', '') is null or r.updated_at > nullif(since->>'exercises', '')::timestamptz)),
        'templates',
          (select jsonb_build_object(
            'rows', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data, 'updated_at', r.updated_at) order by r.updated_at), '[]'::jsonb),
            'ids', coalesce((select jsonb_agg(coalesce(nullif(t.data->>'id', ''), regexp_replace(t.id, '^[^:]+:', '')) order by t.id) from templates t, current_owner co where t.owner = co.uid), '[]'::jsonb),
            'latestUpdatedAt', (select max(t.updated_at) from templates t, current_owner co where t.owner = co.uid)
          ) from templates r, current_owner co where r.owner = co.uid and (nullif(since->>'templates', '') is null or r.updated_at > nullif(since->>'templates', '')::timestamptz)),
        'sessions',
          (select jsonb_build_object(
            'rows', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data, 'updated_at', r.updated_at) order by r.updated_at), '[]'::jsonb),
            'ids', coalesce((select jsonb_agg(coalesce(nullif(s.data->>'id', ''), regexp_replace(s.id, '^[^:]+:', '')) order by s.id) from sessions s, current_owner co where s.owner = co.uid), '[]'::jsonb),
            'latestUpdatedAt', (select max(s.updated_at) from sessions s, current_owner co where s.owner = co.uid)
          ) from sessions r, current_owner co where r.owner = co.uid and (nullif(since->>'sessions', '') is null or r.updated_at > nullif(since->>'sessions', '')::timestamptz)),
        'measurements',
          (select jsonb_build_object(
            'rows', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data, 'updated_at', r.updated_at) order by r.updated_at), '[]'::jsonb),
            'ids', coalesce((select jsonb_agg(coalesce(nullif(m.data->>'id', ''), regexp_replace(m.id, '^[^:]+:', '')) order by m.id) from measurements m, current_owner co where m.owner = co.uid), '[]'::jsonb),
            'latestUpdatedAt', (select max(m.updated_at) from measurements m, current_owner co where m.owner = co.uid)
          ) from measurements r, current_owner co where r.owner = co.uid and (nullif(since->>'measurements', '') is null or r.updated_at > nullif(since->>'measurements', '')::timestamptz))
      )
  );
$$;

grant execute on function public.get_liftlog_app_snapshot(jsonb) to authenticated;
