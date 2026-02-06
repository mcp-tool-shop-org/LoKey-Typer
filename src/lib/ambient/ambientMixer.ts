import { getAudioContext } from '../audioContext'
import type { AmbientStem } from '../ambientManifest'

export type AmbientLayerName = 'low_bed' | 'mid_texture' | 'mid_presence' | 'air' | 'room'

type LayerGraph = {
  stem: AmbientStem
  src: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  pan: StereoPannerNode
}

type BufferCache = Map<string, AudioBuffer>

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function now(ctx: AudioContext) {
  return ctx.currentTime
}

function ramp(param: AudioParam, ctx: AudioContext, value: number, seconds: number) {
  const t0 = now(ctx)
  param.cancelScheduledValues(t0)
  param.setValueAtTime(param.value, t0)
  param.linearRampToValueAtTime(value, t0 + Math.max(0.01, seconds))
}

function setTarget(param: AudioParam, ctx: AudioContext, value: number, timeConstantSeconds: number) {
  const t0 = now(ctx)
  param.cancelScheduledValues(t0)
  param.setTargetAtTime(value, t0, Math.max(0.01, timeConstantSeconds))
}

function randBetween(rand: () => number, min: number, max: number) {
  return min + (max - min) * rand()
}

async function fetchDecode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return await ctx.decodeAudioData(ab)
  } catch {
    return null
  }
}

export class AmbientMixer {
  private bufferCache: BufferCache = new Map()
  private master: GainNode | null = null
  private connected = false
  private layers: Partial<Record<AmbientLayerName, LayerGraph>> = {}

  ensureGraph() {
    const ctx = getAudioContext()
    if (!ctx) return null

    if (!this.master) {
      this.master = ctx.createGain()
      this.master.gain.value = 0
    }

    if (!this.connected) {
      this.master.connect(ctx.destination)
      this.connected = true
    }

    return { ctx, master: this.master }
  }

  disconnect() {
    const ctx = getAudioContext()
    if (!ctx) return
    if (!this.master) return

    try {
      this.master.disconnect()
    } catch {
      // ignore
    }

    this.connected = false
  }

  setMasterVolume(volume: number, seconds: number) {
    const g = this.ensureGraph()
    if (!g) return
    ramp(g.master.gain, g.ctx, clamp(volume, 0, 1), seconds)
  }

  async preload(stems: AmbientStem[]) {
    const g = this.ensureGraph()
    if (!g) return

    await Promise.all(
      stems.map(async (s) => {
        if (this.bufferCache.has(s.path)) return
        const buf = await fetchDecode(g.ctx, s.path)
        if (buf) this.bufferCache.set(s.path, buf)
      }),
    )
  }

  private async getBuffer(stem: AmbientStem) {
    const g = this.ensureGraph()
    if (!g) return null

    const cached = this.bufferCache.get(stem.path)
    if (cached) return cached

    const buf = await fetchDecode(g.ctx, stem.path)
    if (buf) this.bufferCache.set(stem.path, buf)
    return buf
  }

  private baseGainDbForLayer(layer: AmbientLayerName) {
    // Relative mix targets; actual master volume is applied on top.
    if (layer === 'mid_texture' || layer === 'mid_presence') return -14
    if (layer === 'low_bed') return -18
    if (layer === 'air') return -24
    return -26 // room
  }

  private dbToGain(db: number) {
    return Math.pow(10, db / 20)
  }

  private buildLayerGraph(params: {
    ctx: AudioContext
    stem: AmbientStem
    buf: AudioBuffer
    layer: AmbientLayerName
    rand: () => number
    micro: { gainTc: number; filterTc: number; panTc: number }
  }): LayerGraph {
    const src = params.ctx.createBufferSource()
    src.buffer = params.buf
    src.loop = true

    const filter = params.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.7

    // Start frequencies are conservative; micro-variation will drift around these.
    const startCutoff = params.layer === 'air' ? 9000 : params.layer === 'low_bed' ? 1500 : 6500
    filter.frequency.value = startCutoff

    const gain = params.ctx.createGain()
    const baseDb = this.baseGainDbForLayer(params.layer)
    gain.gain.value = this.dbToGain(baseDb)

    const pan = params.ctx.createStereoPanner()
    pan.pan.value = 0

    src.connect(filter)
    filter.connect(pan)
    pan.connect(gain)
    gain.connect(this.master!)

    // Randomized loop offset (0–8s, seam-safe best effort).
    const offset = randBetween(params.rand, 0, 8)
    const offsetSafe = clamp(offset, 0, Math.max(0, params.buf.duration - 0.01))

    try {
      src.start(0, offsetSafe)
    } catch {
      // ignore
    }

    // Micro-variation targets; start near current values.
    setTarget(gain.gain, params.ctx, gain.gain.value, params.micro.gainTc)
    setTarget(filter.frequency, params.ctx, filter.frequency.value, params.micro.filterTc)
    setTarget(pan.pan, params.ctx, pan.pan.value, params.micro.panTc)

    return { stem: params.stem, src, filter, gain, pan }
  }

