import { useEffect, useMemo, useRef, useState } from 'react'
import { computeStats, formatMs } from '@lib'

const DEFAULT_TEXT =
  'The quickest way to improve is to type accurately first. Speed is a side effect of clean technique.'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs font-medium text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-50">{value}</div>
    </div>
  )
}

function HighlightedText({ target, typed }: { target: string; typed: string }) {
  const correctUntil = (() => {
    let i = 0
    for (; i < Math.min(target.length, typed.length); i++) {
      if (target[i] !== typed[i]) break
    }
    return i
  })()

  const incorrectFrom = correctUntil
  const typedExtra = typed.length > target.length ? typed.slice(target.length) : ''

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="font-mono text-sm leading-6">
        <span className="text-zinc-50">{target.slice(0, correctUntil)}</span>
        <span className="text-rose-400">{target.slice(incorrectFrom, typed.length)}</span>
        <span className="text-zinc-500">{target.slice(typed.length)}</span>
        {typedExtra.length > 0 ? <span className="text-rose-400">{typedExtra}</span> : null}
      </div>
    </div>
  )
}

export function PracticePage() {
  const [target, setTarget] = useState(DEFAULT_TEXT)
  const [typed, setTyped] = useState('')
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 200)
    return () => window.clearInterval(t)
  }, [])

  const counts = useMemo(() => {
    let correctChars = 0
    let incorrectChars = 0

    for (let i = 0; i < typed.length; i++) {
      if (i >= target.length) {
        incorrectChars++
        continue
      }
      if (typed[i] === target[i]) correctChars++
      else incorrectChars++
    }

    return { correctChars, incorrectChars }
  }, [typed, target])

  const stats = useMemo(
    () =>
      computeStats({
        startedAtMs,
        nowMs,
        correctChars: counts.correctChars,
        incorrectChars: counts.incorrectChars,
      }),
    [startedAtMs, nowMs, counts.correctChars, counts.incorrectChars],
  )

  const done = typed === target

  function reset(nextTarget?: string) {
    setTyped('')
    setStartedAtMs(null)
    if (typeof nextTarget === 'string') setTarget(nextTarget)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Practice</h1>
          <p className="mt-1 text-sm text-zinc-400">Type the passage. Accuracy first — WPM will follow.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() =>
              reset(
                'Consistency beats intensity. A few focused minutes every day adds up faster than rare long sessions.',
              )
            }
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
          >
            New passage
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Time" value={formatMs(stats.elapsedMs)} />
        <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
        <Stat label="WPM" value={`${Math.round(stats.wpm)}`} />
      </div>

      <HighlightedText target={target} typed={typed} />

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <label className="block text-sm font-medium text-zinc-200" htmlFor="practice">
          Your input
        </label>
        <textarea
          ref={inputRef}
          id="practice"
          value={typed}
          onChange={(e) => {
            const next = e.target.value
            if (startedAtMs == null && next.length > 0) setStartedAtMs(Date.now())
            setTyped(next)
          }}
          spellCheck={false}
          className="mt-2 min-h-28 w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
          placeholder="Start typing here…"
        />

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
          <div>
            {done ? (
              <span className="font-medium text-emerald-400">Completed.</span>
            ) : (
              <span>
                {typed.length}/{target.length} characters
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Focus
          </button>
        </div>
      </div>
    </div>
  )
}
