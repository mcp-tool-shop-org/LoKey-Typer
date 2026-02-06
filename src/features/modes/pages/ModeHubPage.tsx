import { Link, useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import { modeLabel, modeToPath, pickQuickstartExercise, saveLastMode } from '@lib'
import { Icon, type IconName } from '@app/components/Icon'

const MODE_ICON: Record<Mode, IconName> = {
  focus: 'mode-focus',
  real_life: 'mode-real-life',
  competitive: 'mode-competitive',
}

export function ModeHubPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const label = modeLabel(mode)
  const modePath = modeToPath(mode)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Icon name={MODE_ICON[mode]} size={20} className="shrink-0 text-zinc-400" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{label} Mode</h1>
        </div>
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
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Icon name="play" size={16} className="shrink-0 text-zinc-400" />
            Start
          </div>
          <div className="mt-1 text-sm text-zinc-400">Quickstart using rotation rules.</div>
        </button>

        <Link
          to={`/${modePath}/exercises`}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Icon name="list" size={16} className="shrink-0 text-zinc-400" />
            Choose exercise
          </div>
          <div className="mt-1 text-sm text-zinc-400">Browse curated packs.</div>
        </Link>

        <Link
          to={`/${modePath}/settings`}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Icon name="settings" size={16} className="shrink-0 text-zinc-400" />
            Settings
          </div>
          <div className="mt-1 text-sm text-zinc-400">Minimal, mode-aware controls.</div>
        </Link>
      </div>

      {mode === 'competitive' ? (
        <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-zinc-500" />
          <div>Competitive mode is explicit opt-in and shows more data (timer, live WPM, deltas). All records
          are stored locally.</div>
        </div>
      ) : null}
    </div>
  )
}
