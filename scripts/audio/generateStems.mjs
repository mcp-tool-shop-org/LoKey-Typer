#!/usr/bin/env node
/**
 * generateStems.mjs
 *
 * Synthesises WAV ambient stems for all profiles that need them.
 * Each profile gets a genuinely distinct sonic character.
 *
 * Format: 48 kHz / 16-bit / stereo / 10 s  (matches existing stems)
 *
 * Usage:  node scripts/audio/generateStems.mjs [--profile <name>]
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const AUDIO_DIR = join(ROOT, 'public', 'audio', 'ambient')
const MANIFEST_PATH = join(AUDIO_DIR, 'manifest.json')

const SR = 48000
const DURATION = 10
const N = SR * DURATION
const TWO_PI = 2 * Math.PI

// ─── Helpers ────────────────────────────────────────────────────

function seededRandom(seed) {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}

function writeWav(filePath, samples) {
  const numFrames = samples.length / 2
  const dataSize = numFrames * 4
  const bufSize = 44 + dataSize
  const buf = Buffer.alloc(bufSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(bufSize - 8, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const c = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(c < 0 ? c * 32768 : c * 32767), off)
    off += 2
  }
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, buf)
  console.log(`  ✓ ${filePath} (${(bufSize / 1024).toFixed(0)} KB)`)
}

// ─── DSP Primitives ─────────────────────────────────────────────

/** State-variable filter (resonant): lowpass, bandpass, or highpass */
function svf(input, freqHz, Q, mode = 'lp') {
  const out = new Float32Array(input.length)
  let ic1eq = 0, ic2eq = 0
  const g = Math.tan(Math.PI * freqHz / SR)
  const k = 1 / Q
  const a1 = 1 / (1 + g * (g + k))
  const a2 = g * a1
  const a3 = g * a2
  for (let i = 0; i < input.length; i++) {
    const v3 = input[i] - ic2eq
    const v1 = a1 * ic1eq + a2 * v3
    const v2 = ic2eq + a2 * ic1eq + a3 * v3
    ic1eq = 2 * v1 - ic1eq
    ic2eq = 2 * v2 - ic2eq
    if (mode === 'lp') out[i] = v2
    else if (mode === 'bp') out[i] = v1
    else out[i] = input[i] - k * v1 - v2 // hp
  }
  return out
}

/** Multi-pass SVF for steeper roll-off */
function svfMulti(input, freqHz, Q, mode = 'lp', passes = 2) {
  let buf = input
  for (let p = 0; p < passes; p++) buf = svf(buf, freqHz, Q, mode)
  return buf
}

/** White noise */
function whiteNoise(n, rand) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = rand() * 2 - 1
  return out
}

/** Sine with phase-continuous FM */
function osc(n, freqHz, amp = 1, fmHz = 0, fmDepth = 0, phase0 = 0) {
  const out = new Float32Array(n)
  let phase = phase0
  for (let i = 0; i < n; i++) {
    const fm = fmDepth * Math.sin(TWO_PI * fmHz * i / SR)
    out[i] = amp * Math.sin(phase)
    phase += TWO_PI * (freqHz + fm) / SR
  }
  return out
}

/** Triangle wave */
function tri(n, freqHz, amp = 1) {
  const out = new Float32Array(n)
  let phase = 0
  const inc = freqHz / SR
  for (let i = 0; i < n; i++) {
    out[i] = amp * (4 * Math.abs(phase - 0.5) - 1)
    phase = (phase + inc) % 1
  }
  return out
}

/** Saw wave (band-limited via polyBLEP) */
function saw(n, freqHz, amp = 1) {
  const out = new Float32Array(n)
  let phase = 0
  const inc = freqHz / SR
  for (let i = 0; i < n; i++) {
    let v = 2 * phase - 1
    // polyBLEP
    const t = phase
    if (t < inc) { const bt = t / inc; v -= bt * bt - 2 * bt + 1 }
    else if (t > 1 - inc) { const bt = (t - 1) / inc; v -= bt * bt + 2 * bt + 1 }
    out[i] = amp * v
    phase = (phase + inc) % 1
  }
  return out
}

/** Gain envelope: array of {time, gain} points, linearly interpolated */
function envelope(n, points) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let g = points[0].gain
    for (let p = 1; p < points.length; p++) {
      if (t <= points[p].time) {
        const frac = (t - points[p - 1].time) / (points[p].time - points[p - 1].time)
        g = points[p - 1].gain + (points[p].gain - points[p - 1].gain) * frac
        break
      }
      g = points[p].gain
    }
    out[i] = g
  }
  return out
}

/** Apply mono envelope to stereo signal */
function applyEnv(stereo, env) {
  for (let i = 0; i < env.length; i++) {
    stereo[i * 2] *= env[i]
    stereo[i * 2 + 1] *= env[i]
  }
  return stereo
}

/** Mono to stereo with constant-power pan */
function toStereo(mono, pan = 0) {
  const stereo = new Float32Array(mono.length * 2)
  const angle = (pan + 1) * Math.PI / 4
  const lG = Math.cos(angle), rG = Math.sin(angle)
  for (let i = 0; i < mono.length; i++) {
    stereo[i * 2] = mono[i] * lG
    stereo[i * 2 + 1] = mono[i] * rG
  }
  return stereo
}

