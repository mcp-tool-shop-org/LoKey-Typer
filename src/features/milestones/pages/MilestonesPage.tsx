import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadStatsAsync,
  loadStreakAsync,
  loadCompetitiveAsync,
  loadSkillTreeAsync,
  loadUnlocksAsync,
  loadSkillModelAsync,
  type StatsAggregate,
  type StreakData,
  type CompetitiveState,
  type SkillTreeState,
  type UnlockStore,
  type UserSkillModel,
} from '@lib'
import {
  ALL_MILESTONES,
  evaluateMilestones,
  type MilestoneCategory,
  type MilestoneDefinition,
} from '@lib-internal/milestonesEngine'
import {
  ALL_TITLES,
  evaluateTitles,
  type TitleDefinition,
} from '@lib-internal/titlesEngine'

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  journey: 'Journey',
  streak: 'Streaks',
  skill: 'Skill',
  competitive: 'Competitive',
}

const CATEGORY_ORDER: MilestoneCategory[] = ['journey', 'streak', 'skill', 'competitive']

function MilestoneItem({ milestone, earned }: { milestone: MilestoneDefinition; earned: boolean }) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3',
        earned
          ? 'border-zinc-700 bg-zinc-900/40'
          : 'border-zinc-800/50 bg-zinc-950 opacity-50',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div
          className={[
            'h-2 w-2 rounded-full',
            earned ? 'bg-zinc-300' : 'bg-zinc-700',
          ].join(' ')}
        />
        <div
          className={[
            'text-sm font-medium',
            earned ? 'text-zinc-100' : 'text-zinc-500',
          ].join(' ')}
        >
          {milestone.label}
        </div>
      </div>
      <div
        className={[
          'mt-1 pl-4 text-xs',
          earned ? 'text-zinc-400' : 'text-zinc-600',
        ].join(' ')}
      >
        {milestone.description}
      </div>
    </div>
  )
}

function TitleBadge({ title, earned }: { title: TitleDefinition; earned: boolean }) {
  return (
    <div
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium',
        earned
          ? 'border-zinc-600 bg-zinc-900 text-zinc-200'
          : 'border-zinc-800/50 text-zinc-600 opacity-50',
      ].join(' ')}
      title={title.description}
    >
      {title.label}
    </div>
  )
}

export function MilestonesPage() {
  const [loading, setLoading] = useState(true)
  const [earnedMilestones, setEarnedMilestones] = useState<Set<string>>(new Set())
  const [earnedTitles, setEarnedTitles] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
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
        if (cancelled) return

        // Combine already earned with any newly-detected
        const allMilestoneIds = new Set(unlocks.achievements)
        const newMilestones = evaluateMilestones({
          stats,
          streak,
          competitive,
          skillTree,
          alreadyEarned: unlocks.achievements,
        })
        for (const m of newMilestones) allMilestoneIds.add(m.id)

        const allTitleIds = new Set(unlocks.titles)
        const newTitles = evaluateTitles({
          stats,
          streak,
          skill,
          skillTree,
          alreadyEarned: unlocks.titles,
        })
        for (const t of newTitles) allTitleIds.add(t.id)

        setEarnedMilestones(allMilestoneIds)
        setEarnedTitles(allTitleIds)
        setLoading(false)
      } catch {
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Milestones</h1>
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    )
  }

  const totalEarned = earnedMilestones.size + earnedTitles.size
  const totalPossible = ALL_MILESTONES.length + ALL_TITLES.length

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Milestones & Titles
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300 sm:text-base">
            A quiet record of your journey. Milestones mark progress; titles reflect who you've
            become as a typist.
          </p>
          <div className="mt-3 text-xs text-zinc-400">
            {totalEarned}/{totalPossible} earned
          </div>
        </div>
      </section>

      {/* Titles */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Titles</div>
        <div className="flex flex-wrap gap-2">
          {ALL_TITLES.map((title) => (
            <TitleBadge key={title.id} title={title} earned={earnedTitles.has(title.id)} />
          ))}
        </div>
      </section>

      {/* Milestones by category */}
      {CATEGORY_ORDER.map((category) => {
        const milestones = ALL_MILESTONES.filter((m) => m.category === category)
        if (milestones.length === 0) return null

        return (
          <section key={category} className="space-y-3">
            <div className="text-xs font-medium text-zinc-400">{CATEGORY_LABELS[category]}</div>
            <div className="space-y-2">
              {milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  earned={earnedMilestones.has(milestone.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      <div className="text-center">
        <Link
          to="/"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
