// Rating engine: Elo-style local rating + anti-cheese scoring.
// Pure functions — no IDB dependency.

import type { RuleSet } from './db'
import type { RunResult } from './storage'
import { validateRunAgainstRuleSet } from './competitiveEngine'

export type RunValidity = 'valid' | 'too_short' | 'restart_spam' | 'accuracy_too_low' | 'rule_violation'

export const RESTART_SESSION_KEY = 'lkt_restart_count'

export function assessRunValidity(
  run: Pick<RunResult, 'duration_ms' | 'accuracy' | 'backspaces' | 'wpm'>,
  restartCount: number,
  ruleSet: RuleSet,
): RunValidity {
  if (run.duration_ms < 5_000) return 'too_short'
  if (restartCount >= 5) return 'restart_spam'
  if (run.accuracy < 0.5) return 'accuracy_too_low'

  if (ruleSet !== 'standard') {
    const validation = validateRunAgainstRuleSet(run, ruleSet)
    if (!validation.valid) return 'rule_violation'
  }

  return 'valid'
}

export function validityLabel(validity: RunValidity): string {
  switch (validity) {
    case 'valid': return 'Valid run'
    case 'too_short': return 'Not rated: too short (< 5s)'
    case 'restart_spam': return 'Not rated: too many restarts'
    case 'accuracy_too_low': return 'Not rated: accuracy below 50%'
    case 'rule_violation': return 'Not rated: rule set violation'
  }
}

// K-factor for rating changes (standard Elo uses 32)
const K = 32

export function computeRatingDelta(
  currentRating: number,
  run: Pick<RunResult, 'wpm' | 'accuracy'>,
  validity: RunValidity,
): number {
  if (validity !== 'valid') return 0

  // observedScore: normalized WPM (0-1 scale based on 0-120 WPM range) * accuracy
  const normalizedWpm = Math.max(0, Math.min(1, run.wpm / 120))
  const observedScore = normalizedWpm * run.accuracy

  // expectedScore: derived from current rating (logistic curve)
  // At rating 1000, expected ~0.5. At 1500, expected ~0.65. At 2000, expected ~0.8.
  const expectedScore = 1 / (1 + Math.pow(10, (1500 - currentRating) / 400))

  const delta = K * (observedScore - expectedScore)
  return Math.round(delta * 10) / 10 // one decimal
}

export function applyRatingDelta(
  currentRating: number,
  delta: number,
): number {
  return Math.max(0, Math.min(3000, currentRating + delta))
}

export function getRestartCount(): number {
  try {
    return parseInt(sessionStorage.getItem(RESTART_SESSION_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

export function incrementRestartCount(): void {
  try {
    const current = getRestartCount()
    sessionStorage.setItem(RESTART_SESSION_KEY, String(current + 1))
  } catch {
    // silent
  }
}

export function resetRestartCount(): void {
  try {
    sessionStorage.removeItem(RESTART_SESSION_KEY)
  } catch {
    // silent
  }
}
