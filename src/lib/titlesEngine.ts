// Titles engine: evaluates earned titles from accumulated data.
// Pure functions — zero IDB/storage deps.

import type { StatsAggregate, StreakData, SkillTreeState } from './db'
import type { UserSkillModel } from './storage'

// ─── Types ───────────────────────────────────────────────────────────

export type TitleId = string

export type TitleDefinition = {
  id: TitleId
  label: string
  description: string
}

// ─── Definitions ─────────────────────────────────────────────────────

export const ALL_TITLES: TitleDefinition[] = [
  { id: 'steady_hands', label: 'Steady Hands', description: 'Maintained 95%+ accuracy over 20 sessions.' },
  { id: 'quick_fingers', label: 'Quick Fingers', description: 'Averaged 60+ WPM over 20 sessions.' },
  { id: 'clean_punctuation', label: 'Clean Punctuation', description: 'Low punctuation error rate across 10+ sessions.' },
  { id: 'quiet_focus', label: 'Quiet Focus', description: 'No fatigue detected across 10+ sessions. Consistent energy.' },
  { id: 'marathon_runner', label: 'Marathon Runner', description: 'Reached endurance level 5. Long passages are second nature.' },
  { id: 'consistent', label: 'Consistent', description: 'WPM variance under 5% across recent sessions. Reliable rhythm.' },
  { id: 'comeback_kid', label: 'Comeback Kid', description: 'Returned after breaks 3 times. Resilience is a skill.' },
  { id: 'early_adopter', label: 'Early Adopter', description: 'Completed 5 sessions. Thanks for being here early.' },
  { id: 'all_modes', label: 'Mode Explorer', description: 'Practiced in all three modes. Versatile.' },
]

// ─── Evaluation ──────────────────────────────────────────────────────

type TitlePredicate = (params: {
  stats: StatsAggregate
  streak: StreakData
  skill: UserSkillModel | null
  skillTree: SkillTreeState | null
}) => boolean

const predicates: Record<TitleId, TitlePredicate> = {
  steady_hands: ({ skill }) => {
    if (!skill || (skill.total_runs ?? 0) < 20) return false
    return (skill.ema?.accuracy ?? 0) >= 0.95
  },

  quick_fingers: ({ skill }) => {
    if (!skill || (skill.total_runs ?? 0) < 20) return false
    return (skill.ema?.wpm ?? 0) >= 60
  },

  clean_punctuation: ({ skill }) => {
    if (!skill || (skill.total_runs ?? 0) < 10) return false
    return (skill.errors_by_class?.punctuation ?? 1) < 0.5
  },

  quiet_focus: ({ stats }) => {
    if (stats.totalSessions < 10) return false
    return !stats.fatigue.decaySignal
  },

  marathon_runner: ({ skillTree }) => {
    return (skillTree?.branches.endurance.level ?? 0) >= 5
  },

  consistent: ({ stats }) => {
    const vals = stats.rollingWpm10
    if (vals.length < 5) return false
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    if (mean === 0) return false
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    const stdDev = Math.sqrt(variance)
    return stdDev / mean < 0.05
  },

  comeback_kid: ({ streak }) => {
    return (streak.comebackWins ?? 0) >= 3
  },

  early_adopter: ({ stats }) => {
    return stats.totalSessions >= 5
  },

  all_modes: ({ stats }) => {
    const fm = stats.byMode.focus?.sessions ?? 0
    const rl = stats.byMode.real_life?.sessions ?? 0
    const comp = stats.byMode.competitive?.sessions ?? 0
    return fm >= 1 && rl >= 1 && comp >= 1
  },
}

export function evaluateTitles(params: {
  stats: StatsAggregate
  streak: StreakData
  skill: UserSkillModel | null
  skillTree: SkillTreeState | null
  alreadyEarned: string[]
}): TitleDefinition[] {
  const { stats, streak, skill, skillTree, alreadyEarned } = params
  const earnedSet = new Set(alreadyEarned)

  const newlyEarned: TitleDefinition[] = []

  for (const title of ALL_TITLES) {
    if (earnedSet.has(title.id)) continue

    const check = predicates[title.id]
    if (!check) continue

    if (check({ stats, streak, skill, skillTree })) {
      newlyEarned.push(title)
    }
  }

  return newlyEarned
}
