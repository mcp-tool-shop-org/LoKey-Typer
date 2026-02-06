import { Link, useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import { modeLabel, modeToPath, pickQuickstartExercise, saveLastMode } from '@lib'

export function ModeHubPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const label = modeLabel(mode)
  const modePath = modeToPath(mode)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{label} Mode</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {mode === 'focus'
            ? 'Calm practice by default. Low noise, clean rhythm.'
            : mode === 'real_life'
              ? 'Real-world writing: emails, texts, support replies, and journaling.'
              : 'Opt-in competitive runs: timers, PBs, and deltas (local only).'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            saveLastMode(mode)
            const ex = pickQuickstartExercise(mode)
            const qs = new URLSearchParams({ variant: 'short' })
            if (mode === 'competitive') qs.set('duration', 'auto')
            navigate(`/${modePath}/run/${ex.id}?${qs.toString()}`)
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="text-sm font-semibold text-zinc-50">Start</div>
          <div className="mt-1 text-sm text-zinc-400">Quickstart using rotation rules.</div>
        </button>

        <Link
          to={`/${modePath}/exercises`}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="text-sm font-semibold text-zinc-50">Choose exercise</div>
          <div className="mt-1 text-sm text-zinc-400">Browse curated packs.</div>
        </Link>

        <Link
          to={`/${modePath}/settings`}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="text-sm font-semibold text-zinc-50">Settings</div>
          <div className="mt-1 text-sm text-zinc-400">Minimal, mode-aware controls.</div>
        </Link>
      </div>

      {mode === 'competitive' ? (
        <>
          <Link
            to="/competitive/league"
            className="block rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <div className="text-sm font-semibold text-zinc-50">League</div>
            <div className="mt-1 text-sm text-zinc-400">Rating, league standing, and rule sets.</div>
          </Link>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Competitive mode is explicit opt-in and shows more data (timer, live WPM, deltas). All records
            are stored locally.
          </div>
        </>
      ) : null}
    </div>
  )
}
