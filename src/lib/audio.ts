import { getAudioContext, resumeAudioContext } from './audioContext'

export type TypewriterSound =
  | 'key'
  | 'spacebar'
  | 'backspace'
  | 'return_bell'
  | 'error'
  | 'success'

export type AudioMix = {
  master: number
  typing: number
  ui: number
  ambient: number
}

export type AudioCategory = 'typing' | 'ui'

export type AudioSettings = {
  enabled: boolean
  mix?: AudioMix
  volume?: number // Legacy master if mix is missing
  modeGain: number
  category?: AudioCategory
}

export type AudioDiagnostics = {
  state: AudioContextState | 'unknown'
  buffersLoaded: number
  totalBuffers: number
  lastEvent: string | null
}

type BufferMap = Partial<Record<string, AudioBuffer>>

const base = import.meta.env.BASE_URL

export const SAMPLE_URLS = {
  key: [`${base}audio/key_1.wav`, `${base}audio/key_2.wav`, `${base}audio/key_3.wav`, `${base}audio/key_4.wav`],
  spacebar: [`${base}audio/spacebar.wav`],
  backspace: [`${base}audio/backspace.wav`],
  return_bell: [`${base}audio/return_bell.wav`],
  error: [`${base}audio/error.wav`],
  success: [`${base}audio/return_bell.wav`], // Alias to bell for now
} as const

const MIN_INTERVAL_MS: Record<TypewriterSound, number> = {
  key: 15,
  spacebar: 30,
  backspace: 30,
  error: 40,
  return_bell: 50,
  success: 50,
}

export class TypewriterAudio {
  private buffers: BufferMap = {}
  private ready = false
  private inFlight: Promise<void> | null = null
  private active: Array<{ stopAt: number; stop: () => void }> = []
  private lastEvent: string | null = null
  private lastPlayedAt: Partial<Record<TypewriterSound, number>> = {}
  private lastPlayedUrl: Partial<Record<TypewriterSound, string>> = {}
  private totalExpectedBuffers = 0

  getDiagnostics(): AudioDiagnostics {
    const ctx = getAudioContext()
    return {
      state: ctx?.state ?? 'unknown',
      buffersLoaded: Object.keys(this.buffers).length,
      totalBuffers: this.totalExpectedBuffers || 1, // Avoid div by zero
      lastEvent: this.lastEvent,
    }
  }

  /** Triggers loading of all audio assets immediately (idempotent). */
  prewarm() {
     this.ensureReady().catch(err => console.warn('Audio prewarm failed', err))
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return
    if (this.inFlight) return this.inFlight

    this.inFlight = (async () => {
      // Shared context is created lazily (must be user-gesture triggered to fully unlock in many browsers)
      const ctx = getAudioContext()
      if (!ctx) {
        this.ready = true
        return
      }

      const fetchDecode = async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch failed')
        const ab = await res.arrayBuffer()
        return await ctx.decodeAudioData(ab)
      }

      // Try to preload samples, but tolerate missing files.
      const entries = Object.entries(SAMPLE_URLS) as Array<[keyof typeof SAMPLE_URLS, readonly string[]]>
      const allUrls = entries.flatMap((e) => e[1])
      this.totalExpectedBuffers = allUrls.length

      await Promise.all(
        entries.flatMap(([kind, urls]) =>
          urls.map(async (u) => {
            try {
              const b = await fetchDecode(u)
              this.buffers[`${kind}:${u}`] = b
            } catch {
              // ignore (we'll synthesize fallback)
            }
          }),
        ),
      )

      this.ready = true
    })()

    return this.inFlight
  }

  async resume() {
    await resumeAudioContext()
  }

  play(kind: TypewriterSound, settings: AudioSettings) {
    if (!settings.enabled) return
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    // Debounce
    const now = ctx.currentTime
    const limitParams = MIN_INTERVAL_MS[kind] || 15
    const last = this.lastPlayedAt[kind] ?? 0
    if (now - last < limitParams / 1000) return

    this.lastPlayedAt[kind] = now
    this.lastEvent = kind

    // Calculate effective volume
    let vol = settings.modeGain
    if (settings.mix) {
      const cat = settings.category ?? 'typing'
      const catVol = cat === 'typing' ? settings.mix.typing : settings.mix.ui
      vol *= settings.mix.master * catVol
    } else {
      vol *= (settings.volume ?? 1)
    }

    // polyphony cap
    this.active = this.active.filter((a) => a.stopAt > now)
    while (this.active.length >= 6) {
      const oldest = this.active.shift()
      oldest?.stop()
    }

    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, vol))
    gain.connect(ctx.destination)

    const tryBuffer = () => {
      const urls = SAMPLE_URLS[kind]
      let url = urls[Math.floor(Math.random() * urls.length)]

      // Smart random: avoid immediate repeat if multiple samples exist (Anti-Machine Gun)
      if (urls.length > 1 && url === this.lastPlayedUrl[kind]) {
         const candidates = urls.filter(u => u !== url)
         url = candidates[Math.floor(Math.random() * candidates.length)]
      }
      this.lastPlayedUrl[kind] = url

      const key = `${kind}:${url}`
      const buf = this.buffers[key]
      if (!buf) return null

      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = 0.98 + Math.random() * 0.06
      src.connect(gain)
      src.start()
      const stopAt = now + buf.duration
      this.active.push({ stopAt, stop: () => src.stop() })
      return true
    }

    if (tryBuffer()) return

    // Synth fallback: short noise click / bell
    const dur = kind === 'return_bell' ? 0.12 : 0.03
    const src = ctx.createBufferSource()
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (kind === 'return_bell') {
      // simple bell-ish tone
      const freq = 880
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate
        const env = Math.exp(-t * 18)
        data[i] = Math.sin(2 * Math.PI * freq * t) * env
      }
    } else {
      // click/noise
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length
        const env = Math.exp(-t * 10)
        data[i] = (Math.random() * 2 - 1) * env
      }
    }

    src.buffer = buffer
    src.playbackRate.value = 0.98 + Math.random() * 0.06
    src.connect(gain)
    src.start()
    const stopAt = now + dur
    this.active.push({ stopAt, stop: () => src.stop() })
  }
}

export const typewriterAudio = new TypewriterAudio()
