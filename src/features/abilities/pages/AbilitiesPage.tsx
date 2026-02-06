import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadSkillTreeAsync, type SkillBranch, type SkillTreeState } from '@lib'
import { branchDescription, branchLabel } from '@lib-internal/skillTree'

const BRANCHES: SkillBranch[] = ['accuracy', 'rhythm', 'endurance', 'punctuation']

function BranchCard({ branch, tree }: { branch: SkillBranch; tree: SkillTreeState }) {
  const progress = tree.branches[branch]
  const pct = progress.xpToNext === Infinity ? 100 : Math.round((progress.xp / progress.xpToNext) * 100)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold text-zinc-50">{branchLabel(branch)}</div>
        <div className="text-xs font-medium tabular-nums text-zinc-400">Lv {progress.level}</div>
      </div>
      <div className="mt-1 text-xs text-zinc-400">{branchDescription(branch)}</div>

      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-zinc-500">
          {progress.level >= 10
            ? 'Max level'
            : `${progress.xp} / ${progress.xpToNext} XP`}
        </div>
      </div>
    </div>
  )
}

export function AbilitiesPage() {
  const [tree, setTree] = useState<SkillTreeState | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const t = await loadSkillTreeAsync()
        if (!cancelled) setTree(t)
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!tree) return null

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Skill Tree</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Total XP: <span className="text-zinc-200">{tree.totalXp.toLocaleString()}</span>
          </p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {BRANCHES.map((branch) => (
          <BranchCard key={branch} branch={branch} tree={tree} />
        ))}
      </div>
    </div>
  )
}
