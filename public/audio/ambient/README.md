# Ambient audio assets

Manifest-driven ambient system with **95 stems** across **7 profiles**.

- Manifest: `public/audio/ambient/manifest.json`
- Generator: `scripts/audio/generateStems.mjs`
- Runtime loads stems from manifest paths.

## Profiles

| Profile | Mode | Layers | Stems | Description |
|---------|------|--------|-------|-------------|
| focus_soft | focus | 4 | 17 | Original neutral ambient texture |
| focus_warm | focus | 4 | 15 | Singing bowl-inspired inharmonic partials with slow beating |
| nature_air | focus | 4 | 14 | Birdsong chirps, wind, distant stream |
| rain_gentle | focus | 4 | 14 | Dense pink noise rain, muffled room layer |
| deep_hum | focus | 3 | 11 | Low drone with 40 Hz gamma component, theta beating |
| cafe_murmur | focus | 4 | 14 | Formant murmur, soft ceramic clinks, warm room |
| competitive_clean | competitive | 3 | 10 | Neutral, low-distraction competitive mode |

## Regenerating stems

```bash
# Regenerate all profiles
node scripts/audio/generateStems.mjs

# Regenerate a single profile
node scripts/audio/generateStems.mjs --profile rain_gentle
```

Generation is deterministic (seeded RNG). The same stem IDs always produce the same audio.

## Stem format

- 48 kHz / 16-bit / stereo / 10 seconds (~1.9 MB per file)
- WAV format (PCM)

## Expected manifest fields

Each stem entry includes:

- `id`: stable stem id (string)
- `mode`: `focus` | `competitive`
- `profile`: e.g. `focus_soft`, `rain_gentle`, `deep_hum`
- `layer`: `low_bed` | `mid_texture` | `mid_presence` | `air` | `room`
- `path`: public URL path
- `lufs_i`: integrated loudness (LUFS-I)
- `features`: `{ brightness, density, movement }`

## Notes

- Missing/invalid assets fail-safe to silence (no crash).
- Screen Reader Mode forces ambient off; Reduced Motion disables macro evolutions.
- Debug: set `localStorage.lkt_ambient_debug = "1"` and watch console logs.
- The `random` profile setting (default) picks a different focus profile each page load.
