import { describe, it, expect } from 'vitest'
import { computeStats } from './typing'

describe('computeStats', () => {
  describe('Accuracy Clamping', () => {
    it('should clamp accuracy to 1 when correct chars > total (defensive)', () => {
      const result = computeStats({
        startedAtMs: 1000,
        nowMs: 2000,
        correctChars: 10,
        incorrectChars: -2, // Impossible scenario locally but ensures clamp works
      })
      expect(result.accuracy).toBe(1)
    })

    it('should clamp accuracy to 0 when correct chars are negative (defensive)', () => {
        const result = computeStats({
            startedAtMs: 1000,
            nowMs: 2000,
            correctChars: -5,
            incorrectChars: 10,
        })
        expect(result.accuracy).toBe(0)
    })

    it('should calculate normal accuracy correctly', () => {
      const result = computeStats({
        startedAtMs: 0,
        nowMs: 1000,
        correctChars: 50,
        incorrectChars: 50,
      })
      expect(result.accuracy).toBe(0.5)
    })
  })

  describe('WPM Safety', () => {
    it('should return 0 WPM when startedAtMs is null', () => {
      const result = computeStats({
        startedAtMs: null,
        nowMs: 1000,
        correctChars: 50,
        incorrectChars: 0,
      })
      expect(result.wpm).toBe(0)
      expect(result.elapsedMs).toBe(0)
    })

    it('should return 0 WPM when duration is 0', () => {
      const result = computeStats({
        startedAtMs: 1000,
        nowMs: 1000,
        correctChars: 10,
        incorrectChars: 0,
      })
      expect(result.wpm).toBe(0)
    })

    it('should return 0 WPM when duration is negative', () => {
      const result = computeStats({
        startedAtMs: 2000,
        nowMs: 1000,
        correctChars: 10,
        incorrectChars: 0,
      })
      expect(result.wpm).toBe(0)
    })
  })

  describe('Basic Correctness', () => {
    it('should calculate 12 WPM for 60 chars in 1 minute', () => {
      // 60 chars / 5 = 12 words
      // 1 minute
      // WPM = 12
      const result = computeStats({
        startedAtMs: 0,
        nowMs: 60000,
        correctChars: 60,
        incorrectChars: 0,
      })
      expect(result.wpm).toBeCloseTo(12)
    })

    it('should calculate 60 WPM for 300 chars in 1 minute', () => {
      // 300 chars / 5 = 60 words
      // 1 minute
      // WPM = 60
      const result = computeStats({
        startedAtMs: 0,
        nowMs: 60000,
        correctChars: 300,
        incorrectChars: 0,
      })
      expect(result.wpm).toBeCloseTo(60)
    })
  })
})
