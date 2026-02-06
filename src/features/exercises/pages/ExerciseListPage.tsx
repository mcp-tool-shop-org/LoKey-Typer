import { Link, useNavigate } from 'react-router-dom'
import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import { getPersonalBest, modeLabel, modeToPath } from '@lib'
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

function ExerciseRow({ mode, ex }: { mode: Mode; ex: Exercise }) {
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
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
      </div>
    </div>
  )
}

export function ExerciseListPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const exercises = loadExercisesByMode(mode)
  const grouped = groupByPack(exercises)
  const label = modeLabel(mode)

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
        {grouped.map(([pack, list]) => (
          <section key={pack} className="space-y-3">
            <div className="text-xs font-medium text-zinc-400">{pack}</div>
            <div className="space-y-3">
              {list.map((ex) => (
                <ExerciseRow key={ex.id} mode={mode} ex={ex} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
