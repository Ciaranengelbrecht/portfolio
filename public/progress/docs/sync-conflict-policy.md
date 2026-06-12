# LiftLog Sync Conflict Policy

## Rule

LiftLog uses owner-scoped rows and whole-record upserts. For v1 beta, conflicts resolve by latest meaningful update timestamp where the app records one, otherwise by the last successful write accepted by Supabase.

## User-Facing Behavior

- Sessions preserve `updatedAt`, set completion timestamps, and work logs so recent workout edits can be compared against remote data.
- Settings preserve `settingsUpdatedAt`; newer local settings can sync after reconnect.
- Measurements, templates, and exercises should be edited on one active device during beta when offline for long periods.
- Export remains the recovery path for manual backup before destructive imports or resets.

## Pre-Mass-User Follow-Up

- Add per-record conflict UI for sessions when local and remote `updatedAt` differ after offline edits.
- Add explicit `updatedAt` writes for all measurements, templates, and exercises.
- Add a small conflict event to monitoring without sending workout contents.
