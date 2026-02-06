// Rotation engine: produces an explained, prioritized session plan.
// Pure functions — zero IDB/storage deps.

import type { Exercise, Mode } from '@content'
import { loadExercisesByMode, findExercise } from '@content'
import type { RunResult, UserSkillModel } from './storage'
import type { StatsAggregate, StreakData } from './db'
import { computeAdaptiveProfile, scoreExerciseForProfile, adjustDifficultyBand } from './adaptiveEngine'

// ─── Types ───────────────────────────────────────────────────────────

export type SessionPlan = {
  exerciseId: string
  reasons: string[]
  priority: 'high' | 'medium' | 'low'
  estimatedSeconds: number
}

// ─── Reason generation ───────────────────────────────────────────────

function humanTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    punctuation: 'punctuation',
    apostrophe: 'apostrophes',
    quotes: 'quotation marks',
    brackets: 'brackets',
    dashes: 'dashes',
    slashes: 'slashes',
    numbers: 'numbers',
    multiline: 'multi-line passages',
    sentences: 'sentences',
    calm: 'calm passages',
  }
  return labels[tag] ?? tag
}

export function generatePlanReasons(params: {
  exercise: Exercise
  skill: UserSkillModel
  stats: StatsAggregate
  streak: StreakData
}): string[] {
  const { exercise, skill, stats, streak } = params
  const reasons: string[] = []

  // Check weakness tags that match this exercise
  const weakTags = skill.weak_tags ?? []
  const weakness = skill.weakness_by_tag ?? {}
  const matchedWeak = exercise.tags.filter((t) => weakTags.includes(t) && (weakness[t] ?? 0) > 0.01)
  if (matchedWeak.length > 0) {
    const label = humanTagLabel(matchedWeak[0])
    reasons.push(`Targets ${label} — an area you can improve.`)
  }

  // Fatigue signal → prefer short exercises
  if (stats.fatigue.decaySignal && exercise.estimated_seconds <= 30) {
    reasons.push('Short exercise to keep energy up.')
  }

  // Streak context
  const currentStreak = streak.currentStreak ?? 0
  if (currentStreak >= 5 && currentStreak < 10) {
    reasons.push(`Day ${currentStreak} — try something new.`)
  } else if (currentStreak >= 10) {
    reasons.push(`Strong streak at ${currentStreak} days — keep the momentum.`)
  }

  // Performance by length: suggest stretching
  const perf = skill.performance_by_length
  if (perf.short.runs > 5 && perf.medium.runs < 3 && exercise.estimated_seconds > 30) {
    reasons.push("You're strong at short — this stretches to medium length.")
  }

  // Templates for variety
  if (exercise.type === 'template') {
    reasons.push('Template exercise — different every time.')
  }

  // Default reason if nothing matched
  if (reasons.length === 0) {
    reasons.push('Good variety for your current level.')
  }

  return reasons
}

// ─── Session planning ────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

// Simple seeded PRNG
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

function pickWeighted<T>(items: T[], weightFn: (x: T) => number, rand: () => number): T | null {
  let total = 0
  const weights = items.map((i) => {
    const w = Math.max(0, weightFn(i))
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

function difficultyBandWeight(difficulty: number, center: number): number {
  const dist = Math.abs(difficulty - center)
  return 1 + clamp(1.5 - dist, 0, 1.5)
}

export function planNextSessions(params: {
  skill: UserSkillModel
  stats: StatsAggregate
  streak: StreakData
  mode: Mode
  count: number
  seed?: string
  recentRuns?: Pick<RunResult, 'wpm' | 'accuracy'>[]
}): SessionPlan[] {
  const { skill, stats, streak, mode, seed, recentRuns } = params
  const count = Math.max(1, Math.min(5, params.count))

  const seedStr = seed ?? `plan|${mode}|${new Date().toISOString().slice(0, 10)}`
  const rand = mulberry32(xmur3(seedStr)())

  const pool = loadExercisesByMode(mode)
  const recent = new Set(skill.recent_exercise_ids_by_mode?.[mode]?.slice(0, 30) ?? [])
  const candidates = pool.filter((ex) => !recent.has(ex.id))

  if (candidates.length === 0) return []

  const profile = computeAdaptiveProfile(skill)
  const bandCenter = recentRuns
    ? adjustDifficultyBand(skill, mode, recentRuns)
    : adjustDifficultyBand(skill, mode, [])

  const weakTags = skill.weak_tags ?? []
  const weakness = skill.weakness_by_tag ?? {}

  function weight(ex: Exercise): number {
    let w = 1
    w *= difficultyBandWeight(ex.difficulty, bandCenter)

    for (const t of ex.tags) {
      const s = weakness[t]
      if (Number.isFinite(s) && s > 0) w *= 1 + clamp(s, 0, 1) * 0.75
    }

    const hits = weakTags.reduce((acc: number, t: string) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
    if (hits > 0) w *= 1 + hits * 0.4

    if (ex.type === 'template') w *= 1.1

    w *= scoreExerciseForProfile(ex, profile)
    return w
  }

  const used = new Set<string>()
  const usedPacks = new Set<string>()
  const plans: SessionPlan[] = []

  while (plans.length < count) {
    // Prefer variety: penalize exercises from packs we've already picked
    const remaining = candidates.filter((ex) => !used.has(ex.id))
    if (remaining.length === 0) break

    const picked = pickWeighted(
      remaining,
      (ex) => {
        let w = weight(ex)
        if (usedPacks.has(ex.pack)) w *= 0.3 // strong variety penalty
        return w
      },
      rand,
    )
    if (!picked) break

    used.add(picked.id)
    usedPacks.add(picked.pack)

    const reasons = generatePlanReasons({ exercise: picked, skill, stats, streak })

    // Priority: high if targets weak areas, medium if decent match, low otherwise
    const weakHits = weakTags.filter((t) => picked.tags.includes(t)).length
    const priority: SessionPlan['priority'] = weakHits >= 2 ? 'high' : weakHits === 1 ? 'medium' : 'low'

    plans.push({
      exerciseId: picked.id,
      reasons,
      priority,
      estimatedSeconds: picked.estimated_seconds,
    })
  }

  // Sort: high priority first
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  plans.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return plans
}

/** Resolve a plan item's exercise details (returns null if exercise not found) */
export function resolvePlanExercise(plan: SessionPlan): Exercise | null {
  return findExercise(plan.exerciseId)
}