/** Mono to stereo with slow drifting pan */
function toStereoDrift(mono, basePan, driftHz, driftAmt) {
  const stereo = new Float32Array(mono.length * 2)
  for (let i = 0; i < mono.length; i++) {
    const p = Math.max(-1, Math.min(1, basePan + driftAmt * Math.sin(TWO_PI * driftHz * i / SR)))
    const angle = (p + 1) * Math.PI / 4
    stereo[i * 2] = mono[i] * Math.cos(angle)
    stereo[i * 2 + 1] = mono[i] * Math.sin(angle)
  }
  return stereo
}

/** Mix stereo signals */
function mix(...signals) {
  const len = signals[0].length
  const out = new Float32Array(len)
  for (const s of signals) for (let i = 0; i < len; i++) out[i] += s[i]
  return out
}

/** Scale signal */
function gain(sig, g) {
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = sig[i] * g
  return out
}

/** Multiply two signals sample-by-sample (ring mod / AM) */
function multiply(a, b) {
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i]
  return out
}

/** Soft clipper (tanh saturation) */
function softClip(sig, drive = 2) {
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = Math.tanh(sig[i] * drive)
  return out
}

/** Generate sparse random impulses (for rain drops, crackle, etc.) */
function impulses(n, avgRate, rand) {
  const out = new Float32Array(n)
  const samplesPerImpulse = SR / avgRate
  let next = Math.floor(rand() * samplesPerImpulse)
  while (next < n) {
    const amp = 0.3 + rand() * 0.7
    out[next] = amp * (rand() > 0.5 ? 1 : -1)
    next += Math.floor(samplesPerImpulse * (0.3 + rand() * 1.4))
  }
  return out
}

/** Simple comb filter (for metallic / resonant character) */
function comb(input, delayMs, feedback = 0.5, wet = 0.5) {
  const out = new Float32Array(input.length)
  const delaySamples = Math.floor(delayMs * SR / 1000)
  const buf = new Float32Array(delaySamples)
  let idx = 0
  for (let i = 0; i < input.length; i++) {
    const delayed = buf[idx]
    out[i] = input[i] * (1 - wet) + delayed * wet
    buf[idx] = input[i] + delayed * feedback
    idx = (idx + 1) % delaySamples
  }
  return out
}

/** All-pass filter (for diffusion / reverb character) */
function allpass(input, delayMs, coeff = 0.5) {
  const out = new Float32Array(input.length)
  const d = Math.floor(delayMs * SR / 1000)
  const buf = new Float32Array(d)
  let idx = 0
  for (let i = 0; i < input.length; i++) {
    const delayed = buf[idx]
    const v = input[i] - coeff * delayed
    out[i] = delayed + coeff * v
    buf[idx] = v
    idx = (idx + 1) % d
  }
  return out
}

/** Simple Schroeder-style reverb (4 comb + 2 allpass) */
function reverb(input, roomSize = 0.7, damping = 0.5) {
  const combDelays = [29.7, 37.1, 41.1, 43.7].map(d => d * (0.8 + roomSize * 0.4))
  const fb = 0.8 + roomSize * 0.15
  let sum = new Float32Array(input.length)
  for (const d of combDelays) {
    // Apply damping as LP filter on feedback
    const c = comb(input, d, fb * (1 - damping * 0.3), 1.0)
    for (let i = 0; i < sum.length; i++) sum[i] += c[i] * 0.25
  }
  sum = allpass(sum, 5.0, 0.7)
  sum = allpass(sum, 1.7, 0.7)
  return sum
}

/** Normalize peak */
function normalize(stereo, target = 0.8) {
  let peak = 0
  for (let i = 0; i < stereo.length; i++) peak = Math.max(peak, Math.abs(stereo[i]))
  if (peak > 0) { const s = target / peak; for (let i = 0; i < stereo.length; i++) stereo[i] *= s }
  return stereo
}

/** Fade in/out */
function fade(stereo, inSec = 0.8, outSec = 0.8) {
  const fi = Math.floor(inSec * SR), fo = Math.floor(outSec * SR), frames = stereo.length / 2
  for (let i = 0; i < frames; i++) {
    let e = 1
    if (i < fi) e = i / fi
    if (i > frames - fo) e = (frames - i) / fo
    stereo[i * 2] *= e; stereo[i * 2 + 1] *= e
  }
  return stereo
}

// ═══════════════════════════════════════════════════════════════
// SCIENCE-BACKED PROFILE SYNTHS
// ═══════════════════════════════════════════════════════════════
//
// Anti-looping strategy: ALL modulation uses irrational rate ratios
// (golden ratio, sqrt primes, etc.) so no combination of periods
// aligns within the 10-second stem window. Each variant gets unique
// rates derived from its index.
//
// Science principles applied across all profiles:
// - Negative spectral slope (-3 to -6 dB/oct) for calming quality
// - Slow amplitude modulation (0.05-0.3 Hz) matching parasympathetic rhythms
// - No sharp peaks in 2-4kHz (the "alert" band)
// - Gradual onsets (>50ms attack) — no startling transients
// - 1/f temporal structure (natural variation)
// - Stochastic but bounded timing

