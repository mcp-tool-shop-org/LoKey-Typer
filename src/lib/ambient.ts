import type { Mode } from '@content'
import type { Preferences } from './storage'
import { getAudioContext, resumeAudioContext } from './audioContext'
import { getEffectiveAmbientEnabled } from './effectivePrefs'

export type AmbientProfile = 'off' | 'focus_soft' | 'focus_warm' | 'competitive_clean' | 'nature_air'

type LayerId = 'low_bed' | 'mid_texture' | 'mid_presence' | 'air' | 'broadband'

type ActiveGraph = {
  profile: AmbientProfile
  outGain: GainNode
  finalOut: AudioNode
  nodes: AudioNode[]
  sources: Array<AudioScheduledSourceNode>
  timers: number[]
  cleanupTimer?: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function rampGain(gainParam: AudioParam, ctx: AudioContext, value: number, seconds: number) {
  const t0 = ctx.currentTime
  gainParam.cancelScheduledValues(t0)
  // tiny offset avoids some browsers popping when ramping from 0
  const start = clamp(gainParam.value, 0, 10)
  gainParam.setValueAtTime(start, t0)
  gainParam.linearRampToValueAtTime(value, t0 + Math.max(0.01, seconds))
}

function randomOffsetSeconds(duration: number) {
  return Math.random() * Math.max(0.01, duration)
}

const AMBIENT_ASSET_URLS: Record<Exclude<AmbientProfile, 'off'>, Partial<Record<LayerId, string>>> = {
  focus_soft: {
    low_bed: '/audio/ambient/focus/soft/focus_soft_low_bed_v1.wav',
    mid_texture: '/audio/ambient/focus/soft/focus_soft_mid_texture_v1.wav',
    air: '/audio/ambient/focus/soft/focus_soft_air_v1.wav',
  },
  focus_warm: {
    low_bed: '/audio/ambient/focus/warm/focus_warm_low_bed_v1.wav',
    mid_texture: '/audio/ambient/focus/warm/focus_warm_mid_texture_v1.wav',
  },
  competitive_clean: {
    low_bed: '/audio/ambient/competitive/clean/comp_clean_low_bed_v1.wav',
    mid_presence: '/audio/ambient/competitive/clean/comp_clean_mid_presence_v1.wav',
    air: '/audio/ambient/competitive/clean/comp_clean_air_v1.wav',
  },
  nature_air: {
    broadband: '/audio/ambient/nature/air/nature_air_broadband_v1.wav',
  },
}

type BufferKey = `${AmbientProfile}:${LayerId}`

class AmbientAssetStore {
  private buffers = new Map<BufferKey, AudioBuffer>()
  private attempted = new Set<BufferKey>()

  get(profile: AmbientProfile, layer: LayerId) {
    return this.buffers.get(`${profile}:${layer}` as BufferKey) ?? null
  }

  availableCount(profile: Exclude<AmbientProfile, 'off'>) {
    let count = 0
    for (const key of this.buffers.keys()) {
      if (key.startsWith(`${profile}:`)) count++
    }
    return count
  }

  async preload(ctx: AudioContext, profile: Exclude<AmbientProfile, 'off'>) {
    const urls = AMBIENT_ASSET_URLS[profile]
    const entries = Object.entries(urls) as Array<[LayerId, string]>
    await Promise.all(
      entries.map(async ([layer, url]) => {
        const k = `${profile}:${layer}` as BufferKey
        if (this.attempted.has(k) || this.buffers.has(k)) return
        this.attempted.add(k)

        try {
          const res = await fetch(url)
          if (!res.ok) return
          const ab = await res.arrayBuffer()
          const buf = await ctx.decodeAudioData(ab)
          this.buffers.set(k, buf)
        } catch {
          // ignore (silent fallback)
        }
      }),
    )
  }
}

const assets = new AmbientAssetStore()

let sharedNoiseBuffer: AudioBuffer | null = null
const NOISE_SECONDS = 140 // ≥2 minutes, single shared buffer reused across layers

function getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) return sharedNoiseBuffer

  const frames = Math.floor(ctx.sampleRate * NOISE_SECONDS)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  // White noise; shaped later via filters + very slow modulation.
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  sharedNoiseBuffer = buffer
  return buffer
}

