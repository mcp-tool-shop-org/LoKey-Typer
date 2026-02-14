import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import type { UserSkillModel } from './storage'
import type { RunMetrics } from './perfectRun'

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

export type DailySessionType = 'reset' | 'mix' | 'deep'

export type DailySetItemKind = 'confidence' | 'targeted' | 'challenge' | 'real_life' | 'mix'

export type DailySetItem = {
  kind: DailySetItemKind
  mode: Mode
  exerciseId: string
  completed?: boolean
}

export type DailySet = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  items: DailySetItem[]
}

export type DailyItemResult = {
  wpm: number
  accuracy: number
  durationMs: number
  completedAt: number
  metrics?: RunMetrics
}

export type DailyProgress = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  completedItems: DailyItemResult[]
  startedAt?: number
  completedAt?: number
}

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function itemCount(type: DailySessionType) {
  if (type === 'reset') return 3
  if (type === 'deep') return 5
  return 3
}

// In-memory cache to avoid re-rolling on hot reload or re-render
const CACHE: Record<string, DailySet> = {}

function getCachedDailySet(key: { userId: string; dateKey: string; sessionType: string }): DailySet | null {
  return CACHE[\\|\|\\] ?? null
}

function setCachedDailySet(set: DailySet) {
  CACHE[\\|\|\\] = set
}

function bandCenterFromSkill(skill: UserSkillModel | undefined): number {
  if (!skill || !Number.isFinite(skill.total_runs)) return 3
  const wpm = skill.ema.wpm
  if (wpm < 30) return 2
  if (wpm < 45) return 2.5
  if (wpm < 60) return 3
  if (wpm < 75) return 3.5
  return 4
}

function difficultyBandWeight(difficulty: number, center: number) {
  const dist = Math.abs(difficulty - center)
  // Closer to center = higher weight
  return 1 + Math.max(0, 1.5 - dist)
}

function exerciseWeight(params: {
  ex: Exercise
  kind: DailySetItemKind
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
}): number {
  const { ex, kind, weakTags, bandCenter, targetTag } = params
  let w = 1

  if (kind === 'confidence') {
    // Prefer easier items.
    w *= (6 - ex.difficulty)
    w *= difficultyBandWeight(ex.difficulty, Math.min(3, bandCenter))
  } else if (kind === 'targeted') {
    // Keep within band but bias toward weakness tag.
    w *= difficultyBandWeight(ex.difficulty, bandCenter)
  } else if (kind === 'challenge') {
    // Prefer harder items.
    w *= ex.difficulty
    w *= difficultyBandWeight(ex.difficulty, Math.max(3, bandCenter + 1))
  } else {
    // Default: stay near the user's current band.
    w *= difficultyBandWeight(ex.difficulty, bandCenter)
  }

  const tagHits = weakTags.reduce((acc, t) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
  if (tagHits > 0) w *= 1 + tagHits * 0.75

  if (kind === 'targeted' && targetTag && ex.tags.includes(targetTag)) w *= 2.0

  // Small bias toward templates in the daily loop for replayability.
  if (ex.type === 'template') w *= 1.15

  return w
}

function pickExercise(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
  excludeIds: Set<string>
  prefs?: {
     screenReaderMode: boolean
     focusMaxLength?: number
  }
}): Exercise | null {
  const all = loadExercisesByMode(params.mode)
  
  // Apply hard filters
  const filtered = all.filter((ex) => {
      if (params.excludeIds.has(ex.id)) return false
      
      // Screen reader constraint
      if (params.prefs?.screenReaderMode) {
          if (ex.tags.includes('multiline') || ex.tags.includes('visual-only')) return false
      }
      
      // Length constraint
      if (params.prefs?.focusMaxLength && params.mode === 'focus') {
           const text = ex.text_short ?? ex.text ?? ex.text_long ?? ''
           // If template, assume it can adapt or is roughly correct. If static, check length.
           if (ex.type !== 'template' && text.length > params.prefs.focusMaxLength) return false
      }
      
      return true
  })

  if (filtered.length === 0) return null

  const picked = pickWeighted(
    filtered,
    (ex) =>
      exerciseWeight({
        ex,
        kind: params.kind,
        weakTags: params.weakTags,
        bandCenter: params.bandCenter,
        targetTag: params.targetTag,
      }),
    params.rand,
  )
  return picked
}

