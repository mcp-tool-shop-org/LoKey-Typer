// Progression engine: pack unlock rules.
// Pure functions — unlock state is derived, not stored.

import type { Mode } from '@content'
import type { SkillBranch, SkillTreeState, CompetitiveState, StatsAggregate } from './db'

export type PackUnlockRule =
  | { type: 'always' }
  | { type: 'sessions_in_mode'; mode: Mode; count: number }
  | { type: 'skill_level'; branch: SkillBranch; minLevel: number }
  | { type: 'rating'; minRating: number }
  | { type: 'total_sessions'; count: number }

export type PackUnlockStatus = {
  unlocked: boolean
  reason: string
}

export function evaluatePackUnlock(
  rule: PackUnlockRule,
  stats: StatsAggregate | null,
  skillTree: SkillTreeState | null,
  competitive: CompetitiveState | null,
): boolean {
  switch (rule.type) {
    case 'always':
      return true
    case 'sessions_in_mode': {
      const sessions = stats?.byMode[rule.mode]?.sessions ?? 0
      return sessions >= rule.count
    }
    case 'skill_level': {
      const level = skillTree?.branches[rule.branch]?.level ?? 0
      return level >= rule.minLevel
    }
    case 'rating': {
      const rating = competitive?.rating ?? 0
      return rating >= rule.minRating
    }
    case 'total_sessions': {
      const total = stats?.totalSessions ?? 0
      return total >= rule.count
    }
  }
}

export function getPackUnlockStatus(
  rule: PackUnlockRule,
  stats: StatsAggregate | null,
  skillTree: SkillTreeState | null,
  competitive: CompetitiveState | null,
): PackUnlockStatus {
  const unlocked = evaluatePackUnlock(rule, stats, skillTree, competitive)

  if (unlocked) return { unlocked: true, reason: '' }

  switch (rule.type) {
    case 'always':
      return { unlocked: true, reason: '' }
    case 'sessions_in_mode': {
      const sessions = stats?.byMode[rule.mode]?.sessions ?? 0
      const modeName = rule.mode === 'focus' ? 'Focus' : rule.mode === 'real_life' ? 'Real Life' : 'Competitive'
      return { unlocked: false, reason: `${sessions}/${rule.count} sessions in ${modeName} mode` }
    }
    case 'skill_level': {
      const level = skillTree?.branches[rule.branch]?.level ?? 0
      const branchName = rule.branch[0].toUpperCase() + rule.branch.slice(1)
      return { unlocked: false, reason: `${branchName} level ${level}/${rule.minLevel}` }
    }
    case 'rating': {
      const rating = competitive?.rating ?? 0
      return { unlocked: false, reason: `Rating ${Math.round(rating)}/${rule.minRating}` }
    }
    case 'total_sessions': {
      const total = stats?.totalSessions ?? 0
      return { unlocked: false, reason: `${total}/${rule.count} total sessions` }
    }
  }
}

// Default pack rules — most packs are always unlocked.
// Pack IDs must match exactly what's in the content JSON packs.
// This is a conservative starting set — can be expanded as more packs are added.
export const DEFAULT_PACK_RULES: Record<string, PackUnlockRule> = {
  // Always unlocked (most packs)
  // Only a few harder/advanced packs have requirements:
  'Advanced Punctuation': { type: 'skill_level', branch: 'punctuation', minLevel: 2 },
  'Speed Drills': { type: 'sessions_in_mode', mode: 'competitive', count: 5 },
  'Endurance Challenges': { type: 'skill_level', branch: 'endurance', minLevel: 3 },
  'Gold League Exercises': { type: 'rating', minRating: 1800 },
}

export function getPackRule(packId: string): PackUnlockRule {
  return DEFAULT_PACK_RULES[packId] ?? { type: 'always' }
}
