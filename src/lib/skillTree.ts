// Skill tree engine: 4 branches (accuracy, rhythm, endurance, punctuation) + XP.
// Pure functions — no IDB dependency.

import type { Exercise } from '@content'
import type { RunResult } from './storage'
import type { SkillBranch, SkillTreeState, BranchProgress } from './db'
import { defaultSkillTreeState } from './db'

export type XpGains = Record<SkillBranch, number>

// Exponential XP thresholds per level (0→1 = 100, 1→2 = 250, etc.)
const LEVEL_THRESHOLDS = [100, 250, 500, 850, 1300, 1900, 2700, 3800, 5200, 7000]
const MAX_LEVEL = LEVEL_THRESHOLDS.length

export function xpForLevel(level: number): number {
  if (level < 0 || level >= MAX_LEVEL) return Infinity
  return LEVEL_THRESHOLDS[level]
}

export function computeXpFromRun(
  run: RunResult,
  exercise: Exercise,
  targetText: string,
): XpGains {
  const durationMin = Math.max(0.1, run.duration_ms / 60_000)
  const baseXp = Math.round(durationMin * 15) // ~15 XP per minute base

  // Accuracy branch: scales with accuracy squared (rewards clean typing)
  const accuracyXp = Math.round(baseXp * run.accuracy * run.accuracy)

  // Rhythm branch: rewards consistent WPM (bonus for higher WPM, penalty-free)
  const wpmFactor = Math.min(2, run.wpm / 40) // normalized around 40 WPM
  const rhythmXp = Math.round(baseXp * 0.5 * wpmFactor)

  // Endurance branch: only awards XP for runs > 30s, scales with duration
  const enduranceXp = run.duration_ms > 30_000
    ? Math.round(baseXp * Math.min(2, durationMin / 2))
    : 0

  // Punctuation branch: awards XP when punctuation/special chars are present
  const hasPunct = /[.,;:?!"""'''\-–—()\[\]{}<>\\/0-9]/.test(targetText)
  const punctTags = (exercise.tags ?? []).filter(t =>
    ['punctuation', 'numbers', 'brackets', 'quotes', 'dashes', 'slashes'].includes(t)
  )
  const punctFactor = hasPunct ? 0.5 + punctTags.length * 0.25 : 0
  const punctuationXp = Math.round(baseXp * punctFactor * run.accuracy)

  return {
    accuracy: accuracyXp,
    rhythm: rhythmXp,
    endurance: enduranceXp,
    punctuation: punctuationXp,
  }
}

function advanceBranch(prev: BranchProgress, xpGain: number): BranchProgress {
  if (prev.level >= MAX_LEVEL) return prev

  let xp = prev.xp + xpGain
  let level = prev.level
  let xpToNext = prev.xpToNext

  while (level < MAX_LEVEL && xp >= xpToNext) {
    xp -= xpToNext
    level++
    xpToNext = level < MAX_LEVEL ? xpForLevel(level) : Infinity
  }

  return { level, xp, xpToNext }
}

export function applyXp(prev: SkillTreeState | null, gains: XpGains): SkillTreeState {
  const state = prev ?? defaultSkillTreeState()
  const totalGained = gains.accuracy + gains.rhythm + gains.endurance + gains.punctuation

  return {
    branches: {
      accuracy: advanceBranch(state.branches.accuracy, gains.accuracy),
      rhythm: advanceBranch(state.branches.rhythm, gains.rhythm),
      endurance: advanceBranch(state.branches.endurance, gains.endurance),
      punctuation: advanceBranch(state.branches.punctuation, gains.punctuation),
    },
    totalXp: state.totalXp + totalGained,
    lastUpdated: new Date().toISOString(),
  }
}

export function branchLabel(branch: SkillBranch): string {
  switch (branch) {
    case 'accuracy': return 'Accuracy'
    case 'rhythm': return 'Rhythm'
    case 'endurance': return 'Endurance'
    case 'punctuation': return 'Punctuation'
  }
}

export function branchDescription(branch: SkillBranch): string {
  switch (branch) {
    case 'accuracy': return 'Clean, error-free typing. Fewer mistakes means faster growth.'
    case 'rhythm': return 'Consistent speed and flow. Higher WPM builds this faster.'
    case 'endurance': return 'Sustained focus over longer sessions. Requires 30s+ runs.'
    case 'punctuation': return 'Special characters, numbers, and symbols. Practice diverse content.'
  }
}