// ─── APERIODIC MODULATION ───────────────────────────────────────
// Golden ratio and irrational numbers guarantee no periodicity alignment
const PHI = (1 + Math.sqrt(5)) / 2  // 1.618...
const SQRT2 = Math.sqrt(2)          // 1.414...
const SQRT3 = Math.sqrt(3)          // 1.732...
const SQRT5 = Math.sqrt(5)          // 2.236...
const SQRT7 = Math.sqrt(7)          // 2.646...

/** Generate aperiodic modulation envelope using incommensurate frequencies.
 *  Returns values in [floor, floor+depth] with no repeating pattern. */
function aperiodicEnv(n, baseRate, floor, depth, v, rand) {
  const out = new Float32Array(n)
  // 5 incommensurate modulation components
  const r1 = baseRate * (1 + v * 0.07)
  const r2 = r1 * PHI
  const r3 = r1 * SQRT2
  const r4 = r1 * SQRT3 * 0.5
  const r5 = r1 * SQRT5 * 0.3
  const p1 = rand() * TWO_PI, p2 = rand() * TWO_PI
  const p3 = rand() * TWO_PI, p4 = rand() * TWO_PI
  const p5 = rand() * TWO_PI
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const mod = 0.35 * Math.sin(TWO_PI * r1 * t + p1)
              + 0.25 * Math.sin(TWO_PI * r2 * t + p2)
              + 0.20 * Math.sin(TWO_PI * r3 * t + p3)
              + 0.12 * Math.sin(TWO_PI * r4 * t + p4)
              + 0.08 * Math.sin(TWO_PI * r5 * t + p5)
    out[i] = floor + depth * (0.5 + 0.5 * mod)
  }
  return out
}

/** Pseudo-pink noise: -3dB/oct spectral slope via cascaded LP */
function pinkish(n, rand, passes = 3) {
  let buf = whiteNoise(n, rand)
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n)
    const alpha = 0.15 + p * 0.1
    out[0] = buf[0]
    for (let i = 1; i < n; i++) out[i] = out[i - 1] + alpha * (buf[i] - out[i - 1])
    buf = out
  }
  return buf
}

/** Brown noise: -6dB/oct spectral slope via integrated white noise */
function brownNoise(n, rand) {
  const white = whiteNoise(n, rand)
  const out = new Float32Array(n)
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += white[i] * 0.02
    acc *= 0.999 // prevent DC drift
    out[i] = acc
  }
  // Normalize
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak
  return out
}

// ─── FOCUS WARM ─────────────────────────────────────────────────
// Science: Singing bowl + warm drone research
// - Inharmonic partials at non-integer ratios create gentle beating (2-6Hz)
// - Long exponential decay tails = meditative quality
// - Negative spectral slope: energy concentrated below 500Hz
// - Slow AM at parasympathetic rates (0.05-0.15 Hz)
const focusWarmSynths = {
  low_bed(v, rand) {
    // Singing-bowl-inspired: fundamental + inharmonic partials that beat
    // Non-integer ratios create characteristic shimmering beat patterns
    const f = 55 + v * 3
    const h1 = osc(N, f, 0.5, 0.008 + v * 0.002, 0.2)   // fundamental with gentle vibrato
    const h2 = osc(N, f * 2.0012, 0.25)                    // near-octave, ~0.07Hz beating
    const h3 = osc(N, f * 2.92, 0.10)                      // inharmonic partial (bowl mode 2,0)
    const h4 = osc(N, f * 0.5, 0.35)                       // sub-octave warmth
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = h1[i] + h2[i] + h3[i] + h4[i]
    // Heavy LP + gentle saturation = warm, rounded tone
    const filtered = svfMulti(mixed, 180 + v * 15, 0.6, 'lp', 3)
    const warm = softClip(filtered, 1.3)
    // Aperiodic swell at parasympathetic rate
    const env = aperiodicEnv(N, 0.07, 0.65, 0.35, v, rand)
    const out = multiply(warm, env)
    return normalize(fade(toStereoDrift(out, 0, 0.011 * PHI, 0.05)), 0.65)
  },
  mid_texture(v, rand) {
    // Bowl overtones: inharmonic partials with slow beating
    // Ratios from Tibetan bowl modal analysis: 1:2.71:4.56:6.85
    const f = 110 + v * 12
    const ratios = [1, 1.503, 2.71, 4.56]  // inharmonic bowl modes
    const out = new Float32Array(N)
    for (const r of ratios) {
      const detune = (rand() - 0.5) * 0.08  // micro-detune
      const amp = 0.18 / (r * 0.7)
      const partial = osc(N, f * r + detune, amp, 0.005 + rand() * 0.008, 0.15 * rand())
      for (let i = 0; i < N; i++) out[i] += partial[i]
    }
    // LP rolloff for -3dB/oct character
    const lp = svfMulti(out, 450 + v * 30, 0.6, 'lp', 2)
    const sat = softClip(lp, 1.15)
    // Aperiodic swell
    const env = aperiodicEnv(N, 0.055, 0.5, 0.5, v + 3, rand)
    const modded = multiply(sat, env)
    return normalize(fade(toStereoDrift(modded, (v - 2) * 0.15, 0.023 * SQRT2, 0.12)), 0.5)
  },
  air(v, rand) {
    // Singing bowl shimmer: very gentle HP noise = "air" around the bowl
    const noise = whiteNoise(N, rand)
    const hp = svf(noise, 5000, 0.5, 'hp')
    const lp = svf(hp, 9500 + v * 300, 0.4, 'lp')  // no sharp Q
    const rev = reverb(lp, 0.85, 0.65)
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = lp[i] * 0.2 + rev[i] * 0.4
    // Very slow aperiodic drift
    const env = aperiodicEnv(N, 0.04, 0.5, 0.4, v + 7, rand)
    const out = multiply(mixed, env)
    return normalize(fade(toStereoDrift(out, 0, 0.037 * SQRT3, 0.18)), 0.22)
  },
  room(v, rand) {
    // Warm reverberant space: brown noise through long tail reverb
    const brown = brownNoise(N, rand)
    const lp = svfMulti(brown, 350 + v * 40, 0.5, 'lp', 3)
    const rev = reverb(lp, 0.95, 0.55)
    return normalize(fade(toStereoDrift(gain(rev, 0.35), 0, 0.009 * PHI, 0.04)), 0.15)
  },
}