function pickWithRelaxation(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
  used: Set<string>
  avoid: Set<string>
  prefs?: {
     screenReaderMode: boolean
     focusMaxLength?: number
  }
}): Exercise | null {
  const strict = new Set<string>([...params.used, ...params.avoid])
  return (
    pickExercise({
      mode: params.mode,
      kind: params.kind,
      rand: params.rand,
      weakTags: params.weakTags,
      bandCenter: params.bandCenter,
      targetTag: params.targetTag,
      excludeIds: strict,
      prefs: params.prefs
    }) ??
    pickExercise({
      mode: params.mode,
      kind: params.kind,
      rand: params.rand,
      weakTags: params.weakTags,
      bandCenter: params.bandCenter,
      targetTag: params.targetTag,
      excludeIds: params.used,
      prefs: params.prefs
    })
  )
}

export function generateDailySet(params: {
  userId: string
  dateKey?: string
  sessionType: DailySessionType
  weakTags?: string[]
  skill?: Pick<UserSkillModel, 'total_runs' | 'ema' | 'recent_exercise_ids_by_mode'>
  prefs?: {
     screenReaderMode: boolean
     focusMaxLength?: number
  }
}): DailySet {
  const dateKey = params.dateKey ?? todayKey()

  const cached = getCachedDailySet({ userId: params.userId, dateKey, sessionType: params.sessionType })
  if (cached) return cached

  const seedStr = \\|\|\\
  const rand = mulberry32(xmur3(seedStr)())

  const weakTags = params.weakTags ?? []
  const bandCenter = bandCenterFromSkill(params.skill)
  const targetTag = weakTags.length > 0 ? weakTags[Math.floor(rand() * weakTags.length)] ?? null : null
  const count = itemCount(params.sessionType)

  const used = new Set<string>()
  const avoid = new Set<string>()
  const novelty = params.skill?.recent_exercise_ids_by_mode
  if (novelty) {
    for (const id of novelty.focus?.slice(0, 20) ?? []) avoid.add(id)
    for (const id of novelty.real_life?.slice(0, 20) ?? []) avoid.add(id)
    for (const id of novelty.competitive?.slice(0, 20) ?? []) avoid.add(id)
  }

  const items: DailySetItem[] = []

  // 1. Confidence Booster (Focus)
  const confidence = pickWithRelaxation({
    mode: 'focus',
    kind: 'confidence',
    rand,
    weakTags,
    bandCenter,
    targetTag,
    used,
    avoid,
    prefs: params.prefs
  })
  if (confidence) {
    used.add(confidence.id)
    items.push({ kind: 'confidence', mode: 'focus', exerciseId: confidence.id })
  }

  // 2. Real-Life or Targeted (if weak tags exist)
  if (items.length < count) {
    let mode2: Mode = 'real_life'
    let kind2: DailySetItemKind = 'real_life'
    
    if (targetTag && rand() > 0.3) {
        mode2 = 'focus'
        kind2 = 'targeted'
    }

    const item2 = pickWithRelaxation({
        mode: mode2,
        kind: kind2,
        rand,
        weakTags,
        bandCenter,
        targetTag,
        used,
        avoid,
        prefs: params.prefs
    })
    
    if (item2) {
        used.add(item2.id)
        items.push({ kind: kind2, mode: mode2, exerciseId: item2.id })
    }
  }

  // 3. Fill the rest with Challenge or Mix
  while (items.length < count) {
    const pick = pickWithRelaxation({
      mode: 'focus',
      kind: 'challenge',
      rand,
      weakTags,
      bandCenter,
      targetTag,
      used,
      avoid,
      prefs: params.prefs
    })
    
    if (pick) {
        used.add(pick.id)
        items.push({ kind: 'challenge', mode: 'focus', exerciseId: pick.id })
    } else {
        // Fallback: if rigid criteria fail, pick *any* valid exercise
        const fallback = pickWithRelaxation({
            mode: 'focus',
            kind: 'mix',
            rand,
            weakTags: [],
            bandCenter: 3,
            targetTag: null,
            used,
            avoid: new Set(),
            prefs: params.prefs
        })
        if (fallback) {
            used.add(fallback.id)
            items.push({ kind: 'mix', mode: 'focus', exerciseId: fallback.id })
        } else {
            // Should not happen unless pool is empty or strict filter (SR mode) excluded everything
            break 
        }
    }
  }

  const out: DailySet = {
    dateKey,
    userId: params.userId,
    sessionType: params.sessionType,
    items,
  }

  setCachedDailySet(out)
  return out
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// --- Daily progress persistence ---

const DAILY_PROGRESS_KEY = 'lkt_daily_progress'

export function loadDailyProgress(dateKey: string, userId: string): DailyProgress | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(DAILY_PROGRESS_KEY)
    const parsed = safeParse<DailyProgress>(raw)
    if (!parsed || parsed.dateKey !== dateKey || parsed.userId !== userId) return null
    if (!Array.isArray(parsed.completedItems)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDailyProgress(progress: DailyProgress): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // ignore
  }
}
