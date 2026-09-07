-- Integration tests: ONLY run against a disposable local PostgreSQL database.
-- psql -v ON_ERROR_STOP=1 -f wedding/test-schema.sql <local connection>
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
\ir schema.sql
insert into wedding_private.settings values (true, encode(sha256(convert_to('local-test-invitation-code', 'UTF8')), 'hex'), true);
insert into auth.users values ('00000000-0000-4000-8000-000000000001', 'organiser@local.test'), ('00000000-0000-4000-8000-000000000002', 'outsider@local.test');
insert into public.wedding_organisers values ('00000000-0000-4000-8000-000000000001');
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create function public.test_reject(sql text, expected text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(expected in sqlerrm) > 0 then raise notice 'PASS: rejected %', expected; return; end if;
    raise exception 'Unexpected rejection: % (wanted %)', sqlerrm, expected;
  end;
  raise exception 'FAIL: expected rejection %', expected;
end $$;
set role anon;
select public.test_reject('select * from public.wedding_responses', 'permission denied');
select public.test_reject('select * from wedding_private.settings', 'permission denied');
select public.test_reject('insert into public.wedding_responses(id, first_name, last_name, email, attending) values(gen_random_uuid(),''Fake'',''Guest'',''fake@local.test'',true)', 'permission denied');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'wrong','First','Last','first@local.test',true)$q$, 'INVALID_INVITATION');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),null,'First','Last','first@local.test',true)$q$, 'INVALID_INVITATION');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code',' ','Last','first@local.test',true)$q$, 'INVALID_RESPONSE');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','First','Last','not-an-email',true)$q$, 'INVALID_RESPONSE');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','First','Last','first@local.test',null)$q$, 'INVALID_RESPONSE');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','First','Last','first@local.test',true,'','','https://bot.test')$q$, 'INVALID_RESPONSE');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','First','Last','first@local.test',true,repeat('x',1001))$q$, 'INVALID_RESPONSE');
select public.test_assert(public.submit_wedding_rsvp('10000000-0000-4000-8000-000000000001','local-test-invitation-code',' First ',' Last ','FIRST@local.test',true,' Vegetarian ','Hello')->>'status' = 'received', 'guest can submit without reading responses');
select public.test_assert(public.submit_wedding_rsvp('10000000-0000-4000-8000-000000000001','local-test-invitation-code',' First ',' Last ','FIRST@local.test',true,' Vegetarian ','Hello')->>'status' = 'received', 'unchanged retry succeeds');
select public.test_reject($q$select public.submit_wedding_rsvp('10000000-0000-4000-8000-000000000001','local-test-invitation-code','First','Last','first@local.test',false)$q$, 'INVALID_RESPONSE');
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','FIRST','LAST','first@local.test',false)$q$, 'DUPLICATE_RSVP');
select public.test_assert(public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','Second','Last','first@local.test',false,'Ignored when declining')->>'status' = 'received', 'household can share email and decline');
reset role;
select public.test_assert((select count(*) = 2 from public.wedding_responses), 'retry does not create a duplicate');
select public.test_assert((select dietary_notes = '' from public.wedding_responses where first_name='Second'), 'decline omits dietary notes');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select public.test_assert((select count(*) = 0 from public.wedding_responses), 'unapproved signed-in user cannot read responses');
select public.test_assert((select count(*) = 0 from public.wedding_organisers), 'unapproved user cannot list organisers');
select public.test_reject($q$insert into public.wedding_organisers values ('00000000-0000-4000-8000-000000000002')$q$, 'permission denied');
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
select public.test_assert((select count(*) = 2 from public.wedding_responses), 'organiser sees all responses');
select public.test_assert((select count(*) = 1 from public.wedding_organisers), 'organiser sees own access grant');
select public.test_reject($q$delete from public.wedding_responses$q$, 'permission denied');
reset role;
update wedding_private.settings set accepting_responses = false;
set role anon;
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','New','Guest','new@local.test',true)$q$, 'RSVPS_CLOSED');
select public.test_assert(public.submit_wedding_rsvp('10000000-0000-4000-8000-000000000001','local-test-invitation-code','First','Last','first@local.test',true,'Vegetarian','Hello')->>'status' = 'received', 'confirmed response remains retryable after closing');
reset role;
update wedding_private.settings set accepting_responses = true;
insert into public.wedding_responses(id,first_name,last_name,email,attending)
select gen_random_uuid(), 'Guest'||i, 'Last', 'limited@local.test', true from generate_series(1,12) i;
set role anon;
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','Thirteenth','Last','limited@local.test',true)$q$, 'RATE_LIMITED');
reset role;
insert into public.wedding_responses(id,first_name,last_name,email,attending)
select gen_random_uuid(), 'Bulk'||i, 'Last', 'bulk'||i||'@local.test', true from generate_series(1,486) i;
set role anon;
select public.test_reject($q$select public.submit_wedding_rsvp(gen_random_uuid(),'local-test-invitation-code','Daily','Limit','day@local.test',true)$q$, 'RATE_LIMITED');
reset role;
select public.test_assert((select count(*) = 500 from public.wedding_responses), 'rejected requests never write rows');