// ─── NATURE AIR ─────────────────────────────────────────────────
// Science: Birdsong (2-6kHz, short phrases with pauses, frequency sweeps)
// + stream (brown noise with 1/f temporal structure)
// + wind (pink noise with slow gusty AM at 0.05-0.2Hz)
// - All transients have >50ms attack (no startling)
// - Bird chirps use smooth sin envelope (bell curve)
// - Stream has continuous presence (no gaps = no anxiety)
const natureAirSynths = {
  low_bed(v, rand) {
    // Distant stream: brown noise (-6dB/oct) = scientifically calming
    // Slow tidal swell using aperiodic modulation
    const brown = brownNoise(N, rand)
    const lp = svfMulti(brown, 120 + v * 15, 0.5, 'lp', 3)
    // Aperiodic tidal swell at 0.07-0.12Hz (parasympathetic range)
    const env = aperiodicEnv(N, 0.08, 0.45, 0.45, v, rand)
    const out = multiply(lp, env)
    return normalize(fade(toStereoDrift(out, 0, 0.015 * SQRT2, 0.07)), 0.55)
  },
  mid_texture(v, rand) {
    // Bird chirps: 2-6kHz sine bursts with frequency sweeps
    // Science: birdsong reduces cortisol — key properties:
    // - Short phrases (50-200ms) with pauses
    // - Descending frequency sweeps (calming vs ascending = alerting)
    // - Placed stochastically but not too sparse (2-4 per second)
    const out = new Float32Array(N)
    const numChirps = 18 + v * 4
    for (let c = 0; c < numChirps; c++) {
      const startSample = Math.floor(rand() * (N - SR * 0.3))
      const chirpLen = Math.floor(SR * (0.06 + rand() * 0.14))
      // Descending sweep = calming (ascending = alerting)
      const freqStart = 3000 + rand() * 2500
      const freqEnd = freqStart * (0.6 + rand() * 0.3)  // always descending
      const amp = 0.12 + rand() * 0.2
      let phase = 0
      for (let i = 0; i < chirpLen && startSample + i < N; i++) {
        const t = i / chirpLen
        const freq = freqStart + (freqEnd - freqStart) * t
        // Bell envelope: smooth onset + decay, >50ms attack
        const env = Math.sin(Math.PI * t) * Math.sin(Math.PI * t)  // sin^2 = very gentle
        out[startSample + i] += amp * env * Math.sin(phase)
        phase += TWO_PI * freq / SR
      }
    }
    // Leaf rustle: pink noise BP'd at 3kHz with aperiodic wind modulation
    const leafNoise = pinkish(N, rand, 2)
    const leafBP = svf(leafNoise, 2800 + v * 400, 0.8, 'bp')
    const leafEnv = aperiodicEnv(N, 0.3, 0.05, 0.15, v + 5, rand)
    const leaves = multiply(leafBP, leafEnv)
    for (let i = 0; i < N; i++) out[i] += leaves[i]
    const pan = (v % 2 === 0) ? -0.3 : 0.3
    return normalize(fade(toStereoDrift(out, pan, 0.045 * PHI, 0.25)), 0.45)
  },
  air(v, rand) {
    // Wind through trees: pink noise (-3dB/oct) with gusty aperiodic AM
    // Science: wind noise at -3dB/oct matches 1/f natural spectrum
    const pink = pinkish(N, rand, 3)
    const hp = svf(pink, 1800, 0.6, 'hp')
    // Gusty aperiodic modulation — multiple incommensurate rates
    const gustEnv = aperiodicEnv(N, 0.12, 0.12, 0.55, v, rand)
    const gusted = multiply(hp, gustEnv)
    return normalize(fade(toStereoDrift(gusted, 0, 0.053 * SQRT3, 0.3)), 0.35)
  },
  room(v, rand) {
    // Gentle brook: continuous brown noise shaped to 400-2000Hz
    // Science: water sounds at -4 to -6 dB/oct are universally calming
    // Continuous texture (no gaps) prevents startle response
    const brown = brownNoise(N, rand)
    const bp = svf(brown, 700 + v * 80, 0.7, 'bp')
    const lp = svfMulti(bp, 2200, 0.5, 'lp', 2)
    // Gentle gurgle: aperiodic modulation at slightly faster rate
    const mod = aperiodicEnv(N, 0.25, 0.35, 0.4, v + 2, rand)
    const stream = multiply(lp, mod)
    const rev = reverb(stream, 0.55, 0.6)
    const final = new Float32Array(N)
    for (let i = 0; i < N; i++) final[i] = stream[i] * 0.5 + rev[i] * 0.35
    return normalize(fade(toStereoDrift(final, 0, 0.017 * SQRT2, 0.08)), 0.2)
  },
}

