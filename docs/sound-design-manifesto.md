# LoKey Typer — Sound Design Manifesto

**Version**: v1.0 — Ambient-first architecture

## 1. Purpose

Sound in LoKey Typer is not decoration, motivation, or entertainment. It is part of the interaction substrate.

The ambient system exists to:

- support sustained attention
- avoid attentional capture
- preserve motor–auditory feedback for typing
- remain safe and comfortable for long sessions
- adapt without becoming noticeable

If sound ever becomes the focus, it has failed.

## 2. Design Philosophy

### 2.1 Environment, not music

LoKey Typer does not play songs, tracks, or loops in the musical sense.

Instead, it renders a continuously evolving acoustic environment composed of layered, non-rhythmic textures.

There is no beginning, climax, or ending.

### 2.2 Non-intrusive by default

The system is designed so that:

- users often cannot tell when the sound changes
- but also never feel like they are listening to a repeating loop

Subtle change is preferred over novelty.

### 2.3 Typing comes first

Typing feedback (keystrokes, errors, confirmation sounds) is always:

- audible
- temporally precise
- perceptually distinct

Ambient sound must never mask or compete with typing feedback.

### 2.4 Accessibility is a hard constraint

Accessibility requirements override all aesthetic or experiential goals.

When required:

- ambient audio is disabled automatically
- dynamic behavior is reduced or removed
- no information is conveyed exclusively through sound

## 3. Psychoacoustic Principles

### 3.1 No rhythmic entrainment — aperiodic modulation

The ambient system must not introduce rhythm, tempo, or periodic structure.

**Rationale**

Rhythmic audio entrains attention and motor timing, which interferes with reading and typing. Additionally, simple periodic modulation (sine LFOs) within looping stems creates audible repetition artifacts.

**Rules**

- No BPM-based content
- No repeating transient patterns
- No periodic modulation in the ~0.5–4 Hz range
- No tempo-synchronized changes
- All modulation must be aperiodic

**Implementation: irrational rate ratios**

All amplitude modulation uses 5 summed sinusoids at frequencies related by irrational constants (golden ratio phi=1.618, sqrt(2)=1.414, sqrt(3)=1.732, sqrt(5)=2.236, sqrt(7)=2.646). Since no rational multiple of these frequencies equals another, the combined waveform has no finite period — it never repeats. Each stem variant receives unique random phase offsets.

### 3.2 Spectral design — negative spectral slopes

The soundscape uses spectral slopes matching naturally calming sounds.

**Science basis**

Research shows negative spectral slopes (-3 to -6 dB/oct) are perceived as calming. All natural calming sounds share this property: rain (-3 dB/oct, pink), wind (-3 dB/oct), streams (-4 to -6 dB/oct), ocean (-6 dB/oct, brown).

**Targets per profile**

- **rain_gentle**: Pink noise spectrum, broadband 1–5 kHz peak
- **focus_warm**: Energy below 500 Hz, inharmonic bowl partials
- **nature_air**: Mixed spectrum — brown noise base, pink wind, 2–6 kHz chirps
- **deep_hum**: Brown noise (-6 dB/oct), energy below 200 Hz, 40 Hz gamma component
- **cafe_murmur**: Brown noise through 50–500 Hz formant bands

**Shared rules**

- No sharp peaks in the 2–4 kHz "alerting" band
- Gentle roll-off above 4 kHz
- No sustained narrowband tones
- All transients have >50 ms attack time

### 3.3 Loudness stability

Perceived loudness stability is more important than peak loudness.

**Rules**

- Ambient audio is quiet by default
- Changes in loudness occur slowly
- Crossfades preserve total energy

## 4. Evolution Over Time

### 4.1 Continuous micro-variation

The soundscape is always alive through slow, subtle drift:

- gain
- filter cutoff
- stereo width

These changes are:

- smooth
- non-periodic
- spread over tens of seconds or minutes

### 4.2 Macro evolution (“chapters”)

During long sessions, the environment evolves by replacing one layer at a time.

**Constraints**

- Only one layer may change at once
- Changes are crossfaded slowly
- No changes near task boundaries (exercise end)
- Recently used material is avoided

The goal is freshness without attention capture.

## 5. Typing-Specific Constraints

### 5.1 No auditory masking

Ambient sound must not interfere with keystroke perception.

**Rules**

- Ambient RMS is capped relative to typing SFX RMS
- Ambient content contains no sharp transients
- Spectral overlap with keystroke frequencies is minimized

### 5.2 Temporal independence