function createNoiseSource(ctx: AudioContext) {
  const src = ctx.createBufferSource()
  src.buffer = getSharedNoiseBuffer(ctx)
  src.loop = true
  return src
}

function deriveEffectiveProfile(mode: Mode, selected: AmbientProfile): AmbientProfile {
  if (selected === 'off') return 'off'
  if (selected === 'nature_air') return 'nature_air'

  if (mode === 'competitive') return 'competitive_clean'
  // focus + real-life share the calm focus bed
  if (selected === 'competitive_clean') return 'focus_soft'
  return selected
}

function buildGraph(ctx: AudioContext, profile: AmbientProfile): ActiveGraph {
  const outGain = ctx.createGain()
  outGain.gain.value = 0

  let finalOut: AudioNode = outGain

  const nodes: AudioNode[] = [outGain]
  const sources: Array<AudioScheduledSourceNode> = []
  const timers: number[] = []

  // Profile-wide hard cap for high frequencies (spec bans >8k in focus profiles).
  // Competitive allows up to ~9k, nature is also capped to avoid hiss.
  const profileLowpassHz =
    profile === 'competitive_clean' || profile === 'nature_air' ? 9000 : 8000
  const profileLP = ctx.createBiquadFilter()
  profileLP.type = 'lowpass'
  profileLP.frequency.value = profileLowpassHz
  profileLP.Q.value = 0.7

  outGain.disconnect()
  outGain.connect(profileLP)
  finalOut = profileLP
  nodes.push(profileLP)

  const usingAnyAssets =
    profile !== 'off' && assets.availableCount(profile as Exclude<AmbientProfile, 'off'>) > 0

  const makeStereoDrift = (params: { depth: number; seconds: number }) => {
    const p = ctx.createStereoPanner()
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1 / Math.max(8, params.seconds)
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = clamp(params.depth, 0, 1)
    lfo.connect(lfoGain)
    lfoGain.connect(p.pan)
    nodes.push(p, lfo, lfoGain)
    sources.push(lfo)
    try {
      lfo.start()
    } catch {
      // ignore
    }
    return p
  }

  const applyAmpMod = (g: GainNode, params: { depth: number; seconds: number }) => {
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1 / Math.max(5, params.seconds)
    const lfoGain = ctx.createGain()
    // depth is absolute gain modulation (small)
    lfoGain.gain.value = Math.max(0, params.depth)
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    nodes.push(lfo, lfoGain)
    sources.push(lfo)
    try {
      lfo.start()
    } catch {
      // ignore
    }
  }

  const addCrossfadedBufferLoop = (params: {
    buffer: AudioBuffer
    target: AudioNode
    baseGain: number
    playbackRate?: number
    crossfadeSeconds: number
    drift?: { depth: number; seconds: number }
    ampMod?: { depth: number; seconds: number }
    chain?: (src: AudioNode) => AudioNode
  }) => {
    const layerGain = ctx.createGain()
    layerGain.gain.value = Math.max(0, params.baseGain)

    const drift = params.drift ? makeStereoDrift(params.drift) : null

    const chain = (src: AudioNode) => {
      const chained = params.chain ? params.chain(src) : src
      if (drift) {
        chained.connect(drift)
        drift.connect(layerGain)
      } else {
        chained.connect(layerGain)
      }
      layerGain.connect(params.target)
      return chained
    }

    nodes.push(layerGain)

    if (params.ampMod) applyAmpMod(layerGain, params.ampMod)

    const dur = params.buffer.duration
    const cf = clamp(params.crossfadeSeconds, 0.1, Math.max(0.1, dur / 2))
    const periodMs = Math.max(250, (dur - cf) * 1000)

    const startOne = (when: number, offsetSeconds: number) => {
      const src = ctx.createBufferSource()
      src.buffer = params.buffer
      src.loop = false
      src.playbackRate.value = params.playbackRate ?? 1
      const out = chain(src)

      // Fade in/out to avoid any loop boundary click.
      const g = ctx.createGain()
      g.gain.value = 0
      ;(out as AudioNode).disconnect()
      ;(out as AudioNode).connect(g)
      g.connect(layerGain)
      nodes.push(g)

      // schedule envelope
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(1, when + cf)
      g.gain.setValueAtTime(1, when + Math.max(cf, dur - cf))
      g.gain.linearRampToValueAtTime(0, when + dur)

      try {
        src.start(when, clamp(offsetSeconds, 0, Math.max(0, dur - 0.01)))
      } catch {
        // ignore
      }

      sources.push(src)
    }

    const startAt = ctx.currentTime
    startOne(startAt, randomOffsetSeconds(dur))

    const timer = window.setInterval(() => {
      const t = ctx.currentTime
      startOne(t, 0)
    }, periodMs)
    timers.push(timer)
  }

  const addLowBed = (params: {
    freq: number
    gain: number
    detuneCents: number
    detuneLfoSeconds: number
    ampLfoSeconds: number
    driftSeconds: number
    driftDepth: number
  }) => {
    // Prefer file asset if any exist for this profile.
    const buf =
      profile !== 'off' ? assets.get(profile, 'low_bed') : null
    if (usingAnyAssets && buf) {
      addCrossfadedBufferLoop({
        buffer: buf,
        target: outGain,
        baseGain: params.gain,
        crossfadeSeconds: 2,
        drift: { depth: params.driftDepth, seconds: params.driftSeconds },
        ampMod: { depth: params.gain * 0.12, seconds: params.ampLfoSeconds },
        chain: (src) => {
          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 220
          lp.Q.value = 0.7
          nodes.push(lp)
          src.connect(lp)
          return lp
        },
      })
      return
    }

    const bedFilter = ctx.createBiquadFilter()
    bedFilter.type = 'lowpass'
    bedFilter.frequency.value = 220
    bedFilter.Q.value = 0.7

    const bedGain = ctx.createGain()
    bedGain.gain.value = params.gain

    applyAmpMod(bedGain, { depth: params.gain * 0.12, seconds: params.ampLfoSeconds })

    const p = makeStereoDrift({ depth: params.driftDepth, seconds: params.driftSeconds })

    const osc1 = ctx.createOscillator()
    osc1.type = 'triangle'
    osc1.frequency.value = params.freq
    osc1.detune.value = -params.detuneCents

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = params.freq
    osc2.detune.value = params.detuneCents

    // Slow detune drift (non-rhythmic, very low rate)
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1 / Math.max(10, params.detuneLfoSeconds)

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 4

    lfo.connect(lfoGain)
    lfoGain.connect(osc1.detune)
    lfoGain.connect(osc2.detune)

    osc1.connect(bedFilter)
    osc2.connect(bedFilter)
    bedFilter.connect(bedGain)
    bedGain.connect(p)
    p.connect(outGain)

    nodes.push(bedFilter, bedGain, osc1, osc2, lfo, lfoGain)
    sources.push(osc1, osc2, lfo)

    try {
      osc1.start()
      osc2.start()
      lfo.start()
    } catch {
      // ignore
    }
  }

  const addTexture = (params: {
    layer: 'mid_texture' | 'mid_presence'
    bandHz: number
    q: number
    gain: number
    filterLfoSeconds: number
    filterDepthHz: number
    ampLfoSeconds: number
    driftSeconds: number
    driftDepth: number
    highpassHz?: number
    lowpassHz?: number
  }) => {
    const buf = profile !== 'off' ? assets.get(profile, params.layer) : null
    if (usingAnyAssets && buf) {
      addCrossfadedBufferLoop({
        buffer: buf,
        target: outGain,
        baseGain: params.gain,
        crossfadeSeconds: 2,
        drift: { depth: params.driftDepth, seconds: params.driftSeconds },
        ampMod: { depth: params.gain * 0.16, seconds: params.ampLfoSeconds },
        chain: (src) => {
          const hp = ctx.createBiquadFilter()
          hp.type = 'highpass'
          hp.frequency.value = params.highpassHz ?? 0
          hp.Q.value = 0.7

          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = params.bandHz
          bp.Q.value = params.q

          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = params.lowpassHz ?? 20_000
          lp.Q.value = 0.7

          // smooth movement
          const lfo = ctx.createOscillator()
          lfo.type = 'sine'
          lfo.frequency.value = 1 / Math.max(6, params.filterLfoSeconds)
          const lfoGain = ctx.createGain()
          lfoGain.gain.value = params.filterDepthHz
          lfo.connect(lfoGain)
          lfoGain.connect(bp.frequency)
          nodes.push(hp, bp, lp, lfo, lfoGain)
          sources.push(lfo)
          try {
            lfo.start()
          } catch {
            // ignore
          }

          src.connect(hp)
          hp.connect(bp)
          bp.connect(lp)
          return lp
        },
      })
      return
    }

    const src = createNoiseSource(ctx)

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = params.highpassHz ?? 0

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = params.bandHz
    bp.Q.value = params.q

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = params.lowpassHz ?? 20_000
    lp.Q.value = 0.7

    const g = ctx.createGain()
    g.gain.value = params.gain

    applyAmpMod(g, { depth: params.gain * 0.16, seconds: params.ampLfoSeconds })

    const p = makeStereoDrift({ depth: params.driftDepth, seconds: params.driftSeconds })

    // Very slow, smooth movement in the filter cutoff
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1 / Math.max(6, params.filterLfoSeconds)

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = params.filterDepthHz

    lfo.connect(lfoGain)
    lfoGain.connect(bp.frequency)

    src.connect(hp)
    hp.connect(bp)
    bp.connect(lp)
    lp.connect(g)
    g.connect(p)
    p.connect(outGain)

    nodes.push(src, hp, bp, lp, g, lfo, lfoGain)
    sources.push(src, lfo)

    // phase-randomized start
    const bufferDur = src.buffer?.duration ?? 1
    src.start(0, randomOffsetSeconds(bufferDur))
    lfo.start()
  }

  const addAir = (params: {
    gain: number
    highpassHz: number
    lowpassHz: number
    ampLfoSeconds: number
    driftSeconds: number
    driftDepth: number
  }) => {
    const buf = profile !== 'off' ? assets.get(profile, 'air') : null
    if (usingAnyAssets && buf) {
      addCrossfadedBufferLoop({
        buffer: buf,
        target: outGain,
        baseGain: params.gain,
        crossfadeSeconds: 2,
        drift: { depth: params.driftDepth, seconds: params.driftSeconds },
        ampMod: { depth: params.gain * 0.25, seconds: params.ampLfoSeconds },
        chain: (src) => {
          const hp = ctx.createBiquadFilter()
          hp.type = 'highpass'
          hp.frequency.value = params.highpassHz
          hp.Q.value = 0.7

          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = params.lowpassHz
          lp.Q.value = 0.7

          nodes.push(hp, lp)
          src.connect(hp)
          hp.connect(lp)
          return lp
        },
      })
      return
    }

    const src = createNoiseSource(ctx)

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = params.highpassHz
    hp.Q.value = 0.7

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = params.lowpassHz
    lp.Q.value = 0.7

    const g = ctx.createGain()
    g.gain.value = params.gain

    applyAmpMod(g, { depth: params.gain * 0.25, seconds: params.ampLfoSeconds })

    const p = makeStereoDrift({ depth: params.driftDepth, seconds: params.driftSeconds })

    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(p)
    p.connect(outGain)

    nodes.push(src, hp, lp, g)
    sources.push(src)

    const bufferDur = src.buffer?.duration ?? 1
    src.start(0, randomOffsetSeconds(bufferDur))
  }

  if (profile === 'focus_soft') {
    // Spec: low bed 60–110Hz, mid texture 220–650Hz, air 4–7kHz (no content >8k).
    addLowBed({ freq: 88, gain: 0.20, detuneCents: 7, detuneLfoSeconds: 55, ampLfoSeconds: 22, driftSeconds: 55, driftDepth: 0.08 })
    addTexture({
      layer: 'mid_texture',
      bandHz: 430,
      q: 0.65,
      gain: 0.11,
      filterLfoSeconds: 30,
      filterDepthHz: 90,
      ampLfoSeconds: 24,
      driftSeconds: 55,
      driftDepth: 0.08,
      lowpassHz: 650,
    })
    addAir({ gain: 0.040, highpassHz: 4200, lowpassHz: 8000, ampLfoSeconds: 30, driftSeconds: 70, driftDepth: 0.06 })
  } else if (profile === 'focus_warm') {
    // Spec: no air layer; bed 70–95Hz; mid texture upper limit ≤500Hz; slower modulation.
    addLowBed({ freq: 78, gain: 0.22, detuneCents: 6, detuneLfoSeconds: 70, ampLfoSeconds: 34, driftSeconds: 70, driftDepth: 0.07 })
    addTexture({
      layer: 'mid_texture',
      bandHz: 360,
      q: 0.7,
      gain: 0.10,
      filterLfoSeconds: 42,
      filterDepthHz: 70,
      ampLfoSeconds: 36,
      driftSeconds: 75,
      driftDepth: 0.07,
      lowpassHz: 500,
    })
  } else if (profile === 'competitive_clean') {
    // Brighter, slightly more movement (still non-rhythmic)
    addLowBed({ freq: 102, gain: 0.18, detuneCents: 9, detuneLfoSeconds: 30, ampLfoSeconds: 8, driftSeconds: 30, driftDepth: 0.11 })
    addTexture({
      layer: 'mid_presence',
      bandHz: 900,
      q: 0.6,
      gain: 0.13,
      filterLfoSeconds: 12,
      filterDepthHz: 160,
      ampLfoSeconds: 7,
      driftSeconds: 30,
      driftDepth: 0.11,
      highpassHz: 350,
      lowpassHz: 1200,
    })
    addAir({ gain: 0.055, highpassHz: 6000, lowpassHz: 9000, ampLfoSeconds: 9, driftSeconds: 28, driftDepth: 0.10 })

    // Optional clarity bump at start: short, gentle shelf gain that decays.
    const shelf = ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 1800
    shelf.gain.value = 0

    outGain.connect(shelf)
    finalOut = shelf

    nodes.push(shelf)

    // Ramp shelf gain up then back down quickly.
    const t0 = ctx.currentTime
    shelf.gain.setValueAtTime(0, t0)
    shelf.gain.linearRampToValueAtTime(2.5, t0 + 0.35)
    shelf.gain.linearRampToValueAtTime(0, t0 + 1.6)
  } else if (profile === 'nature_air') {
    // Accessibility-safe nature-ish: no discrete events, just shaped broadband air.
    const buf = assets.get('nature_air', 'broadband')
    if (usingAnyAssets && buf) {
      addCrossfadedBufferLoop({
        buffer: buf,
        target: outGain,
        baseGain: 0.14,
        crossfadeSeconds: 2,
        drift: { depth: 0.09, seconds: 55 },
        ampMod: { depth: 0.02, seconds: 35 },
        chain: (src) => {
          const hp = ctx.createBiquadFilter()
          hp.type = 'highpass'
          hp.frequency.value = 120
          hp.Q.value = 0.7

          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 9000
          lp.Q.value = 0.7

          nodes.push(hp, lp)
          src.connect(hp)
          hp.connect(lp)
          return lp
        },
      })
    } else {
      addLowBed({ freq: 74, gain: 0.14, detuneCents: 5, detuneLfoSeconds: 75, ampLfoSeconds: 28, driftSeconds: 65, driftDepth: 0.08 })
      addTexture({
        layer: 'mid_texture',
        bandHz: 420,
        q: 0.55,
        gain: 0.07,
        filterLfoSeconds: 45,
        filterDepthHz: 65,
        ampLfoSeconds: 30,
        driftSeconds: 60,
        driftDepth: 0.08,
        highpassHz: 120,
        lowpassHz: 1600,
      })
      addAir({ gain: 0.05, highpassHz: 2400, lowpassHz: 9000, ampLfoSeconds: 34, driftSeconds: 60, driftDepth: 0.08 })
    }
  }

  return { profile, outGain, finalOut, nodes, sources, timers }
}

