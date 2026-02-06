import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise, Mode } from '@content'
import {
  appendRun,
  appendRunAsync,
  applyRatingDelta,
  applyXp,
  assessRunValidity,
  bestAccuracyForExercise,
  bestWpmForExercise,
  buildFeedback,
  computeLiveMetrics,
  computeRatingDelta,
  computeXpFromRun,
  getPersonalBest,
  getRestartCount,
  loadCompetitiveAsync,
  loadGoalsAsync,
  loadSkillModel,
  loadSkillTreeAsync,
  loadStatsAsync,
  loadStreakAsync,
  loadUnlocksAsync,
  loadSkillModelAsync,
  maybeUpdatePersonalBest,
  pushRecent,
  saveCompetitiveAsync,
  saveGoalsAsync,
  saveLastMode,
  saveSkillModel,
  saveSkillTreeAsync,
  saveStatsAsync,
  saveStreakAsync,
  saveUnlocksAsync,
  type Preferences,
  type SprintDurationMs,
  typewriterAudio,
  updateGoalsAfterRun,
  updateSkillModelFromRun,
  validityLabel,
  type RunValidity,
} from '@lib'
import { updateCompetitiveAfterRun } from '@lib-internal/competitiveEngine'
import { updateStatsFromRun, updateStreakFromRun } from '@lib-internal/statsEngine'
import { generateCoachMessage, type CoachMessage } from '@lib-internal/coach'
import { evaluateMilestones } from '@lib-internal/milestonesEngine'
import { evaluateTitles } from '@lib-internal/titlesEngine'
import { TypingOverlay } from './TypingOverlay'
import { CoachBanner } from './CoachBanner'
import { SessionReflection } from './SessionReflection'
import { ambientPlugin } from '../../plugins/ambientPlugin'

