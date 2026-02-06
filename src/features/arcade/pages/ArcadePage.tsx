import { useEffect, useMemo, useRef, useState } from 'react'
import { computeStats, formatMs } from '@lib'

const WORDS = [
  'shift',
  'space',
  'accuracy',
  'rhythm',
  'keyboard',
  'focus',
  'typing',
  'home',
  'practice',
  'arcade',
  'signal',
  'tempo',
  'control',
  'repeat',
  'smooth',
  'habit',
  'measure',
  'improve',
  'reset',
  'commit',
]

function pickNext(current: string) {
  if (WORDS.length <= 1) return current
  let next = current
  while (next === current) {
    next = WORDS[Math.floor(Math.random() * WORDS.length)]
  }
  return next
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs font-medium text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-50">{value}</div>
    </div>
  )
}

export function ArcadePage() {
  const DURATION_MS = 30_000

  const [currentWord, setCurrentWord] = useState(() => WORDS[0])
  const [input, setInput] = useState('')
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [correctWords, setCorrectWords] = useState(0)
  const [mistakes, setMistakes] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 100)
    return () => window.clearInterval(t)
  }, [])

  const remainingMs = useMemo(() => {
    if (startedAtMs == null) return DURATION_MS
    return Math.max(0, DURATION_MS - (nowMs - startedAtMs))
  }, [startedAtMs, nowMs])

  const ended = remainingMs === 0 && startedAtMs != null

  const stats = useMemo(() => {
    const correctChars = correctWords * 5
    const incorrectChars = mistakes * 5
    return computeStats({
      startedAtMs,
      nowMs: startedAtMs == null ? 0 : Math.min(nowMs, startedAtMs + DURATION_MS),
      correctChars,
      incorrectChars,
    })
  }, [correctWords, mistakes, startedAtMs, nowMs])

  function reset() {
    setStartedAtMs(null)
    setNowMs(Date.now())
    setInput('')
    setCorrectWords(0)
    setMistakes(0)
    setCurrentWord(WORDS[0])
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Arcade</h1>
          <p className="mt-1 text-sm text-zinc-400">30-second sprint. Type each word and press Space/Enter.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
          >
            {startedAtMs == null ? 'Start' : 'Restart'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Remaining" value={formatMs(remainingMs)} />
        <Stat label="Correct" value={`${correctWords}`} />
        <Stat label="Mistakes" value={`${mistakes}`} />
        <Stat label="WPM" value={`${Math.round(stats.wpm)}`} />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-xs font-medium text-zinc-400">Current word</div>
        <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-50">{currentWord}</div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-zinc-200" htmlFor="arcade">
            Your input
          </label>
          <input
            ref={inputRef}
            id="arcade"
            value={input}
            onChange={(e) => {
              const next = e.target.value
              if (startedAtMs == null && next.length > 0) setStartedAtMs(Date.now())
              setInput(next)
            }}
            onKeyDown={(e) => {
              if (ended) return

              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                const typed = input.trim()
                if (typed.length === 0) return

                if (typed === currentWord) setCorrectWords((v) => v + 1)
                else setMistakes((v) => v + 1)

                setInput('')
                setCurrentWord((w) => pickNext(w))
              }
            }}
            disabled={ended}
            spellCheck={false}
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-60"
            placeholder={ended ? 'Time!' : 'Type the word and press Space…'}
          />

          <div className="mt-3 text-xs text-zinc-400">
            Score: <span className="font-medium text-zinc-200">{correctWords - mistakes}</span>
            {ended ? <span className="ml-2 font-medium text-emerald-400">Run complete.</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
