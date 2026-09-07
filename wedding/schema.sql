-- Run once in the existing project's Supabase SQL editor. Does not modify other apps.
begin;
create schema if not exists wedding_private;
revoke all on schema wedding_private from public, anon, authenticated;

create table wedding_private.settings (
  singleton boolean primary key default true check (singleton),
  invite_hash text not null,
  accepting_responses boolean not null default true
);
create table public.wedding_organisers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.wedding_responses (
  id uuid primary key,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  attending boolean not null,
  dietary_notes text not null default '' check (char_length(dietary_notes) <= 1000),
  message text not null default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);
create unique index wedding_response_identity on public.wedding_responses
  (lower(first_name), lower(last_name), lower(email));
create index wedding_response_created on public.wedding_responses (created_at);
create index wedding_response_email_created on public.wedding_responses (email, created_at);
alter table public.wedding_responses enable row level security;
alter table public.wedding_organisers enable row level security;
revoke all on public.wedding_responses, public.wedding_organisers from public, anon, authenticated;
grant select on public.wedding_responses, public.wedding_organisers to authenticated;
create policy wedding_organiser_self on public.wedding_organisers for select to authenticated
  using (user_id = (select auth.uid()));
create policy wedding_organiser_read on public.wedding_responses for select to authenticated
  using (exists (select 1 from public.wedding_organisers where user_id = (select auth.uid())));

create function public.submit_wedding_rsvp(
  p_request_id uuid, p_invite_code text, p_first_name text, p_last_name text,
  p_email text, p_attending boolean, p_dietary_notes text default '',
  p_message text default '', p_website text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  settings wedding_private.settings%rowtype;
  previous public.wedding_responses%rowtype;
  first_name_clean text := pg_catalog.regexp_replace(pg_catalog.btrim(p_first_name), '\s+', ' ', 'g');
  last_name_clean text := pg_catalog.regexp_replace(pg_catalog.btrim(p_last_name), '\s+', ' ', 'g');
  email_clean text := pg_catalog.lower(pg_catalog.btrim(p_email));
begin
  select * into settings from wedding_private.settings where singleton;
  if not found then raise exception 'RSVPS_CLOSED'; end if;
  if p_invite_code is null or char_length(p_invite_code) > 128 or
     pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.btrim(p_invite_code), 'UTF8')), 'hex') <> settings.invite_hash then
    raise exception 'INVALID_INVITATION';
  end if;
  if p_request_id is null or p_attending is null or
     first_name_clean is null or char_length(first_name_clean) not between 1 and 80 or
     last_name_clean is null or char_length(last_name_clean) not between 1 and 80 or
     email_clean is null or char_length(email_clean) > 254 or email_clean !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     p_dietary_notes is null or char_length(p_dietary_notes) > 1000 or
     p_message is null or char_length(p_message) > 1000 or coalesce(p_website, '') <> '' then
    raise exception 'INVALID_RESPONSE';
  end if;
  -- Serialises this small wedding's writes so concurrent requests cannot bypass limits.
  perform pg_catalog.pg_advisory_xact_lock(2709261400);
  select * into previous from public.wedding_responses where id = p_request_id;
  if found then
    if previous.first_name = first_name_clean and previous.last_name = last_name_clean and
       previous.email = email_clean and previous.attending = p_attending and
       previous.dietary_notes = (case when p_attending then pg_catalog.btrim(p_dietary_notes) else '' end) and
       previous.message = pg_catalog.btrim(p_message) then
      return jsonb_build_object('status', 'received');
    end if;
    raise exception 'INVALID_RESPONSE';
  end if;
  if not settings.accepting_responses then raise exception 'RSVPS_CLOSED'; end if;
  if exists (select 1 from public.wedding_responses where lower(first_name) = lower(first_name_clean)
      and lower(last_name) = lower(last_name_clean) and email = email_clean) then
    raise exception 'DUPLICATE_RSVP';
  end if;
  if (select count(*) from public.wedding_responses where email = email_clean and created_at > now() - interval '1 hour') >= 12 or
     (select count(*) from public.wedding_responses where created_at > now() - interval '24 hours') >= 500 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.wedding_responses (id, first_name, last_name, email, attending, dietary_notes, message)
  values (p_request_id, first_name_clean, last_name_clean, email_clean, p_attending,
          case when p_attending then pg_catalog.btrim(p_dietary_notes) else '' end, pg_catalog.btrim(p_message));
  return jsonb_build_object('status', 'received');
end;
$$;
revoke all on function public.submit_wedding_rsvp(uuid,text,text,text,text,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_wedding_rsvp(uuid,text,text,text,text,boolean,text,text,text) to anon, authenticated;
commit;
