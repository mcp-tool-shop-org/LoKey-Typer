import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'

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

export type DailySetItemKind = 'confidence' | 'challenge' | 'real_life' | 'mix'

export type DailySetItem = {
  kind: DailySetItemKind
  mode: Mode
  exerciseId: string
}

export type DailySet = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  items: DailySetItem[]
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function itemCount(sessionType: DailySessionType) {
  if (sessionType === 'reset') return 5
  if (sessionType === 'mix') return 8
  return 10
}

function exerciseWeight(params: {
  ex: Exercise
  kind: DailySetItemKind
  weakTags: string[]
}): number {
  const { ex, kind, weakTags } = params
  let w = 1

  if (kind === 'confidence') {
    // Prefer easier items.
    w *= (6 - ex.difficulty)
  } else if (kind === 'challenge') {
    // Prefer harder items.
    w *= ex.difficulty
  }

  const tagHits = weakTags.reduce((acc, t) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
  if (tagHits > 0) w *= 1 + tagHits * 0.75

  // Small bias toward templates in the daily loop for replayability.
  if (ex.type === 'template') w *= 1.15

  return w
}

function pickExercise(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  excludeIds: Set<string>
}): Exercise | null {
  const pool = loadExercisesByMode(params.mode).filter((ex) => !params.excludeIds.has(ex.id))
  if (pool.length === 0) return null
  const picked = pickWeighted(pool, (ex) => exerciseWeight({ ex, kind: params.kind, weakTags: params.weakTags }), params.rand)
  return picked
}

export function generateDailySet(params: {
  userId: string
  dateKey?: string
  sessionType: DailySessionType
  weakTags?: string[]
}): DailySet {
  const dateKey = params.dateKey ?? todayKey()
  const seedStr = `${params.userId}|${dateKey}|${params.sessionType}`
  const rand = mulberry32(xmur3(seedStr)())

  const weakTags = params.weakTags ?? []
  const count = itemCount(params.sessionType)

  const used = new Set<string>()
  const items: DailySetItem[] = []

  const confidence = pickExercise({ mode: 'focus', kind: 'confidence', rand, weakTags, excludeIds: used })
  if (confidence) {
    used.add(confidence.id)
    items.push({ kind: 'confidence', mode: 'focus', exerciseId: confidence.id })
  }

  const scenario = pickExercise({ mode: 'real_life', kind: 'real_life', rand, weakTags, excludeIds: used })
  if (scenario) {
    used.add(scenario.id)
    items.push({ kind: 'real_life', mode: 'real_life', exerciseId: scenario.id })
  }

  const challenge = pickExercise({ mode: 'competitive', kind: 'challenge', rand, weakTags, excludeIds: used })
  if (challenge) {
    used.add(challenge.id)
    items.push({ kind: 'challenge', mode: 'competitive', exerciseId: challenge.id })
  }

  while (items.length < count) {
    const mode: Mode = rand() < 0.55 ? 'focus' : 'real_life'
    const ex = pickExercise({ mode, kind: 'mix', rand, weakTags, excludeIds: used })
    if (!ex) break
    used.add(ex.id)
    items.push({ kind: 'mix', mode, exerciseId: ex.id })
  }

  // Deterministic fallback if pools were unexpectedly empty.
  if (items.length === 0) {
    const pool = loadExercisesByMode('focus')
    const first = pool[0]
    if (first) items.push({ kind: 'mix', mode: 'focus', exerciseId: first.id })
  }

  return {
    dateKey,
    userId: params.userId,
    sessionType: params.sessionType,
    items,
  }
}
