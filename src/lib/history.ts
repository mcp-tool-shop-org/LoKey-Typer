import { safeParse } from './storage'

export type HistoryPoint = {
  dateKey: string // YYYY-MM-DD
  wpm: number
  accuracy: number // 0..1
  focusLevel?: number
  dailyCompleted: boolean
}

export type TrendSummary = {
  metric: 'wpm' | 'accuracy'
  direction: 'up' | 'down' | 'flat'
  deltaFormatted: string
  text: string
}

const MAX_HISTORY_POINTS = 60

export function upsertHistoryPoint(
  points: HistoryPoint[],
  newPoint: HistoryPoint
): HistoryPoint[] {
  const others = points.filter((p) => p.dateKey !== newPoint.dateKey)
  const next = [...others, newPoint]
  next.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  if (next.length > MAX_HISTORY_POINTS) {
    return next.slice(next.length - MAX_HISTORY_POINTS)
  }
  return next
}

export function summarizeTrend(
  points: HistoryPoint[],
  metric: 'wpm' | 'accuracy',
  lookbackDays = 7
): TrendSummary | null {
  if (points.length < 2) return null
  
  const last = points[points.length - 1]
  const prevIdx = Math.max(0, points.length - 1 - Math.min(points.length - 1, lookbackDays))
  const prev = points[prevIdx]
  
  if (last === prev) return null
  
  const valNow = metric === 'wpm' ? last.wpm : last.accuracy * 100
  const valPrev = metric === 'wpm' ? prev.wpm : prev.accuracy * 100
  
  const delta = valNow - valPrev
  const percent = valPrev !== 0 ? (delta / valPrev) * 100 : 0
  
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  
  const absPercent = Math.abs(percent)
  
  let deltaText = ''
  if (metric === 'wpm') {
    deltaText = Math.round(valPrev) + ' -> ' + Math.round(valNow)
  } else {
    deltaText = valPrev.toFixed(1) + '% -> ' + valNow.toFixed(1) + '%'
  }
  
  const percentText = absPercent.toFixed(1) + '%'
  const label = metric === 'wpm' ? 'WPM' : 'Accuracy'
  const text = label + ' ' + direction + ' ' + percentText + ' (' + deltaText + ')'
  
  return {
    metric,
    direction,
    deltaFormatted: percentText,
    text
  }
}

const HISTORY_KEY = 'lkt_history_v1'

export function loadHistory(): HistoryPoint[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const parsed = safeParse<unknown>(localStorage.getItem(HISTORY_KEY))
    if (!parsed) return []
    if (!Array.isArray(parsed)) return []
    return parsed as HistoryPoint[]
  } catch {
    return []
  }
}

export function saveHistory(points: HistoryPoint[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(HISTORY_KEY, JSON.stringify(points))
  } catch {
  }
}
