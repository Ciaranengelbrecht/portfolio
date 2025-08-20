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
end $$;

-- (Optional) Enable RLS & policies for profiles if you want to restrict access
alter table profiles enable row level security;
-- Recreate policies idempotently with distinct names
drop policy if exists "own read" on profiles;
drop policy if exists "own insert" on profiles;
drop policy if exists "own update" on profiles;
create policy "own read" on profiles for select using (auth.uid() = id);
create policy "own insert" on profiles for insert with check (auth.uid() = id);
create policy "own update" on profiles for update using (auth.uid() = id);

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
create policy "own read" on exercises for select using (auth.uid() = owner);
create policy "own insert" on exercises for insert with check (auth.uid() = owner);
create policy "own update" on exercises for update using (auth.uid() = owner);
create policy "own delete" on exercises for delete using (auth.uid() = owner);

drop policy if exists "own read" on sessions;
drop policy if exists "own insert" on sessions;
drop policy if exists "own update" on sessions;
drop policy if exists "own delete" on sessions;
create policy "own read" on sessions for select using (auth.uid() = owner);
create policy "own insert" on sessions for insert with check (auth.uid() = owner);
create policy "own update" on sessions for update using (auth.uid() = owner);
create policy "own delete" on sessions for delete using (auth.uid() = owner);

drop policy if exists "own read" on measurements;
drop policy if exists "own insert" on measurements;
drop policy if exists "own update" on measurements;
drop policy if exists "own delete" on measurements;
create policy "own read" on measurements for select using (auth.uid() = owner);
create policy "own insert" on measurements for insert with check (auth.uid() = owner);
create policy "own update" on measurements for update using (auth.uid() = owner);
create policy "own delete" on measurements for delete using (auth.uid() = owner);

drop policy if exists "own read" on templates;
drop policy if exists "own insert" on templates;
drop policy if exists "own update" on templates;
drop policy if exists "own delete" on templates;
create policy "own read" on templates for select using (auth.uid() = owner);
create policy "own insert" on templates for insert with check (auth.uid() = owner);
create policy "own update" on templates for update using (auth.uid() = owner);
create policy "own delete" on templates for delete using (auth.uid() = owner);

drop policy if exists "own read" on settings;
drop policy if exists "own upsert" on settings;
drop policy if exists "own update" on settings;
create policy "own read" on settings for select using (auth.uid() = owner);
create policy "own upsert" on settings for insert with check (auth.uid() = owner);
create policy "own update" on settings for update using (auth.uid() = owner);

-- ============================================================================
-- Monetization: purchases table (unified Stripe / PayPal entitlement store)
-- ============================================================================
-- A purchase row represents a successfully paid transaction that unlocks either
-- a specific program pack (Stripe style) or global access (PayPal unlock-all).
-- Provider specific uniqueness guaranteed via (provider, external_id).
-- NOTE: Run this block after initial core tables. Safe & idempotent.

create table if not exists purchases (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,               -- 'stripe' | 'paypal' | future
  external_id text not null,            -- provider's order/session id
  status text not null default 'paid',  -- 'paid' | 'refunded' | 'revoked'
  amount_cents integer,                 -- stored in smallest currency unit
  currency text,                        -- e.g. 'usd'
  pack_id text,                         -- nullable if unlock-all purchase
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Uniqueness for idempotent upserts per provider event
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'uniq_purchases_provider_external'
  ) then
    execute 'create unique index uniq_purchases_provider_external on purchases(provider, external_id)';
  end if;
end $$;

-- Fast lookup by user
create index if not exists purchases_user_idx on purchases(user_id);
create index if not exists purchases_pack_idx on purchases(pack_id);

-- Touch updated_at automatically
create trigger purchases_updated before update on purchases for each row execute function extensions.moddatetime(updated_at);

alter table purchases enable row level security;
-- Policies: users can view their own rows (by user_id). Inserts/updates handled by service role (bypass RLS).
drop policy if exists "purchases own read" on purchases;
drop policy if exists "purchases own update" on purchases;
create policy "purchases own read" on purchases for select using (auth.uid() = user_id);
create policy "purchases own update" on purchases for update using (auth.uid() = user_id);

-- (Optionally) If you later want non-authenticated PayPal flows tied by email, add a user_email column and adapt policies.
