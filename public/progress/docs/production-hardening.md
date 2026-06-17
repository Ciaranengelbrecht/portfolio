# LiftLog Production Hardening Checklist

This checklist covers the Supabase-backed LiftLog PWA before broader public testing. Keep it non-destructive: do not reset the database, recreate the project, or rerun schema setup in a way that drops user data.

## Repo Checks

- Run `npm run audit:secrets` from `public/progress`.
- Tracked `VITE_SUPABASE_ANON_KEY` values are allowed because they are public browser keys. Security must come from RLS and authenticated policies, not from hiding the anon key.
- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_*`, database URLs, JWT secrets, keystores, signing files, or copied auth access/refresh tokens.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase Edge Function secrets.

## Supabase RLS Checks

Run these in Supabase SQL Editor:

1. `supabase.rls-maintenance.sql`
   - Fixes `auth_rls_initplan` warnings.
   - Removes the stale duplicate `update_own_profile` policy.
   - Does not delete table data.

2. `supabase.rls-audit.sql`
   - Read-only audit.
   - Expected result after maintenance: zero rows.
   - Any returned row means an app table is missing RLS, missing an expected policy, has a broad policy, or there is an unexpected public table.

Then rerun:

- Database > Security Advisor
- Database > Performance Advisor

## Endpoint And Rate Limit Checks

- The only server-side endpoint is the `delete-account` Edge Function.
- It must validate the caller with `auth.getUser()` before using the service role key.
- It should delete only rows scoped to the authenticated user:
  - `owner = user.id` for app data tables.
  - `id = user.id` for `profiles`.
- The function has a CORS allowlist. If deployment uses another origin, set `DELETE_ACCOUNT_ALLOWED_ORIGINS` in Supabase function secrets as a comma-separated list.
- Check Supabase Dashboard > Authentication > Rate Limits. Keep defaults unless real abuse or launch traffic suggests otherwise.
- Use Edge Function logs to watch for repeated `401`, `403`, or high-volume `POST /delete-account` attempts.

## Database And Scale Checks

- Keep the existing owner-scoped indexes in `supabase.schema.sql`:
  - `owner`
  - `(owner, updated_at)`
- Use `pg_stat_statements`/Performance Advisor after real traffic before adding more indexes.
- Keep app caches and in-flight request deduplication in `db.ts` and `dataCache.ts`.
- If query reports still show high realtime/list traffic after RLS maintenance, prioritize:
  - owner-filtered realtime subscriptions,
  - coalescing forced refreshes after realtime/auth events,
  - avoiding repeated forced `getAllCached(..., { force: true })` calls.
- Avoid denormalizing JSON data until fresh production stats show a specific bottleneck.

## Manual Acceptance Checks

- Account A can create, update, and delete sessions, exercises, measurements, templates, and settings.
- Account B cannot read or modify Account A rows.
- A dummy account can delete itself through Settings.
- Security Advisor has no RLS warnings for LiftLog tables.
- Performance Advisor has no missing-index warning for the main app queries.
