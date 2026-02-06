import type { Mode } from '@content'

export type AmbientLayerName = 'low_bed' | 'mid_texture' | 'mid_presence' | 'air' | 'room'

export type SoundscapeLayers = Partial<Record<AmbientLayerName, string>>

type PersistedHistory = {
  // Most recent first
  recentSoundscapes: string[]
  recentDominant: string[]
}

const KEY_PREFIX = 'lkt_ambient_history_v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function keyForMode(mode: Mode) {
  return `${KEY_PREFIX}|${mode}`
}

function loadPersisted(mode: Mode): PersistedHistory {
  try {
    if (typeof localStorage === 'undefined') return { recentSoundscapes: [], recentDominant: [] }
    const parsed = safeParse<PersistedHistory>(localStorage.getItem(keyForMode(mode)))
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

function savePersisted(mode: Mode, next: PersistedHistory) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(keyForMode(mode), JSON.stringify(next))
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
    const persisted = loadPersisted(this.mode)
    const id = this.soundscapeId(profile, layers)
    return persisted.recentSoundscapes.slice(0, n).includes(id)
  }

  wasDominantUsedRecently(layers: SoundscapeLayers, n = 10) {
    const persisted = loadPersisted(this.mode)
    const dom = this.dominantStemId(layers)
    if (!dom) return false
    return persisted.recentDominant.slice(0, n).includes(dom)
  }

  noteSoundscape(profile: string, layers: SoundscapeLayers) {
    const persisted = loadPersisted(this.mode)
    const id = this.soundscapeId(profile, layers)
    const dom = this.dominantStemId(layers)

    const nextSoundscapes = [id, ...persisted.recentSoundscapes.filter((s) => s !== id)].slice(0, 50)
    const nextDominant =
      dom == null
        ? persisted.recentDominant
        : [dom, ...persisted.recentDominant.filter((s) => s !== dom)].slice(0, 10)

    savePersisted(this.mode, { recentSoundscapes: nextSoundscapes, recentDominant: nextDominant })
  }
}
