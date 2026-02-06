import type { Mode } from '@content'
import type { Preferences } from '../storage'
import { resumeAudioContext } from '../audioContext'
import { getEffectiveAmbientEnabled } from '../effectivePrefs'
import { fetchAmbientManifest, type AmbientStem } from '../ambientManifest'
import { AmbientHistory, type AmbientLayerName, type SoundscapeLayers } from './ambientHistory'
import { AmbientMixer } from './ambientMixer'

export type AmbientProfile = 'off' | 'focus_soft' | 'focus_warm' | 'competitive_clean' | 'nature_air'

type EngineParams = {
  mode: Mode
  prefs: Preferences
  sessionActive: boolean
  sessionPaused: boolean
  exerciseRemainingMs?: number | null
}

type DebugState = {
  enabled: boolean
  shouldPlay: boolean
  mode: Mode
  profile: AmbientProfile
  masterVolume: number
  activeStemIds: Partial<Record<AmbientLayerName, string>>
  nextEvolutionAtMs: number | null
  lastEvolutionAtMs: number | null
  reducedMotion: boolean
  screenReaderMode: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pickWeighted<T>(items: T[], weight: (x: T) => number, rand: () => number): T | null {
  let total = 0
  const weights = items.map((i) => {
    const w = Math.max(0, weight(i))
    total += w
    return w
  })
  if (total <= 0) return null
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1] ?? null
}

function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function deriveEffectiveProfile(mode: Mode, selected: AmbientProfile): AmbientProfile {
  if (selected === 'off') return 'off'
  if (selected === 'nature_air') return 'nature_air'

  if (mode === 'competitive') return 'competitive_clean'
  if (selected === 'competitive_clean') return 'focus_soft'
  return selected
}

function computeEffectiveVolume(prefs: Preferences) {
  const base = clamp(Number(prefs.ambientVolume), 0, 1)

  // Safety cap.
  const maxVolume = 0.5

  // Keep ambience below typing SFX when enabled.
  const typingCap = prefs.soundEnabled ? clamp(prefs.volume, 0, 1) * 0.7 : maxVolume

  return clamp(base, 0, Math.min(maxVolume, typingCap))
}

function layersForMode(mode: Mode): AmbientLayerName[] {
  if (mode === 'competitive') return ['low_bed', 'mid_presence', 'air']
  return ['low_bed', 'mid_texture', 'air', 'room']
}

function evolutionWeights(layer: AmbientLayerName) {
  if (layer === 'air') return 0.45
  if (layer === 'room') return 0.35
  if (layer === 'mid_texture' || layer === 'mid_presence') return 0.15
  return 0.05
}

function isSafeToEvolve(remainingMs: number | null | undefined) {
  if (remainingMs == null) return true
  return remainingMs > 20_000
}

export class AmbientEngineV2 {
  private mixer = new AmbientMixer()
  private manifest: { stems: AmbientStem[] } | null = null
  private manifestLoadedAtMs: number | null = null

  private enabled = false
  private shouldPlay = false
  private desiredMaster = 0
  private pauseOnTyping = false
  private pausedByVisibility = false
  private lastExerciseRemainingMs: number | null | undefined = null

  private typingPauseTimer: number | null = null

  private activeMode: Mode = 'focus'
  private activeProfile: AmbientProfile = 'off'

  private lastReducedMotion = false
  private lastScreenReaderMode = false

  private history: AmbientHistory | null = null

  private nextEvolutionAtMs: number | null = null
  private lastEvolutionAtMs: number | null = null
  private evolutionDebounceUntilMs: number | null = null

  private microTimer: number | null = null
  private macroTimer: number | null = null

  private rand = mulberry32(xmur3('ambient')())

  async userGestureUnlock() {
    await resumeAudioContext()
  }

  // Back-compat with the previous ambient engine API.
  async ensureReady() {
    await resumeAudioContext()
    await this.ensureManifestLoaded()
  }

  setVisibilityPaused(paused: boolean) {
    this.pausedByVisibility = paused
    this.applyVolumes(0.6)
  }

