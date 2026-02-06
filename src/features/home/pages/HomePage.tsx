import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import { loadAllPacks } from '@content'
import { checkGoalCompletion, generateDailyGoal, getPackRule, getPackUnlockStatus, intentLabel, loadCompetitiveAsync, loadGoalsAsync, loadJournalAsync, loadProfileAsync, loadSkillTreeAsync, loadStatsAsync, loadStreakAsync, loadUnlocksAsync, modeLabel, modeToPath, pickQuickstartExercise, preferredQuickstartMode, saveLastMode, type CompetitiveState, type GoalsState, type JournalEntry, type SkillTreeState, type StatsAggregate, type StreakData, type UnlockStore, type UserProfile } from '@lib'
import { generateHomeCoachMessage, type CoachMessage } from '@lib-internal/coach'

function ModeCard({ mode, description, highlight }: { mode: Mode; description: string; highlight?: boolean }) {
  const navigate = useNavigate()
  const label = modeLabel(mode)
  const path = modeToPath(mode)

  return (
    <div
      className={[
        'rounded-2xl border p-6',
        highlight ? 'border-zinc-600 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-950',
      ].join(' ')}
    >
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

function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function goalToMode(goal: UserProfile['goal']): Mode | null {
  if (goal === 'calm' || goal === 'speed') return 'focus'
  if (goal === 'work_writing') return 'real_life'
  if (goal === 'competition') return 'competitive'
  return null
}

export function HomePage() {
  const preferred = preferredQuickstartMode()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null)
  const [recentJournal, setRecentJournal] = useState<JournalEntry[]>([])
  const [goals, setGoals] = useState<GoalsState | null>(null)
  const [skillTree, setSkillTree] = useState<SkillTreeState | null>(null)
  const [stats, setStats] = useState<StatsAggregate | null>(null)
  const [competitive, setCompetitive] = useState<CompetitiveState | null>(null)
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [unlocks, setUnlocks] = useState<UnlockStore | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, s, str, journal, g, tree, comp, u] = await Promise.all([
          loadProfileAsync(),
          loadStatsAsync(),
          loadStreakAsync(),
          loadJournalAsync(),
          loadGoalsAsync(),
          loadSkillTreeAsync(),
          loadCompetitiveAsync(),
          loadUnlocksAsync(),
        ])
        if (cancelled) return
        setProfile(p)
        setStats(s)
        setStreak(str)
        setCompetitive(comp)
        setUnlocks(u)
        setCoachMsg(generateHomeCoachMessage(s, str, p))
        setRecentJournal(journal.slice(-3).reverse())
        setGoals(g)
        setSkillTree(tree)
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [])

  const userName = profile?.name?.trim() || ''
  const highlightMode = profile?.goal ? goalToMode(profile.goal) : null

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {userName ? `Welcome back, ${userName}.` : 'Calm by default. Competitive on purpose.'}
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

      {coachMsg ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400">
          {coachMsg.text}
        </div>
      ) : null}

      {streak && (streak.totalDaysPracticed ?? 0) > 0 ? (
        <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="text-sm text-zinc-200">
            {streak.totalDaysPracticed ?? 0} day{(streak.totalDaysPracticed ?? 0) !== 1 ? 's' : ''} practiced
          </div>
          {(streak.comebackWins ?? 0) > 0 ? (
            <div className="text-xs text-zinc-400">
              · {streak.comebackWins} comeback{(streak.comebackWins ?? 0) !== 1 ? 's' : ''}
            </div>
          ) : null}
          <div className="ml-auto flex gap-1">
            {(streak.rolling7 ?? []).map((v, i) => (
              <span
                key={i}
                className={`inline-block h-2 w-2 rounded-full ${v ? 'bg-zinc-400' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {goals && goals.weeklyIntent ? (() => {
        const goal = generateDailyGoal(goals.weeklyIntent, new Date().getDay(), null)
        const todayAvgAcc = goals.todaySessions > 0 ? goals.todayAccuracySum / goals.todaySessions : 0
        const completed = checkGoalCompletion(goal, goals.todaySessions, goals.todayMinutesMs, todayAvgAcc)
        return (
          <Link
            to="/goals"
            className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-400">
                Today's goal — {intentLabel(goals.weeklyIntent)}
              </div>
              {completed ? (
                <span className="text-[11px] font-medium text-green-400">Done</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm text-zinc-200">
              {goals.todaySessions}/{goal.targetSessions} sessions · {Math.round(goals.todayMinutesMs / 60_000)}/{goal.targetMinutes} min
            </div>
          </Link>
        )
      })() : null}

      {skillTree && skillTree.totalXp > 0 ? (
        <Link
          to="/abilities"
          className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
        >
          <div className="text-xs font-medium text-zinc-400">Skill Tree</div>
          <div className="mt-1 text-sm text-zinc-200">
            {skillTree.totalXp.toLocaleString()} total XP
          </div>
        </Link>
      ) : null}

      {stats ? (() => {
        const packs = loadAllPacks()
        const packNames = [...new Set(packs.map((p) => p.pack))]
        const unlocked = packNames.filter((name) => {
          const rule = getPackRule(name)
          const status = getPackUnlockStatus(rule, stats, skillTree, competitive)
          return status.unlocked
        }).length
        return unlocked < packNames.length ? (
          <Link
            to="/focus/exercises"
            className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
          >
            <div className="text-xs font-medium text-zinc-400">Content Packs</div>
            <div className="mt-1 text-sm text-zinc-200">
              {unlocked}/{packNames.length} packs unlocked
            </div>
          </Link>
        ) : null
      })() : null}

      {unlocks && (unlocks.achievements.length > 0 || unlocks.titles.length > 0) ? (
        <Link
          to="/milestones"
          className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
        >
          <div className="text-xs font-medium text-zinc-400">Milestones & Titles</div>
          <div className="mt-1 text-sm text-zinc-200">
            {unlocks.achievements.length} milestone{unlocks.achievements.length !== 1 ? 's' : ''}{unlocks.titles.length > 0 ? ` · ${unlocks.titles.length} title${unlocks.titles.length !== 1 ? 's' : ''}` : ''} earned
          </div>
        </Link>
      ) : null}

      {stats && stats.totalSessions >= 3 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/plan"
            className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
          >
            <div className="text-xs font-medium text-zinc-400">Session Planner</div>
            <div className="mt-1 text-sm text-zinc-200">Plan your next sessions with reasons</div>
          </Link>
          {stats.totalSessions >= 5 ? (
            <Link
              to="/insights"
              className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
            >
              <div className="text-xs font-medium text-zinc-400">Insights</div>
              <div className="mt-1 text-sm text-zinc-200">View your progress trends</div>
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <ModeCard mode="focus" description="Calm practice. Minimal HUD by default." highlight={highlightMode === 'focus'} />
        <ModeCard mode="real_life" description="Emails, texts, support replies, and journaling." highlight={highlightMode === 'real_life'} />
        <ModeCard mode="competitive" description="Timed sprints, PBs, and a simple local leaderboard." highlight={highlightMode === 'competitive'} />
      </section>

      {recentJournal.length > 0 ? (
        <section className="space-y-3">
          <div className="text-xs font-medium text-zinc-400">Recent reflections</div>
          {recentJournal.map((entry, i) => (
            <div key={entry.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              {entry.note ? <div className="text-sm text-zinc-300">{entry.note}</div> : null}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
                    {tag}
                  </span>
                ))}
                <span className="text-[11px] text-zinc-500">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
