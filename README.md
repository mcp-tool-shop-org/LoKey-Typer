<p align="center">
  <img src="assets/logo.png" alt="LoKey Typer" width="280" />
</p>

A calm typing practice app with ambient soundscapes, personalized daily sets, and no accounts required.

## What it is

LoKey Typer is a typing practice app built for adults who want quiet, focused sessions without gamification, leaderboards, or distractions.

All data stays on your device. No accounts. No cloud. No tracking.

## Practice modes

- **Focus** — Calm, curated exercises for building rhythm and accuracy
- **Real-Life** — Practice with emails, code snippets, and everyday text
- **Competitive** — Timed sprints with personal bests
- **Daily Set** — A fresh set of exercises generated each day, adapted to your recent sessions

## Features

- Ambient soundscapes designed for sustained focus (42 tracks, non-rhythmic)
- Mechanical typewriter keystroke audio (optional)
- Personalized daily exercises based on recent sessions
- Full offline support after first load
- Accessible: screen reader mode, reduced motion, sound-optional

## Install

**Microsoft Store** (recommended):
[Get it from the Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Browser PWA:**
Visit the [web app](https://mcp-tool-shop-org.github.io/LoKey-Typer/) in Edge or Chrome, then click the install icon in the address bar.

## Privacy

LoKey Typer collects no data. All preferences, run history, and personal bests are stored locally in your browser. See the full [privacy policy](https://mcp-tool-shop-org.github.io/LoKey-Typer/privacy.html).

## License

MIT. See [LICENSE](LICENSE).

---

## Development

### Run locally

```bash
npm ci
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — TypeScript build-only typecheck
- `npm run lint` — ESLint
- `npm run preview` — preview production build locally
- `npm run validate:content` — schema + structural validation for all content packs
- `npm run gen:phase2-content` — regenerate Phase 2 packs
- `npm run smoke:rotation` — novelty/rotation smoke test
- `npm run qa:ambient:assets` — ambient WAV asset checks
- `npm run qa:sound-design` — sound design acceptance gates
- `npm run qa:phase3:novelty` — daily set novelty simulation
- `npm run qa:phase3:recommendation` — recommendation sanity simulation

### Code structure

- `src/app` — app wiring (router, shell/layout, global providers)
- `src/features` — feature-owned UI (pages + feature components)
- `src/lib` — shared domain logic (storage, typing metrics, audio/ambient, etc.)
- `src/content` — content types + content pack loading

See `modular.md` for architecture contracts and import boundaries.

### Import aliases

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (public API surface)
- `@lib-internal` → `src/lib` (restricted to app wiring/providers)

### Routes

- `/` — Home
- `/daily` — Daily Set
- `/focus` — Focus mode
- `/real-life` — Real-Life mode
- `/competitive` — Competitive mode
- `/<mode>/exercises` — exercise list
- `/<mode>/settings` — settings
- `/<mode>/run/:exerciseId` — run an exercise

### Docs

- `modular.md` — architecture + import boundary contracts
- `docs/sound-design.md` — ambient sound design framework
- `docs/sound-design-manifesto.md` — sound design manifesto + acceptance tests
- `docs/sound-philosophy.md` — public-facing sound philosophy
- `docs/accessibility-commitment.md` — accessibility commitment
- `docs/how-personalization-works.md` — personalization explainer
