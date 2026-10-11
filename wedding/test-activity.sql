-- Run after test-schema.sql, only in a disposable local PostgreSQL instance.
\set ON_ERROR_STOP on
\ir activity.sql
set role anon;
select public.test_reject('select * from public.wedding_activity', 'permission denied');
select public.test_reject($q$insert into public.wedding_activity values(gen_random_uuid(),'page_view',now())$q$, 'permission denied');
select public.test_reject('select public.get_wedding_activity()', 'permission denied');
select public.test_reject($q$select public.record_wedding_activity(gen_random_uuid(),'wrong','page_view')$q$, 'INVALID_INVITATION');
select public.test_reject($q$select public.record_wedding_activity(gen_random_uuid(),'local-test-invitation-code','invented')$q$, 'INVALID_ACTIVITY');
select public.test_reject($q$select public.record_wedding_activity(null,'local-test-invitation-code','page_view')$q$, 'INVALID_ACTIVITY');
select public.test_assert(public.record_wedding_activity('20000000-0000-4000-8000-000000000001','local-test-invitation-code','page_view')->>'status' = 'recorded', 'anonymous invitation open');
select public.test_assert(public.record_wedding_activity('20000000-0000-4000-8000-000000000001','local-test-invitation-code','page_view')->>'status' = 'recorded', 'unchanged event retry');
select public.test_reject($q$select public.record_wedding_activity('20000000-0000-4000-8000-000000000001','local-test-invitation-code','rsvp_click')$q$, 'INVALID_ACTIVITY');
select public.record_wedding_activity('20000000-0000-4000-8000-000000000002','local-test-invitation-code','rsvp_click');
reset role;
select public.test_assert((select count(*) = 2 from public.wedding_activity), 'activity retry does not double count');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
select public.test_assert((select count(*) = 0 from public.wedding_activity), 'other app users cannot read activity');
select public.test_reject('select public.get_wedding_activity()', 'ORGANISER_REQUIRED');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select public.test_assert(public.get_wedding_activity()->>'page_views' = '1', 'organiser sees one page view');
select public.test_assert(public.get_wedding_activity()->>'rsvp_clicks' = '1', 'organiser sees one RSVP click');
select public.test_assert(jsonb_array_length(public.get_wedding_activity()->'days') = 1, 'organiser sees daily activity');
select public.test_reject('delete from public.wedding_activity', 'permission denied');
reset role;
-- Midnight UTC is already the next day in Perth; use the database clock in tests.
insert into public.wedding_activity values (gen_random_uuid(), 'page_view', (date_trunc('day', now() at time zone 'Australia/Perth') at time zone 'Australia/Perth') - interval '1 second');
set role authenticated;
select public.test_assert(public.get_wedding_activity()->>'today_views' = '1', 'today uses Perth midnight');
reset role;
insert into public.wedding_activity(event_id,event_type)
select gen_random_uuid(),'page_view' from generate_series(1, 998);
set role anon;
select public.test_reject($q$select public.record_wedding_activity(gen_random_uuid(),'local-test-invitation-code','page_view')$q$, 'RATE_LIMITED');
reset role;