  stopAll(seconds: number) {
    const g = this.ensureGraph()
    if (!g) return

    for (const lg of Object.values(this.layers)) {
      if (!lg) continue
      try {
        ramp(lg.gain.gain, g.ctx, 0, seconds)
      } catch {
        // ignore
      }
      try {
        lg.src.stop(g.ctx.currentTime + Math.max(0.05, seconds + 0.1))
      } catch {
        // ignore
      }
    }

    this.layers = {}
  }

  getActiveStemIds(): Partial<Record<AmbientLayerName, string>> {
    const out: Partial<Record<AmbientLayerName, string>> = {}
    for (const [layer, g] of Object.entries(this.layers) as Array<[AmbientLayerName, LayerGraph]>) {
      if (g?.stem?.id) out[layer] = g.stem.id
    }
    return out
  }

  async setSoundscape(params: {
    stemsByLayer: Partial<Record<AmbientLayerName, AmbientStem>>
    rand: () => number
    micro: { gainTc: number; filterTc: number; panTc: number }
    fadeSeconds?: number
  }) {
    const g = this.ensureGraph()
    if (!g || !this.master) return

    // Stop existing quickly; this is used only for initial start or full rebuild.
    this.stopAll(Math.min(2, params.fadeSeconds ?? 1.2))

    const entries = Object.entries(params.stemsByLayer) as Array<[AmbientLayerName, AmbientStem]>
    for (const [layer, stem] of entries) {
      const buf = await this.getBuffer(stem)
      if (!buf) continue
      this.layers[layer] = this.buildLayerGraph({
        ctx: g.ctx,
        stem,
        buf,
        layer,
        rand: params.rand,
        micro: params.micro,
      })
    }
  }

  async swapLayer(params: {
    layer: AmbientLayerName
    next: AmbientStem
    fadeSeconds: number
    rand: () => number
    micro: { gainTc: number; filterTc: number; panTc: number }
  }): Promise<boolean> {
    const g = this.ensureGraph()
    if (!g || !this.master) return false

    const prev = this.layers[params.layer]
    const buf = await this.getBuffer(params.next)
    if (!buf) return false

    const nextGraph = this.buildLayerGraph({
      ctx: g.ctx,
      stem: params.next,
      buf,
      layer: params.layer,
      rand: params.rand,
      micro: params.micro,
    })

    // Crossfade layer only.
    nextGraph.gain.gain.value = 0
    ramp(nextGraph.gain.gain, g.ctx, this.dbToGain(this.baseGainDbForLayer(params.layer)), params.fadeSeconds)

    if (prev) {
      ramp(prev.gain.gain, g.ctx, 0, params.fadeSeconds)
      try {
        prev.src.stop(g.ctx.currentTime + Math.max(0.05, params.fadeSeconds + 0.1))
      } catch {
        // ignore
      }
    }

    this.layers[params.layer] = nextGraph
    return true
  }

  applyMicroVariation(params: {
    rand: () => number
    mode: 'focus' | 'competitive'
  }) {
    const g = this.ensureGraph()
    if (!g) return

    // Smooth random walk targets.
    const drift = (base: number, pct: number) => base * (1 + (params.rand() * 2 - 1) * pct)

    for (const [layer, lg] of Object.entries(this.layers) as Array<[AmbientLayerName, LayerGraph]>) {
      if (!lg) continue

      // Gain drift is subtle.
      const gainDepth = params.mode === 'competitive' ? 0.10 : 0.07
      const targetGain = clamp(lg.gain.gain.value * (1 + (params.rand() * 2 - 1) * gainDepth), 0, 2)
      setTarget(lg.gain.gain, g.ctx, targetGain, params.mode === 'competitive' ? 25 : 60)

      // Filter drift by layer.
      const baseCutoff = layer === 'air' ? 9000 : layer === 'low_bed' ? 1500 : 6500
      const pct = params.mode === 'competitive' ? 0.12 : 0.08
      const targetCutoff = clamp(drift(baseCutoff, pct), 300, 10000)
      setTarget(lg.filter.frequency, g.ctx, targetCutoff, params.mode === 'competitive' ? 30 : 90)

      // Very tiny pan drift.
      const panDepth = params.mode === 'competitive' ? 0.06 : 0.04
      const targetPan = clamp((params.rand() * 2 - 1) * panDepth, -0.15, 0.15)
      setTarget(lg.pan.pan, g.ctx, targetPan, params.mode === 'competitive' ? 40 : 120)
    }
  }
}