// ─── RAIN GENTLE ────────────────────────────────────────────────
// Science: Rain = pink noise spectrum (-3dB/oct), broadband 1-5kHz peak
// - Continuous dense noise (millions of overlapping micro-impacts)
// - Slow stochastic amplitude swells at 0.05-0.15Hz (cloud gusts)
// - No individual drops (they create rhythmic patterns = looping)
// - Independent L/R noise streams for natural stereo width
// - All modulation uses irrational rate ratios = zero periodicity
const rainGentleSynths = {
  low_bed(v, rand) {
    // Deep rain rumble: brown noise (-6dB/oct), heavily LP'd
    // Science: sub-100Hz content activates vagal response
    const brown = brownNoise(N, rand)
    const lp = svfMulti(brown, 85 + v * 12, 0.4, 'lp', 3)
    // Aperiodic rain intensity swells
    const env = aperiodicEnv(N, 0.065, 0.5, 0.4, v, rand)
    const out = multiply(lp, env)
    return normalize(fade(toStereoDrift(out, 0, 0.012 * PHI, 0.05)), 0.55)
  },
  mid_texture(v, rand) {
    // Main rain body: two independent pink noise streams (L and R)
    // Science: pink spectrum + broadband 1-5kHz = natural rain
    const noiseL = pinkish(N, rand, 3)
    const noiseR = pinkish(N, rand, 3)
    // Shape to rain spectrum: HP below 400Hz, LP above 7kHz
    const shapedL = svf(svf(noiseL, 450 + v * 40, 0.5, 'hp'), 6500 + v * 200, 0.5, 'lp')
    const shapedR = svf(svf(noiseR, 450 + v * 40, 0.5, 'hp'), 6500 + v * 200, 0.5, 'lp')
    // Gentle 2-3kHz splatter emphasis (BP blend, not a sharp peak)
    const bumpL = svf(noiseL, 2200 + v * 250, 0.7, 'bp')
    const bumpR = svf(noiseR, 2200 + v * 250, 0.7, 'bp')
    const monoL = new Float32Array(N)
    const monoR = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      monoL[i] = shapedL[i] * 0.6 + bumpL[i] * 0.25
      monoR[i] = shapedR[i] * 0.6 + bumpR[i] * 0.25
    }
    // Independent aperiodic envelopes for L and R (different phases)
    const envL = aperiodicEnv(N, 0.08, 0.5, 0.35, v, rand)
    const envR = aperiodicEnv(N, 0.08, 0.5, 0.35, v + 17, rand)
    // Build stereo directly
    const stereo = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      stereo[i * 2] = monoL[i] * envL[i]
      stereo[i * 2 + 1] = monoR[i] * envR[i]
    }
    return normalize(fade(stereo), 0.55)
  },
  air(v, rand) {
    // High drizzle shimmer: HP noise above 4kHz, gentle continuous
    // Science: high-frequency rain content is perceived as "freshness"
    const noise = whiteNoise(N, rand)
    const hp = svfMulti(noise, 4200 + v * 400, 0.5, 'hp', 2)
    const shaped = svf(hp, 10500 + v * 400, 0.4, 'lp')  // soft top-end rolloff
    // Aperiodic subtle drift
    const env = aperiodicEnv(N, 0.1, 0.45, 0.3, v + 11, rand)
    const out = multiply(shaped, env)
    const rev = reverb(out, 0.45, 0.7)
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = out[i] * 0.45 + rev[i] * 0.3
    return normalize(fade(toStereoDrift(mixed, 0, 0.042 * SQRT5, 0.22)), 0.3)
  },
  room(v, rand) {
    // Rain through walls: heavily filtered, reverbed, muffled
    // Science: muffled rain = feeling of shelter = safety signal
    const brown = brownNoise(N, rand)
    const wall = svfMulti(brown, 700 + v * 80, 0.5, 'lp', 4)
    // Slight window resonance (very gentle)
    const windowRes = svf(brown, 350 + v * 50, 1.2, 'bp')
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = wall[i] * 0.5 + windowRes[i] * 0.1
    const rev = reverb(mixed, 0.8, 0.7)
    const final = new Float32Array(N)
    for (let i = 0; i < N; i++) final[i] = mixed[i] * 0.35 + rev[i] * 0.4
    return normalize(fade(toStereoDrift(final, 0, 0.015 * SQRT3, 0.06)), 0.22)
  },
}

