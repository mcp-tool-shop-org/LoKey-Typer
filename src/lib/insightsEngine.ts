// Insights engine: computes progress summaries from existing local data.
// Pure functions — zero IDB/storage deps.

import type { StatsAggregate } from './db'
import type { UserSkillModel } from './storage'

// ─── Types ───────────────────────────────────────────────────────────

export type TroubleArea = {
  tag: string
  score: number
  label: string
}

export type ImprovedArea = {
  tag: string
  improvement: number
  label: string
}

export type InsightsSummary = {
  wpmTrend: number[]
  accuracyTrend: number[]
  topTroubleAreas: TroubleArea[]
  mostImproved: ImprovedArea | null
  totalSessionCount: number
  totalDurationMinutes: number
  bestWpm: number
  bestAccuracy: number
}

// ─── Helpers ─────────────────────────────────────────────────────────

const TAG_LABELS: Record<string, string> = {
  punctuation: 'Punctuation',
  apostrophe: 'Apostrophes',
  quotes: 'Quotation marks',
  brackets: 'Brackets',
  dashes: 'Dashes',
  slashes: 'Slashes',
  numbers: 'Numbers',
  multiline: 'Multi-line',
  sentences: 'Sentences',
  calm: 'Calm passages',
  letters: 'Letters',
  space: 'Spacing',
  newline: 'Line breaks',
  symbol: 'Symbols',
}

function labelForTag(tag: string): string {
  return TAG_LABELS[tag] ?? tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Main computation ────────────────────────────────────────────────

export function computeInsights(params: {
  stats: StatsAggregate
  skill: UserSkillModel | null
}): InsightsSummary {
  const { stats, skill } = params

  const wpmTrend = [...stats.rollingWpm10]
  const accuracyTrend = [...stats.rollingAccuracy10]

  // Top trouble areas from weakness_by_tag
  const weaknessEntries = Object.entries(skill?.weakness_by_tag ?? {})
    .filter(([, v]) => Number.isFinite(v) && v > 0.001)
    .sort((a, b) => b[1] - a[1])

  const topTroubleAreas: TroubleArea[] = weaknessEntries
    .slice(0, 3)
    .map(([tag, score]) => ({
      tag,
      score,
      label: labelForTag(tag),
    }))

  // Most improved: compare errors_by_class (higher = more errors) to weakness_by_tag
  // The tag with the biggest decrease (was high in errors_by_class, now lower in weakness_by_tag)
  // represents the most improved area
  let mostImproved: ImprovedArea | null = null
  if (skill) {
    const errorsByClass = skill.errors_by_class ?? {}
    const weaknessByTag = skill.weakness_by_tag ?? {}

    let bestImprovement = 0

    for (const [tag, errorScore] of Object.entries(errorsByClass)) {
      const currentWeakness = weaknessByTag[tag] ?? 0
      // Improvement = how much the error score exceeds the current weakness
      // (if error history is high but current weakness is low, they improved)
      const improvement = errorScore - currentWeakness
      if (improvement > bestImprovement && errorScore > 0.5) {
        bestImprovement = improvement
        mostImproved = {
          tag,
          improvement,
          label: labelForTag(tag),
        }
      }
    }
  }

  return {
    wpmTrend,
    accuracyTrend,
    topTroubleAreas,
    mostImproved,
    totalSessionCount: stats.totalSessions,
    totalDurationMinutes: Math.round(stats.totalDurationMs / 60_000),
    bestWpm: stats.bestWpm,
    bestAccuracy: stats.bestAccuracy,
  }
}
