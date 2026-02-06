# LoKey Typer

Vite + React + TypeScript typing app with a calm, adult-focused default experience and an opt-in Competitive mode.

Phase 1 includes:

- Modes: Focus, Real-Life, Competitive
- Curated local content packs (static JSON)
- Typing engine with accuracy/WPM metrics + end-of-run feedback
- Local-only persistence (preferences, recents, run history, personal bests)
- Optional low-latency mechanical typewriter audio (sample files optional; synth fallback)

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — TypeScript build-only typecheck
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
- `npm run gen:phase2-content` — regenerate deterministic Phase 2 packs + extras JSON
- `npm run validate:content` — schema + structural validation for all content packs
- `npm run smoke:rotation` — novelty/rotation smoke test (duplicates + template day-to-day change rate)
- `npm run qa:ambient:assets` — checks `public/audio/ambient/**` for expected ambient WAV layer filenames
- `npm run qa:phase3:novelty` — simulates 14 days of daily sets and reports duplicate rate
- `npm run qa:phase3:recommendation` — recommendation sanity simulation (novelty + weak-tag bias)

## Code structure

- `src/app` — app wiring (router, shell/layout, global providers)
- `src/features` — feature-owned UI (pages + feature components)
- `src/lib` — shared domain logic (storage, typing metrics, audio/ambient, etc.)
- `src/content` — content types + content pack loading

See `modular.md` for the repository modularity contracts (public APIs, import boundaries, effective prefs rules, and content gateway guarantees).

## Docs

- `modular.md` — architecture + import boundary contracts (treat as “law”)
- `personalization_engine.md` — Phase 3 plan for recommendations/daily sets (rules + metrics)

## Contributing

- Read `modular.md` before adding new modules or refactoring imports.
- Keep these checks green: `npm run lint` and `npm run build`.

### Import aliases

To keep imports stable as the repo grows (and to avoid Windows casing/path edge-cases), the app uses these aliases:

- `@app` / `@app/*` → `src/app` (public entrypoint is `src/app/index.ts`)
- `@features` / `@features/*` → `src/features` (public entrypoint is `src/features/index.ts`)
- `@content` / `@content/*` → `src/content` (public entrypoint is `src/content/index.ts`)
- `@lib` / `@lib/*` → `src/lib/public` (public lib surface; entrypoint is `src/lib/public/index.ts`)

Lib internals are available only via:

- `@lib-internal/*` → `src/lib/*`

Notes:

- Feature modules are expected to import from public entrypoints (`@lib`, `@content`, `@app`). ESLint enforces that features don’t reach into internals.
- `@lib-internal/*` is intentionally unstable and is restricted to app wiring/providers.

App wiring can also import app-level exports from the public entrypoint:

- `@app` → `src/app/index.ts`

## Run locally

```bash
npm ci
npm run dev
```

If you’re iterating on deps locally:

```bash
npm install
npm run dev
```

Build + preview:

```bash
npm run build
npm run preview
```

## Routes

- `/` — Home
- `/daily` — Daily Set
- `/focus` — Focus mode hub
- `/real-life` — Real-Life mode hub
- `/competitive` — Competitive mode hub

Each mode supports:

- `/<mode>/exercises` — exercise list
- `/<mode>/settings` — mode/global settings
- `/<mode>/run/:exerciseId` — run an exercise

Notes:

- Legacy routes `/practice` and `/arcade` redirect into the new mode structure.
- Competitive runs support query params like `?duration=60000` and `?ghost=1`.

## Windows MSIX packaging note

This app is configured as a PWA (via `vite-plugin-pwa`). On Windows you can:

- Install it as a PWA from a Chromium-based browser (Edge/Chrome) once hosted (even locally for testing).
- Package it into an MSIX using the Windows **MSIX Packaging Tool** (capture the installed PWA as an app), depending on your distribution needs.

If you prefer an MSIX-first workflow, you can also use PWA-to-MSIX tooling (outside this repo) to generate an MSIX from the PWA manifest/build output.
