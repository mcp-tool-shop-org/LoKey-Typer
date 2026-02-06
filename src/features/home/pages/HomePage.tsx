import { Link, useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import { modeLabel, modeToPath, pickQuickstartExercise, preferredQuickstartMode, saveLastMode } from '@lib'

function ModeCard({ mode, description }: { mode: Mode; description: string }) {
  const navigate = useNavigate()
  const label = modeLabel(mode)
  const path = modeToPath(mode)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-base font-semibold tracking-tight text-zinc-50">
        {label}
        {mode === 'competitive' ? (
          <span className="ml-2 text-xs font-medium text-zinc-400">(opt-in)</span>
        ) : null}
      </div>
      <div className="mt-2 text-sm text-zinc-400">{description}</div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            saveLastMode(mode)
            const ex = pickQuickstartExercise(mode)
            const qs = new URLSearchParams({ variant: 'short' })
            if (mode === 'competitive') qs.set('duration', 'auto')
            navigate(`/${path}/run/${ex.id}?${qs.toString()}`)
          }}
          className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
        >
          Next session
        </button>
        <Link
          to={`/${path}/exercises`}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Choose exercise
        </Link>
        <Link
          to={`/${path}/settings`}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Settings
        </Link>
      </div>
    </div>
  )
}

export function HomePage() {
  const preferred = preferredQuickstartMode()

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Calm by default. Competitive on purpose.
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300 sm:text-base">
            Choose a mode and train with low noise: clean typography, gentle feedback, and local-only
            progress. Competitive mode is explicit opt-in and shows more data.
          </p>

          <div className="mt-4 text-xs text-zinc-400">
            Quickstart will prefer your last used mode:{' '}
            <span className="text-zinc-200">{modeLabel(preferred)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ModeCard mode="focus" description="Calm practice. Minimal HUD by default." />
        <ModeCard mode="real_life" description="Emails, texts, support replies, and journaling." />
        <ModeCard mode="competitive" description="Timed sprints, PBs, and a simple local leaderboard." />
      </section>
    </div>
  )
}
