import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  exportAllData,
  importData,
  loadProfileAsync,
  loadPreferencesAsync,
  loadRunsAsync,
  loadStatsAsync,
  loadStreakAsync,
  loadSkillModelAsync,
  loadPersonalBestsAsync,
  loadUnlocksAsync,
  loadJournalAsync,
  loadGoalsAsync,
  loadSkillTreeAsync,
  loadCompetitiveAsync,
  deleteRecentRunsAsync,
  anonymizeProfileAsync,
  type ExportPayload,
  type UserProfile,
} from '@lib'
import { computeStoreSummary, type MemoryOverview } from '@lib-internal/memoryEngine'

function StorageBar({ usedKb }: { usedKb: number }) {
  // Approximate IDB quota is generous but we'll show relative to 5MB for visual
  const maxKb = 5_000
  const pct = Math.min(100, (usedKb / maxKb) * 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full bg-zinc-500 transition-all"
        style={{ width: `${Math.max(1, pct)}%` }}
      />
    </div>
  )
}

function formatDate(unixSeconds: number): string {
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function MemoryPage() {
  const [overview, setOverview] = useState<MemoryOverview | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [deleteCount, setDeleteCount] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAnonymize, setConfirmAnonymize] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function refresh() {
    try {
      const [prof, prefs, sessions, stats, streak, skill, pbs, unlocks, journal, goals, tree, comp] =
        await Promise.all([
          loadProfileAsync(),
          loadPreferencesAsync(),
          loadRunsAsync(),
          loadStatsAsync(),
          loadStreakAsync(),
          loadSkillModelAsync(),
          loadPersonalBestsAsync(),
          loadUnlocksAsync(),
          loadJournalAsync(),
          loadGoalsAsync(),
          loadSkillTreeAsync(),
          loadCompetitiveAsync(),
        ])

      const ov = computeStoreSummary({
        profile: prof,
        preferences: prefs,
        sessions,
        stats,
        streak,
        skill,
        personalBests: pbs,
        unlocks,
        journal,
        goals,
        skillTree: tree,
        competitive: comp,
      })

      setOverview(ov)
      setProfile(prof)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleExport() {
    try {
      const data = await exportAllData()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lokey-typer-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: 'success', text: 'Data exported successfully.' })
    } catch {
      setMessage({ type: 'error', text: 'Export failed.' })
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as ExportPayload
      const result = await importData(payload)
      const warnings = result.warnings.length > 0 ? ` Warnings: ${result.warnings.join('; ')}` : ''
      setMessage({ type: 'success', text: `Imported ${result.imported} items.${warnings}` })
      await refresh()
    } catch {
      setMessage({ type: 'error', text: 'Import failed. Is the file valid JSON?' })
    }
  }

  async function handleDeleteRecent() {
    try {
      const deleted = await deleteRecentRunsAsync(deleteCount)
      setMessage({ type: 'success', text: `Removed ${deleted} session${deleted !== 1 ? 's' : ''}. Stats may be stale until your next run.` })
      setConfirmDelete(false)
      await refresh()
    } catch {
      setMessage({ type: 'error', text: 'Delete failed.' })
    }
  }

  async function handleAnonymize() {
    try {
      await anonymizeProfileAsync()
      setMessage({ type: 'success', text: 'Profile anonymized. Name and pronouns cleared.' })
      setConfirmAnonymize(false)
      await refresh()
    } catch {
      setMessage({ type: 'error', text: 'Anonymization failed.' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Your Data</h1>
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Your Data
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300 sm:text-base">
            Everything stays on your device. Export, inspect, or remove anything — you're in control.
          </p>
        </div>
      </section>

      {message ? (
        <div
          className={[
            'rounded-lg border px-4 py-2.5 text-sm',
            message.type === 'success'
              ? 'border-green-800 bg-green-950/40 text-green-300'
              : 'border-red-800 bg-red-950/40 text-red-300',
          ].join(' ')}
        >
          {message.text}
        </div>
      ) : null}

      {/* Storage overview */}
      {overview ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-zinc-400">Storage usage</div>
            <div className="text-xs text-zinc-500">{overview.totalSizeKb.toFixed(1)} KB</div>
          </div>
          <StorageBar usedKb={overview.totalSizeKb} />

          {overview.sessionCount > 0 ? (
            <div className="text-xs text-zinc-500">
              {overview.sessionCount} session{overview.sessionCount !== 1 ? 's' : ''}
              {overview.oldestSession ? ` · oldest: ${formatDate(overview.oldestSession)}` : ''}
              {overview.newestSession ? ` · newest: ${formatDate(overview.newestSession)}` : ''}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Data inventory */}
      {overview ? (
        <section className="space-y-3">
          <div className="text-xs font-medium text-zinc-400">Data inventory</div>
          <div className="space-y-1">
            {overview.stores.map((store) => (
              <div
                key={store.name}
                className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-950 px-4 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-200">{store.label}</div>
                  <div className="text-xs text-zinc-500">{store.description}</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  {store.itemCount !== null ? (
                    <span>{store.itemCount} item{store.itemCount !== 1 ? 's' : ''}</span>
                  ) : null}
                  <span className="tabular-nums">{store.approximateSizeKb.toFixed(1)} KB</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Export / Import */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Export & Import</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
          >
            Export all data
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
          >
            Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {/* Delete recent sessions */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Remove recent sessions</div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-3">
            <label htmlFor="delete-count" className="text-sm text-zinc-300">
              Delete the most recent
            </label>
            <input
              id="delete-count"
              type="number"
              min={1}
              max={overview?.sessionCount ?? 100}
              value={deleteCount}
              onChange={(e) => setDeleteCount(Math.max(1, Number.parseInt(e.target.value) || 1))}
              className="w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm tabular-nums text-zinc-100 outline-none focus:border-zinc-500"
            />
            <span className="text-sm text-zinc-300">session{deleteCount !== 1 ? 's' : ''}</span>
          </div>

          {confirmDelete ? (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-zinc-400">
                This will remove {deleteCount} session{deleteCount !== 1 ? 's' : ''}. Stats may be stale until
                your next run.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteRecent}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-3 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              Delete sessions
            </button>
          )}
        </div>
      </section>

      {/* Anonymize profile */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Anonymize profile</div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm text-zinc-300">
            Clears your name and pronouns but keeps all practice data intact.
          </div>
          {profile && (profile.name || profile.pronouns) ? (
            <div className="mt-2 text-xs text-zinc-500">
              Current: {profile.name || '(no name)'}{profile.pronouns ? ` · ${profile.pronouns}` : ''}
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">
              Profile is already anonymous.
            </div>
          )}

          {confirmAnonymize ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleAnonymize}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Confirm anonymize
              </button>
              <button
                type="button"
                onClick={() => setConfirmAnonymize(false)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
              >
                Cancel
              </button>
            </div>
          ) : profile && (profile.name || profile.pronouns) ? (
            <button
              type="button"
              onClick={() => setConfirmAnonymize(true)}
              className="mt-3 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              Anonymize
            </button>
          ) : null}
        </div>
      </section>

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
