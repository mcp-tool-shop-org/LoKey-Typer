import { describe, it, expect } from 'vitest'
import { computeErrorHotspots, updateSkillModelFromRun } from './skillModel'
import type { UserSkillModel, RunResult } from './storage'
import type { Exercise } from '@content'

function defaultSkillModel(): UserSkillModel {
  return {
    version: 2,
    updated_at: new Date().toISOString(),
    total_runs: 0,
    ema: { wpm: 0, accuracy: 1, backspace_rate: 0 },
    by_mode: {
      focus: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      real_life: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      competitive: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
    },
    errors_by_class: {},
    weakness_by_tag: {},
    performance_by_length: {
      short: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      medium: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      long: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      multiline: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
    },
    weak_tags: [],
    recent_exercise_ids_by_mode: { focus: [], real_life: [], competitive: [] },
  }
}

describe('skillModel', () => {
    describe('computeErrorHotspots', () => {
        it('should verify newline mismatch is categorized correctly', () => {
             const result = computeErrorHotspots({
                 target: "a\n b",
                 typed: "a b"
             })
             // 'a' matches (implied space mismatch?)
             // target[1] is '\n', typed[1] is ' '. 
             // expected '\n' -> clas 'newline'.
             expect(result.newline).toBe(1)
        })

        it('should verify letter mismatch', () => {
            const result = computeErrorHotspots({
                target: "cat",
                typed: "cut"
            })
            // 'c' matches
            // 'a' != 'u' -> expected 'a' -> 'letters'
            // 't' matches
            expect(result.letters).toBe(1)
        })

        it('should handle over-typing as overflow', () => {
             const result = computeErrorHotspots({
                 target: "a",
                 typed: "ab"
             })
             // 'a' matches
             // typed[1] is 'b', expected null -> 'overflow'
             expect(result.overflow).toBe(1) 
        })
    })

    describe('updateSkillModelFromRun', () => {
        const mockExercise: Exercise = {
            id: 'ex-1',
            type: 'quote',
            text: 'test',
            source: 'test',
            estimated_seconds: 10,
            word_count: 1
        } as unknown as Exercise // Cast to avoid full mock if irrelevant fields exist

        it('should update EMA correctly', () => {
             const prev = defaultSkillModel()
             prev.ema.wpm = 0
             prev.ema.accuracy = 0 // Start low to see clear change
             
             // Run valid for 100 WPM
             const run: RunResult = {
                 exercise_id: 'ex-1',
                 timestamp: Date.now(),
                 mode: 'focus',
                 wpm: 100,
                 accuracy: 1,
                 errors: 0,
                 backspaces: 0,
                 duration_ms: 1000
             }

             // Alpha is 0.2
             // New = Prev + 0.2 * (Run - Prev)
             // WPM: 0 + 0.2 * (100 - 0) = 20
             // Acc: 0 + 0.2 * (1 - 0) = 0.2
             
             const next = updateSkillModelFromRun({
                 prev,
                 run,
                 exercise: mockExercise,
                 targetText: "test",
                 typedText: "test"
             })
             
             expect(next.ema.wpm).toBeCloseTo(20)
             expect(next.ema.accuracy).toBeCloseTo(0.2)
        })

        it('should maintain monotonic counters', () => {
            const prev = defaultSkillModel()
            const run: RunResult = {
                 exercise_id: 'ex-1',
                 timestamp: Date.now(),
                 mode: 'focus',
                 wpm: 100,
                 accuracy: 1,
                 errors: 0,
                 backspaces: 0,
                 duration_ms: 1000
            }
            const next = updateSkillModelFromRun({ prev, run, exercise: mockExercise, targetText: 'test', typedText: 'test' })
            // total_runs is incremented inside calculate something?
            // Wait, does 'updateSkillModelFromRun' increment 'total_runs'?
            // Reading 'src/lib/skillModel.ts' again:
            // "total_runs: params.prev.total_runs + 1,"
            // Yes.
            expect(next.total_runs).toBe(prev.total_runs + 1)
        })

        it('should maintain bounded history (max 50)', () => {
            const prev = defaultSkillModel()
            // Create 50 fake IDs
            prev.recent_exercise_ids_by_mode['focus'] = Array.from({length: 50}, (_, i) => `id-${i}`)
            
            const run: RunResult = {
                 exercise_id: 'new-id',
                 timestamp: Date.now(),
                 mode: 'focus',
                 wpm: 100,
                 accuracy: 1,
                 errors: 0,
                 backspaces: 0,
                 duration_ms: 1000
            }
            
            const next = updateSkillModelFromRun({ prev, run, exercise: mockExercise, targetText: 'test', typedText: 'test' })
            
            // Length should be 50
            expect(next.recent_exercise_ids_by_mode.focus.length).toBe(50)
            // Head should be 'new-id'
            expect(next.recent_exercise_ids_by_mode.focus[0]).toBe('new-id')
            // Last element should be id-48 (id-49 dropped)
             expect(next.recent_exercise_ids_by_mode.focus[49]).toBe('id-48')
        })
    })
})
