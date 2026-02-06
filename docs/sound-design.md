# Ambient Sound Design & Audit Framework (Phase 3.4)

This document defines LoKey Typer’s **ambient audio quality bar** and the audit steps used to keep it:

- safe for long sessions (30–120+ minutes)
- focus-supporting (not stimulating, not sleep-inducing)
- low cognitive load (no attentional capture)
- accessibility-aware
- non-masking relative to typing feedback

It is written to serve two purposes:

1) **Internal guardrails** for adding or reviewing new ambient stems
2) **Publicly defensible claims** about what the ambient system is (and is not)

## Audit goals (must-haves)

The ambient system must:

- support sustained attention (no “music-like” hooks)
- avoid rhythmic entrainment (no audible BPM / pulse)
- avoid attentional capture (no “moments”)
- remain safe and non-fatiguing for long sessions
- stay subordinate to typing SFX (avoid auditory masking)
- fail safe (missing/invalid assets ⇒ silence, no crash)

## 1) Psychoacoustic design principles

These principles draw on published research in environmental acoustics, psychoacoustics, and stress physiology. Each profile is synthesized to match the acoustic properties of sounds shown to reduce cortisol, support sustained attention, or activate parasympathetic relaxation.

### 1.1 No rhythmic entrainment — aperiodic modulation

**Why**

Rhythmic or periodic audio can entrain attention and motor timing. For a typing trainer, that's undesirable: it competes with reading and keystroke cadence. Additionally, periodic modulation in 10-second looping stems creates audible "looping" artifacts.

**Audit criteria**

- No audible BPM.
- No repeating transient patterns.
- No regular amplitude modulation in ~0.5–4 Hz (where entrainment is strongest).
- No audible periodicity when stems loop seamlessly.

**Implementation: irrational rate modulation**

All amplitude modulation uses 5 incommensurate frequencies based on irrational numbers (golden ratio, sqrt(2), sqrt(3), sqrt(5), sqrt(7)). These mathematically guarantee no repeating pattern within any finite window, eliminating perceived looping.

Each stem variant receives unique phase offsets and rate multipliers derived from its index, ensuring no two variants share modulation patterns.

- Macro evolution intervals are randomized (engine schedules ~3–6 minutes).

**Defensible claim**

> LoKey Typer uses mathematically aperiodic modulation to eliminate both rhythmic entrainment and perceptible looping.

### 1.2 Spectral balance — negative spectral slope

**Why**

Research shows that sounds with negative spectral slopes (-3 to -6 dB/octave) are perceived as calming, while flat or positive slopes increase alertness and fatigue. Natural calming sounds (rain, wind, streams) all share this spectral property.

**Spectral targets per profile**

| Profile | Spectral Slope | Primary Energy Band | Science Basis |
|---------|---------------|---------------------|---------------|
| rain_gentle | -3 dB/oct (pink) | 1–5 kHz broadband | Rain psychoacoustics |
| focus_warm | -3 dB/oct | < 500 Hz | Singing bowl modal analysis |
| nature_air | -3 to -6 dB/oct | 400 Hz–2 kHz + 2–6 kHz chirps | Birdsong + water research |
| deep_hum | -6 dB/oct (brown) | < 200 Hz | Brown noise + 40 Hz gamma |
| cafe_murmur | -6 dB/oct (brown) | 50–500 Hz formants | ASMR + social presence |

**Shared spectral rules**

- No sharp peaks in the 2–4 kHz "alert" band
- Gentle roll-off above 4 kHz in all profiles
- All transients have >50 ms attack (no startle response)

**Manifest metadata**

Each stem includes:

- `lufs_i`: integrated loudness estimate (LUFS-I)
- `features.brightness` (0–1): relative brightness
- `features.density` (0–1): textural density
- `features.movement` (0–1): perceived motion

**Defensible claim**

> Ambient stems use negative spectral slopes matching naturally calming sounds, with no sharp energy in alerting frequency bands.

### 1.3 Loudness safety for long sessions

**Why**

For sustained attention tasks, **loudness stability** matters as much as (or more than) loudness peaks. Distracting level variation can increase perceived fatigue.

**Audit rules**

- Target stem integrated loudness (guidance): **–30 to –34 LUFS-I**.
- Ambient master is capped and remains below typing SFX.
- Only slow drift (micro-variation) is permitted; avoid rapid gain motion.

**Implementation checks**

- Crossfades are long and smooth (no hard cuts).
- Macro swaps change one layer at a time.

**Defensible claim**

> Ambient audio is level-capped and designed for long sessions with stable loudness.

## 2) Cognitive load & attention audit

### 2.1 Event minimization

**Rule**

No sudden changes, sharp onsets, or identifiable “moments.”

**Audit checklist**

- Macro crossfades are long (engine uses multi-second fades; keep ≥ 12s for swaps).
- Never swap more than one layer at a time.
- Do not evolve near task boundaries (the engine avoids evolutions in the final ~20s of an exercise when remaining time is known).

**Defensible claim**

> The soundscape evolves gradually to avoid interrupting attention.

### 2.2 “Change blindness” alignment

This is a desired property: the environment should stay fresh without pulling focus.

**Test prompt (informal)**

After 20–30 minutes of use, ask:

- “Did the sound change?”

