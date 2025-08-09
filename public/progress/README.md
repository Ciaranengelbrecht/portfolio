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

- Enable GitHub Pages: Settings → Pages → Deploy from GitHub Actions.
- Ensure default branch is `main`.
- Push to `main`; the provided workflow builds and publishes `dist` to Pages.
- For a subfolder path, set `base` in `vite.config.ts` to `'/your/subfolder/'`.
- Custom domain: create `CNAME` file at repo root with your domain.

## Data model
See `src/lib/types.ts`.

## Tests

```bash
npm run test
```

Includes minimal tests for deload calculation and persistence utilities.
