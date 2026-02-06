import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { findExercise, type Mode } from '@content'
import {
  getOrCreateUserId,
  isTemplateExercise,
  modeToPath,
  renderTemplateExercise,
  topCompetitiveRuns,
  type SprintDurationMs,
} from '@lib'
import { usePreferences } from '@app'
import { Icon } from '@app/components/Icon'
import { TypingSession } from '@features/typing'

function repeatToLength(base: string, minLen: number) {
  let out = base
  while (out.length < minLen) out += `\n\n${base}`
  return out
}

export function RunPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const params = useParams<{ exerciseId: string }>()
  const [search] = useSearchParams()
  const { prefs } = usePreferences()

  const exerciseId = params.exerciseId ?? ''
  const exercise = findExercise(exerciseId)

  const variant = (search.get('variant') === 'long' ? 'long' : 'short') as 'short' | 'long'
  const ghost = mode === 'competitive' && prefs.competitiveGhostEnabled && search.get('ghost') !== '0'

  const sprintDurationMs = useMemo(() => {
    if (mode !== 'competitive') return undefined
    const raw = search.get('duration')
    if (raw === '30000') return 30_000
    if (raw === '60000') return 60_000
    if (raw === '120000') return 120_000
    return prefs.competitiveSprintDurationMs
  }, [mode, prefs.competitiveSprintDurationMs, search])

  const targetText = useMemo(() => {
    if (!exercise) return ''

    const userId = getOrCreateUserId()
    const dateKey = new Date().toISOString().slice(0, 10)

    const base = isTemplateExercise(exercise)
      ? renderTemplateExercise(exercise, { dateKey, seed: `${userId}|${exercise.id}|${dateKey}` })
      : variant === 'long'
        ? (exercise.text_long ?? exercise.text_short ?? exercise.text ?? '')
        : (exercise.text_short ?? exercise.text ?? exercise.text_long ?? '')

    if (mode === 'competitive') {
      // keep sprints going without running out of target text
      return repeatToLength(base, 1800)
    }
    return base
  }, [exercise, mode, variant])

  if (!exercise) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-sm font-semibold text-zinc-50">Exercise not found</div>
        <div className="mt-2 text-sm text-zinc-400">ID: {exerciseId}</div>
      </div>
    )
  }

  const showCompetitiveHud = mode === 'competitive'

  return (
    <div className="space-y-6">
      {mode === 'competitive' ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon name="timer" size={15} className="shrink-0 text-zinc-400" />
              Sprint: <span className="text-zinc-50">{(sprintDurationMs ?? 60_000) / 1000}s</span>
              {ghost ? (
                <span className="ml-1 flex items-center gap-1 text-zinc-400">
                  <Icon name="ghost" size={14} className="shrink-0" /> Ghost comparison
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/${modeToPath(mode)}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              <Icon name="arrow-left" size={14} className="shrink-0" />
              Mode
            </button>
          </div>
          <div className="mt-3 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Icon name="trophy" size={13} className="shrink-0 text-zinc-500" />
              Leaderboard (local) — top WPM for this duration:
            </div>
            <div className="mt-2 grid gap-1">
              {topCompetitiveRuns({ durationMs: sprintDurationMs ?? 60_000, limit: 3 }).map((r, i) => {
                const medalIcon = i === 0 ? 'medal-gold' as const : i === 1 ? 'medal-silver' as const : 'medal-bronze' as const
                return (
                  <div key={`${r.timestamp}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Icon name={medalIcon} size={14} className="shrink-0" />
                      #{i + 1}
                    </div>
                    <div className="text-zinc-200">{Math.round(r.wpm)} WPM</div>
                    <div className="text-zinc-500">{Math.round(r.accuracy * 1000) / 10}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <TypingSession
        mode={mode}
        exercise={exercise}
        targetText={targetText}
        prefs={prefs}
        sprintDurationMs={mode === 'competitive' ? (sprintDurationMs as SprintDurationMs) : undefined}
        showCompetitiveHud={showCompetitiveHud}
        ghostEnabled={ghost}
        onExit={() => navigate(`/${modeToPath(mode)}`)}
        onRestart={() => navigate(0)}
      />
    </div>
  )
}
