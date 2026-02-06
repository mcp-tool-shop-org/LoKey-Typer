import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { findExercise } from '@content'
import { loadSkillModel, loadStatsAsync, loadStreakAsync, modeLabel, modeToPath, preferredQuickstartMode, type StatsAggregate, type StreakData, type UserSkillModel } from '@lib'
import { planNextSessions, type SessionPlan } from '@lib-internal/rotationEngine'

function PriorityBadge({ priority }: { priority: SessionPlan['priority'] }) {
  const colors = {
    high: 'border-amber-700 text-amber-400',
    medium: 'border-zinc-600 text-zinc-300',
    low: 'border-zinc-700 text-zinc-400',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[priority]}`}>
      {priority}
    </span>
  )
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-zinc-400' : 'bg-zinc-700'}`}
        />
      ))}
    </span>
  )
}

function PlanCard({ plan, mode }: { plan: SessionPlan; mode: string }) {
  const navigate = useNavigate()
  const exercise = findExercise(plan.exerciseId)
  if (!exercise) return null

  const path = modeToPath(exercise.mode)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-50">{exercise.title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span>{exercise.pack}</span>
            <span>·</span>
            <DifficultyDots level={exercise.difficulty} />
            <span>·</span>
            <span>{Math.ceil(exercise.estimated_seconds / 60)} min</span>
          </div>
        </div>
        <PriorityBadge priority={plan.priority} />
      </div>

      <ul className="mt-3 space-y-1">
        {plan.reasons.map((reason, i) => (
          <li key={i} className="text-xs leading-5 text-zinc-400">
            <span className="mr-1.5 text-zinc-500">—</span>
            {reason}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            const qs = new URLSearchParams({ variant: 'short' })
            navigate(`/${path}/run/${exercise.id}?${qs.toString()}`)
          }}
          className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
        >
          Start
        </button>
        <Link
          to={`/${path}/exercises`}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Browse pack
        </Link>
      </div>
    </div>
  )
}

export function PlanPage() {
  const mode = preferredQuickstartMode()
  const [plans, setPlans] = useState<SessionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const skill = loadSkillModel()
        const [stats, streak] = await Promise.all([
          loadStatsAsync(),
          loadStreakAsync(),
        ])

        if (cancelled) return

        const result = planNextSessions({
          skill,
          stats: stats as StatsAggregate,
          streak: streak as StreakData,
          mode,
          count: 3,
          seed: refreshKey > 0 ? `plan|${mode}|${refreshKey}|${Date.now()}` : undefined,
        })

        setPlans(result)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [mode, refreshKey])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Session Plan</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Suggested sessions for <span className="text-zinc-200">{modeLabel(mode)}</span> mode, based on your recent practice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setRefreshKey((k) => k + 1)
          }}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Planning...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
          No exercises available right now. Try a different mode or come back later.
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard key={plan.exerciseId} plan={plan} mode={mode} />
          ))}
        </div>
      )}

      <Link
        to="/"
        className="inline-block text-sm text-zinc-400 hover:text-zinc-200"
      >
        Back to home
      </Link>
    </div>
  )
}
