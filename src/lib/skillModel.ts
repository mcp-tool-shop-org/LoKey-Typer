import type { Exercise } from '@content'
import type { RunResult, UserSkillModel } from './storage'

export type CharClass =
  | 'letters'
  | 'numbers'
  | 'space'
  | 'newline'
  | 'apostrophe'
  | 'quotes'
  | 'dash'
  | 'punctuation'
  | 'brackets'
  | 'slash'
  | 'symbol'
  | 'overflow'

export type LengthBucket = 'short' | 'medium' | 'long' | 'multiline'

function isLetter(ch: string) {
  return /^[A-Za-z]$/.test(ch)
}

function isNumber(ch: string) {
  return /^[0-9]$/.test(ch)
}

function charClassForExpected(expected: string | null): CharClass {
  if (expected == null) return 'overflow'
  if (expected === '\n') return 'newline'
  if (expected === ' ') return 'space'

  if (expected === "'" || expected === '’') return 'apostrophe'
  if (expected === '"' || expected === '“' || expected === '”') return 'quotes'
  if (expected === '-' || expected === '–' || expected === '—') return 'dash'

  if ('()[]{}<>'.includes(expected)) return 'brackets'
  if (expected === '/' || expected === '\\') return 'slash'
  if (isNumber(expected)) return 'numbers'
  if (isLetter(expected)) return 'letters'
  if (',.;:?!'.includes(expected)) return 'punctuation'
  if (/^[^\w\s]$/.test(expected)) return 'symbol'
  return 'symbol'
}

function bucketForExercise(ex: Exercise, targetText: string): LengthBucket {
  const isMultiline =
    (ex.type === 'template' ? ex.template.includes('\n') : false) || targetText.includes('\n')
  if (isMultiline) return 'multiline'

  const s = ex.estimated_seconds
  if (s <= 30) return 'short'
  if (s <= 90) return 'medium'
  return 'long'
}

function emaUpdate(prev: number, next: number, alpha: number) {
  if (!Number.isFinite(prev)) return next
  return prev + alpha * (next - prev)
}

export function computeErrorHotspots(params: {
  target: string
  typed: string
}): Record<CharClass, number> {
  const out: Record<CharClass, number> = {
    letters: 0,
    numbers: 0,
    space: 0,
    newline: 0,
    apostrophe: 0,
    quotes: 0,
    dash: 0,
    punctuation: 0,
    brackets: 0,
    slash: 0,
    symbol: 0,
    overflow: 0,
  }

  const max = Math.max(params.target.length, params.typed.length)
  for (let i = 0; i < max; i++) {
    const expected = i < params.target.length ? params.target[i] : null
    const actual = i < params.typed.length ? params.typed[i] : null
    if (actual == null) continue
    if (expected != null && actual === expected) continue
    const cls = charClassForExpected(expected)
    out[cls]++
  }

  return out
}

function deriveWeakTags(errorsByClass: Record<string, number>): string[] {
  const entries = Object.entries(errorsByClass)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Map internal classes into tags that already exist in content.
  const map: Record<string, string> = {
    numbers: 'numbers',
    apostrophe: 'apostrophe',
    quotes: 'quotes',
    dash: 'dashes',
    punctuation: 'punctuation',
    slash: 'slashes',
    brackets: 'brackets',
  }

  const tags = entries
    .map(([k]) => map[k] ?? null)
    .filter((t): t is string => Boolean(t))

  return Array.from(new Set(tags))
}

export function updateSkillModelFromRun(params: {
  prev: UserSkillModel
  run: RunResult
  exercise: Exercise
  targetText: string
  typedText: string
}): UserSkillModel {
  const alpha = 0.2
  const now = new Date().toISOString()

  const typedLen = Math.max(1, params.typedText.length)
  const backspaceRate = Math.max(0, Math.min(1, params.run.backspaces / typedLen))

  const bucket = bucketForExercise(params.exercise, params.targetText)
  const hotspots = computeErrorHotspots({ target: params.targetText, typed: params.typedText })

  const nextErrorsByClass: Record<string, number> = { ...(params.prev.errors_by_class ?? {}) }
  for (const [cls, count] of Object.entries(hotspots)) {
    const prevVal = nextErrorsByClass[cls] ?? 0
    nextErrorsByClass[cls] = emaUpdate(prevVal, count, alpha)
  }

  const nextPerf = { ...params.prev.performance_by_length }
  const prevBucket = nextPerf[bucket]
  nextPerf[bucket] = {
    ema_wpm: emaUpdate(prevBucket.ema_wpm, params.run.wpm, alpha),
    ema_accuracy: emaUpdate(prevBucket.ema_accuracy, params.run.accuracy, alpha),
    ema_backspace_rate: emaUpdate(prevBucket.ema_backspace_rate, backspaceRate, alpha),
    runs: (prevBucket.runs ?? 0) + 1,
  }

  const next: UserSkillModel = {
    ...params.prev,
    version: 1,
    updated_at: now,
    total_runs: (params.prev.total_runs ?? 0) + 1,
    ema: {
      wpm: emaUpdate(params.prev.ema?.wpm ?? 0, params.run.wpm, alpha),
      accuracy: emaUpdate(params.prev.ema?.accuracy ?? 1, params.run.accuracy, alpha),
      backspace_rate: emaUpdate(params.prev.ema?.backspace_rate ?? 0, backspaceRate, alpha),
    },
    errors_by_class: nextErrorsByClass,
    performance_by_length: nextPerf,
    weak_tags: deriveWeakTags(nextErrorsByClass),
  }

  return next
}
