-- LiftLog read-only RLS audit.
-- Run this in Supabase SQL Editor after schema/policy changes.
-- It reports missing RLS, missing policies, broad policies, and unexpected
-- public tables. It does not modify data or database objects.

with expected_tables(table_name) as (
  values
    ('profiles'),
    ('exercises'),
    ('sessions'),
    ('measurements'),
    ('templates'),
    ('settings')
),
expected_policies(table_name, policy_name, command_name) as (
  values
    ('profiles', 'own read', 'SELECT'),
    ('profiles', 'own insert', 'INSERT'),
    ('profiles', 'own update', 'UPDATE'),
    ('exercises', 'own read', 'SELECT'),
    ('exercises', 'own insert', 'INSERT'),
    ('exercises', 'own update', 'UPDATE'),
    ('exercises', 'own delete', 'DELETE'),
    ('sessions', 'own read', 'SELECT'),
    ('sessions', 'own insert', 'INSERT'),
    ('sessions', 'own update', 'UPDATE'),
    ('sessions', 'own delete', 'DELETE'),
    ('measurements', 'own read', 'SELECT'),
    ('measurements', 'own insert', 'INSERT'),
    ('measurements', 'own update', 'UPDATE'),
    ('measurements', 'own delete', 'DELETE'),
    ('templates', 'own read', 'SELECT'),
    ('templates', 'own insert', 'INSERT'),
    ('templates', 'own update', 'UPDATE'),
    ('templates', 'own delete', 'DELETE'),
    ('settings', 'own read', 'SELECT'),
    ('settings', 'own upsert', 'INSERT'),
    ('settings', 'own update', 'UPDATE')
),
app_tables as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (select table_name from expected_tables)
),
policy_rows as (
  select
    tablename as table_name,
    policyname as policy_name,
    cmd as command_name,
    coalesce(qual, '') as using_expression,
    coalesce(with_check, '') as check_expression
  from pg_policies
  where schemaname = 'public'
),
checks as (
  select
    'missing_table' as check_name,
    e.table_name,
    null::text as policy_name,
    'Expected public table is missing' as detail
  from expected_tables e
  left join app_tables t using (table_name)
  where t.table_name is null

  union all

  select
    'rls_disabled',
    t.table_name,
    null::text,
    'RLS is disabled on an expected app table'
  from app_tables t
  where not t.rls_enabled

  union all

  select
    'missing_policy',
    e.table_name,
    e.policy_name,
    'Expected policy is missing'
  from expected_policies e
  left join policy_rows p
    on p.table_name = e.table_name
   and p.policy_name = e.policy_name
   and p.command_name = e.command_name
  where p.policy_name is null

  union all

  select
    'unexpected_public_table',
    c.relname,
    null::text,
    'Public table is not part of the LiftLog policy matrix'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not in (select table_name from expected_tables)

  union all

  select
    'broad_policy',
    p.table_name,
    p.policy_name,
    'Policy expression appears broad: using=' || p.using_expression || ' check=' || p.check_expression
  from policy_rows p
  where p.table_name in (select table_name from expected_tables)
    and (
      lower(regexp_replace(p.using_expression, '\s+', '', 'g')) in ('true', '(true)')
      or lower(regexp_replace(p.check_expression, '\s+', '', 'g')) in ('true', '(true)')
    )

  union all

  select
    'unscoped_policy',
    p.table_name,
    p.policy_name,
    'Policy does not reference auth.uid(): using=' || p.using_expression || ' check=' || p.check_expression
  from policy_rows p
  where p.table_name in (select table_name from expected_tables)
    and p.command_name <> 'ALL'
    and not (
      p.using_expression ilike '%auth.uid%'
      or p.check_expression ilike '%auth.uid%'
    )
)
select *
from checks
order by check_name, table_name, policy_name;

-- Expected result after applying supabase.rls-maintenance.sql: zero rows.
