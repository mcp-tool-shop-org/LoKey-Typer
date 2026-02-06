// Scenario engine: selects difficulty variants for real-life exercises.
// Pure functions — zero IDB/storage deps.

import type { Exercise } from '@content'
import type { UserSkillModel } from './storage'
import type { StatsAggregate } from './db'

// ─── Types ───────────────────────────────────────────────────────────

export type ScenarioVariant = 'recovery' | 'standard' | 'challenge'

export type ScenarioSelection = {
  variant: ScenarioVariant
  textVariant: 'short' | 'long'
  rationale: string
}

// ─── Variant selection ───────────────────────────────────────────────

export function selectScenarioVariant(params: {
  exercise: Exercise
  skill: UserSkillModel
  stats: StatsAggregate
}): ScenarioSelection {
  const { stats, skill } = params
  const recent = stats.rollingAccuracy10

  // Need at least 3 data points for signal
  if (recent.length < 3) {
    return {
      variant: 'standard',
      textVariant: 'short',
      rationale: 'Standard difficulty — building your profile.',
    }
  }

  // Last 3 accuracy values
  const last3 = recent.slice(-3)
  const avgAcc = last3.reduce((s, v) => s + v, 0) / last3.length

  // Recovery: accuracy dipping
  if (avgAcc < 0.92) {
    return {
      variant: 'recovery',
      textVariant: 'short',
      rationale: 'Recovery lap — accuracy dipped recently. Shorter text to rebuild confidence.',
    }
  }

  // Challenge: consistent high accuracy AND enough experience
  const totalRuns = skill.total_runs ?? 0
  if (avgAcc > 0.97 && totalRuns >= 10) {
    return {
      variant: 'challenge',
      textVariant: 'long',
      rationale: 'Extended challenge — your consistency is strong. Longer passage to stretch.',
    }
  }

  // Standard
  return {
    variant: 'standard',
    textVariant: 'short',
    rationale: 'Standard difficulty — a good fit for where you are.',
  }
}

// ─── Labels ──────────────────────────────────────────────────────────

export function variantLabel(variant: ScenarioVariant): string {
  switch (variant) {
    case 'recovery':
      return 'Recovery Lap'
    case 'standard':
      return 'Standard'
    case 'challenge':
      return 'Extended Challenge'
  }
}
