// Adaptive difficulty engine: uses error profile to bias exercise selection.
// Pure functions — zero IDB/storage deps.

import type { Exercise } from '@content'
import type { UserSkillModel, RunResult } from './storage'
import type { LengthBucket } from './skillModel'

// ─── Types ───────────────────────────────────────────────────────────

export type AdaptiveProfile = {
  /** 0-1: higher = user struggles more with punctuation, should practice it */
  punctuationDensity: number
  /** 0-1: higher = user can handle harder words / complex text */
  wordComplexity: number
  /** Best-performing length bucket */
  lengthPreference: LengthBucket
  /** 0-0.4: how much to occasionally push beyond comfort zone */
  challengeSpice: number
}

// ─── Profile computation ─────────────────────────────────────────────

type SkillSlice = Pick<
  UserSkillModel,
  'errors_by_class' | 'weakness_by_tag' | 'performance_by_length' | 'ema' | 'total_runs'
>

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function bestLengthBucket(perf: UserSkillModel['performance_by_length']): LengthBucket {
  const buckets: LengthBucket[] = ['short', 'medium', 'long', 'multiline']
  let best: LengthBucket = 'short'
  let bestAcc = -1

  for (const b of buckets) {
    const p = perf[b]
    if (p.runs < 2) continue // need at least 2 runs for signal
    if (p.ema_accuracy > bestAcc) {
      bestAcc = p.ema_accuracy
      best = b
    }
  }

  return best
}

export function computeAdaptiveProfile(skill: SkillSlice): AdaptiveProfile {
  // Punctuation density: higher errors_by_class.punctuation EMA → more need for punct practice
  const punctEma = Number(skill.errors_by_class?.punctuation ?? 0)
  const punctuationDensity = clamp(punctEma / 3, 0, 1) // normalize: 3+ errors/run → maxed

  // Word complexity: high accuracy = can handle complex; low = keep simple
  const accuracy = Number(skill.ema?.accuracy ?? 1)
  const wordComplexity = clamp(accuracy, 0, 1)

  // Best length bucket
  const lengthPreference = bestLengthBucket(skill.performance_by_length)

  // Challenge spice: ramps from 0→0.4 over first 50 runs
  const runs = Math.max(0, Number(skill.total_runs ?? 0))
  const challengeSpice = clamp(runs / 125, 0, 0.4) // 50 runs → 0.4

  return { punctuationDensity, wordComplexity, lengthPreference, challengeSpice }
}

// ─── Exercise scoring ────────────────────────────────────────────────

const PUNCT_TAGS = new Set(['punctuation', 'apostrophe', 'quotes', 'brackets', 'dashes', 'slashes'])

function exerciseHasPunctuation(ex: Exercise): boolean {
  return ex.tags.some((t) => PUNCT_TAGS.has(t))
}

function lengthBucketFromExercise(ex: Exercise): LengthBucket {
  if (ex.tags.includes('multiline')) return 'multiline'
  const s = ex.estimated_seconds
  if (s <= 30) return 'short'
  if (s <= 90) return 'medium'
  return 'long'
}

export function scoreExerciseForProfile(exercise: Exercise, profile: AdaptiveProfile): number {
  let score = 1

  // Punctuation targeting: if user weak on punct and exercise has punct → boost
  if (profile.punctuationDensity > 0.2 && exerciseHasPunctuation(exercise)) {
    score *= 1 + profile.punctuationDensity * 0.6
  }

  // Length match: prefer exercises matching best length bucket
  const exBucket = lengthBucketFromExercise(exercise)
  if (exBucket === profile.lengthPreference) {
    score *= 1.15
  }

  // Difficulty vs word complexity
  // wordComplexity 0-1 maps to preferred difficulty 1-5
  const preferredDiff = 1 + profile.wordComplexity * 4
  const diffDist = Math.abs(exercise.difficulty - preferredDiff)
  // Closer = higher score
  score *= 1 + clamp(2 - diffDist, 0, 2) * 0.3

  // Challenge spice: occasionally boost harder-than-comfort exercises
  if (profile.challengeSpice > 0 && exercise.difficulty > preferredDiff + 0.5) {
    score *= 1 + profile.challengeSpice
  }

  return score
}

// ─── Difficulty band refinement ──────────────────────────────────────

type BandSkillSlice = Pick<UserSkillModel, 'ema' | 'by_mode' | 'total_runs'>
type RecentRunSlice = Pick<RunResult, 'wpm' | 'accuracy'>

function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export function adjustDifficultyBand(
  skill: BandSkillSlice,
  mode: string,
  recentRuns: RecentRunSlice[],
): number {
  // Base band center (same WPM→band logic as existing)
  if (!skill || !Number.isFinite(skill.total_runs)) return 3
  if (skill.total_runs < 5) return 2.5

  const byMode = skill.by_mode as Record<string, { ema_wpm: number } | undefined>
  const wpm = Number(byMode?.[mode]?.ema_wpm ?? skill.ema?.wpm ?? 0)
  let band: number
  if (!Number.isFinite(wpm)) band = 3
  else if (wpm < 30) band = 2
  else if (wpm < 45) band = 2.5
  else if (wpm < 60) band = 3
  else if (wpm < 75) band = 3.5
  else band = 4

  // Refine based on recent runs
  if (recentRuns.length >= 3) {
    const last3 = recentRuns.slice(-3)

    // If accuracy dropping → nudge band down
    const avgAcc = last3.reduce((s, r) => s + r.accuracy, 0) / last3.length
    if (avgAcc < 0.92) {
      band -= 0.3
    }

    // If WPM trending up → nudge band up
    const wpmSlope = linearSlope(recentRuns.map((r) => r.wpm))
    if (wpmSlope > 0.5) {
      band += 0.2
    }
  }

  return clamp(band, 1, 5)
}
