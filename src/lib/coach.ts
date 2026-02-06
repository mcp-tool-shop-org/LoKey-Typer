// Rules-based micro-coach. Zero AI dependency.
// Priority-ordered: first matching rule wins. Silence is fine.

import type { StatsAggregate, StreakData, UserProfile } from './db'
import { computeTrend } from './statsEngine'

export type CoachMessageType = 'celebrate' | 'observe' | 'suggest' | 'encourage'

export type CoachMessage = {
  text: string
  type: CoachMessageType
}

export function generateCoachMessage(
  stats: StatsAggregate | null,
  streak: StreakData | null,
  _profile: UserProfile | null,
): CoachMessage | null {
  if (!stats || stats.totalSessions === 0) return null

  // 1. Streak celebration
  if (streak && streak.currentStreak >= 7) {
    return { text: `${streak.currentStreak} days straight. That's a real habit.`, type: 'celebrate' }
  }

  // 2. Accuracy dip with punctuation errors
  const punctErrors = stats.errorHeatmap['punctuation'] ?? 0
  if (punctErrors > 10 && stats.rollingAccuracy10.length >= 3) {
    const recentAcc = stats.rollingAccuracy10.slice(-3)
    const avgRecent = recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length
    if (avgRecent < 0.95) {
      return {
        text: 'Accuracy dipped when punctuation appeared. A short punctuation warmup could help.',
        type: 'suggest',
      }
    }
  }

  // 3. Fatigue detected
  if (stats.fatigue.decaySignal) {
    return {
      text: 'Accuracy tends to drop later in sessions. Shorter runs or a break might help.',
      type: 'observe',
    }
  }

  // 4. Speed plateau
  const wpmTrend = computeTrend(stats.rollingWpm10)
  const accTrend = computeTrend(stats.rollingAccuracy10)
  if (wpmTrend === 'stable' && stats.totalSessions >= 10) {
    if (accTrend === 'improving') {
      return { text: 'WPM is steady. Consistency is improving. Nice.', type: 'observe' }
    }
    return { text: 'Speed is plateaued. Try varying exercise difficulty.', type: 'suggest' }
  }

  // 5. Improving
  if (wpmTrend === 'improving') {
    return { text: 'Steady improvement. Keep this pace.', type: 'encourage' }
  }

  // 6. First session of day
  if (streak && streak.rolling7[0] === 0) {
    return { text: 'Welcome back. One session is enough.', type: 'encourage' }
  }

  // 7. Streak building (3+ days)
  if (streak && streak.currentStreak >= 3) {
    return { text: `${streak.currentStreak}-day streak. Steady.`, type: 'celebrate' }
  }

  // 8. Default: silence
  return null
}

export function generateHomeCoachMessage(
  stats: StatsAggregate | null,
  streak: StreakData | null,
  profile: UserProfile | null,
): CoachMessage | null {
  if (!stats || stats.totalSessions === 0) return null

  // Streak focus for home page
  if (streak && streak.currentStreak >= 7) {
    return { text: `${streak.currentStreak}-day streak. Solid rhythm.`, type: 'celebrate' }
  }

  if (streak && streak.rolling7[0] === 0) {
    const name = profile?.name?.trim()
    return {
      text: name ? `Hey ${name}. Ready for today's session?` : 'Ready for today?',
      type: 'encourage',
    }
  }

  if (streak && streak.currentStreak >= 3) {
    return { text: `${streak.currentStreak} days in a row. Nice consistency.`, type: 'celebrate' }
  }

  const wpmTrend = computeTrend(stats.rollingWpm10)
  if (wpmTrend === 'improving') {
    return { text: 'Your speed is trending up. Keep it going.', type: 'encourage' }
  }

  return null
}
