# LiftLog Production Release Runbook

## Current Release Shape

- v1 is free: no App Store IAP, no Play Billing, no subscriptions.
- Android ships first as a Trusted Web Activity using the existing Play package `com.ciaranengelbrecht.LiftLog`.
- iOS ships through the Capacitor shell in `ios/` for TestFlight before App Store review.
- The hosted app currently launches from `/progress/dist/index.html`. Keep this stable until hosting is changed to serve the built app directly at `/progress/`.

## Required Gates

Run from `public/progress`:

```bash
npm test
npm run build
npm run verify:dist
```

Before app-store beta, also verify:

- Lighthouse PWA installability against `https://ciaranengelbrecht.com/progress/`.
- Android internal test: launch, sign in, log an offline workout, reconnect, sync, export, delete account, reinstall.
- iOS TestFlight: launch, sign in or magic link, offline mode, safe-area layout, export/import, delete account, app resume/update.
- Multi-device test: same account on two devices, same-day workout edits, stale cache recovery.
- Privacy policy, Apple privacy answers, and Google Data Safety answers match the code.
- Verify sign-up privacy checkbox, Settings privacy link, Play Privacy URL, Data safety answers, and Data deletion answers all match.

## Store Metadata

- App name: LiftLog
- Short description: Track lifting sessions, body measurements, and progress offline.
- Full description: LiftLog is a gym progress tracker for logging workouts, templates, sets, reps, weights, measurements, and body-composition estimates. It works offline, syncs with sign-in, supports export/import backups, and includes account deletion from Settings.
- Category: Health & Fitness
- Support URL: `https://ciaranengelbrecht.com/delete-account-liftlog.html`
- Privacy URL: `https://ciaranengelbrecht.com/progress/privacy.html`
- Review note: LiftLog is not a simple website wrapper. The app provides workout logging, offline-first operation, Supabase sync, body measurements, import/export backups, account deletion, theme/settings controls, and progress analytics.

## Data Safety Defaults

- Data collected: email address, user ID, workout data, body measurements, app settings, optional operational diagnostics.
- Data not collected in v1: payment info, precise location, contacts, photos, advertising identifiers.
- Data sharing: Supabase for auth/database/sync; app-store platform metadata from Apple/Google.
- Data deletion: in-app Settings > Account > Delete account & data, backed by the `delete-account` Supabase Edge Function.

## Operational Checklist

- Deploy `supabase/functions/delete-account` before review.
- Keep `VITE_MONITORING_ENDPOINT` blank unless a first-party endpoint exists.
- Confirm Supabase backups, auth email templates, redirect URLs, RLS, rate limits, and quota.
- Regenerate Android TWA after changing `twa-manifest.json`.
- Run `npm run ios:sync` before opening/submitting the iOS project.
- Store signing keys outside git and CI logs.