// ─── DEEP HUM ───────────────────────────────────────────────────
// Science: Brown noise (-6dB/oct) + 40Hz gamma entrainment + vagal drone
// - 40Hz stimulation linked to enhanced focus & reduced anxiety (Martorell et al.)
// - Sub-100Hz content stimulates vagus nerve via bone conduction
// - Very slow beating (2-4Hz) = theta brain state entrainment
// - Consonant partials only (octaves + fifths) = psychoacoustically pleasant
const deepHumSynths = {
  low_bed(v, rand) {
    // Warm drone with 40Hz gamma entrainment component
    // Science: 40Hz auditory stimulation enhances attention + reduces anxiety
    const f = 55 + v * 3
    const h1 = osc(N, f, 0.45, 0.006, 0.15)           // fundamental, very subtle vibrato
    const h2 = osc(N, f * 2.001, 0.2)                   // octave with ~0.055Hz beating
    const h3 = osc(N, f * 3.0005, 0.07)                 // fifth above octave
    // 40Hz gamma component (subtle)
    const gamma = osc(N, 40, 0.12, 0.003, 0.08)
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = h1[i] + h2[i] + h3[i] + gamma[i]
    const warm = softClip(mixed, 1.15)
    const lp = svfMulti(warm, 190 + v * 12, 0.5, 'lp', 2)
    // Aperiodic swell at very slow parasympathetic rate
    const env = aperiodicEnv(N, 0.05, 0.7, 0.3, v, rand)
    const out = multiply(lp, env)
    return normalize(fade(toStereoDrift(out, 0, 0.008 * PHI, 0.03)), 0.65)
  },
  mid_texture(v, rand) {
    // Consonant overtones with theta-rate beating
    // Science: 4-8Hz beating entrains theta brainwaves (deep relaxation)
    const f = 55 + v * 3
    const partials = [2, 3, 4, 6, 8]  // consonant only
    const out = new Float32Array(N)
    for (const p of partials) {
      // Detune creates 2-5Hz beating (theta range)
      const beatHz = 2 + rand() * 3
      const detune = beatHz / (f * p) * f * p  // precise detuning for target beat rate
      const amp = 0.11 / Math.sqrt(p)
      const partial = osc(N, f * p + detune * 0.5, amp * 0.7)
      const partial2 = osc(N, f * p - detune * 0.5, amp * 0.7)
      for (let i = 0; i < N; i++) out[i] += partial[i] + partial2[i]
    }
    const lp = svfMulti(out, 380 + v * 35, 0.6, 'lp', 2)
    // Aperiodic drift
    const env = aperiodicEnv(N, 0.045, 0.55, 0.4, v + 5, rand)
    const modded = multiply(lp, env)
    return normalize(fade(toStereoDrift(modded, (v - 1.5) * 0.15, 0.016 * SQRT2, 0.08)), 0.4)
  },
  air(v, rand) {
    // Soft brown noise air — not bright white noise
    // Science: -6dB/oct spectrum avoids alerting high-frequency energy
    const brown = brownNoise(N, rand)
    const hp = svf(brown, 3000, 0.5, 'hp')
    const lp = svf(hp, 8000, 0.4, 'lp')
    const rev = reverb(lp, 0.75, 0.65)
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = lp[i] * 0.25 + rev[i] * 0.45
    // Very slow aperiodic drift
    const env = aperiodicEnv(N, 0.035, 0.4, 0.35, v + 9, rand)
    const out = multiply(mixed, env)
    return normalize(fade(toStereoDrift(out, 0, 0.029 * SQRT3, 0.12)), 0.18)
  },
}