  noteTypingActivity() {
    if (!this.pauseOnTyping) return

    // Fade down quickly; restore after a short idle.
    this.mixer.setMasterVolume(0, 0.12)

    if (this.typingPauseTimer != null) window.clearTimeout(this.typingPauseTimer)
    this.typingPauseTimer = window.setTimeout(() => {
      if (!this.shouldPlay) return
      this.mixer.setMasterVolume(this.desiredMaster, 0.6)
    }, 900)
  }

  getDebugState(): DebugState {
    return {
      enabled: this.enabled,
      shouldPlay: this.shouldPlay,
      mode: this.activeMode,
      profile: this.activeProfile,
      masterVolume: this.desiredMaster,
      activeStemIds: this.mixer.getActiveStemIds(),
      nextEvolutionAtMs: this.nextEvolutionAtMs,
      lastEvolutionAtMs: this.lastEvolutionAtMs,
      reducedMotion: this.lastReducedMotion,
      screenReaderMode: this.lastScreenReaderMode,
    }
  }

  private async ensureManifestLoaded() {
    const nowMs = Date.now()
    // Refresh at most once per minute (dev friendliness).
    if (this.manifest && this.manifestLoadedAtMs && nowMs - this.manifestLoadedAtMs < 60_000) return

    const m = await fetchAmbientManifest()
    this.manifest = m ? { stems: m.stems } : { stems: [] }
    this.manifestLoadedAtMs = nowMs
  }

  private stemsFor(params: { mode: Mode; profile: AmbientProfile; layer: AmbientLayerName }) {
    if (!this.manifest) return []

    // Map real_life to focus palette.
    const paletteMode: Mode = params.mode === 'competitive' ? 'competitive' : 'focus'

    return this.manifest.stems
      .filter((s) => s.layer === params.layer)
      .filter((s) => (params.profile === 'nature_air' ? s.profile === 'nature_air' : s.profile === params.profile))
      .filter((s) => {
        // Keep manifest mode compatible.
        if (paletteMode === 'competitive') return s.mode === 'competitive'
        // focus palette accepts both focus + real_life stems (treated the same).
        return s.mode === 'focus' || s.mode === 'real_life'
      })
  }

  private computeEnabled(prefs: Preferences) {
    return Boolean(prefs.soundEnabled) && Boolean(getEffectiveAmbientEnabled(prefs))
  }

  private applyVolumes(seconds: number) {
    const v = this.enabled && !this.pausedByVisibility ? this.desiredMaster : 0
    this.mixer.setMasterVolume(v, seconds)
  }

  private shouldLogDebug() {
    try {
      if (typeof localStorage === 'undefined') return false
      return localStorage.getItem('lkt_ambient_debug') === '1'
    } catch {
      return false
    }
  }

  private logDebug(msg: string, extra?: unknown) {
    if (!this.shouldLogDebug()) return
    console.log(`[ambient] ${msg}`, extra ?? '')
  }

  private scheduleMicro() {
    if (this.microTimer != null) return
    this.microTimer = window.setInterval(() => {
      if (!this.shouldPlay) return
      const mode = this.activeMode === 'competitive' ? 'competitive' : 'focus'
      this.mixer.applyMicroVariation({ rand: this.rand, mode })
    }, 1000)
  }

  private scheduleMacroTick() {
    if (this.macroTimer != null) return
    this.macroTimer = window.setInterval(() => {
      if (!this.shouldPlay) return
      if (this.pausedByVisibility) return
      if (this.lastReducedMotion) return

      if (!isSafeToEvolve(this.lastExerciseRemainingMs)) return

      void (async () => {
        await this.ensureManifestLoaded()
        const hasAny = (this.manifest?.stems?.length ?? 0) > 0
        if (!hasAny) return

        await this.maybeEvolve({
          mode: this.activeMode,
          profile: this.activeProfile,
          reducedMotion: this.lastReducedMotion,
          exerciseRemainingMs: this.lastExerciseRemainingMs,
        })
      })()
    }, 1000)
  }

