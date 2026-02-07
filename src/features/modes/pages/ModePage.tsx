import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Mode } from '@content'
import {
  getOrCreateUserId,
  getPoolStatus,
  loadSkillModel,
  pickNextExercise,
  saveLastMode,
  topCompetitiveRuns,
  type ContentEngineResult,
  type SprintDurationMs,
} from '@lib'
import { usePreferences } from '@app'
import { Icon } from '@app/components/Icon'
import { TypingSession } from '@features/typing'

export function ModePage({ mode }: { mode: Mode }) {
  const [search, setSearch] = useSearchParams()
  const { prefs, setPrefs } = usePreferences()
  const userId = useMemo(() => getOrCreateUserId(), [])

  // Session state
  const [session, setSession] = useState<ContentEngineResult | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [startError, setStartError] = useState<string | null>(null)
  // Tracks the autostart value we last handled (to detect re-navigation to same route).
  const handledAutostart = useRef<string | null>(null)

  // Pool status (recomputed when session changes)
  const pool = useMemo(() => getPoolStatus(mode), [mode, sessionKey])

  // Competitive sprint config (inline on this page)
  const sprintDurationMs = prefs.competitiveSprintDurationMs
  const ghostEnabled = prefs.competitiveGhostEnabled

  const startSession = useCallback(() => {
    try {
      setStartError(null)
      const skill = loadSkillModel()
      const result = pickNextExercise({ mode, userId, skill, prefs })
      saveLastMode(mode)
      setSession(result)
      setSessionKey((k) => k + 1)
    } catch (err) {
      console.error('[ModePage] startSession failed:', err)
      setStartError('Couldn\u2019t load an exercise. Try refreshing the page.')
    }
  }, [mode, userId, prefs])

  // Handle ?autostart=<timestamp> from HomePage.
  // HomePage sends a unique timestamp each click, so we can detect re-navigation.
  useEffect(() => {
    const ts = search.get('autostart')
    if (!ts) return
    if (ts === handledAutostart.current) return
    handledAutostart.current = ts
    // Remove autostart param from URL without a full navigation.
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('autostart')
      return next
    }, { replace: true })
    startSession()
  }, [search, setSearch, startSession])

  function handleExit() {
    setSession(null)
  }

  function handleRestart() {
    startSession()
  }

  // If running, show TypingSession inline
  if (session) {
    const showCompetitiveHud = mode === 'competitive'

    return (
      <div className="mx-auto max-w-3xl space-y-10">
        <TypingSession
          key={`${session.exercise.id}-${sessionKey}`}
          mode={mode}
          exercise={session.exercise}
          targetText={session.renderedText}
          prefs={prefs}
          sprintDurationMs={mode === 'competitive' ? (sprintDurationMs as SprintDurationMs) : undefined}
          showCompetitiveHud={showCompetitiveHud}
          ghostEnabled={mode === 'competitive' ? ghostEnabled : false}
          onExit={handleExit}
          onRestart={handleRestart}
        />

        {/* "Next" button below the typing session */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Icon name="play" size={16} className="shrink-0 text-zinc-400" />
            Next exercise
          </button>
        </div>
      </div>
    )
  }

  // Idle state — show Go button
  const top3 = mode === 'competitive' ? topCompetitiveRuns({ durationMs: sprintDurationMs, limit: 3 }) : []

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* CTA — same position as every other tab */}
      <div className="text-center">
        <button
          type="button"
          onClick={startSession}
          className="inline-flex items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800 px-10 py-3.5 text-base font-semibold text-zinc-300 transition hover:bg-zinc-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Icon name="play" size={20} className="text-zinc-400" />
          Start typing
        </button>
        <div className="mt-4 text-xs text-zinc-500">
          {pool.remaining > 0
            ? `${pool.remaining} of ${pool.total} exercises remaining`
            : `Pool cycled — ${pool.total} exercises, fresh variants`}
        </div>
      </div>

      {/* Error banner */}
      {startError ? (
        <div className="flex items-center gap-3 rounded-xl border border-rose-900/50 bg-rose-950/30 px-5 py-4 text-sm text-rose-400">
          <Icon name="info" size={16} className="shrink-0" />
          {startError}
        </div>
      ) : null}

      {/* Competitive: inline sprint config */}
      {mode === 'competitive' ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
                <Icon name="timer" size={14} className="shrink-0 text-zinc-500" />
                Sprint duration
              </div>
              <div className="mt-2 flex gap-2">
                {([30_000, 60_000, 120_000] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPrefs({ ...prefs, competitiveSprintDurationMs: d as SprintDurationMs })}
                    className={
                      'min-h-10 rounded-md border px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
                      (sprintDurationMs === d
                        ? 'border-zinc-600 bg-zinc-900 text-zinc-50'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900')
                    }
                  >
                    {d / 1000}s
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900">
              <input
                type="checkbox"
                checked={ghostEnabled}
                onChange={(e) => setPrefs({ ...prefs, competitiveGhostEnabled: e.target.checked })}
                className="accent-zinc-400"
              />
              <Icon name="ghost" size={14} className="shrink-0 text-zinc-500" />
              Ghost comparison (PB)
            </label>

            <div className="w-48 text-xs text-zinc-400">
              <div className="flex items-center justify-center gap-1.5">
                <Icon name="trophy" size={14} className="shrink-0 text-zinc-500" />
                Top runs ({sprintDurationMs / 1000}s)
              </div>
              {top3.length > 0 ? (
                <div className="mt-2 grid gap-1">
                  {top3.map((r, i) => {
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
              ) : (
                <div className="mt-2 text-center text-zinc-600">
                  No runs yet — complete a sprint to set a record.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
