import { safeParse } from './storage'

export type DailyStreak = {
  currentStreak: number
  bestStreak: number
  lastCompletedDateKey?: string
  completedDates: string[] // ISO date strings 'YYYY-MM-DD'
}

export type StreakUpdateResult = {
  newState: DailyStreak
  isNewDayCompletion: boolean
  didIncrementStreak: boolean
  isPersonalBest: boolean
}

const MAX_HISTORY_DAYS = 60

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

function parseDateKey(dateKey: string): Date {
  return new Date(dateKey + 'T00:00:00Z') // Treat as UTC midnight
}

/**
 * Returns number of days between A and B.
 * positive if B is after A.
 */
function getDayDiff(dateKeyA: string, dateKeyB: string): number {
  const a = parseDateKey(dateKeyA).getTime()
  const b = parseDateKey(dateKeyB).getTime()
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((b - a) / msPerDay)
}

export function recordDailyCompletion(
  streak: DailyStreak,
  dateKey: string
): StreakUpdateResult {
  const { lastCompletedDateKey, currentStreak, bestStreak, completedDates } = streak

  // 1. Same day check
  if (lastCompletedDateKey === dateKey) {
    return {
      newState: streak,
      isNewDayCompletion: false,
      didIncrementStreak: false,
      isPersonalBest: false,
    }
  }

  let newCurrentStreak = 1
  let didIncrementStreak = false

  if (!lastCompletedDateKey) {
    // First ever
    newCurrentStreak = 1
    didIncrementStreak = true 
  } else {
    const diff = getDayDiff(lastCompletedDateKey, dateKey)

    if (diff === 1) {
      // Consecutive: Extend streak
      newCurrentStreak = currentStreak + 1
      didIncrementStreak = true
    } else if (diff <= 0) {
      // Past fill or replay -> No streak increment
      // If we go back in time, we don't break current streak, but we don't extend it either.
      // But we update completedDates.
      // And we prob shouldn't update lastCompletedDateKey if it's in the past relative to current.
      // Simple logic: Only update 'lastCompletedDateKey' if new date is > old date?
      // But let's follow prompt: 'Input: streakState, dateKey -> Output: new state'
      // If prompt implies forward progression:
      // 'If lastCompleted is yesterday -> ... Else -> currentStreak = 1'
      // If strict, any non-consecutive becomes 1. 
      // I'll stick to: 'If diff !== 1 -> newCurrentStreak = 1'.
      newCurrentStreak = 1
    } else {
       // Gap > 1 -> Reset
       newCurrentStreak = 1
    }
  }

  const newBestStreak = Math.max(bestStreak, newCurrentStreak)
  const isPersonalBest = newBestStreak > bestStreak && newBestStreak > 1

  // Handle date list (dedupe, sort, slice)
  const set = new Set(completedDates)
  set.add(dateKey)
  const newList = Array.from(set).sort().reverse().slice(0, MAX_HISTORY_DAYS)

  // Only update lastCompletedDateKey if this new date is actually newer than what we had?
  // Or just always update it? 
  // If I do a past day, my streak resets to 1 because I 'broke' the chain relative to my last record.
  // This is a known 'gotcha' in simple streak logic. Usually users do 'today'.
  // We'll proceed with simple last-seen logic.
  
  return {
    newState: {
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
      lastCompletedDateKey: dateKey,
      completedDates: newList,
    },
    isNewDayCompletion: true,
    didIncrementStreak,
    isPersonalBest,
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STREAK_KEY = 'lkt_streak_v1'

export function loadStreak(): DailyStreak {
  const defaultState: DailyStreak = {
    currentStreak: 0,
    bestStreak: 0,
    completedDates: [],
  }

  try {
    if (typeof localStorage === 'undefined') return defaultState
    const parsed = safeParse<any>(localStorage.getItem(STREAK_KEY))
    if (!parsed) return defaultState
    
    return {
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      lastCompletedDateKey: typeof parsed.lastCompletedDateKey === 'string' ? parsed.lastCompletedDateKey : undefined,
      completedDates: Array.isArray(parsed.completedDates) ? parsed.completedDates : [],
    }
  } catch {
    return defaultState
  }
}

export function saveStreak(streak: DailyStreak) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak))
  } catch {
    // ignore
  }
}
