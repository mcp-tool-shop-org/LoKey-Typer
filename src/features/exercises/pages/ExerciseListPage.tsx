import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import {
  getPackRule,
  getPackUnlockStatus,
  getPersonalBest,
  loadCompetitiveAsync,
  loadSkillTreeAsync,
  loadStatsAsync,
  modeLabel,
  modeToPath,
  type CompetitiveState,
  type PackUnlockStatus,
  type SkillTreeState,
  type StatsAggregate,
} from '@lib'
import { usePreferences } from '@app'

function groupByPack(exercises: Exercise[]) {
  const map = new Map<string, Exercise[]>()
  for (const e of exercises) {
    const arr = map.get(e.pack) ?? []
    arr.push(e)
    map.set(e.pack, arr)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function ExerciseRow({ mode, ex, locked }: { mode: Mode; ex: Exercise; locked: boolean }) {
  const modePath = modeToPath(mode)
  const { prefs } = usePreferences()
  const pb = mode === 'competitive' ? getPersonalBest(ex.id, prefs.competitiveSprintDurationMs) : null

  const base = `/${modePath}/run/${ex.id}`

  const mk = (variant: 'short' | 'long') => {
    const qs = new URLSearchParams({ variant })
    if (mode === 'competitive') {
      qs.set('duration', String(prefs.competitiveSprintDurationMs))
      if (prefs.competitiveGhostEnabled) qs.set('ghost', '1')
    }
    return `${base}?${qs.toString()}`
  }

  return (
    <div className={[
      'rounded-xl border border-zinc-800 bg-zinc-950 p-4',
      locked ? 'opacity-50' : '',
    ].join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-50">{ex.title}</div>
          <div className="mt-1 text-xs text-zinc-400">
            Difficulty {ex.difficulty} • Est. {ex.estimated_seconds}s • {ex.tags.join(', ')}
          </div>
          {pb ? (
            <div className="mt-2 text-xs text-zinc-400">
              PB ({prefs.competitiveSprintDurationMs / 1000}s):{' '}
              <span className="text-zinc-200">{Math.round(pb.wpm)} WPM</span> @{' '}
              <span className="text-zinc-200">{Math.round(pb.accuracy * 1000) / 10}%</span>
            </div>
          ) : null}
        </div>

        {locked ? (
          <div className="text-xs text-zinc-500">Locked</div>
        ) : (
          <div className="flex gap-2">
            <Link
              to={mk('short')}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              Start (short)
            </Link>
            <Link
              to={mk('long')}
              className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
            >
              Start (long)
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function PackHeader({ pack, status }: { pack: string; status: PackUnlockStatus | null }) {
  const locked = status != null && !status.unlocked
  return (
    <div className="flex items-center gap-2">
      <div className={[
        'text-xs font-medium',
        locked ? 'text-zinc-600' : 'text-zinc-400',
      ].join(' ')}>
        {pack}
      </div>
      {locked ? (
        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
          {status.reason}
        </span>
      ) : null}
    </div>
  )
}

export function ExerciseListPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const exercises = loadExercisesByMode(mode)
  const grouped = groupByPack(exercises)
  const label = modeLabel(mode)

  const [stats, setStats] = useState<StatsAggregate | null>(null)
  const [skillTree, setSkillTree] = useState<SkillTreeState | null>(null)
  const [competitive, setCompetitive] = useState<CompetitiveState | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, t, c] = await Promise.all([
          loadStatsAsync(),
          loadSkillTreeAsync(),
          loadCompetitiveAsync(),
        ])
        if (cancelled) return
        setStats(s)
        setSkillTree(t)
        setCompetitive(c)
        setLoaded(true)
      } catch {
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function getStatus(pack: string): PackUnlockStatus | null {
    if (!loaded) return null
    const rule = getPackRule(pack)
    return getPackUnlockStatus(rule, stats, skillTree, competitive)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{label} exercises</h1>
          <p className="mt-1 text-sm text-zinc-400">Curated content packs (static JSON).</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Back
        </button>
      </div>

      <div className="space-y-6">
        {grouped.map(([pack, list]) => {
          const status = getStatus(pack)
          const locked = status != null && !status.unlocked
          return (
            <section key={pack} className="space-y-3">
              <PackHeader pack={pack} status={status} />
              <div className="space-y-3">
                {list.map((ex) => (
                  <ExerciseRow key={ex.id} mode={mode} ex={ex} locked={locked} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
