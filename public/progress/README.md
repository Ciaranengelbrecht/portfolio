# LiftLog

Small, fast PWA to track lifting sessions and body measurements. Built with React + TypeScript + Vite + Tailwind. Works offline with IndexedDB.

## Getting started

1) Install deps

```bash
npm install
```

2) Run dev server

```bash
npm run dev
```

3) Build

```bash
npm run build
```

4) Preview build

```bash
npm run preview
```

## Deploy to GitHub Pages


## Data model
See `src/lib/types.ts`.

## Tests

```bash
npm run test
```

Includes minimal tests for deload calculation and persistence utilities.

### Recovery Model (Heuristic)
The app includes a recovery estimation page that models per-muscle readiness using an exponential decay of accumulated "training stress" from recent sessions (≤5 days window).

Core ideas:
- Each logged set contributes an initial stress S0 scaled by reps × load proxy × effort (assumed near failure) × muscle size modifier.
- S0 reduced for isolation patterns (curl, extension, raise, fly, pullover, pressdown, etc.) and for secondary muscles (40% weighting).
- Per-muscle half-life hours (time to ~50% stress remaining) derive a decay constant Tau = t_half / ln(2).
- RemainingStress = Σ S0_i * exp(-Δt_i / Tau_muscle).
- PercentRecovered = 100 * (1 - RemainingStress / Threshold_muscle) clamped 0–100, where Threshold ≈ 12 × muscleModifier (proxy for multi‑day adaptive capacity).
- Status bands: Ready ≥90%, Near 75–89%, Caution 50–74%, Not Ready <50%.

Baseline half-life hours: shoulders 18, forearms 18, biceps 20, core 20, triceps 22, calves 30, chest 36, back 40, glutes 44, hamstrings 48, quads 48, other 36.

Disclaimer: Heuristic approximation only; true recovery varies with sleep, nutrition, stress, genetics. Treat as guidance not prescription.