class AmbientEngine {
  private active: ActiveGraph | null = null
  private enabled = false
  private desiredVolume = 0
  private pauseOnTyping = false
  private crossfadeSeconds = 10
  private typingPauseTimer: number | null = null
  private pausedByVisibility = false

  ensureReady() {
    const ctx = getAudioContext()
    if (ctx) {
      // Preload assets opportunistically; failures are silent (fallback).
      void assets.preload(ctx, 'focus_soft')
      void assets.preload(ctx, 'focus_warm')
      void assets.preload(ctx, 'competitive_clean')
      void assets.preload(ctx, 'nature_air')
    }
    return ctx
  }

  async userGestureUnlock() {
    await resumeAudioContext()
  }

  private stopGraph(graph: ActiveGraph) {
    for (const t of graph.timers) {
      try {
        window.clearInterval(t)
      } catch {
        // ignore
      }
    }

    try {
      graph.finalOut.disconnect()
    } catch {
      // ignore
    }

    for (const s of graph.sources) {
      try {
        s.stop()
      } catch {
        // ignore
      }
    }

    for (const n of graph.nodes) {
      try {
        n.disconnect()
      } catch {
        // ignore
      }
    }
  }

  private setGraphVolume(ctx: AudioContext, graph: ActiveGraph, volume: number, seconds: number) {
    rampGain(graph.outGain.gain, ctx, volume, seconds)
  }