  private clearTimers() {
    if (this.microTimer != null) window.clearInterval(this.microTimer)
    if (this.macroTimer != null) window.clearInterval(this.macroTimer)
    this.microTimer = null
    this.macroTimer = null
  }

  private planNextEvolution() {
    const minutes = 3 + this.rand() * 3
    this.nextEvolutionAtMs = Date.now() + minutes * 60_000
  }

  private ensureEvolutionPlanned() {
    if (this.nextEvolutionAtMs == null) this.planNextEvolution()
  }

  private pickInitialSoundscape(params: { mode: Mode; profile: AmbientProfile }) {
    const layers = layersForMode(params.mode)
    const stemsByLayer: Partial<Record<AmbientLayerName, AmbientStem>> = {}

    for (const layer of layers) {
      const candidates = this.stemsFor({ mode: params.mode, profile: params.profile, layer })
      if (!this.history) continue

      const picked = pickWeighted(
        candidates.filter((c) => !this.history!.wasLayerUsedRecently(layer, c.id, 5)),
        () => 1,
        this.rand,
      )

      if (picked) {
        stemsByLayer[layer] = picked
        this.history.noteLayerUse(layer, picked.id, 5)
      }
    }

    return stemsByLayer
  }

  private async ensurePlaying(params: {
    mode: Mode
    profile: AmbientProfile
    reducedMotion: boolean
    exerciseRemainingMs?: number | null
  }) {
    if (!this.history || this.activeMode !== params.mode) this.history = new AmbientHistory(params.mode)

    // Choose initial stems.
    const stemsByLayer = this.pickInitialSoundscape({ mode: params.mode, profile: params.profile })
    const activeIds: SoundscapeLayers = {}
    for (const [layer, stem] of Object.entries(stemsByLayer) as Array<[AmbientLayerName, AmbientStem]>) {
      activeIds[layer] = stem.id
    }

    // Cross-session no-repeat: if we accidentally picked a recent full soundscape, we’ll let macro evolution swap quickly.
    if (this.history.wasSoundscapeUsedWithinMs(params.profile, activeIds, 30 * 60_000)) {
      this.logDebug('Picked recently-used soundscape; will evolve soon', activeIds)
      this.nextEvolutionAtMs = Date.now() + 15_000
    } else {
      this.history.noteSoundscape(params.profile, activeIds)
    }

    await this.mixer.preload(Object.values(stemsByLayer).filter(Boolean) as AmbientStem[])

    await this.mixer.setSoundscape({
      stemsByLayer,
      rand: this.rand,
      micro: {
        gainTc: params.mode === 'competitive' ? 30 : 60,
        filterTc: params.mode === 'competitive' ? 30 : 90,
        panTc: params.mode === 'competitive' ? 40 : 120,
      },
    })

    this.planNextEvolution()
    this.scheduleMicro()
    this.scheduleMacroTick()
  }

  private async maybeEvolve(params: {
    mode: Mode
    profile: AmbientProfile
    reducedMotion: boolean
    exerciseRemainingMs?: number | null
  }) {
    if (params.reducedMotion) return
    if (!isSafeToEvolve(params.exerciseRemainingMs)) return

    const nowMs = Date.now()
    if (this.evolutionDebounceUntilMs != null && nowMs < this.evolutionDebounceUntilMs) return
    if (this.nextEvolutionAtMs == null || nowMs < this.nextEvolutionAtMs) return

    const layers = layersForMode(params.mode)
    const layer = pickWeighted(layers, evolutionWeights, this.rand)
    if (!layer || !this.history) {
      this.planNextEvolution()
      return
    }

    const candidates = this.stemsFor({ mode: params.mode, profile: params.profile, layer })
    const picked = pickWeighted(
      candidates.filter((c) => !this.history!.wasLayerUsedRecently(layer, c.id, 5)),
      () => 1,
      this.rand,
    )

    if (!picked) {
      this.planNextEvolution()
      return
    }

    const ok = await this.mixer.swapLayer({
      layer,
      next: picked,
      fadeSeconds: 12 + this.rand() * 13,
      rand: this.rand,
      micro: {
        gainTc: params.mode === 'competitive' ? 30 : 60,
        filterTc: params.mode === 'competitive' ? 30 : 90,
        panTc: params.mode === 'competitive' ? 40 : 120,
      },
    })

    if (ok) {
      this.history.noteLayerUse(layer, picked.id, 5)
      const active = this.mixer.getActiveStemIds() as SoundscapeLayers
      this.history.noteSoundscape(params.profile, active)
      this.lastEvolutionAtMs = nowMs
      this.evolutionDebounceUntilMs = nowMs + 60_000
      this.logDebug(`Evolved layer ${layer}`, { next: picked.id, active })
    }

    this.planNextEvolution()
  }