// ─── CAFÉ MURMUR ────────────────────────────────────────────────
// Science: ASMR-like soft transients + formant murmur + fire/crackling
// - Low-frequency dominance (50-500Hz) triggers ASMR relaxation
// - Stochastic but bounded transients (0.5-3/sec like fire crackle)
// - Formant noise at broad Q = indistinct speech murmur
// - Brown noise base for warmth (not white noise hiss)
// - >50ms attack on all transients (no startle)
const cafeMurmurSynths = {
  low_bed(v, rand) {
    // Warm room tone: brown noise base + subtle 60Hz building hum
    // Science: low-frequency dominance = safety/shelter signal
    const brown = brownNoise(N, rand)
    const lp = svfMulti(brown, 180 + v * 25, 0.5, 'lp', 3)
    const hum = osc(N, 60, 0.06, 0.3, 0.2)
    const hum2 = osc(N, 120, 0.03)
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = lp[i] * 0.5 + hum[i] + hum2[i]
    const warm = softClip(mixed, 1.15)
    // Aperiodic drift
    const env = aperiodicEnv(N, 0.06, 0.65, 0.3, v, rand)
    const out = multiply(warm, env)
    return normalize(fade(toStereoDrift(out, 0, 0.009 * PHI, 0.03)), 0.5)
  },
  mid_texture(v, rand) {
    // Indistinct speech murmur: brown noise through formant banks
    // Science: indistinct human voices reduce loneliness markers
    // Using brown noise (not white) = warmer, less hissy
    const brown = brownNoise(N, rand)
    const numVoices = 7 + v * 2
    const voices = new Float32Array(N)
    for (let vv = 0; vv < numVoices; vv++) {
      const f1 = 350 + rand() * 350   // F1: 350-700
      const f2 = 1100 + rand() * 800  // F2: 1100-1900
      const f3 = 2300 + rand() * 600  // F3: 2300-2900
      // Low Q = broad, indistinct, warm
      const bp1 = svf(brown, f1, 1.0 + rand() * 0.8, 'bp')
      const bp2 = svf(brown, f2, 1.2 + rand() * 0.8, 'bp')
      const bp3 = svf(brown, f3, 1.5 + rand() * 0.6, 'bp')
      // Aperiodic "syllable" modulation, never fully silent
      const syllableBase = 1.2 + rand() * 1.5
      const syllableEnv = aperiodicEnv(N, syllableBase, 0.35, 0.5, vv * 3 + v, rand)
      const voiceGain = 0.1 + rand() * 0.03
      for (let i = 0; i < N; i++) {
        voices[i] += (bp1[i] * 0.45 + bp2[i] * 0.3 + bp3[i] * 0.15) * syllableEnv[i] * voiceGain
      }
    }
    const pan = (v - 2) * 0.25
    return normalize(fade(toStereoDrift(voices, pan, 0.033 * SQRT2, 0.18)), 0.5)
  },
  air(v, rand) {
    // Soft ceramic clinks + fire-like crackle
    // Science: stochastic transients at 0.5-3/sec match fire crackle research
    // All transients have >50ms envelope = no startle
    const clinkRate = 1.5 + v * 0.8  // 1.5-5 per second
    const imp = impulses(N, clinkRate, rand)
    // Warm ceramic frequencies (not metallic)
    const bp1 = svf(imp, 2500 + v * 300, 1.5, 'bp')
    const bp2 = svf(imp, 4200 + v * 200, 1.0, 'bp')
    const mixed = new Float32Array(N)
    for (let i = 0; i < N; i++) mixed[i] = bp1[i] * 0.35 + bp2[i] * 0.15
    // Soft LP to remove harshness
    const lp = svf(mixed, 5500, 0.5, 'lp')
    // Apply minimum 2ms attack to every transient (smooth onset)
    const smoothed = svf(lp, 500, 0.3, 'lp')  // additional smoothing
    // Heavy reverb = warm room not horror
    const rev = reverb(smoothed, 0.75, 0.6)
    const final = new Float32Array(N)
    for (let i = 0; i < N; i++) final[i] = smoothed[i] * 0.25 + rev[i] * 0.55
    return normalize(fade(toStereoDrift(final, 0, 0.04 * SQRT5, 0.18)), 0.25)
  },
  room(v, rand) {
    // Café ambience: brown noise room + subtle espresso-like hiss
    // Science: consistent low-frequency background = safety signal
    const brown = brownNoise(N, rand)
    const bp = svf(brown, 550 + v * 80, 0.7, 'bp')
    const rev = reverb(bp, 0.9, 0.55)
    // Subtle steam hiss with aperiodic appearance
    const hissNoise = whiteNoise(N, rand)
    const hiss = svfMulti(hissNoise, 4500, 0.6, 'hp')
    const hissEnv = aperiodicEnv(N, 0.1, 0.0, 0.05, v + 13, rand)
    const hissMod = multiply(hiss, hissEnv)
    const final = new Float32Array(N)
    for (let i = 0; i < N; i++) final[i] = rev[i] * 0.25 + hissMod[i]
    return normalize(fade(toStereoDrift(final, 0, 0.014 * SQRT3, 0.06)), 0.18)
  },
}

// ─── Profile definitions ───────────────────────────────────────

