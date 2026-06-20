# Supabase Performance Checklist

Use this before adding indexes or changing regions.

## Startup Requests

- Prefer `get_liftlog_app_snapshot()` for startup/background sync.
- Keep per-table REST reads as fallbacks and for single-row legacy migration paths.
- Watch metrics: `app_snapshot_sync_ms`, `background_sync_ms`, `bootstrap_ready_ms`, and `time_to_first_cached_paint_ms`.

## Indexes

Current query pattern is owner-scoped table reads and owner-scoped incremental sync by `updated_at`.

Expected indexes:

- `*_owner_idx` on `owner`
- `*_owner_updated_idx` on `(owner, updated_at)`

Do not add indexes for columns that do not exist in this schema, such as `user_id`, `event_id`, or `status`.

## Supabase Dashboard Checks

In Supabase Dashboard:

1. Open Database -> Query Performance.
2. Review slow queries after real tester usage.
3. Open Index Advisor and check only queries that match actual app paths.
4. Add an index only when it matches a repeated slow query.
5. Re-test after adding the index because over-indexing can slow writes.

## Column Selection

- Core store reads should use `id,data` or `id,data,updated_at`, not `*`.
- Profile reads should select explicit fields needed by the app.
