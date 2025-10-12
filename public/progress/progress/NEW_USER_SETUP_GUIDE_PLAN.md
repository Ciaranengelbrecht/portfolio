# Guided Setup Experience – Technical Plan

## Goals
- Provide first-time users with a step-by-step assistant that configures a personalised training program.
- Gather key preferences (experience level, days per week, focus muscles, typical sets) and translate them into a balanced weekly split, suggested templates, and exercise recommendations.
- Deliver inline guidance, explanations, and smart defaults so users feel supported while retaining full control.
- Seamlessly integrate outputs with existing program, template, and session systems (Supabase-backed via `db`).

## Success Criteria
- Launchable from a prominent “Guided Setup” entry point (primary button on Program page + optional top-level banner when no program exists).
- Wizard supports resume/dismiss states; partial progress stored locally.
- Generates a valid `UserProgram` with `weeklySplit`, `mesoWeeks`, `deload` and persists via `saveProfileProgram` / `setProgram`.
- Optionally creates/updates Templates and applies them to future sessions (re-using existing planner logic).
- Offers contextual hints, recommended ranges, and exercise suggestions aligned with user goals.
- Fully keyboard/touch accessible, mobile friendly, dark-mode native.

## User Flow
1. **Entry & welcome** – explain value, highlight ability to tweak later.
2. **Training background** – ask experience (beginner/intermediate/advanced), time constraints, equipment access (home/gym/minimal).
3. **Schedule selection** – choose preferred training days per week, indicate rest day preferences, optionally lock mandatory rest days.
4. **Goal focus** – select primary & secondary muscle priorities, optionally choose strength vs hypertrophy bias.
5. **Volume calibration** – confirm preferred sets per session and tolerance for weekly volume (auto-suggest ranges with sliders + helper text referencing evidence-based totals).
6. **Auto-distribution review** – show proposed weekly split (day labels, focus per day) and highlight how muscle priorities were addressed; allow quick adjustments.
7. **Template seed** – present curated template suggestions per day (based on equipment + goals). Users can accept or swap exercises before finishing.
8. **Summary & confirm** – recap program parameters, deload plan, next steps. On confirm, persist program + optional templates, run session allocation helper, surface tips for exploring Sessions/Templates pages.
9. **Post-complete hints** – show quick access to editing templates, measurement tracking, etc., via snack/toast or inline banner.

## Data Model & Persistence
- Extend `Settings.progress` with onboarding progress markers (e.g. `guidedSetupCompleted: boolean`, `guidedSetupDraft?: GuidedSetupState`).
- Introduce new type `GuidedSetupState` (kept under `src/lib/types.ts` or dedicated module) capturing user answers across steps.
- Add helper functions in `src/lib/guidedSetup.ts`:
  - `suggestWeeklySplit(state: GuidedSetupState): WeeklySplitDay[]`
  - `calculateVolumeTargets(state: GuidedSetupState): Record<string, number>`
  - `buildTemplatePlan(state, split, catalog): TemplateDraft[]`
  - `generateProgram(state, split): UserProgram`
- Persist draft state locally (IndexedDB `settings` row) to support resume/cancel flows.

## UI Architecture
- Create `features/guided-setup/GuidedSetupWizard.tsx` containing the multi-step flow.
- Leverage shared Card/Modal styles with `glass-card` aesthetic; use `Dialog` overlay (existing `components/Modal` if available) or create new full-screen overlay with breadcrumb header and progress indicator.
- Steps implemented as individual components inside `features/guided-setup/steps/` for maintainability.
- Provide `useGuidedSetup()` hook managing state machine, validation, and transitions.
- Include contextual helper components: `TipCallout`, `MusclePriorityPicker`, `ScheduleGrid`, `ExerciseSuggestionList`.

## Algorithm Notes
- **Weekly Split**: Map day count → recommended patterns (e.g. 3d = Full Body + Upper/Lower emphasis; 4d = Upper/Lower x2; 5d = Upper/Lower/Push/Pull/Legs; 6d = PPL x2). Adjust slots to emphasise selected priority muscles by tagging day focus.
- **Volume Distribution**: Start from evidence-based weekly set ranges (per muscle) adjusted for experience (beginner: 8-10, intermediate: 10-14, advanced: 12-18). Scale by priority weighting (primary +25%, secondary +10%, maintenance -25%). Ensure total sets per day align with user’s “sets per session” answer; use heuristic to keep sessions within ±2 sets of target.
- **Exercise Suggestions**: Filter `exercises` catalogue by muscle focus + equipment availability + tags. Provide top 3 recommended options per slot, fallback to default templates. Mark optional accessories.
- **Deload Strategy**: If user is beginner or low volume, default to `last-week`; advanced/high volume -> `interval` every 6 weeks.
- **Template Generation**: Compose `Template` drafts with curated exercise lists, storing `plannedSets` / `repRange` derived from priorities (strength bias uses 4-6, hypertrophy 8-12, endurance 12-15). Allow user to toggle exercises before saving.

## Integration & Side Effects
- On submit: save program via `saveProfileProgram`, update context, update `settings.progress.guidedSetupCompleted`, store new templates via `db.put("templates")`, optionally run `applyProgramToFutureSessions` variant for blank sessions.
- Provide undo/rollback by storing previous program summary and offering a toast with “Restore previous program”.
- Emit `sb-change` events for `templates`, `sessions`, `settings` as needed.

## Telemetry & Validation
- Add lightweight optional logging (console or future analytics) capturing step completion, used choices (for future iteration).
- Unit-test core algorithms (volume distribution, split suggestion) under `src/tests/guidedSetup.test.ts`.
- Integration test that final `UserProgram` passes `validateProgram` and templates abide by session set limits.

## Milestones & Deliverables
1. **Foundation (current step)** – finalize design, create types, stub wizard shell with placeholder steps.
2. **Questionnaire & State Machine** – implement steps, validation, in-memory state persistence.
3. **Recommendation Engine** – add algorithms that output split, volume targets, templates.
4. **Program & Template Persistence** – wire to DB, ensure idempotent saves, add rollback option.
5. **UX Polish & Guidance** – copywriting, helper tooltips, animations, accessibility tests.
6. **Testing & QA** – unit tests, manual smoke, run `npm run build`.

## Open Questions / Next Decisions
- Should guided setup auto-create sessions for upcoming weeks or rely on existing scheduler? (lean towards reusing existing session creation pipeline.)
- Do we allow users to skip exercise suggestions and start from blank templates? (likely yes, provide “Skip – I’ll add later”.)
- Where else should we surface entry point? (Dashboard banner when program volume < threshold.)

---
Prepared: 12 Oct 2025
