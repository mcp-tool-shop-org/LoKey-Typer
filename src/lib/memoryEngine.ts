// Memory engine: inventory and management utilities for user data.
// Pure functions — zero IDB/storage deps (except size estimation helpers).

import type { RunResult } from './storage'

// ─── Types ───────────────────────────────────────────────────────────

export type StoreSummary = {
  name: string
  label: string
  description: string
  approximateSizeKb: number
  itemCount: number | null
}

export type MemoryOverview = {
  stores: StoreSummary[]
  totalSizeKb: number
  sessionCount: number
  oldestSession: number | null
  newestSession: number | null
}

// ─── Store metadata ──────────────────────────────────────────────────

type StoreSpec = {
  name: string
  label: string
  description: string
}

const STORE_SPECS: StoreSpec[] = [
  { name: 'profile', label: 'Profile', description: 'Name, pronouns, goal, tone preference.' },
  { name: 'preferences', label: 'Preferences', description: 'Sound, HUD, font, and mode settings.' },
  { name: 'sessions', label: 'Sessions', description: 'Every typing run recorded.' },
  { name: 'stats_agg', label: 'Stats', description: 'Rolling averages, best scores, fatigue data.' },
  { name: 'streaks', label: 'Streaks', description: 'Practice days, comebacks, rolling week.' },
  { name: 'skill', label: 'Skill Model', description: 'EMA scores, weakness tags, error classes.' },
  { name: 'personal_bests', label: 'Personal Bests', description: 'Best WPM and accuracy per exercise.' },
  { name: 'unlocks', label: 'Unlocks', description: 'Earned milestones, titles, and cosmetics.' },
  { name: 'journal', label: 'Journal', description: 'Post-session reflections and tags.' },
  { name: 'goals', label: 'Goals', description: 'Weekly intent and daily progress.' },
  { name: 'skill_tree', label: 'Skill Tree', description: 'XP and level per branch.' },
  { name: 'competitive', label: 'Competitive', description: 'Rating, league, and season data.' },
]

// ─── Size estimation ─────────────────────────────────────────────────

function estimateKb(data: unknown): number {
  try {
    const str = JSON.stringify(data)
    return str ? str.length / 1024 : 0
  } catch {
    return 0
  }
}

export function computeStoreSummary(params: {
  profile: unknown
  preferences: unknown
  sessions: unknown[]
  stats: unknown
  streak: unknown
  skill: unknown
  personalBests: unknown
  unlocks: unknown
  journal: unknown[]
  goals: unknown
  skillTree: unknown
  competitive: unknown
}): MemoryOverview {
  const dataMap: Record<string, { data: unknown; count: number | null }> = {
    profile: { data: params.profile, count: null },
    preferences: { data: params.preferences, count: null },
    sessions: { data: params.sessions, count: params.sessions.length },
    stats_agg: { data: params.stats, count: null },
    streaks: { data: params.streak, count: null },
    skill: { data: params.skill, count: null },
    personal_bests: { data: params.personalBests, count: null },
    unlocks: { data: params.unlocks, count: null },
    journal: { data: params.journal, count: params.journal.length },
    goals: { data: params.goals, count: null },
    skill_tree: { data: params.skillTree, count: null },
    competitive: { data: params.competitive, count: null },
  }

  const stores: StoreSummary[] = STORE_SPECS.map((spec) => {
    const entry = dataMap[spec.name]
    return {
      name: spec.name,
      label: spec.label,
      description: spec.description,
      approximateSizeKb: Math.round(estimateKb(entry?.data ?? null) * 10) / 10,
      itemCount: entry?.count ?? null,
    }
  })

  const totalSizeKb = Math.round(stores.reduce((s, st) => s + st.approximateSizeKb, 0) * 10) / 10

  // Session timestamps
  const sessions = params.sessions as Array<{ timestamp?: number }>
  let oldestSession: number | null = null
  let newestSession: number | null = null
  for (const s of sessions) {
    if (typeof s.timestamp === 'number') {
      if (oldestSession === null || s.timestamp < oldestSession) oldestSession = s.timestamp
      if (newestSession === null || s.timestamp > newestSession) newestSession = s.timestamp
    }
  }

  return {
    stores,
    totalSizeKb,
    sessionCount: sessions.length,
    oldestSession,
    newestSession,
  }
}

// ─── Session deletion helpers ────────────────────────────────────────

export function filterSessionsForDeletion<T extends { timestamp?: number }>(
  sessions: T[],
  count: number,
): { toKeep: T[]; toDelete: T[] } {
  if (count <= 0 || sessions.length === 0) {
    return { toKeep: [...sessions], toDelete: [] }
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...sessions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  const toDelete = sorted.slice(0, Math.min(count, sorted.length))
  const deleteSet = new Set(toDelete)
  const toKeep = sessions.filter((s) => !deleteSet.has(s))

  return { toKeep, toDelete }
}
