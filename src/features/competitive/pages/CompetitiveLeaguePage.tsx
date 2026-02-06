import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadCompetitiveAsync, saveCompetitiveAsync, type CompetitiveState, type RuleSet } from '@lib'
import { ALL_RULE_SETS, describeRuleSet, leagueLabel, nextLeagueThreshold } from '@lib-internal/competitiveEngine'

export function CompetitiveLeaguePage() {
  const [state, setState] = useState<CompetitiveState | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await loadCompetitiveAsync()
        if (!cancelled) setState(s)
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!state) return null

  const nextThreshold = nextLeagueThreshold(state.currentLeague)
  const progressToNext = nextThreshold
    ? Math.max(0, Math.min(1, (state.rating - (state.currentLeague === 'bronze' ? 0 : state.currentLeague === 'silver' ? 1200 : 1800)) / (nextThreshold - (state.currentLeague === 'bronze' ? 0 : state.currentLeague === 'silver' ? 1200 : 1800))))
    : 1

  const avgDelta = state.recentDeltas.length > 0
    ? state.recentDeltas.reduce((a, b) => a + b, 0) / state.recentDeltas.length
    : 0
  const trendArrow = avgDelta > 1 ? '\u2191' : avgDelta < -1 ? '\u2193' : '\u2192'

  async function changeRuleSet(ruleSet: RuleSet) {
    const next = { ...state!, activeRuleSet: ruleSet }
    setState(next)
    await saveCompetitiveAsync(next).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">League</h1>
          <p className="mt-1 text-sm text-zinc-400">Your competitive standing.</p>
        </div>
        <Link
          to="/competitive"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Back
        </Link>
      </div>

      {/* League badge + rating */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-4">
          <div className={[
            'flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold',
            state.currentLeague === 'gold' ? 'bg-yellow-900/40 text-yellow-400' :
            state.currentLeague === 'silver' ? 'bg-zinc-700/40 text-zinc-300' :
            'bg-orange-900/40 text-orange-400',
          ].join(' ')}>
            {leagueLabel(state.currentLeague)[0]}
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-50">
              {leagueLabel(state.currentLeague)} League
            </div>
            <div className="text-sm tabular-nums text-zinc-400">
              Rating: <span className="text-zinc-200">{Math.round(state.rating)}</span>
              <span className="ml-2">{trendArrow}</span>
            </div>
          </div>
        </div>

        {nextThreshold ? (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>{leagueLabel(state.currentLeague)}</span>
              <span>{nextThreshold} to promote</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-400 transition-all duration-300"
                style={{ width: `${Math.round(progressToNext * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-zinc-400">Top league reached.</div>
        )}

        <div className="mt-3 text-xs text-zinc-500">
          {state.totalRatedRuns} rated run{state.totalRatedRuns !== 1 ? 's' : ''}
        </div>
      </section>

      {/* Rule set selector */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-xs font-medium text-zinc-400">Active rule set</div>
        <div className="mt-3 space-y-2">
          {ALL_RULE_SETS.map((rs) => {
            const config = describeRuleSet(rs)
            const active = rs === state.activeRuleSet
            return (
              <button
                key={rs}
                type="button"
                onClick={() => changeRuleSet(rs)}
                className={[
                  'w-full rounded-xl border p-3 text-left',
                  active ? 'border-zinc-600 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-zinc-50">{config.name}</div>
                  {active ? (
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-300">Active</span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{config.description}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Recent deltas */}
      {state.recentDeltas.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-xs font-medium text-zinc-400">Recent rating changes</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.recentDeltas.map((d, i) => (
              <span
                key={i}
                className={[
                  'rounded-md px-2 py-1 text-xs font-medium tabular-nums',
                  d > 0 ? 'bg-green-900/30 text-green-400' :
                  d < 0 ? 'bg-red-900/30 text-red-400' :
                  'bg-zinc-800 text-zinc-500',
                ].join(' ')}
              >
                {d > 0 ? '+' : ''}{Math.round(d)}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
