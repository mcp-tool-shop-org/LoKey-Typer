import { describe, it, expect } from 'vitest'
import { computeFocusTargetLength } from './focusProgression'

describe('focusProgression', () => {
  it('should maintain length and increment streak on good run', () => {
    const result = computeFocusTargetLength({
      currentLength: 50,
      isSuccess: true,
      accuracy: 0.98,
      wpm: 60,
      streak: 0,
    })
    expect(result.nextLength).toBe(50)
    expect(result.nextStreak).toBe(1)
  })

  it('should reset streak but maintain length on mediocre run', () => {
    const result = computeFocusTargetLength({
      currentLength: 50,
      isSuccess: true,
      accuracy: 0.92, // > 0.9 but < 0.96
      wpm: 60,
      streak: 5,
    })
    expect(result.nextLength).toBe(50)
    expect(result.nextStreak).toBe(0)
  })

  it('should decrease length and reset streak on poor accuracy', () => {
    const result = computeFocusTargetLength({
      currentLength: 100,
      isSuccess: true,
      accuracy: 0.85, 
      wpm: 60,
      streak: 5,
    })
    expect(result.nextLength).toBe(100 - 15) // RAMP_DOWN_STEP
    expect(result.nextStreak).toBe(0)
  })

  it('should ramp up length after streak reaches multiple of 3', () => {
    const result = computeFocusTargetLength({
      currentLength: 100,
      isSuccess: true,
      accuracy: 0.99, 
      wpm: 60,
      streak: 2, // Will become 3
    })
    expect(result.nextStreak).toBe(3)
    expect(result.nextLength).toBe(100 + 25) // RAMP_UP_STEP
  })

  it('should clamp length to max', () => {
    const result = computeFocusTargetLength({
      currentLength: 300,
      isSuccess: true,
      accuracy: 1.0, 
      wpm: 100,
      streak: 2,
    })
    expect(result.nextStreak).toBe(3)
    expect(result.nextLength).toBe(300) // Max
  })

  it('should clamp length to min', () => {
    const result = computeFocusTargetLength({
      currentLength: 30,
      isSuccess: true,
      accuracy: 0.5, 
      wpm: 10,
      streak: 0,
    })
    expect(result.nextLength).toBe(30) // Min
  })
})
