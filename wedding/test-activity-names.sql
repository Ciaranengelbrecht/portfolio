-- Run after test-activity.sql, only in a disposable local PostgreSQL instance.
\set ON_ERROR_STOP on
\ir activity-names.sql
select public.test_assert((select count(*) = 1001 from public.wedding_activity), 'upgrade preserves existing activity');
select public.test_assert((select count(*) = 0 from public.wedding_activity where named_at is not null), 'older visits are unnamed');
truncate public.wedding_activity;
set role anon;
select public.test_reject('select guest_first_name from public.wedding_activity', 'permission denied');
select public.test_reject($q$select public.identify_wedding_visit(gen_random_uuid(),'wrong','Guest','Name')$q$, 'INVALID_INVITATION');
select public.test_reject($q$select public.identify_wedding_visit(gen_random_uuid(),'local-test-invitation-code',' ','')$q$, 'INVALID_NAME');
select public.test_reject($q$select public.identify_wedding_visit(gen_random_uuid(),'local-test-invitation-code',E'\t\n','')$q$, 'INVALID_NAME');
select public.test_reject($q$select public.identify_wedding_visit(gen_random_uuid(),'local-test-invitation-code',repeat('x',81),'')$q$, 'INVALID_NAME');
select public.test_reject($q$select public.identify_wedding_visit(null,'local-test-invitation-code','Guest','Name')$q$, 'INVALID_NAME');
select public.record_wedding_activity('30000000-0000-4000-8000-000000000001','local-test-invitation-code','page_view');
select public.identify_wedding_visit('30000000-0000-4000-8000-000000000001','local-test-invitation-code','  Ana   María  ','O’Neill');
select public.identify_wedding_visit('30000000-0000-4000-8000-000000000001','local-test-invitation-code','  Ana   María  ','O’Neill');
select public.record_wedding_activity('30000000-0000-4000-8000-000000000003','local-test-invitation-code','rsvp_click','30000000-0000-4000-8000-000000000001');
select public.identify_wedding_visit('30000000-0000-4000-8000-000000000002','local-test-invitation-code','Sam','');
select public.record_wedding_activity('30000000-0000-4000-8000-000000000002','local-test-invitation-code','page_view','30000000-0000-4000-8000-000000000002');
select public.test_reject($q$select public.record_wedding_activity(gen_random_uuid(),'local-test-invitation-code','page_view','30000000-0000-4000-8000-000000000002')$q$, 'INVALID_ACTIVITY');
reset role;
select public.test_assert((select count(*) = 3 from public.wedding_activity), 'naming before or after open and repeated naming do not double count');
select public.test_assert((select guest_first_name = 'Ana María' and guest_last_name = 'O’Neill' from public.wedding_activity where event_id='30000000-0000-4000-8000-000000000001'), 'names normalised and preserved');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.test_assert((select count(*) = 0 from public.wedding_activity), 'other app users cannot read names');
select public.test_reject('select public.get_wedding_activity()', 'ORGANISER_REQUIRED');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.test_assert(public.get_wedding_activity()->>'page_views' = '2', 'organiser sees preserved view count');
select public.test_assert(public.get_wedding_activity()->>'named_visits' = '2', 'organiser sees named count');
select public.test_assert((select v->>'rsvp_clicks' = '1' from jsonb_array_elements(public.get_wedding_activity()->'visits') v where v->>'first_name' = 'Ana María'), 'clicks attached to the named visit');
select public.test_reject($q$update public.wedding_activity set guest_first_name='Changed'$q$, 'permission denied');
reset role;
