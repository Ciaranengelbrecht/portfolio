-- Upgrade existing activity tracking. Previously recorded visits remain unnamed.
begin;
alter table public.wedding_activity
  add column visit_id uuid,
  add column guest_first_name text not null default '' check (char_length(guest_first_name) <= 80),
  add column guest_last_name text not null default '' check (char_length(guest_last_name) <= 80),
  add column named_at timestamptz;
create index wedding_activity_visit_clicks on public.wedding_activity(visit_id) where event_type = 'rsvp_click';

-- One signature, with an optional argument, preserves older deployed clients.
drop function public.record_wedding_activity(uuid,text,text);
create function public.record_wedding_activity(p_event_id uuid, p_invite_code text, p_event_type text, p_visit_id uuid default null)
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
  if p_event_id is null or p_event_type is null or p_event_type not in ('page_view', 'rsvp_click') or
     (p_event_type = 'page_view' and p_visit_id is not null and p_visit_id <> p_event_id) then
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
  insert into public.wedding_activity(event_id, event_type, visit_id)
  values (p_event_id, p_event_type, case when p_event_type = 'page_view' then p_event_id else p_visit_id end);
  return jsonb_build_object('status', 'recorded');
end;
$$;
revoke all on function public.record_wedding_activity(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_wedding_activity(uuid,text,text,uuid) to anon, authenticated;

create function public.identify_wedding_visit(p_visit_id uuid, p_invite_code text, p_first_name text, p_last_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  first_name_clean text := pg_catalog.btrim(pg_catalog.regexp_replace(p_first_name, '\s+', ' ', 'g'));
  last_name_clean text := pg_catalog.btrim(pg_catalog.regexp_replace(p_last_name, '\s+', ' ', 'g'));
begin
  if p_visit_id is null or first_name_clean is null or last_name_clean is null or
     char_length(first_name_clean) > 80 or char_length(last_name_clean) > 80 or
     (first_name_clean = '' and last_name_clean = '') then
    raise exception 'INVALID_NAME';
  end if;
  -- Verifies the invitation, takes the write lock and ensures the open exists.
  -- This handles naming racing the initial open, or an initial network failure.
  perform public.record_wedding_activity(p_visit_id, p_invite_code, 'page_view', p_visit_id);
  update public.wedding_activity
  set visit_id = p_visit_id, guest_first_name = first_name_clean, guest_last_name = last_name_clean,
      named_at = coalesce(named_at, now())
  where event_id = p_visit_id and event_type = 'page_view';
  return jsonb_build_object('status', 'recorded');
end;
$$;
revoke all on function public.identify_wedding_visit(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.identify_wedding_visit(uuid,text,text,text) to anon, authenticated;

create or replace function public.get_wedding_activity()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Australia/Perth')::date;
  totals jsonb;
  days jsonb;
  visits jsonb;
begin
  if not exists (select 1 from public.wedding_organisers where user_id = (select auth.uid())) then
    raise exception 'ORGANISER_REQUIRED';
  end if;
  select jsonb_build_object(
    'page_views', count(*) filter (where event_type = 'page_view'),
    'rsvp_clicks', count(*) filter (where event_type = 'rsvp_click'),
    'today_views', count(*) filter (where event_type = 'page_view' and created_at >= (today::timestamp at time zone 'Australia/Perth')),
    'today_clicks', count(*) filter (where event_type = 'rsvp_click' and created_at >= (today::timestamp at time zone 'Australia/Perth')),
    'last_view', max(created_at) filter (where event_type = 'page_view'),
    'named_visits', count(*) filter (where event_type = 'page_view' and named_at is not null)
  ) into totals from public.wedding_activity;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.day desc), '[]'::jsonb) into days from (
    select (created_at at time zone 'Australia/Perth')::date as day,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'rsvp_click') as rsvp_clicks
    from public.wedding_activity
    where created_at >= ((today - 13)::timestamp at time zone 'Australia/Perth')
    group by 1
  ) d;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.opened_at desc, v.visit_id desc), '[]'::jsonb) into visits from (
    select p.event_id as visit_id, p.guest_first_name as first_name, p.guest_last_name as last_name,
      p.created_at as opened_at, p.named_at,
      (select count(*) from public.wedding_activity c where c.visit_id = p.event_id and c.event_type = 'rsvp_click') as rsvp_clicks
    from public.wedding_activity p
    where p.event_type = 'page_view'
    order by p.created_at desc, p.event_id desc
    limit 100
  ) v;
  return totals || jsonb_build_object('days', days, 'visits', visits);
end;
$$;
revoke all on function public.get_wedding_activity() from public, anon, authenticated;
grant execute on function public.get_wedding_activity() to authenticated;
commit;
