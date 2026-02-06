import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import {
  loadRuns,
  loadSkillModel,
  modeLabel,
  modeToPath,
  pickQuickstartExercise,
  preferredQuickstartMode,
  saveLastMode,
} from '@lib'
import { Icon, type IconName } from '@app/components/Icon'

const MODES: Mode[] = ['focus', 'real_life', 'competitive']

const MODE_META: Record<Mode, { description: string; icon: IconName }> = {
  focus: { description: 'Calm practice, minimal HUD.', icon: 'mode-focus' },
  real_life: { description: 'Emails, texts, and real-world scenarios.', icon: 'mode-real-life' },
  competitive: { description: 'Timed sprints, PBs, and leaderboard.', icon: 'mode-competitive' },
}

const STAT_ICONS: IconName[] = ['stat-speed', 'stat-accuracy', 'stat-sessions', 'stat-days']

function computeDaysPracticed(runs: ReturnType<typeof loadRuns>) {
  const days = new Set<string>()
  for (const r of runs) {
    const d = new Date(r.timestamp * 1000).toISOString().slice(0, 10)
    days.add(d)
  }
  return days.size
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: IconName }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-center">
      <Icon name={icon} size={18} className="mx-auto text-zinc-500" />
      <div className="mt-1.5 text-lg font-semibold tabular-nums text-zinc-50">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-zinc-500">{label}</div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState<Mode>(preferredQuickstartMode)

  const skill = useMemo(() => loadSkillModel(), [])
  const daysPracticed = useMemo(() => computeDaysPracticed(loadRuns()), [])
  const hasHistory = skill.total_runs > 0

  function handleStart() {
    saveLastMode(selectedMode)
    const ex = pickQuickstartExercise(selectedMode)
    const qs = new URLSearchParams({ variant: 'short' })
    if (selectedMode === 'competitive') qs.set('duration', 'auto')
    navigate(`/${modeToPath(selectedMode)}/run/${ex.id}?${qs.toString()}`)
  }

  function cycleMode() {
    setSelectedMode((prev) => {
      const idx = MODES.indexOf(prev)
      return MODES[(idx + 1) % MODES.length]
    })
  }

  return (
    <div className="space-y-6">
      {/* Hero + CTA */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-10 text-center sm:py-14">
        <p className="text-sm font-medium text-zinc-400">Calm practice. Real progress.</p>
        <button
          type="button"
          onClick={handleStart}
          className="mt-6 inline-flex items-center gap-2.5 rounded-lg bg-zinc-50 px-8 py-3 text-base font-semibold text-zinc-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Icon name="play" size={18} className="text-zinc-700" />
          Start typing
        </button>
        <div className="mt-4 text-xs text-zinc-500">
          Starting in{' '}
          <span className="font-medium text-zinc-300">{modeLabel(selectedMode)}</span>
          {' · '}
          <button
            type="button"
            onClick={cycleMode}
            className="text-zinc-400 underline underline-offset-2 transition hover:text-zinc-200"
          >
            change
          </button>
        </div>
      </section>

      {/* Stats Row */}
      {hasHistory ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={`${Math.round(skill.ema.wpm)}`} label="Avg WPM" icon={STAT_ICONS[0]} />
          <StatCard value={`${Math.round(skill.ema.accuracy * 100)}%`} label="Accuracy" icon={STAT_ICONS[1]} />
          <StatCard value={`${skill.total_runs}`} label="Sessions" icon={STAT_ICONS[2]} />
          <StatCard value={`${daysPracticed}`} label="Days practiced" icon={STAT_ICONS[3]} />
        </section>
      ) : (
        <p className="text-center text-sm text-zinc-500">
          Pick a mode below and start your first session.
        </p>
      )}

      {/* Mode Quick-Links */}
      <section className="grid gap-3 sm:grid-cols-3">
        {MODES.map((mode) => {
          const meta = MODE_META[mode]
          return (
            <Link
              key={mode}
              to={`/${modeToPath(mode)}`}
              className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Icon name={meta.icon} size={20} className="mt-0.5 shrink-0 text-zinc-500" />
              <div>
                <div className="text-sm font-semibold text-zinc-50">
                  {modeLabel(mode)}
                  {mode === 'competitive' ? (
                    <span className="ml-1.5 text-[11px] font-medium text-zinc-500">(opt-in)</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-zinc-400">{meta.description}</div>
              </div>
            </Link>
          )
        })}
      </section>

      {/* Daily Set Teaser */}
      {hasHistory ? (
        <Link
          to="/daily"
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <div className="flex items-center gap-3">
            <Icon name="calendar" size={18} className="shrink-0 text-zinc-500" />
            <div>
              <div className="text-sm font-semibold text-zinc-50">Today's set</div>
              <div className="mt-0.5 text-xs text-zinc-500">A curated session, ready when you are.</div>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="shrink-0 text-zinc-600" />
        </Link>
      ) : null}
    </div>
  )
}
