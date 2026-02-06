import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  checkGoalCompletion,
  generateDailyGoal,
  intentDescription,
  intentLabel,
  loadGoalsAsync,
  loadStatsAsync,
  loadStreakAsync,
  saveGoalsAsync,
  suggestWeeklyIntent,
  type GoalsState,
  type WeeklyIntent,
} from '@lib'

const ALL_INTENTS: WeeklyIntent[] = ['build_habit', 'push_speed', 'fix_accuracy', 'explore']

export function GoalsPage() {
  const [goals, setGoals] = useState<GoalsState | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, stats, streak] = await Promise.all([
          loadGoalsAsync(),
          loadStatsAsync(),
          loadStreakAsync(),
        ])
        if (cancelled) return

        // Auto-suggest intent if none set
        if (!g.intentSetAt) {
          g.weeklyIntent = suggestWeeklyIntent(stats, streak, null)
          g.intentSetAt = new Date().toISOString().slice(0, 10)
          saveGoalsAsync(g).catch(() => {})
        }
        setGoals(g)
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!goals) return null

  const goal = generateDailyGoal(goals.weeklyIntent, new Date().getDay(), null)
  const todayAvgAcc = goals.todaySessions > 0 ? goals.todayAccuracySum / goals.todaySessions : 0
  const completed = checkGoalCompletion(goal, goals.todaySessions, goals.todayMinutesMs, todayAvgAcc)
  const sessionProgress = Math.min(1, goals.todaySessions / goal.targetSessions)
  const minuteProgress = Math.min(1, (goals.todayMinutesMs / 60_000) / goal.targetMinutes)
  const overallProgress = Math.min(1, (sessionProgress + minuteProgress) / 2)

  async function changeIntent(intent: WeeklyIntent) {
    const next = { ...goals!, weeklyIntent: intent, intentSetAt: new Date().toISOString().slice(0, 10) }
    setGoals(next)
    await saveGoalsAsync(next).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Goals</h1>
          <p className="mt-1 text-sm text-zinc-400">Weekly intent and daily targets.</p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>

      {/* Weekly intent */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-xs font-medium text-zinc-400">This week's intent</div>
        <div className="mt-2 text-lg font-semibold text-zinc-50">{intentLabel(goals.weeklyIntent)}</div>
        <div className="mt-1 text-sm text-zinc-400">{intentDescription(goals.weeklyIntent)}</div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_INTENTS.map((intent) => (
            <button
              key={intent}
              type="button"
              onClick={() => changeIntent(intent)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium',
                intent === goals.weeklyIntent
                  ? 'bg-zinc-50 text-zinc-950'
                  : 'border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900',
              ].join(' ')}
            >
              {intentLabel(intent)}
            </button>
          ))}
        </div>
      </section>

      {/* Today's goal */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">Today's goal</div>
          {completed ? (
            <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[11px] font-medium text-green-400">
              Complete
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] text-zinc-400">Sessions</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
              {goals.todaySessions}/{goal.targetSessions}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] text-zinc-400">Minutes</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
              {Math.round(goals.todayMinutesMs / 60_000)}/{goal.targetMinutes}
            </div>
          </div>
          {goal.accuracyFloor != null ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-[11px] text-zinc-400">Accuracy floor</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
                {goals.todaySessions > 0 ? `${Math.round(todayAvgAcc * 100)}%` : '—'} / {Math.round(goal.accuracyFloor * 100)}%
              </div>
            </div>
          ) : null}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-400 transition-all duration-300"
              style={{ width: `${Math.round(overallProgress * 100)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Week history */}
      {goals.weekHistory.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-xs font-medium text-zinc-400">Recent days</div>
          <div className="mt-3 flex gap-2">
            {goals.weekHistory.map((day, i) => (
              <div key={day.date ?? i} className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                    day.completed
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-zinc-800 text-zinc-500',
                  ].join(' ')}
                >
                  {day.completed ? '\u2713' : '\u2014'}
                </div>
                <div className="text-[10px] text-zinc-500">{day.date.slice(5)}</div>
              </div>
            ))}
          </div>
          {goals.goalStreak > 0 ? (
            <div className="mt-3 text-xs text-zinc-400">
              Goal streak: <span className="text-zinc-200">{goals.goalStreak} days</span>
              {goals.bestGoalStreak > goals.goalStreak ? (
                <span className="ml-2 text-zinc-500">(best: {goals.bestGoalStreak})</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
