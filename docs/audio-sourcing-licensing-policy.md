# Audio Sourcing + Licensing Policy (Ambient Stems)

This policy exists so contributors can expand LoKey Typer’s ambient library safely and consistently.

## Licensing (hard rule)

**Only CC0 audio is accepted.**

- Allowed: **CC0 1.0 (Public Domain dedication)**
- Not accepted: CC-BY, CC-BY-SA, CC-BY-NC, “royalty-free” custom licenses, or anything that requires attribution, restricts commercial use, or adds redistribution limits.

Rationale: LoKey Typer ships audio files directly in the repository/app. CC0 is the only option that stays unambiguous for redistribution and future distribution channels.

## What we are (and are not) looking for

LoKey Typer ambience is an **environment**, not music.

Target qualities (must-have):
- Non-rhythmic (no BPM, pulse, groove)
- No sharp transients or “events”
- No melodic foreground / hook
- Comfortable for long sessions

See the formal constraints in:
- `docs/sound-design-manifesto.md`
- `docs/sound-design.md`
- `docs/audio-review-checklist.md`

## Recommended sources (CC0-friendly)

Prefer reputable catalogs where individual items clearly display **CC0**.

- Freesound (filter to CC0 only)
- OpenGameArt (filter to CC0 only)

Important: even if a site allows uploads under CC0, **still sanity-check provenance** (e.g., avoid anything that sounds like it was ripped from a game/film/song).

## Search terms that usually work

Use these as starting points when searching CC0 catalogs:

- “room tone”, “roomtone”, “air tone”, “airtone”
- “broadband noise”, “texture”, “drone”, “wash”, “bed”
- “ventilation hum”, “distant wind”, “soft wind”, “far ambience”
- “tape hiss” (only if not tonal/whistling)

Avoid search terms like:
- “lofi”, “beat”, “bpm”, “drums”, “melody”, “song”, “music loop”

## Quick acceptance checklist (before you add files)

1) License shown as **CC0** on the asset’s page
2) No audible rhythm / pulse
3) No obvious repeating transient pattern
4) No hook / melody / foreground motif
5) Feels OK after ~10 minutes at low volume (then do the full review per `docs/audio-review-checklist.md`)

## When adding stems to the repo

- Add WAVs under `public/audio/ambient/**` following existing folder conventions.
- Update `public/audio/ambient/manifest.json` with:
  - `id`, `mode`, `profile`, `layer`, `path`, `length_sec`, `lufs_i`
- Run:
  - `npm run qa:ambient:assets`
  - `npm run qa:sound-design`

## Procedurally generated stems

Most ambient stems are **procedurally synthesized** using `scripts/audio/generateStems.mjs`. These stems:

- Use no external audio samples — they are synthesized from DSP primitives (oscillators, noise generators, filters, reverb)
- Have no licensing concerns — they are original generated works
- Can be regenerated at any time with `node scripts/audio/generateStems.mjs`
- Are deterministic (seeded RNG) — the same stem IDs always produce the same audio

The CC0-only policy applies to any *externally sourced* stems that might be added in the future. The procedurally generated stems in the current library are original works.

## Notes

- CC0 means you can use/modify/distribute, including commercially, without permission. Don't imply the original creator endorses LoKey Typer.
- If we ever want to accept CC-BY in the future, we should add an explicit attribution system first. Until then: **CC0 only**.