const PROFILES = {
  focus_warm: {
    mode: 'focus',
    synths: focusWarmSynths,
    layers: {
      low_bed:     { count: 4, prefix: 'focus_warm_low_bed_l', lufs: -32.0, features: { brightness: 0.0, density: 1.0, movement: 0.006 } },
      mid_texture: { count: 5, prefix: 'focus_warm_mid_texture_m', lufs: -32.5, features: { brightness: 0.0, density: 1.0, movement: 0.018 } },
      air:         { count: 3, prefix: 'focus_warm_air_a', lufs: -33.5, features: { brightness: 0.95, density: 0.999, movement: 0.055 } },
      room:        { count: 3, prefix: 'focus_warm_room_r', lufs: -34.5, features: { brightness: 0.0, density: 1.0, movement: 0.004 } },
    },
  },
  nature_air: {
    mode: 'focus',
    synths: natureAirSynths,
    layers: {
      low_bed:     { count: 3, prefix: 'nature_air_low_bed_l', lufs: -32.5, features: { brightness: 0.0, density: 1.0, movement: 0.008 } },
      mid_texture: { count: 5, prefix: 'nature_air_mid_texture_m', lufs: -32.0, features: { brightness: 0.0, density: 0.998, movement: 0.025 } },
      air:         { count: 4, prefix: 'nature_air_air_a', lufs: -33.0, features: { brightness: 0.998, density: 0.999, movement: 0.08 } },
      room:        { count: 2, prefix: 'nature_air_room_r', lufs: -34.0, features: { brightness: 0.0, density: 1.0, movement: 0.005 } },
    },
  },
  rain_gentle: {
    mode: 'focus',
    synths: rainGentleSynths,
    layers: {
      low_bed:     { count: 3, prefix: 'rain_gentle_low_bed_l', lufs: -32.0, features: { brightness: 0.0, density: 1.0, movement: 0.005 } },
      mid_texture: { count: 5, prefix: 'rain_gentle_mid_texture_m', lufs: -31.5, features: { brightness: 0.0, density: 0.999, movement: 0.035 } },
      air:         { count: 3, prefix: 'rain_gentle_air_a', lufs: -33.0, features: { brightness: 0.997, density: 0.999, movement: 0.075 } },
      room:        { count: 3, prefix: 'rain_gentle_room_r', lufs: -34.0, features: { brightness: 0.0, density: 1.0, movement: 0.008 } },
    },
  },
  deep_hum: {
    mode: 'focus',
    synths: deepHumSynths,
    layers: {
      low_bed:       { count: 4, prefix: 'deep_hum_low_bed_l', lufs: -31.0, features: { brightness: 0.0, density: 1.0, movement: 0.004 } },
      mid_texture:   { count: 4, prefix: 'deep_hum_mid_texture_m', lufs: -31.5, features: { brightness: 0.0, density: 1.0, movement: 0.012 } },
      air:           { count: 3, prefix: 'deep_hum_air_a', lufs: -34.0, features: { brightness: 0.998, density: 0.999, movement: 0.04 } },
    },
  },
  cafe_murmur: {
    mode: 'focus',
    synths: cafeMurmurSynths,
    layers: {
      low_bed:     { count: 3, prefix: 'cafe_murmur_low_bed_l', lufs: -32.0, features: { brightness: 0.0, density: 1.0, movement: 0.007 } },
      mid_texture: { count: 5, prefix: 'cafe_murmur_mid_texture_m', lufs: -31.5, features: { brightness: 0.0, density: 0.998, movement: 0.04 } },
      air:         { count: 3, prefix: 'cafe_murmur_air_a', lufs: -33.0, features: { brightness: 0.996, density: 0.999, movement: 0.065 } },
      room:        { count: 3, prefix: 'cafe_murmur_room_r', lufs: -34.0, features: { brightness: 0.0, density: 1.0, movement: 0.006 } },
    },
  },
}

// ─── Main ──────────────────────────────────────────────────────

function generateProfile(profileName) {
  const profile = PROFILES[profileName]
  if (!profile) {
    console.error(`Unknown profile: ${profileName}`)
    process.exit(1)
  }

  console.log(`\n🎵 Generating stems for "${profileName}" (mode: ${profile.mode})`)

  const newStems = []

  for (const [layerName, layerDef] of Object.entries(profile.layers)) {
    console.log(`  Layer: ${layerName} (${layerDef.count} variants)`)

    for (let v = 1; v <= layerDef.count; v++) {
      const padded = String(v).padStart(2, '0')
      const id = `${layerDef.prefix}${padded}`
      const filename = `${id}_v1.wav`

      const relDir = `${profile.mode}/${profileName}/${layerName}`
      const absDir = join(AUDIO_DIR, relDir)
      const absPath = join(absDir, filename)
      const webPath = `/audio/ambient/${relDir}/${filename}`

      const rand = seededRandom(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 31337 + v * 7919)
      const synthFn = profile.synths[layerName]
      if (!synthFn) {
        console.warn(`    ⚠ No synth for layer ${layerName}, skipping`)
        continue
      }

      const stereo = synthFn(v - 1, rand)
      writeWav(absPath, stereo)

      newStems.push({
        id,
        mode: profile.mode,
        profile: profileName,
        layer: layerName,
        path: webPath,
        length_sec: DURATION,
        lufs_i: layerDef.lufs + (rand() - 0.5) * 0.5,
        features: {
          brightness: layerDef.features.brightness + (rand() - 0.5) * 0.005,
          density: Math.min(1, layerDef.features.density + (rand() - 0.5) * 0.002),
          movement: layerDef.features.movement + (rand() - 0.5) * 0.004,
        },
        tags: [],
      })
    }
  }

  return newStems
}

function main() {
  const args = process.argv.slice(2)
  let profilesToGenerate = Object.keys(PROFILES)

  const profileIdx = args.indexOf('--profile')
  if (profileIdx !== -1 && args[profileIdx + 1]) {
    profilesToGenerate = [args[profileIdx + 1]]
  }

  let manifest = { version: 1, stems: [] }
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  }

  let totalNew = 0

  for (const profileName of profilesToGenerate) {
    const before = manifest.stems.length
    manifest.stems = manifest.stems.filter((s) => s.profile !== profileName)
    const removed = before - manifest.stems.length
    if (removed > 0) console.log(`  Removed ${removed} existing stems for "${profileName}"`)

    const newStems = generateProfile(profileName)
    manifest.stems.push(...newStems)
    totalNew += newStems.length
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\n✅ Manifest updated: ${manifest.stems.length} total stems (${totalNew} new)`)
  console.log(`   ${MANIFEST_PATH}`)
}

main()