Ambient sound must not react to typing cadence, speed, or accuracy.

No reactive audio. No feedback coupling.

## 6. Accessibility Guarantees

### Screen reader mode

- Ambient audio is disabled automatically
- All state changes have non-audio equivalents

### Reduced motion / sensory sensitivity

- Macro evolution is disabled
- Only static or minimally drifting ambience may be used

### Sound off

- The application remains fully usable
- No audio is required to understand state or progress

## 7. Fail-Safe Behavior

Sound is optional.

If audio assets are missing, invalid, or fail to load:

- the system must remain silent
- no errors propagate to the UI
- typing behavior is unaffected

Silence is always a valid outcome.

## 8. Non-Goals (Explicitly Out of Scope)

LoKey Typer does not claim to:

- improve intelligence
- optimize brainwaves
- increase productivity through neuroscience
- induce specific mental states through audio entrainment

The synthesis is *informed by* acoustic research (spectral slopes, parasympathetic rates, calming sound categories), but we do not claim therapeutic or cognitive enhancement outcomes. The goal is comfort and focus support, not optimization.

## 9. Ambient Profile Library

All stems are procedurally synthesized using DSP primitives. No external samples.

| Profile | Layers | Stems | Science Basis |
|---------|--------|-------|---------------|
| focus_soft | 4 | 17 | Original neutral texture |
| focus_warm | 4 | 15 | Singing bowl inharmonic partials, 2–6 Hz beating |
| nature_air | 4 | 14 | Birdsong cortisol reduction, water -6dB/oct, wind 1/f |
| rain_gentle | 4 | 14 | Pink rain spectrum, vagal sub-bass, shelter safety signal |
| deep_hum | 3 | 11 | 40 Hz gamma entrainment, theta beating, brown noise |
| cafe_murmur | 4 | 14 | ASMR formant murmur, fire-like stochastic transients |
| competitive_clean | 3 | 10 | Neutral, low-distraction |

The `random` default setting picks a different profile each page load.

## Acceptance Tests (Enforceable, Numeric)

These are engineering gates, not suggestions.

### A. Loudness & Mixing

- **Integrated loudness per ambient stem**: –30 to –34 LUFS (±1 LUFS tolerance)
- **Ambient master RMS ≤ 70% of typing SFX RMS**
- **Gain drift per layer**: ≤ ±2 dB, time constant ≥ 30 seconds

### B. Modulation & Evolution

- No fixed-frequency LFOs
- All modulation sources must be aperiodic
- **Macro evolution interval**: ≥ 3 minutes, ≤ 6 minutes (randomized)
- **Crossfade duration for layer swaps**: 12–25 seconds
- **Max layers swapped simultaneously**: 1
- **No evolution within 20 seconds of exercise end**

### C. Novelty / Repetition

- **Per-layer “recent memory”**: K ≥ 5 (no reuse within session)
- **No identical full soundscape state repeated within 30 minutes**

### D. Accessibility

- `screenReaderMode = true` → ambient audio = OFF (hard enforced)
- `reducedMotion = true` → macro evolution = OFF

No exceptions.

### E. Stability & Safety

- Missing or invalid audio asset → silent fallback
- Manifest load failure → ambient disabled
- No audio errors may throw or block typing

## Marketing Copy (Science-Safe, Defensible)

You can use the following verbatim.

### Short description

LoKey Typer uses six distinct ambient soundscapes — rain, singing bowls, birdsong, drones, cafe murmur, and soft textures — each synthesized using acoustic research on calming sounds. No loops, no samples, no repetition.

### Medium description

Unlike playlists or music loops, LoKey Typer's ambience is procedurally synthesized using acoustic properties shown to reduce stress: negative spectral slopes matching rain and wind, parasympathetic-rate modulation, and mathematically aperiodic textures that never repeat. Six profiles offer variety while a random default keeps each session fresh. Accessibility settings are enforced automatically, and sound is always optional.

### "Why our ambience is different"

LoKey Typer doesn't play songs or samples. It synthesizes a quiet, evolving acoustic environment grounded in what acoustic science knows about calming sounds — designed to stay out of the way while you type.

### What we explicitly don’t claim

We don’t promise productivity boosts or neuroscience hacks. We design for comfort, focus, and long-session usability.

## Final note (for contributors)

Sound design decisions must be evaluated against this manifesto. If a change makes the sound more noticeable, more musical, or more reactive, it should be questioned.

The best compliment our audio can receive is that users forget it’s there — until they turn it off.
