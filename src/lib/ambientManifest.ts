import type { Mode } from '@content'

export type AmbientLayerName = 'low_bed' | 'mid_texture' | 'mid_presence' | 'air' | 'room'

export type AmbientStemFeatures = {
  brightness?: number
  density?: number
  movement?: number
}

export type AmbientStem = {
  id: string
  mode: Mode
  profile: string
  layer: AmbientLayerName
  path: string
  length_sec?: number
  lufs_i?: number
  tags?: string[]
  features?: AmbientStemFeatures
}

export type AmbientManifest = {
  version: number
  stems: AmbientStem[]
}

function isMode(x: unknown): x is Mode {
  return x === 'focus' || x === 'real_life' || x === 'competitive'
}

function isLayer(x: unknown): x is AmbientLayerName {
  return x === 'low_bed' || x === 'mid_texture' || x === 'mid_presence' || x === 'air' || x === 'room'
}

export async function fetchAmbientManifest(url = '/audio/ambient/manifest.json'): Promise<AmbientManifest | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return null
    const raw = (await res.json()) as unknown

    const m = raw as Partial<AmbientManifest> | null
    const version = m?.version
    if (!m || !Array.isArray(m.stems) || typeof version !== 'number' || !Number.isFinite(version)) return null

    const stems: AmbientStem[] = []
    for (const s0 of m.stems) {
      const s = s0 as Partial<AmbientStem> | null
      if (!s) continue
      if (typeof s.id !== 'string' || s.id.length === 0) continue
      if (!isMode(s.mode)) continue
      if (typeof s.profile !== 'string' || s.profile.length === 0) continue
      if (!isLayer(s.layer)) continue
      if (typeof s.path !== 'string' || s.path.length === 0) continue
      stems.push({
        id: s.id,
        mode: s.mode,
        profile: s.profile,
        layer: s.layer,
        path: s.path,
        length_sec: Number.isFinite(s.length_sec) ? s.length_sec : undefined,
        lufs_i: Number.isFinite(s.lufs_i) ? s.lufs_i : undefined,
        tags: Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === 'string') : undefined,
        features: s.features,
      })
    }

    return { version, stems }
  } catch {
    return null
  }
}