  update(params: EngineParams) {
    this.enabled = this.computeEnabled(params.prefs)
    this.pauseOnTyping = Boolean(params.prefs.ambientPauseOnTyping)

    const selected = (params.prefs.ambientProfile ?? 'off') as AmbientProfile
    const profile = deriveEffectiveProfile(params.mode, selected)

    const reducedMotion = Boolean(params.prefs.reducedMotion)
    const screenReaderMode = Boolean(params.prefs.screenReaderMode)

    this.lastReducedMotion = reducedMotion
    this.lastScreenReaderMode = screenReaderMode

    const shouldPlay =
      this.enabled &&
      params.sessionActive &&
      !params.sessionPaused &&
      !this.pausedByVisibility &&
      profile !== 'off' &&
      !screenReaderMode

    const modeChanged = this.activeMode !== params.mode
    const profileChanged = this.activeProfile !== profile

    this.activeMode = params.mode
    this.activeProfile = profile
    this.lastExerciseRemainingMs = params.exerciseRemainingMs
    this.shouldPlay = shouldPlay

    this.desiredMaster = shouldPlay ? computeEffectiveVolume(params.prefs) : 0

    if (!shouldPlay) {
      this.applyVolumes(0.5)
      this.clearTimers()
      return
    }

    // When switching mode/profile mid-session, rebuild the soundscape.
    if (modeChanged || profileChanged) {
      this.mixer.stopAll(1.0)
      this.history = new AmbientHistory(this.activeMode)
      this.nextEvolutionAtMs = null
      this.lastEvolutionAtMs = null
      this.evolutionDebounceUntilMs = null
    }

    // Seed RNG per session+profile+mode day bucket for stable "feel" within a day.
    const seed = `${this.activeMode}|${this.activeProfile}|${new Date().toISOString().slice(0, 10)}`
    this.rand = mulberry32(xmur3(seed)())

    void (async () => {
      await this.ensureManifestLoaded()

      // If manifest has no stems, stay silent but keep engine stable.
      const hasAny = (this.manifest?.stems?.length ?? 0) > 0
      if (!hasAny) {
        this.logDebug('No ambient stems found in manifest; staying silent')
        this.applyVolumes(0.5)
        return
      }

      // Start if nothing playing.
      if (Object.keys(this.mixer.getActiveStemIds()).length === 0) {
        await this.ensurePlaying({
          mode: params.mode,
          profile,
          reducedMotion,
          exerciseRemainingMs: params.exerciseRemainingMs,
        })
      }

      this.ensureEvolutionPlanned()

      // Ensure macro tick is active (it will no-op in reduced motion).
      this.scheduleMacroTick()

      // Keep master volume in sync.
      this.applyVolumes(0.8)

      // Debug state updates.
      if (this.shouldLogDebug()) {
        const st: DebugState = {
          enabled: this.enabled,
          shouldPlay,
          mode: this.activeMode,
          profile: this.activeProfile,
          masterVolume: this.desiredMaster,
          activeStemIds: this.mixer.getActiveStemIds(),
          nextEvolutionAtMs: this.nextEvolutionAtMs,
          lastEvolutionAtMs: this.lastEvolutionAtMs,
          reducedMotion,
          screenReaderMode,
        }
        this.logDebug('state', st)
      }
    })()
  }
}
