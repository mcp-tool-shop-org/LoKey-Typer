// Milestones engine: evaluates journey milestones from accumulated data.
// Pure functions — zero IDB/storage deps.

import type { StatsAggregate, StreakData, CompetitiveState, SkillTreeState } from './db'

// ─── Types ───────────────────────────────────────────────────────────

export type MilestoneId = string

export type MilestoneCategory = 'journey' | 'streak' | 'skill' | 'competitive'

export type MilestoneDefinition = {
  id: MilestoneId
  label: string
  description: string
  category: MilestoneCategory
}

export type EarnedMilestone = MilestoneDefinition & {
  earnedAt?: string
}

// ─── Definitions ─────────────────────────────────────────────────────

export const ALL_MILESTONES: MilestoneDefinition[] = [
  // Journey
  { id: 'first_session', label: 'First Session', description: 'You showed up. That\'s the hardest part.', category: 'journey' },
  { id: 'sessions_10', label: '10 Sessions', description: 'Double digits. You\'re building something.', category: 'journey' },
  { id: 'sessions_50', label: '50 Sessions', description: 'Fifty sessions in. This is real practice.', category: 'journey' },
  { id: 'sessions_100', label: '100 Sessions', description: 'A hundred sessions. You\'ve put in the work.', category: 'journey' },
  { id: 'first_week', label: 'First Week', description: 'One full week of practice.', category: 'journey' },
  { id: 'one_hour', label: 'One Hour', description: 'An hour of focused typing. Time well spent.', category: 'journey' },

  // Streak
  { id: 'streak_3', label: '3-Day Streak', description: 'Three days in a row. Momentum is building.', category: 'streak' },
  { id: 'streak_7', label: '7-Day Streak', description: 'A full week without missing a day.', category: 'streak' },
  { id: 'streak_14', label: '14-Day Streak', description: 'Two weeks of consistency. That\'s a habit.', category: 'streak' },
  { id: 'streak_30', label: '30-Day Streak', description: 'A month of daily practice. Remarkable.', category: 'streak' },
  { id: 'comeback_1', label: 'First Comeback', description: 'You came back after a break. That takes more effort than continuing.', category: 'streak' },
  { id: 'comeback_5', label: '5 Comebacks', description: 'Five times you returned. Persistence, not perfection.', category: 'streak' },

  // Skill
  { id: 'accuracy_95_avg', label: 'Clean Typist', description: 'Averaged 95%+ accuracy. Fewer errors, more flow.', category: 'skill' },
  { id: 'wpm_50_avg', label: 'Steady Pace', description: 'Averaging 50+ WPM. Finding your rhythm.', category: 'skill' },
  { id: 'wpm_80_avg', label: 'Quick Fingers', description: 'Averaging 80+ WPM. That\'s fast.', category: 'skill' },
  { id: 'punct_lvl_3', label: 'Punctuation Pro', description: 'Reached level 3 in punctuation. Commas and colons bend to your will.', category: 'skill' },
  { id: 'endurance_lvl_3', label: 'Endurance Runner', description: 'Reached level 3 in endurance. Long passages feel natural.', category: 'skill' },

  // Competitive
  { id: 'first_rated_run', label: 'First Rated Run', description: 'Your first competitive rating. The journey begins.', category: 'competitive' },
  { id: 'silver_league', label: 'Silver League', description: 'Promoted to Silver. Solid fundamentals.', category: 'competitive' },
  { id: 'gold_league', label: 'Gold League', description: 'Welcome to Gold. Elite territory.', category: 'competitive' },
]

// ─── Evaluation ──────────────────────────────────────────────────────

type MilestonePredicate = (params: {
  stats: StatsAggregate
  streak: StreakData
  competitive: CompetitiveState | null
  skillTree: SkillTreeState | null
}) => boolean

const predicates: Record<MilestoneId, MilestonePredicate> = {
  // Journey
  first_session: ({ stats }) => stats.totalSessions >= 1,
  sessions_10: ({ stats }) => stats.totalSessions >= 10,
  sessions_50: ({ stats }) => stats.totalSessions >= 50,
  sessions_100: ({ stats }) => stats.totalSessions >= 100,
  first_week: ({ streak }) => (streak.totalDaysPracticed ?? 0) >= 7,
  one_hour: ({ stats }) => stats.totalDurationMs >= 3_600_000,

  // Streak
  streak_3: ({ streak }) => streak.bestStreak >= 3,
  streak_7: ({ streak }) => streak.bestStreak >= 7,
  streak_14: ({ streak }) => streak.bestStreak >= 14,
  streak_30: ({ streak }) => streak.bestStreak >= 30,
  comeback_1: ({ streak }) => (streak.comebackWins ?? 0) >= 1,
  comeback_5: ({ streak }) => (streak.comebackWins ?? 0) >= 5,

  // Skill
  accuracy_95_avg: ({ stats }) => {
    if (stats.rollingAccuracy10.length < 5) return false
    const avg = stats.rollingAccuracy10.reduce((a, b) => a + b, 0) / stats.rollingAccuracy10.length
    return avg >= 0.95
  },
  wpm_50_avg: ({ stats }) => {
    if (stats.rollingWpm10.length < 5) return false
    const avg = stats.rollingWpm10.reduce((a, b) => a + b, 0) / stats.rollingWpm10.length
    return avg >= 50
  },
  wpm_80_avg: ({ stats }) => {
    if (stats.rollingWpm10.length < 5) return false
    const avg = stats.rollingWpm10.reduce((a, b) => a + b, 0) / stats.rollingWpm10.length
    return avg >= 80
  },
  punct_lvl_3: ({ skillTree }) => (skillTree?.branches.punctuation.level ?? 0) >= 3,
  endurance_lvl_3: ({ skillTree }) => (skillTree?.branches.endurance.level ?? 0) >= 3,

  // Competitive
  first_rated_run: ({ competitive }) => (competitive?.totalRatedRuns ?? 0) >= 1,
  silver_league: ({ competitive }) => competitive?.currentLeague === 'silver' || competitive?.currentLeague === 'gold',
  gold_league: ({ competitive }) => competitive?.currentLeague === 'gold',
}

export function evaluateMilestones(params: {
  stats: StatsAggregate
  streak: StreakData
  competitive: CompetitiveState | null
  skillTree: SkillTreeState | null
  alreadyEarned: string[]
}): EarnedMilestone[] {
  const { stats, streak, competitive, skillTree, alreadyEarned } = params
  const earnedSet = new Set(alreadyEarned)
  const now = new Date().toISOString()

  const newlyEarned: EarnedMilestone[] = []

  for (const milestone of ALL_MILESTONES) {
    if (earnedSet.has(milestone.id)) continue

    const check = predicates[milestone.id]
    if (!check) continue

    if (check({ stats, streak, competitive, skillTree })) {
      newlyEarned.push({ ...milestone, earnedAt: now })
    }
  }

  return newlyEarned
}