  private computeEffectiveVolume(prefs: Preferences) {
    const base = clamp(Number(prefs.ambientVolume), 0, 1)

    // Hard cap for safety.
    const maxVolume = 0.5

    // If key sounds are enabled, keep ambience below them.
    const typingCap = prefs.soundEnabled ? clamp(prefs.volume, 0, 1) * 0.7 : maxVolume

    return clamp(base, 0, Math.min(maxVolume, typingCap))
  }

  private computeEffectiveEnabled(prefs: Preferences) {
    return Boolean(getEffectiveAmbientEnabled(prefs))
  }

  update(params: { mode: Mode; prefs: Preferences; sessionActive: boolean; sessionPaused: boolean }) {
    const ctx = this.ensureReady()
    if (!ctx) return

    this.enabled = this.computeEffectiveEnabled(params.prefs)
    this.pauseOnTyping = Boolean(params.prefs.ambientPauseOnTyping)
    this.crossfadeSeconds = 10

    const selected = (params.prefs.ambientProfile ?? 'off') as AmbientProfile
    const profile = deriveEffectiveProfile(params.mode, selected)

    // No changes mid-exercise unless user explicitly changes prefs; this function is called from React effects.
    const shouldPlay = this.enabled && params.sessionActive && !params.sessionPaused && !this.pausedByVisibility && profile !== 'off'

    this.desiredVolume = shouldPlay ? this.computeEffectiveVolume(params.prefs) : 0

    if (!shouldPlay) {
      if (this.active) this.setGraphVolume(ctx, this.active, 0, 0.5)
      return
    }

    // If nothing active, start.
    if (!this.active) {
      const g = buildGraph(ctx, profile)
      g.finalOut.connect(ctx.destination)
      this.active = g

      const fadeIn = params.mode === 'competitive' ? 4 : 7
      this.setGraphVolume(ctx, g, this.desiredVolume, fadeIn)
      return
    }

    // Same profile: just update volume.
    if (this.active.profile === profile) {
      this.setGraphVolume(ctx, this.active, this.desiredVolume, 0.8)
      return
    }

    // Crossfade profile.
    const prev = this.active
    const next = buildGraph(ctx, profile)
    next.finalOut.connect(ctx.destination)
    this.active = next

    this.setGraphVolume(ctx, next, this.desiredVolume, this.crossfadeSeconds)
    this.setGraphVolume(ctx, prev, 0, this.crossfadeSeconds)

    if (prev.cleanupTimer) window.clearTimeout(prev.cleanupTimer)
    prev.cleanupTimer = window.setTimeout(() => this.stopGraph(prev), (this.crossfadeSeconds + 0.5) * 1000)
  }

  noteTypingActivity() {
    if (!this.pauseOnTyping) return
    const ctx = getAudioContext()
    if (!ctx) return
    if (!this.active) return

    // Fade down quickly; then restore after a short idle.
    this.setGraphVolume(ctx, this.active, 0, 0.12)

    if (this.typingPauseTimer != null) window.clearTimeout(this.typingPauseTimer)
    this.typingPauseTimer = window.setTimeout(() => {
      const ctx2 = getAudioContext()
      if (!ctx2) return
      if (!this.active) return
      if (!this.enabled) return
      this.setGraphVolume(ctx2, this.active, this.desiredVolume, 0.6)
    }, 900)
  }

  setVisibilityPaused(paused: boolean) {
    this.pausedByVisibility = paused
    const ctx = getAudioContext()
    if (!ctx) return
    if (!this.active) return
    this.setGraphVolume(ctx, this.active, paused ? 0 : this.desiredVolume, paused ? 0.6 : 1.2)
  }
}

export const ambientEngine = new AmbientEngine()

// Global visibility hook (fail-safe; silence when tab is not active).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    ambientEngine.setVisibilityPaused(document.hidden)
  })
}
