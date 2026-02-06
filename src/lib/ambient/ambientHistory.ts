import type { Mode } from '@content'

export type AmbientLayerName = 'low_bed' | 'mid_texture' | 'mid_presence' | 'air' | 'room'

export type SoundscapeLayers = Partial<Record<AmbientLayerName, string>>

type HistoryEntry = { id: string; atMs: number }

type PersistedHistoryV2 = {
  // Most recent first
  recentSoundscapes: HistoryEntry[]
  recentDominant: HistoryEntry[]
}

type PersistedHistoryV1 = {
  // Most recent first
  recentSoundscapes: string[]
  recentDominant: string[]
}

const KEY_PREFIX_V1 = 'lkt_ambient_history_v1'
const KEY_PREFIX_V2 = 'lkt_ambient_history_v2'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function keyForModeV1(mode: Mode) {
  return `${KEY_PREFIX_V1}|${mode}`
}

function keyForModeV2(mode: Mode) {
  return `${KEY_PREFIX_V2}|${mode}`
}

function normalizeEntry(x: unknown): HistoryEntry | null {
  const e = x as Partial<HistoryEntry> | null
  if (!e) return null
  if (typeof e.id !== 'string' || e.id.length === 0) return null
  if (typeof e.atMs !== 'number' || !Number.isFinite(e.atMs) || e.atMs <= 0) return null
  return { id: e.id, atMs: e.atMs }
}

function loadPersistedV2(mode: Mode): PersistedHistoryV2 {
  try {
    if (typeof localStorage === 'undefined') return { recentSoundscapes: [], recentDominant: [] }
    const parsed = safeParse<PersistedHistoryV2>(localStorage.getItem(keyForModeV2(mode)))
    if (!parsed) return { recentSoundscapes: [], recentDominant: [] }
    return {
      recentSoundscapes: Array.isArray(parsed.recentSoundscapes)
        ? parsed.recentSoundscapes.map(normalizeEntry).filter((e): e is HistoryEntry => e != null)
        : [],
      recentDominant: Array.isArray(parsed.recentDominant)
        ? parsed.recentDominant.map(normalizeEntry).filter((e): e is HistoryEntry => e != null)
        : [],
    }
  } catch {
    return { recentSoundscapes: [], recentDominant: [] }
  }
}

function loadPersistedV1(mode: Mode): PersistedHistoryV1 {
  try {
    if (typeof localStorage === 'undefined') return { recentSoundscapes: [], recentDominant: [] }
    const parsed = safeParse<PersistedHistoryV1>(localStorage.getItem(keyForModeV1(mode)))
    if (!parsed) return { recentSoundscapes: [], recentDominant: [] }
    return {
      recentSoundscapes: Array.isArray(parsed.recentSoundscapes)
        ? parsed.recentSoundscapes.filter((s): s is string => typeof s === 'string')
        : [],
      recentDominant: Array.isArray(parsed.recentDominant)
        ? parsed.recentDominant.filter((s): s is string => typeof s === 'string')
        : [],
    }
  } catch {
    return { recentSoundscapes: [], recentDominant: [] }
  }
}

function savePersistedV2(mode: Mode, next: PersistedHistoryV2) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(keyForModeV2(mode), JSON.stringify(next))
  } catch {
    // ignore
  }
}

export class AmbientHistory {
  private mode: Mode
  private perLayerRecent: Record<AmbientLayerName, string[]> = {
    low_bed: [],
    mid_texture: [],
    mid_presence: [],
    air: [],
    room: [],
  }

  constructor(mode: Mode) {
    this.mode = mode
  }

  noteLayerUse(layer: AmbientLayerName, stemId: string, k = 5) {
    const prev = this.perLayerRecent[layer] ?? []
    this.perLayerRecent[layer] = [stemId, ...prev.filter((s) => s !== stemId)].slice(0, k)
  }

  wasLayerUsedRecently(layer: AmbientLayerName, stemId: string, k = 5) {
    const prev = this.perLayerRecent[layer] ?? []
    return prev.slice(0, k).includes(stemId)
  }

  soundscapeId(profile: string, layers: SoundscapeLayers) {
    const parts = Object.entries(layers)
      .filter(([, id]) => typeof id === 'string' && id.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([layer, id]) => `${layer}:${id}`)
    return `${profile}|${parts.join('|')}`
  }

  dominantStemId(layers: SoundscapeLayers) {
    return layers.mid_texture ?? layers.mid_presence ?? null
  }

  wasSoundscapeUsedRecently(profile: string, layers: SoundscapeLayers, n = 50) {
    const persistedV2 = loadPersistedV2(this.mode)
    const id = this.soundscapeId(profile, layers)
    if (persistedV2.recentSoundscapes.length) return persistedV2.recentSoundscapes.slice(0, n).some((e) => e.id === id)

    const persistedV1 = loadPersistedV1(this.mode)
    return persistedV1.recentSoundscapes.slice(0, n).includes(id)
  }

  wasSoundscapeUsedWithinMs(profile: string, layers: SoundscapeLayers, windowMs: number) {
    const persisted = loadPersistedV2(this.mode)
    const id = this.soundscapeId(profile, layers)
    const cutoff = Date.now() - Math.max(0, windowMs)
    return persisted.recentSoundscapes.some((e) => e.id === id && e.atMs >= cutoff)
  }

  wasDominantUsedRecently(layers: SoundscapeLayers, n = 10) {
    const persistedV2 = loadPersistedV2(this.mode)
    const dom = this.dominantStemId(layers)
    if (!dom) return false
    if (persistedV2.recentDominant.length) return persistedV2.recentDominant.slice(0, n).some((e) => e.id === dom)

    const persistedV1 = loadPersistedV1(this.mode)
    return persistedV1.recentDominant.slice(0, n).includes(dom)
  }

  noteSoundscape(profile: string, layers: SoundscapeLayers) {
    const id = this.soundscapeId(profile, layers)
    const dom = this.dominantStemId(layers)

    const nowMs = Date.now()
    const persisted = loadPersistedV2(this.mode)

    const nextSoundscapes = [{ id, atMs: nowMs }, ...persisted.recentSoundscapes.filter((e) => e.id !== id)].slice(0, 200)
    const nextDominant =
      dom == null
        ? persisted.recentDominant
        : [{ id: dom, atMs: nowMs }, ...persisted.recentDominant.filter((e) => e.id !== dom)].slice(0, 50)

    savePersistedV2(this.mode, { recentSoundscapes: nextSoundscapes, recentDominant: nextDominant })
  }
}