A good outcome is often: *“Not really.”* — while objective logs show that evolutions occurred.

**Defensible claim**

> The environment subtly evolves to reduce habituation without drawing attention.

## 3) Typing-specific motor–auditory interference audit

This is where LoKey Typer’s ambient system is intentionally different from a music playlist.

### 3.1 Auditory masking avoidance (typing SFX must stay clear)

**Why**

Masking typing sounds degrades timing feedback and can harm accuracy.

**Rules**

- Ambient stems must not contain percussive transients.
- Ambient energy should be kept lower in upper-mid regions where click/presence cues live.
- Ambient master should remain clearly below typing SFX.

**Defensible claim**

> Ambient audio is mixed to preserve clear keystroke feedback.

### 3.2 Temporal independence from keystrokes

**Rule**

Ambient must not react to typing rhythm.

**Implementation guardrails**

- No envelope followers tied to input.
- No reactive “beat matching” or cadence effects.

**Defensible claim**

> The soundscape remains independent of typing cadence.

## 4) Accessibility & neurodiversity audit

### 4.1 Screen reader compatibility

- Screen Reader Mode forces ambient off.
- No audio-only cues for state changes.

### 4.2 Reduced motion / sensory sensitivity

- Reduced Motion disables macro evolution (micro drift only).
- Ambient can still be used, but should remain conservative.

### 4.3 Cognitive predictability

- No surprise sounds.
- No notification-like cues embedded in ambience.

**Defensible claim**

> Accessibility modes enforce conservative audio behavior by default.

## 5) Long-session fatigue testing protocol (internal)

This is a lightweight protocol you can run and honestly say you ran.

**Suggested internal test**

- 3–5 users
- 45–90 minute typing sessions
- Compare:
  - silence
  - LoKey ambience
  - typical “lofi music”

**Metrics (simple + practical)**

- Self-report fatigue (end + mid-session)
- Desire to turn audio off
- Error rate drift over time
- Perceived distraction

You don’t need to publish numbers to describe the methodology.

## 6) Marketing-safe language (no pseudoscience)

### Safe, defensible phrases

- “Psychoacoustically tuned” (meaning: shaped to avoid distraction/fatigue)
- “Non-rhythmic, non-intrusive”
- “Designed to avoid attentional capture”
- “Designed for long focus sessions”
- “Evolving soundscape without repetition”

### Avoid (not defensible)

- “Scientifically proven to boost productivity”
- “Neuroscience-backed performance gains”
- “Brainwave / binaural claims”

### Example positioning blurb

LoKey Typer uses a non-rhythmic ambient soundscape designed to support sustained focus without distraction. It evolves gradually over time, avoids masking keystroke feedback, and fails safe to silence when audio assets are missing.

## 7) Operational checklist (for adding stems)

When adding a new stem to `public/audio/ambient/**` and `public/audio/ambient/manifest.json`:

- No obvious rhythmic pulse or repeating transients.
- No sharp attacks; use slow fades.
- Loudness is conservative (prefer –30 to –34 LUFS-I guidance).
- Tag/feature metadata is filled in when available (`lufs_i`, `features.*`).
- Validate file existence via `npm run qa:ambient:assets`.

Versioning note: treat changes to this doc as versioned product behavior. If the criteria change, explain why.

## 8) Ambient profile library — science-backed synthesis

All ambient profiles are procedurally synthesized using DSP primitives (state-variable filters, oscillators, noise generators, reverb). No external audio samples are used.

### Profile descriptions

**rain_gentle** — Pink/brown noise shaped to natural rain spectrum
- Pink noise base (-3 dB/oct) with broadband 1–5 kHz peak
- Independent L/R noise streams for stereo width
- Brown noise sub-bass activates vagal response
- Muffled room layer = shelter/safety psychoacoustic signal

**focus_warm** — Singing bowl-inspired inharmonic partials
- Non-integer partial ratios (1:1.503:2.71:4.56) from Tibetan bowl modal analysis
- 2–6 Hz beating from detuned partials = meditative quality
- Sub-octave warmth, energy concentrated below 500 Hz
- Parasympathetic-rate AM (0.05–0.15 Hz)

**nature_air** — Birdsong + stream + wind
- Descending bird chirps (calming; ascending chirps are alerting)
- Brown noise stream (-6 dB/oct) = universally calming water sound
- Pink noise wind with gusty aperiodic AM
- sin^2 envelopes on all chirps guarantee >50 ms attack

**deep_hum** — Brown noise drone + gamma entrainment
- 40 Hz component: linked to enhanced focus and reduced anxiety (Martorell et al.)
- Theta-rate beating (4–8 Hz) on consonant overtones
- Brown noise air layer (not white) avoids alerting high frequencies
- Sub-100 Hz drone stimulates vagus nerve

**cafe_murmur** — ASMR-like formant murmur + fire crackle
- Brown noise through formant filter banks = warm indistinct speech
- Stochastic transients at 0.5–3/sec match fire crackle research
- All transients smoothed with >50 ms attack envelope
- Low-frequency dominance (50–500 Hz) = safety/shelter signal

### Generation

Stems are generated via `node scripts/audio/generateStems.mjs`. Each profile produces 11–15 stems across 3–4 layers (low_bed, mid_texture, air, room). The `random` profile setting picks a different profile each page load for variety.
