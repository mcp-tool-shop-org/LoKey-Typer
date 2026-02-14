import { describe, expect, it } from 'vitest'
import { upsertHistoryPoint, summarizeTrend, type HistoryPoint } from './history'

describe('upsertHistoryPoint', () => {
  it('adds a new point to empty list', () => {
    const list: HistoryPoint[] = []
    const p: HistoryPoint = { dateKey: '2023-01-01', wpm: 50, accuracy: 0.9, dailyCompleted: true }
    const next = upsertHistoryPoint(list, p)
    expect(next).toHaveLength(1)
    expect(next[0]).toEqual(p)
  })

  it('replaces point with same dateKey', () => {
    const list: HistoryPoint[] = [
      { dateKey: '2023-01-01', wpm: 50, accuracy: 0.9, dailyCompleted: true }
    ]
    const p: HistoryPoint = { dateKey: '2023-01-01', wpm: 60, accuracy: 0.95, dailyCompleted: true }
    const next = upsertHistoryPoint(list, p)
    expect(next).toHaveLength(1)
    expect(next[0].wpm).toBe(60)
  })

  it('sorts by date ascending', () => {
    const list: HistoryPoint[] = [
      { dateKey: '2023-01-02', wpm: 50, accuracy: 0.9, dailyCompleted: true }
    ]
    const p: HistoryPoint = { dateKey: '2023-01-01', wpm: 60, accuracy: 0.95, dailyCompleted: true }
    const next = upsertHistoryPoint(list, p)
    expect(next).toHaveLength(2)
    expect(next[0].dateKey).toBe('2023-01-01')
    expect(next[1].dateKey).toBe('2023-01-02')
  })

  it('trims to max size', () => {
    const list: HistoryPoint[] = Array.from({ length: 60 }, (_, i) => ({
      dateKey: `2023-01-${String(i + 1).padStart(2, '0')}`,
      wpm: 50,
      accuracy: 0.9,
      dailyCompleted: true
    }))
    // Adding 61st point (future date)
    const p: HistoryPoint = { dateKey: '2023-05-01', wpm: 100, accuracy: 1, dailyCompleted: true }
    const next = upsertHistoryPoint(list, p)
    expect(next).toHaveLength(60)
    expect(next[next.length - 1].dateKey).toBe('2023-05-01')
    expect(next[0].dateKey).not.toBe('2023-01-01') // First one should be dropped
  })
})

describe('summarizeTrend', () => {
  it('returns null if insufficient history', () => {
    const list: HistoryPoint[] = [{ dateKey: '2023-01-01', wpm: 50, accuracy: 0.9, dailyCompleted: true }]
    expect(summarizeTrend(list, 'wpm')).toBeNull()
  })

  it('summarizes WPM improvement correctly', () => {
     // 7 days ago: 50. Today: 60.
     const list: HistoryPoint[] = [
         { dateKey: '2023-01-01', wpm: 50, accuracy: 0.9, dailyCompleted: true },
         ...Array.from({ length: 5 }, (_, i) => ({ dateKey: `2023-01-0${i+2}`, wpm: 55, accuracy: 0.9, dailyCompleted: true })),
         { dateKey: '2023-01-08', wpm: 60, accuracy: 0.9, dailyCompleted: true }
     ]
     // Assuming lookback 7 finds index 0
     const summary = summarizeTrend(list, 'wpm', 7)
     expect(summary).not.toBeNull()
     expect(summary?.direction).toBe('up')
     expect(summary?.text).toContain('WPM up 20.0%')
     expect(summary?.text).toContain('50 -> 60')
  })

  it('summarizes accuracy decline correctly', () => {
      const list: HistoryPoint[] = [
          { dateKey: '2023-01-01', wpm: 50, accuracy: 0.98, dailyCompleted: true },
          { dateKey: '2023-01-02', wpm: 50, accuracy: 0.90, dailyCompleted: true }
      ]
      const summary = summarizeTrend(list, 'accuracy', 7)
      expect(summary?.direction).toBe('down')
      // 98 -> 90 is -8.
      // -8 / 98 = -0.0816... -> 8.2% roughly
      expect(summary?.text).toContain('Accuracy down')
  })
})
