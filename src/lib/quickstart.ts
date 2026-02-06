import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import { loadLastMode, loadRecents } from './storage'

export function pickQuickstartExercise(mode: Mode): Exercise {
  const exercises = loadExercisesByMode(mode)
  if (exercises.length === 0) {
    throw new Error(`No exercises available for mode: ${mode}`)
  }

  const recents = loadRecents().byMode[mode] ?? []
  const recentIndex = new Map<string, number>()
  for (let i = 0; i < recents.length; i++) recentIndex.set(recents[i], i)

  // lowest recently-played first (avoid repeats)
  const sorted = [...exercises].sort((a, b) => {
    const ai = recentIndex.has(a.id) ? recentIndex.get(a.id)! : Number.POSITIVE_INFINITY
    const bi = recentIndex.has(b.id) ? recentIndex.get(b.id)! : Number.POSITIVE_INFINITY
    if (ai !== bi) return bi - ai // bigger index = longer ago
    return a.difficulty - b.difficulty
  })

  return sorted[0]
}

export function preferredQuickstartMode(): Mode {
  return loadLastMode() ?? 'focus'
}