function fnv1a32Hex(input: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function computeTagsHit(params: { exercise: Exercise; targetText: string }): string[] {
  const tags = new Set<string>()

  const t = params.targetText
  if (t.includes('\n')) tags.add('multiline')
  if (/[0-9]/.test(t)) tags.add('numbers')
  if (/[.,;:?!]/.test(t)) tags.add('punctuation')
  if (/["“”]/.test(t)) tags.add('quotes')
  if (/[’']/.test(t)) tags.add('apostrophe')
  if (/[-–—]/.test(t)) tags.add('dashes')
  if (
    t.includes('(') ||
    t.includes(')') ||
    t.includes('[') ||
    t.includes(']') ||
    t.includes('{') ||
    t.includes('}') ||
    t.includes('<') ||
    t.includes('>')
  )
    tags.add('brackets')
  if (/[\\/]/.test(t)) tags.add('slashes')

  // Preserve any content-provided tags that match our tracked set.
  const tracked = new Set(['multiline', 'numbers', 'punctuation', 'quotes', 'apostrophe', 'dashes', 'brackets', 'slashes'])
  for (const exTag of params.exercise.tags ?? []) {
    if (tracked.has(exTag)) tags.add(exTag)
  }

  return Array.from(tags)
}

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-[11px] font-medium text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-50 tabular-nums">{value}</div>
    </div>
  )
}

export function TypingSession(props: {
  mode: Mode
  exercise: Exercise
  targetText: string
  prefs: Preferences
  ruleSet?: import('@lib').RuleSet
  sprintDurationMs?: SprintDurationMs
  showCompetitiveHud: boolean
  ghostEnabled?: boolean
  onExit: () => void
  onRestart: () => void
}) {
  const { targetText } = props
  const [typed, setTyped] = useState('')
  const [backspaces, setBackspaces] = useState(0)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)

  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null)
  const [runValidity, setRunValidity] = useState<RunValidity | null>(null)
  const [newUnlocks, setNewUnlocks] = useState<{ label: string }[]>([])
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const endOnceRef = useRef(false)

  // Load coach message on mount (before typing starts).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [stats, streak] = await Promise.all([loadStatsAsync(), loadStreakAsync()])
        if (cancelled) return
        setCoachMsg(generateCoachMessage(stats, streak, null))
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [])

  const timeLimitMs = props.sprintDurationMs

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = Date.now()
      setNowMs(n)

      if (timeLimitMs != null && startedAtMs != null && endedAtMs == null) {
        if (n - startedAtMs >= timeLimitMs) setEndedAtMs(startedAtMs + timeLimitMs)
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [timeLimitMs, startedAtMs, endedAtMs])

  const effectiveNowMs = endedAtMs ?? nowMs

  const elapsedMs = startedAtMs == null ? 0 : Math.max(0, effectiveNowMs - startedAtMs)
  const remainingMs =
    timeLimitMs == null
      ? null
      : startedAtMs == null
        ? timeLimitMs
        : Math.max(0, timeLimitMs - Math.max(0, effectiveNowMs - startedAtMs))

  const elapsedForMetrics = timeLimitMs == null ? elapsedMs : Math.min(elapsedMs, timeLimitMs)

  const live = useMemo(
    () => computeLiveMetrics({ target: targetText, typed, elapsedMs: elapsedForMetrics }),
    [targetText, typed, elapsedForMetrics],
  )

  const isComplete = endedAtMs != null

  // Phase 3: Ambient soundtrack system (mode-aware, accessible, fail-safe).
  useEffect(() => {
    // The app keeps ambient running globally. While a run is active we just
    // provide the engine with mode + remaining time so it can make safe evolution decisions.
    ambientEngine.update({
      mode: props.mode,
      prefs: props.prefs,
      sessionActive: true,
      sessionPaused: false,
      exerciseRemainingMs: isComplete ? null : remainingMs,
    })
  }, [isComplete, props.mode, props.prefs, remainingMs])

  useEffect(() => {
    if (!isComplete || endedAtMs == null) return
    if (endOnceRef.current) return
    endOnceRef.current = true

    const timestamp = Math.floor(endedAtMs / 1000)

    const run = {
      exercise_id: props.exercise.id,
      timestamp,
      mode: props.mode,
      rendered_text_hash: fnv1a32Hex(targetText),
      wpm: live.wpm,
      accuracy: live.accuracy,
      errors: live.errors,
      backspaces,
      duration_ms: timeLimitMs ?? Math.max(0, endedAtMs - (startedAtMs ?? endedAtMs)),
      tags_hit: computeTagsHit({ exercise: props.exercise, targetText }),
      sprint_duration_ms: timeLimitMs as SprintDurationMs | undefined,
    }

    appendRun(run)
    appendRunAsync(run).catch(() => {})
    pushRecent(props.mode, props.exercise.id)
    saveLastMode(props.mode)

    // Update aggregate stats + streak (fire-and-forget).
    ;(async () => {
      try {
        const [prevStats, prevStreak] = await Promise.all([loadStatsAsync(), loadStreakAsync()])
        const nextStats = updateStatsFromRun(prevStats, run)
        const nextStreak = updateStreakFromRun(prevStreak)
        await Promise.all([saveStatsAsync(nextStats), saveStreakAsync(nextStreak)])
      } catch {
        // silent
      }
    })()

    // Update daily goals (fire-and-forget).
    ;(async () => {
      try {
        const prevGoals = await loadGoalsAsync()
        const nextGoals = updateGoalsAfterRun(prevGoals, run)
        await saveGoalsAsync(nextGoals)
      } catch {
        // silent
      }
    })()

    // Phase 3: update local skill model (adaptive selection foundation).
    try {
      const prev = loadSkillModel()
      const next = updateSkillModelFromRun({
        prev,
        run,
        exercise: props.exercise,
        targetText,
        typedText: typed,
      })
      saveSkillModel(next)
    } catch {
      // ignore
    }

    // Update skill tree XP (fire-and-forget).
    ;(async () => {
      try {
        const xpGains = computeXpFromRun(run, props.exercise, targetText)
        const prevTree = await loadSkillTreeAsync()
        const nextTree = applyXp(prevTree, xpGains)
        await saveSkillTreeAsync(nextTree)
      } catch {
        // silent
      }
    })()

    // Rating + validity assessment (competitive mode)
    const ruleSet = props.ruleSet ?? 'standard'
    const validity = props.mode === 'competitive'
      ? assessRunValidity(run, getRestartCount(), ruleSet)
      : ('valid' as RunValidity)
    setRunValidity(validity)

    // PB update — only for valid runs in competitive mode
    if (validity === 'valid') {
      maybeUpdatePersonalBest({
        exerciseId: props.exercise.id,
        sprintDurationMs: timeLimitMs as SprintDurationMs | undefined,
        wpm: run.wpm,
        accuracy: run.accuracy,
        timestamp,
      })
    }

    // Rating update (competitive mode, fire-and-forget)
    if (props.mode === 'competitive') {
      ;(async () => {
        try {
          const prevComp = await loadCompetitiveAsync()
          const delta = computeRatingDelta(prevComp.rating, run, validity)
          const newRating = applyRatingDelta(prevComp.rating, delta)
          const nextComp = updateCompetitiveAfterRun(prevComp, newRating, delta)
          await saveCompetitiveAsync(nextComp)
        } catch {
          // silent
        }
      })()
    }

    // Milestone + title detection (fire-and-forget).
    ;(async () => {
      try {
        const [stats, streak, competitive, skillTree, unlocks, skill] = await Promise.all([
          loadStatsAsync(),
          loadStreakAsync(),
          loadCompetitiveAsync(),
          loadSkillTreeAsync(),
          loadUnlocksAsync(),
          loadSkillModelAsync(),
        ])

        const newMilestones = evaluateMilestones({
          stats,
          streak,
          competitive,
          skillTree,
          alreadyEarned: unlocks.achievements,
        })
        const newTitles = evaluateTitles({
          stats,
          streak,
          skill,
          skillTree,
          alreadyEarned: unlocks.titles,
        })

        if (newMilestones.length > 0 || newTitles.length > 0) {
          const updatedUnlocks = {
            ...unlocks,
            achievements: [...unlocks.achievements, ...newMilestones.map((m) => m.id)],
            titles: [...unlocks.titles, ...newTitles.map((t) => t.id)],
          }
          await saveUnlocksAsync(updatedUnlocks)

          const labels = [
            ...newMilestones.map((m) => ({ label: m.label })),
            ...newTitles.map((t) => ({ label: t.label })),
          ]
          setNewUnlocks(labels)

          // Auto-dismiss after 4s
          if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
          unlockTimerRef.current = setTimeout(() => setNewUnlocks([]), 4000)
        }
      } catch {
        // silent
      }
    })()

    if (props.prefs.bellOnCompletion) {
      typewriterAudio.play('return_bell', {
        enabled: props.prefs.soundEnabled,
        volume: props.prefs.volume,
        modeGain: props.mode === 'focus' ? 0.7 : props.mode === 'competitive' ? 1.0 : 0.85,
      })
    }
  }, [
    isComplete,
    endedAtMs,
    backspaces,
    live.accuracy,
    live.errors,
    live.wpm,
    props.exercise.id,
    props.exercise,
    props.mode,
    props.prefs.bellOnCompletion,
    props.prefs.soundEnabled,
    props.prefs.volume,
    startedAtMs,
    typed,
    targetText,
    timeLimitMs,
  ])

  const pb = useMemo(
    () => getPersonalBest(props.exercise.id, timeLimitMs as SprintDurationMs | undefined),
    [props.exercise.id, timeLimitMs],
  )

  const bestAccuracy = useMemo(
    () => bestAccuracyForExercise(props.exercise.id, timeLimitMs as SprintDurationMs | undefined),
    [props.exercise.id, timeLimitMs],
  )

  const bestWpm = useMemo(() => {
    if (props.mode === 'competitive') return pb?.wpm ?? null
    return bestWpmForExercise(props.exercise.id)
  }, [pb?.wpm, props.exercise.id, props.mode])

  const ghostCursorIndex = useMemo(() => {
    if (!props.ghostEnabled) return null
    if (props.mode !== 'competitive') return null
    if (!pb) return null
    if (startedAtMs == null) return null

    const elapsedMinutes = elapsedForMetrics / 60_000
    const expectedChars = Math.floor(pb.wpm * 5 * elapsedMinutes)
    return Math.max(0, Math.min(targetText.length, expectedChars))
  }, [elapsedForMetrics, pb, props.ghostEnabled, props.mode, startedAtMs, targetText.length])

  const feedback = useMemo(() => {
    const durationMs = timeLimitMs ?? elapsedMs

    const isPersonalBestWpm =
      (props.mode === 'competitive' ? live.accuracy >= 0.95 : true) &&
      (bestWpm == null || live.wpm > bestWpm)

    const isPersonalBestAccuracy = bestAccuracy == null || live.accuracy > bestAccuracy

    const deltaWpmVsBest = props.mode === 'competitive' && pb != null ? live.wpm - pb.wpm : 0
    const deltaAccuracyVsBest = bestAccuracy != null ? live.accuracy - bestAccuracy : 0

    return buildFeedback({
      mode: props.mode,
      wpm: live.wpm,
      accuracy: live.accuracy,
      errors: live.errors,
      backspaces,
      duration_ms: durationMs,
      is_personal_best_wpm: isPersonalBestWpm,
      is_personal_best_accuracy: isPersonalBestAccuracy,
      delta_wpm_vs_best: deltaWpmVsBest,
      delta_accuracy_vs_best: deltaAccuracyVsBest,
    })
  }, [
    backspaces,
    bestAccuracy,
    bestWpm,
    elapsedMs,
    live.accuracy,
    live.errors,
    live.wpm,
    pb,
    props.mode,
    timeLimitMs,
  ])

  const showLiveWpm = props.prefs.showLiveWpm[props.mode]
  const minimalHud = props.mode === 'focus' ? props.prefs.focusMinimalHud : false

  const containerStyle: CSSProperties = {
    fontSize: `${props.prefs.fontScale}rem`,
  }

  const helpTextId = `typing-help-${props.exercise.id}`

  return (
    <div className="space-y-6" style={containerStyle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-zinc-400">{props.exercise.pack}</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">{props.exercise.title}</h1>
          <div className="mt-1 text-sm text-zinc-400">
            Difficulty {props.exercise.difficulty} • Est. {props.exercise.estimated_seconds}s
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onRestart}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={props.onExit}
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Exit
          </button>
        </div>
      </div>

      {props.showCompetitiveHud ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Remaining" value={timeLimitMs ? formatMs(remainingMs ?? 0) : '—'} />
          <Stat label="WPM" value={`${Math.round(live.wpm)}`} />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} />
          <Stat label="Errors" value={`${live.errors}`} />
        </div>
      ) : minimalHud ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Time" value={formatMs(elapsedMs)} />
          <Stat label="Progress" value={`${typed.length}/${targetText.length}`} />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Time" value={formatMs(elapsedMs)} />
          <Stat label="WPM" value={showLiveWpm ? `${Math.round(live.wpm)}` : 'Hidden'} />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} />
          <Stat label="Backspaces" value={`${backspaces}`} />
        </div>
      )}

      {startedAtMs == null && !isComplete ? <CoachBanner message={coachMsg} /> : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <TypingOverlay
          target={targetText}
          typed={typed}
          showCursor={!isComplete}
          ghostIndex={!isComplete ? ghostCursorIndex : null}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-200">Type here</div>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Focus
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={typed}
          aria-label="Typing input"
          aria-describedby={helpTextId}
          onFocus={() => {
            setInputFocused(true)
            typewriterAudio.ensureReady().then(() => typewriterAudio.resume())          }}
          onBlur={() => {
            setInputFocused(false)
          }}
          onKeyDown={(e) => {
            if (isComplete) return

            if (startedAtMs == null && (e.key.length === 1 || e.key === 'Enter')) {
              setStartedAtMs(Date.now())
            }

            // ignore modifiers
            if (e.ctrlKey || e.metaKey || e.altKey) return

            ambientPlugin.noteTypingActivity()

            const modeGain = props.mode === 'focus' ? 0.7 : props.mode === 'competitive' ? 1.0 : 0.85

            if (e.key === 'Backspace') {
              if (props.ruleSet === 'no_backspace') {
                e.preventDefault()
                return
              }
              setBackspaces((v) => v + 1)
              typewriterAudio.play('backspace', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key === ' ') {
              typewriterAudio.play('spacebar', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key === 'Enter') {
              typewriterAudio.play('key', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key.length === 1) {
              const expected = targetText[typed.length] ?? null
              if (expected != null && e.key !== expected) {
                typewriterAudio.play('error', {
                  enabled: props.prefs.soundEnabled,
                  volume: props.prefs.volume * 0.6,
                  modeGain,
                })
              } else {
                typewriterAudio.play('key', {
                  enabled: props.prefs.soundEnabled,
                  volume: props.prefs.volume,
                  modeGain,
                })
              }
            }
          }}
          onChange={(e) => {
            if (isComplete) return
            const next = e.target.value

            // Belt-and-suspenders: if no_backspace rule and text got shorter, revert
            if (props.ruleSet === 'no_backspace' && next.length < typed.length) {
              e.target.value = typed
              return
            }

            setTyped(next)

            if (next.length !== typed.length) ambientPlugin.noteTypingActivity()

            if (startedAtMs == null && next.length > 0) setStartedAtMs(Date.now())

            if (timeLimitMs == null && next === targetText) {
              setEndedAtMs(Date.now())
            }
          }}
          spellCheck={false}
          className="mt-3 min-h-24 w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-200/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          placeholder="Start typing…"
        />

        <div id={helpTextId} className="mt-3 text-xs text-zinc-400" aria-live="polite" aria-atomic="true">
          {isComplete ? (
            <div className="space-y-2">
              <div className="font-medium text-zinc-200">{feedback.primary}</div>
              {feedback.secondary ? <div className="text-zinc-300">{feedback.secondary}</div> : null}
              {props.mode === 'competitive' && runValidity ? (
                <div className={[
                  'text-xs font-medium',
                  runValidity === 'valid' ? 'text-green-400' : 'text-zinc-500',
                ].join(' ')}>
                  {validityLabel(runValidity)}
                </div>
              ) : null}
              {props.mode === 'competitive' && pb ? (
                <div>
                  PB: <span className="text-zinc-200">{Math.round(pb.wpm)} WPM</span> at{' '}
                  <span className="text-zinc-200">{Math.round(pb.accuracy * 1000) / 10}%</span>
                  {live.accuracy >= 0.95 ? (
                    <span className="ml-2">
                      ΔWPM: <span className="text-zinc-200">{(live.wpm - pb.wpm).toFixed(1)}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-4">
                <div>WPM: {Math.round(live.wpm)}</div>
                <div>Accuracy: {Math.round(live.accuracy * 1000) / 10}%</div>
                <div>Errors: {live.errors}</div>
                <div>Backspaces: {backspaces}</div>
              </div>
            </div>
          ) : (
            <div>Punctuation and newlines are supported. Backspace is allowed (counted).</div>
          )}
        </div>
      </div>

      {isComplete && newUnlocks.length > 0 ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3">
          <div className="text-xs font-medium text-zinc-300">
            {newUnlocks.length === 1 ? 'New unlock' : 'New unlocks'}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {newUnlocks.map((u) => (
              <span key={u.label} className="rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
                {u.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {isComplete ? (
        <SessionReflection sessionTimestamp={endedAtMs ? Math.floor(endedAtMs / 1000) : Math.floor(Date.now() / 1000)} />
      ) : null}

      {props.mode === 'competitive' ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
          PB updates require accuracy ≥ 95%.
        </div>
      ) : null}
    </div>
  )
}
