import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadSkillModel, loadStatsAsync, type StatsAggregate } from '@lib'
import { computeInsights, type InsightsSummary } from '@lib-internal/insightsEngine'

function Sparkline({ values, colorFn }: { values: number[]; colorFn?: (v: number) => string }) {
  if (values.length === 0) return null
  const max = Math.max(...values, 1)
  const barWidth = 100 / Math.max(values.length, 1)

  return (
    <svg viewBox="0 0 100 40" className="h-12 w-full" preserveAspectRatio="none">
      {values.map((v, i) => {
        const height = (v / max) * 36
        const color = colorFn ? colorFn(v) : '#a1a1aa' // zinc-400
        return (
          <rect
            key={i}
            x={i * barWidth + barWidth * 0.1}
            y={40 - height - 2}
            width={barWidth * 0.8}
            height={Math.max(height, 1)}
            rx={1}
            fill={color}
          />
        )
      })}
    </svg>
  )
}

function WeaknessBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min(1, score / maxScore) * 100 : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800">
      <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function InsightsPage() {
  const [insights, setInsights] = useState<InsightsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stats = await loadStatsAsync()
        if (cancelled) return

        if ((stats as StatsAggregate).totalSessions < 1) {
          setLoading(false)
          return
        }

        const skill = loadSkillModel()
        const result = computeInsights({ stats: stats as StatsAggregate, skill })
        setInsights(result)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading insights...</div>
  }

  if (!insights || insights.totalSessionCount < 5) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Insights</h1>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
          Complete a few more sessions to unlock insights. You need at least 5 sessions for meaningful trends.
        </div>
        <Link to="/" className="inline-block text-sm text-zinc-400 hover:text-zinc-200">
          Back to home
        </Link>
      </div>
    )
  }

  const maxWeakness = insights.topTroubleAreas.length > 0
    ? Math.max(...insights.topTroubleAreas.map((a) => a.score))
    : 1

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Insights</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Sessions</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">{insights.totalSessionCount}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Time</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">{insights.totalDurationMinutes} min</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Best WPM</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">{Math.round(insights.bestWpm)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Best Accuracy</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">{Math.round(insights.bestAccuracy * 100)}%</div>
        </div>
      </div>

      {/* WPM trend */}
      {insights.wpmTrend.length >= 2 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs font-medium text-zinc-400">WPM — last {insights.wpmTrend.length} sessions</div>
          <div className="mt-3">
            <Sparkline values={insights.wpmTrend} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
            <span>{Math.round(insights.wpmTrend[0])} WPM</span>
            <span>{Math.round(insights.wpmTrend[insights.wpmTrend.length - 1])} WPM</span>
          </div>
        </section>
      ) : null}

      {/* Accuracy trend */}
      {insights.accuracyTrend.length >= 2 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs font-medium text-zinc-400">Accuracy — last {insights.accuracyTrend.length} sessions</div>
          <div className="mt-3">
            <Sparkline
              values={insights.accuracyTrend}
              colorFn={(v) => (v >= 0.95 ? '#4ade80' : '#a1a1aa')}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
            <span>{Math.round(insights.accuracyTrend[0] * 100)}%</span>
            <span>{Math.round(insights.accuracyTrend[insights.accuracyTrend.length - 1] * 100)}%</span>
          </div>
        </section>
      ) : null}

      {/* Trouble areas */}
      {insights.topTroubleAreas.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs font-medium text-zinc-400">Top trouble areas</div>
          <div className="mt-3 space-y-3">
            {insights.topTroubleAreas.map((area) => (
              <div key={area.tag}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{area.label}</span>
                  <span className="text-xs text-zinc-500">{Math.round(area.score * 100)}%</span>
                </div>
                <div className="mt-1">
                  <WeaknessBar score={area.score} maxScore={maxWeakness} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Most improved */}
      {insights.mostImproved ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-xs font-medium text-zinc-400">Most improved</div>
          <div className="mt-2 text-sm text-zinc-200">{insights.mostImproved.label}</div>
          <div className="mt-1 text-xs text-zinc-400">
            Error rate dropped significantly in this area.
          </div>
        </section>
      ) : null}

      <Link to="/" className="inline-block text-sm text-zinc-400 hover:text-zinc-200">
        Back to home
      </Link>
    </div>
  )
}
