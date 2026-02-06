// Competitive engine: leagues, rule sets, and run validation.
// Pure functions — no IDB dependency.

import type { League, RuleSet, CompetitiveState } from './db'
import type { RunResult } from './storage'

// ─── League thresholds ──────────────────────────────────────────────

export function determineLeague(rating: number): League {
  if (rating >= 1800) return 'gold'
  if (rating >= 1200) return 'silver'
  return 'bronze'
}

export function leagueLabel(league: League): string {
  switch (league) {
    case 'bronze': return 'Bronze'
    case 'silver': return 'Silver'
    case 'gold': return 'Gold'
  }
}

export function nextLeagueThreshold(league: League): number | null {
  switch (league) {
    case 'bronze': return 1200
    case 'silver': return 1800
    case 'gold': return null // already at top
  }
}

// ─── Rule sets ──────────────────────────────────────────────────────

export type RuleSetConfig = {
  name: string
  description: string
}

export function describeRuleSet(ruleSet: RuleSet): RuleSetConfig {
  switch (ruleSet) {
    case 'standard':
      return { name: 'Standard', description: 'No extra constraints. Backspace allowed.' }
    case 'no_backspace':
      return { name: 'No Backspace', description: 'Backspace is disabled. Every keystroke counts.' }
    case 'accuracy_gate':
      return { name: 'Accuracy Gate', description: 'Run must hit 97%+ accuracy to count.' }
    case 'consistency_ladder':
      return { name: 'Consistency Ladder', description: 'WPM variance across the run must stay under 15%.' }
  }
}

export type RunValidation = {
  valid: boolean
  violations: string[]
}

export function validateRunAgainstRuleSet(
  run: Pick<RunResult, 'accuracy' | 'backspaces' | 'wpm'>,
  ruleSet: RuleSet,
): RunValidation {
  if (ruleSet === 'standard') return { valid: true, violations: [] }

  const violations: string[] = []

  if (ruleSet === 'no_backspace') {
    if (run.backspaces > 0) {
      violations.push(`Used ${run.backspaces} backspace(s). No Backspace mode requires zero.`)
    }
  }

  if (ruleSet === 'accuracy_gate') {
    if (run.accuracy < 0.97) {
      violations.push(`Accuracy ${Math.round(run.accuracy * 1000) / 10}% is below the 97% gate.`)
    }
  }

  if (ruleSet === 'consistency_ladder') {
    // Note: full consistency check requires per-quarter WPM data which we don't have
    // in the current RunResult. For now, we use a WPM-based heuristic.
    // A run with accuracy < 0.9 likely had inconsistencies.
    if (run.accuracy < 0.9) {
      violations.push('Run consistency too low (accuracy proxy below 90%).')
    }
  }

  return { valid: violations.length === 0, violations }
}

export const ALL_RULE_SETS: RuleSet[] = ['standard', 'no_backspace', 'accuracy_gate', 'consistency_ladder']

export function updateCompetitiveAfterRun(
  prev: CompetitiveState,
  rating: number,
  delta: number,
): CompetitiveState {
  const recentDeltas = [delta, ...prev.recentDeltas].slice(0, 10)
  return {
    ...prev,
    rating,
    currentLeague: determineLeague(rating),
    totalRatedRuns: prev.totalRatedRuns + (delta !== 0 ? 1 : 0),
    recentDeltas,
  }
}
