import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { findExercise } from '@content'
import {
  generateDailySet,
  getOrCreateUserId,
  loadRuns,
  loadSkillModel,
  modeToPath,
  type DailySessionType,
  type DailySetItemKind,
} from '@lib'

function kindLabel(kind: DailySetItemKind) {
  if (kind === 'confidence') return 'Confidence win'
  if (kind === 'targeted') return 'Targeted practice'
  if (kind === 'challenge') return 'Challenge'
  if (kind === 'real_life') return 'Real-life scenario'
  return 'Mix'
}

function sessionLabel(type: DailySessionType) {
  if (type === 'reset') return 'Short set'
  if (type === 'deep') return 'Long set'
  return 'Standard set'
}

function dailyWhyLine(type: DailySessionType) {
  if (type === 'reset') return 'A shorter set for a quick reset.'
  if (type === 'deep') return 'A longer set chosen for steady practice.'
  return 'Balanced set chosen for today.'
}

function tagToPracticePhrase(tag: string): string | null {
  const t = tag.toLowerCase()
  if (t === 'punctuation') return 'punctuation practice'
  if (t === 'comma' || t === 'commas') return 'comma practice'
  if (t === 'semicolon' || t === 'semicolons') return 'semicolon practice'
  if (t === 'colon' || t === 'colons') return 'colon practice'
  if (t === 'apostrophe' || t === 'apostrophes') return 'apostrophe practice'
  if (t === 'numbers') return 'numbers practice'
  if (t === 'newlines') return 'line-break practice'
  if (t === 'times') return 'time-format practice'
  return null
}

function targetedWhyLine(params: { exerciseTags: string[]; weakTags: string[] }) {
  for (const wt of params.weakTags) {
    if (!params.exerciseTags.includes(wt)) continue
    const phrase = tagToPracticePhrase(wt)
    if (phrase) return `Includes ${phrase} based on recent sessions.`
  }

  for (const t of params.exerciseTags) {
    const phrase = tagToPracticePhrase(t)
    if (phrase) return `Includes ${phrase} based on recent sessions.`
  }

  return 'Includes targeted practice based on recent sessions.'
}

function computeDaysPracticed(runs: ReturnType<typeof loadRuns>) {
  const days = new Set<string>()
  for (const r of runs) {
    const d = new Date(r.timestamp * 1000).toISOString().slice(0, 10)
    days.add(d)
  }
  return days
}

function computeBestWeek(days: Set<string>) {
  const sorted = Array.from(days).sort()
  if (sorted.length === 0) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const dayMs = sorted.map((d) => new Date(d).getTime())
  let best = 1
  let i = 0
  for (let j = 0; j < dayMs.length; j++) {
    while (dayMs[j] - dayMs[i] > 6 * msPerDay) i++
    best = Math.max(best, j - i + 1)
  }
  return best
}

export function DailySetPage() {
  const [search] = useSearchParams()
  const type = (search.get('type') ?? '') as DailySessionType
  const sessionType: DailySessionType = type === 'reset' || type === 'mix' || type === 'deep' ? type : 'mix'

  const [showWhy, setShowWhy] = useState(false)
  const [openWhyKey, setOpenWhyKey] = useState<string | null>(null)

  const userId = useMemo(() => getOrCreateUserId(), [])
  const skill = useMemo(() => loadSkillModel(), [])

  const daily = useMemo(() => {
    return generateDailySet({
      userId,
      sessionType,
      weakTags: skill.weak_tags,
      skill,
    })
  }, [userId, sessionType, skill])

  const daysPracticed = useMemo(() => computeDaysPracticed(loadRuns()), [])
  const bestWeek = useMemo(() => computeBestWeek(daysPracticed), [daysPracticed])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Today’s Set</h1>
          <p className="mt-1 text-sm text-zinc-400">A quiet session, ready when you are.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'reset' as const, label: sessionLabel('reset') },
              { key: 'mix' as const, label: sessionLabel('mix') },
              { key: 'deep' as const, label: sessionLabel('deep') },
            ]
          ).map((t) => (
            <Link
              key={t.key}
              to={`/daily?type=${t.key}`}
              className={
                'rounded-md border px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
                (sessionType === t.key
                  ? 'border-zinc-600 bg-zinc-900 text-zinc-50'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900')
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <div className="text-xs font-medium text-zinc-400">Days practiced</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50 tabular-nums">{daysPracticed.size}</div>
          <div className="mt-1 text-xs text-zinc-500">No penalties. Missed days are just days.</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <div className="text-xs font-medium text-zinc-400">Best week</div>
          <div className="mt-1 text-lg font-semibold text-zinc-50 tabular-nums">{bestWeek}/7 days</div>
          <div className="mt-1 text-xs text-zinc-500">Your best rolling 7-day stretch.</div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-50">Next session</div>
            <div className="mt-1 text-xs text-zinc-500">Local, seeded, and stable for today.</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowWhy((v) => !v)
              setOpenWhyKey(null)
            }}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {showWhy ? 'Hide why' : 'Why'}
          </button>
        </div>

        {showWhy ? <div className="mt-2 text-xs text-zinc-400">{dailyWhyLine(sessionType)}</div> : null}

        <div className="mt-4 grid gap-3">
          {daily.items.map((it, idx) => {
            const ex = findExercise(it.exerciseId)
            if (!ex) return null
            const path = `/${modeToPath(it.mode)}/run/${ex.id}`
            const qs = new URLSearchParams({ variant: 'short' })
            const href = `${path}?${qs.toString()}`
            const key = `${daily.dateKey}-${idx}-${ex.id}`
            const canExplainItem = showWhy && it.kind === 'targeted'
            const itemWhy = canExplainItem
              ? targetedWhyLine({ exerciseTags: ex.tags ?? [], weakTags: skill.weak_tags ?? [] })
              : null

            return (
              <Link
                key={key}
                to={href}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-zinc-400">
                    {kindLabel(it.kind)} • {ex.mode}
                  </div>
                  <div className="text-xs text-zinc-500">Difficulty {ex.difficulty}</div>
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-50">{ex.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{ex.pack}</div>

                {canExplainItem ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      {openWhyKey === key ? itemWhy : null}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpenWhyKey((prev) => (prev === key ? null : key))
                      }}
                      className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-900"
                    >
                      {openWhyKey === key ? 'Hide' : 'Why'}
                    </button>
                  </div>
                ) : null}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
