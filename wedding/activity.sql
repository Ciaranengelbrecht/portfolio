-- Add anonymous activity tracking to an already activated wedding database.
-- No invitation codes, names, IP addresses or persistent visitor IDs are stored.
begin;
create table public.wedding_activity (
  event_id uuid primary key,
  event_type text not null check (event_type in ('page_view', 'rsvp_click')),
  created_at timestamptz not null default now()
);
create index wedding_activity_created on public.wedding_activity (created_at);
alter table public.wedding_activity enable row level security;
revoke all on public.wedding_activity from public, anon, authenticated;
grant select on public.wedding_activity to authenticated;
create policy wedding_activity_organiser_read on public.wedding_activity for select to authenticated
  using (exists (select 1 from public.wedding_organisers where user_id = (select auth.uid())));

-- Guest writes need the shared invitation secret, just like RSVP submissions.
-- Direct table writes remain unavailable to every browser client.
create function public.record_wedding_activity(p_event_id uuid, p_invite_code text, p_event_type text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expected_hash text;
  previous_type text;
begin
  select invite_hash into expected_hash from wedding_private.settings where singleton;
  if expected_hash is null or p_invite_code is null or char_length(p_invite_code) > 128 or
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.btrim(p_invite_code), 'UTF8')), 'hex') <> expected_hash then
    raise exception 'INVALID_INVITATION';
  end if;
  if p_event_id is null or p_event_type is null or p_event_type not in ('page_view', 'rsvp_click') then
    raise exception 'INVALID_ACTIVITY';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2709261401);
  select event_type into previous_type from public.wedding_activity where event_id = p_event_id;
  if found then
    if previous_type <> p_event_type then raise exception 'INVALID_ACTIVITY'; end if;
    return jsonb_build_object('status', 'recorded');
  end if;
  if (select count(*) from public.wedding_activity where created_at > now() - interval '1 hour') >= 1000 or
     (select count(*) from public.wedding_activity where created_at > now() - interval '24 hours') >= 5000 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.wedding_activity(event_id, event_type) values (p_event_id, p_event_type);
  return jsonb_build_object('status', 'recorded');
end;
$$;
revoke all on function public.record_wedding_activity(uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_wedding_activity(uuid,text,text) to anon, authenticated;

-- Runs under the organiser's own permissions; the table's RLS still applies.
create function public.get_wedding_activity()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Australia/Perth')::date;
  totals jsonb;
  days jsonb;
begin
  if not exists (select 1 from public.wedding_organisers where user_id = (select auth.uid())) then
    raise exception 'ORGANISER_REQUIRED';
  end if;
  select jsonb_build_object(
    'page_views', count(*) filter (where event_type = 'page_view'),
    'rsvp_clicks', count(*) filter (where event_type = 'rsvp_click'),
    'today_views', count(*) filter (where event_type = 'page_view' and created_at >= (today::timestamp at time zone 'Australia/Perth')),
    'today_clicks', count(*) filter (where event_type = 'rsvp_click' and created_at >= (today::timestamp at time zone 'Australia/Perth')),
    'last_view', max(created_at) filter (where event_type = 'page_view')
  ) into totals from public.wedding_activity;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.day desc), '[]'::jsonb) into days from (
    select (created_at at time zone 'Australia/Perth')::date as day,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'rsvp_click') as rsvp_clicks
    from public.wedding_activity
    where created_at >= ((today - 13)::timestamp at time zone 'Australia/Perth')
    group by 1
  ) d;
  return totals || jsonb_build_object('days', days);
end;
$$;
revoke all on function public.get_wedding_activity() from public, anon, authenticated;
grant execute on function public.get_wedding_activity() to authenticated;
commit;
