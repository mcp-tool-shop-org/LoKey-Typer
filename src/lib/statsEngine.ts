// Derived stats pipeline: updates aggregate stats and streaks after each run.

import type { Mode } from '@content'
import type { RunResult } from './storage'
import type { StatsAggregate, StreakData } from './db'
import { defaultStats, defaultStreak } from './db'

function emaUpdate(prev: number, next: number, alpha: number): number {
  if (!Number.isFinite(prev)) return next
  return prev + alpha * (next - prev)
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

// ─── Stats aggregate ─────────────────────────────────────────────────

export function updateStatsFromRun(prev: StatsAggregate | null, run: RunResult): StatsAggregate {
  const stats = prev ?? defaultStats()
  const alpha = 0.2

  // Rolling arrays (FIFO, max 10)
  const wpm10 = [...stats.rollingWpm10, run.wpm].slice(-10)
  const acc10 = [...stats.rollingAccuracy10, run.accuracy].slice(-10)

  // Personal bests
  const bestWpm = Math.max(stats.bestWpm, run.wpm)
  const bestAccuracy = Math.max(stats.bestAccuracy, run.accuracy)

  // Per-mode
  const byMode = { ...stats.byMode }
  const m = byMode[run.mode] ?? { sessions: 0, emaWpm: 0, emaAccuracy: 1, bestWpm: 0 }
  byMode[run.mode] = {
    sessions: m.sessions + 1,
    emaWpm: emaUpdate(m.emaWpm, run.wpm, alpha),
    emaAccuracy: emaUpdate(m.emaAccuracy, run.accuracy, alpha),
    bestWpm: Math.max(m.bestWpm, run.wpm),
  }

  // Error heatmap: merge tags_hit as rough error signal
  const errorHeatmap = { ...stats.errorHeatmap }
  if (run.tags_hit) {
    for (const tag of run.tags_hit) {
      errorHeatmap[tag] = (errorHeatmap[tag] ?? 0) + run.errors
    }
  }

  // Fatigue: compare first-half vs second-half accuracy of last 5 sessions
  const fatigue = { ...stats.fatigue }
  if (acc10.length >= 4) {
    const mid = Math.floor(acc10.length / 2)
    const firstHalf = acc10.slice(0, mid)
    const secondHalf = acc10.slice(mid)
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    fatigue.avgFirstHalfAccuracy = avgFirst
    fatigue.avgSecondHalfAccuracy = avgSecond
    fatigue.decaySignal = avgFirst - avgSecond > 0.03 // 3% drop signals fatigue
  }

  return {
    rollingWpm10: wpm10,
    rollingAccuracy10: acc10,
    bestWpm,
    bestAccuracy,
    totalSessions: stats.totalSessions + 1,
    totalDurationMs: stats.totalDurationMs + run.duration_ms,
    byMode,
    errorHeatmap,
    fatigue,
  }
}

// ─── Streaks ─────────────────────────────────────────────────────────

export function updateStreakFromRun(prev: StreakData | null): StreakData {
  const streak = prev ?? defaultStreak()
  const today = todayStr()

  // Already practiced today — no change
  if (streak.lastPracticeDate === today) return streak

  const gap = daysBetween(streak.lastPracticeDate, today)

  let current: number
  if (gap === 1) {
    // Consecutive day
    current = streak.currentStreak + 1
  } else {
    // Gap > 1 or first ever session
    current = 1
  }

  const best = Math.max(streak.bestStreak, current)

  // Shift rolling7: insert 1 at front, pad gaps with 0s
  const rolling7 = [...streak.rolling7]
  const gapDays = Math.min(gap, 7)
  // Insert gap zeros, then today's 1
  for (let i = 0; i < gapDays - 1 && i < 6; i++) {
    rolling7.unshift(0)
  }
  rolling7.unshift(1)
  const trimmed7 = rolling7.slice(0, 7)

  const weekCount = trimmed7.reduce((a, b) => a + b, 0)
  const bestWeek = Math.max(streak.bestWeek, weekCount)

  return {
    currentStreak: current,
    bestStreak: best,
    lastPracticeDate: today,
    rolling7: trimmed7,
    bestWeek,
  }
}

// ─── Trend ───────────────────────────────────────────────────────────

export type Trend = 'improving' | 'stable' | 'declining'

export function computeTrend(values: number[]): Trend {
  if (values.length < 4) return 'stable'

  // Simple linear regression slope
  const n = values.length
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

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const mean = sumY / n

  // Normalize slope by mean to get relative change rate
  if (mean === 0) return 'stable'
  const relativeSlope = slope / mean

  if (relativeSlope > 0.01) return 'improving'
  if (relativeSlope < -0.01) return 'declining'
  return 'stable'
}

// ─── Re-exported mode type helper ────────────────────────────────────

export function ensureModeStats(byMode: StatsAggregate['byMode'], mode: Mode) {
  if (!byMode[mode]) {
    byMode[mode] = { sessions: 0, emaWpm: 0, emaAccuracy: 1, bestWpm: 0 }
  }
  return byMode[mode]
}
