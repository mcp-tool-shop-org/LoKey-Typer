import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pickNextExercise } from './contentEngine'
import { loadExercisesByMode } from '@content'
import { loadRecents } from './storage'
import type { Exercise } from '@content'

vi.mock('@content', () => ({
  loadExercisesByMode: vi.fn(),
  isTemplateExercise: vi.fn(() => false), // Mocking just in case logic checks it directly
}))

vi.mock('./templateRender', () => ({
  isTemplateExercise: vi.fn(() => false),
  renderTemplateExercise: vi.fn(() => 'content')
}))

vi.mock('./storage', () => ({
  loadRecents: vi.fn(() => ({ byMode: { focus: [] } })),
}))

function makeEx(id: string, tags: string[] = [], difficulty: 1 | 2 | 3 | 4 | 5 = 1): Exercise {
  return { 
     id, 
     title: id, 
     text: 'text', 
     tags, 
     difficulty, 
     pack: 'core',
     estimated_seconds: 10,
     mode: 'focus'
  }
}

describe('pickNextExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadRecents).mockReturnValue({ byMode: { focus: [] } } as any)
  })

  it('biases towards weak tags', () => {
    const exNormal = makeEx('normal', ['a'])
    const exWeak = makeEx('weak', ['weakTag'])
    
    vi.mocked(loadExercisesByMode).mockReturnValue([exNormal, exWeak])
    
    const skill: any = {
      total_runs: 100,
      weak_tags: ['weakTag'],
      weakness_by_tag: { weakTag: 1.0 }
    }
    
    // Run multiple trials
    let weakCount = 0
    // Fix seed randomness by varying userId or time implicit in seed
    for(let i=0; i<100; i++) {
       // Mock math random implicitly through wrapper call? 
       // The Code uses Mulberry seeded by time.
       // We can just rely on statistical average over 100 calls with different time seeds (Date.now())
       // But Date.now() might not change in a loop.
       // Let's vary userId to simulate different seeds
       const res = pickNextExercise({
         mode: 'focus',
         userId: `u${i}`,
         skill, 
         prefs: { screenReaderMode: false } as any
       })
       if (res.exercise.id === 'weak') weakCount++
    }
    
    // With weights: normal=1
    // weak:
    //   weakness_by_tag: 1.0 -> clamp(1,0,1)*0.75 = 0.75 boost -> factor 1.75
    //   weak_tags hit: 1 * 0.4 = 0.4 -> factor 1.4
    //   Total weight ~ 2.45
    // Ratio: 2.45 / 3.45 ~= 71%
    // We expect roughly 70. Allow range > 60
    expect(weakCount).toBeGreaterThan(55) 
  })

  it('respects screen reader preference', () => {
    const exSafe = makeEx('safe', [])
    const exMulti = makeEx('multi', ['multiline'])
    
    vi.mocked(loadExercisesByMode).mockReturnValue([exSafe, exMulti])
    
    // Even if we repeat 50 times, we should never pick multi
    for(let i=0; i<20; i++) {
        const res = pickNextExercise({
            mode: 'focus',
            userId: `u${i}`,
            skill: null,
            prefs: { screenReaderMode: true } as any
        })
        expect(res.exercise.id).toBe('safe')
    }
  })
  
  it('applies recency decay', () => {
    const ex1 = makeEx('ex1')
    const ex2 = makeEx('ex2')
    
    vi.mocked(loadExercisesByMode).mockReturnValue([ex1, ex2])
    // Both are seen, ex1 is MOST recent (index 0)
    vi.mocked(loadRecents).mockReturnValue({ byMode: { focus: ['ex1', 'ex2'] } } as any)
    
    let ex1Count = 0
    for(let i=0; i<100; i++) {
       const res = pickNextExercise({
         mode: 'focus',
         userId: `u${i}`,
         skill: null, 
         prefs: { screenReaderMode: false } as any
       })
       if (res.exercise.id === 'ex1') ex1Count++
    }
    
    // ex1 weight = 0.1 + 0.9*(0/1) = 0.1
    // ex2 weight = 0.1 + 0.9*(1/1) = 1.0
    // Ratio 0.1 / 1.1 ~= 9%
    expect(ex1Count).toBeLessThan(25)
  })
})
