// Goals engine: daily goals + weekly intent system.
// Pure functions — no IDB dependency.

import type { StatsAggregate, StreakData, UserProfile } from './db'
import { computeTrend } from './statsEngine'

export type WeeklyIntent = 'build_habit' | 'push_speed' | 'fix_accuracy' | 'explore'

export type DailyGoal = {
  targetSessions: number
  targetMinutes: number
  accuracyFloor: number | null // null = no floor
}

export type DayCompletion = {
  date: string // YYYY-MM-DD
  completed: boolean
  sessions: number
  minutes: number
}

export type GoalsState = {
  weeklyIntent: WeeklyIntent
  intentSetAt: string // ISO date
  todaySessions: number
  todayMinutesMs: number
  todayAccuracySum: number // sum of accuracy values for averaging
  lastSessionDate: string // YYYY-MM-DD
  goalStreak: number // consecutive days meeting goal
  bestGoalStreak: number
  weekHistory: DayCompletion[] // last 7 days, index 0 = most recent
}

export function defaultGoals(): GoalsState {
  return {
    weeklyIntent: 'build_habit',
    intentSetAt: '',
    todaySessions: 0,
    todayMinutesMs: 0,
    todayAccuracySum: 0,
    lastSessionDate: '',
    goalStreak: 0,
    bestGoalStreak: 0,
    weekHistory: [],
  }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return Infinity
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

export function suggestWeeklyIntent(
  stats: StatsAggregate | null,
  streak: StreakData | null,
  _profile: UserProfile | null,
): WeeklyIntent {
  if (!stats || stats.totalSessions < 5) return 'build_habit'

  const accTrend = computeTrend(stats.rollingAccuracy10)
  if (accTrend === 'declining') return 'fix_accuracy'

  const wpmTrend = computeTrend(stats.rollingWpm10)
  if (wpmTrend === 'stable' && stats.totalSessions >= 20) return 'push_speed'

  if (streak && streak.currentStreak >= 7) return 'explore'

  if (wpmTrend === 'improving') return 'push_speed'

  return 'build_habit'
}

export function intentLabel(intent: WeeklyIntent): string {
  switch (intent) {
    case 'build_habit': return 'Build a Habit'
    case 'push_speed': return 'Push Speed'
    case 'fix_accuracy': return 'Fix Accuracy'
    case 'explore': return 'Explore'
  }
}

export function intentDescription(intent: WeeklyIntent): string {
  switch (intent) {
    case 'build_habit': return 'Focus on showing up. One session a day is enough.'
    case 'push_speed': return 'Push your WPM higher with more focused practice.'
    case 'fix_accuracy': return 'Slow down and prioritize clean, accurate typing.'
    case 'explore': return 'Try new exercises and modes you haven\'t touched.'
  }
}

export function generateDailyGoal(intent: WeeklyIntent, _dayOfWeek: number, stats: StatsAggregate | null): DailyGoal {
  const sessions = stats?.totalSessions ?? 0

  switch (intent) {
    case 'build_habit':
      return { targetSessions: 1, targetMinutes: 5, accuracyFloor: null }
    case 'push_speed':
      return {
        targetSessions: sessions < 20 ? 2 : 3,
        targetMinutes: 10,
        accuracyFloor: 0.9,
      }
    case 'fix_accuracy':
      return {
        targetSessions: 2,
        targetMinutes: 8,
        accuracyFloor: 0.95,
      }
    case 'explore':
      return { targetSessions: 2, targetMinutes: 10, accuracyFloor: null }
  }
}

export function checkGoalCompletion(
  goal: DailyGoal,
  todaySessions: number,
  todayMinutesMs: number,
  todayAvgAccuracy: number,
): boolean {
  if (todaySessions < goal.targetSessions) return false
  if (todayMinutesMs / 60_000 < goal.targetMinutes) return false
  if (goal.accuracyFloor != null && todayAvgAccuracy < goal.accuracyFloor) return false
  return true
}

export function updateGoalsAfterRun(
  prev: GoalsState,
  run: { duration_ms: number; accuracy: number },
): GoalsState {
  const today = todayStr()
  const isNewDay = prev.lastSessionDate !== today

  let todaySessions = prev.todaySessions
  let todayMinutesMs = prev.todayMinutesMs
  let todayAccuracySum = prev.todayAccuracySum
  let weekHistory = [...prev.weekHistory]
  let goalStreak = prev.goalStreak
  let bestGoalStreak = prev.bestGoalStreak

  if (isNewDay) {
    // Check if yesterday's goal was met before rolling over
    if (prev.lastSessionDate && prev.todaySessions > 0) {
      const prevGoal = generateDailyGoal(prev.weeklyIntent, 0, null)
      const prevAvgAcc = prev.todaySessions > 0 ? prev.todayAccuracySum / prev.todaySessions : 0
      const prevCompleted = checkGoalCompletion(prevGoal, prev.todaySessions, prev.todayMinutesMs, prevAvgAcc)

      weekHistory.unshift({
        date: prev.lastSessionDate,
        completed: prevCompleted,
        sessions: prev.todaySessions,
        minutes: Math.round(prev.todayMinutesMs / 60_000),
      })
      weekHistory = weekHistory.slice(0, 7)

      const gap = daysBetween(prev.lastSessionDate, today)
      if (prevCompleted && gap === 1) {
        goalStreak = goalStreak + 1
      } else if (gap > 1) {
        // Missed days — reset streak
        goalStreak = 0
      }
      bestGoalStreak = Math.max(bestGoalStreak, goalStreak)
    }

    // Reset daily counters
    todaySessions = 0
    todayMinutesMs = 0
    todayAccuracySum = 0
  }

  todaySessions += 1
  todayMinutesMs += run.duration_ms
  todayAccuracySum += run.accuracy

  return {
    ...prev,
    todaySessions,
    todayMinutesMs,
    todayAccuracySum,
    lastSessionDate: today,
    goalStreak,
    bestGoalStreak,
    weekHistory,
  }
}
