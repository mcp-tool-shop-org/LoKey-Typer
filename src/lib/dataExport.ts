// Data export, import, and reset.

import type { Preferences, RunResult, PersonalBestsStore, UserSkillModel } from './storage'
import type { UserProfile, StreakData, StatsAggregate, JournalEntry, UnlockStore } from './db'
import {
  loadProfileAsync,
  loadPreferencesAsync,
  loadRunsAsync,
  loadStatsAsync,
  loadStreakAsync,
  loadSkillModelAsync,
  loadPersonalBestsAsync,
  loadJournalAsync,
  loadUnlocksAsync,
  saveProfileAsync,
  savePreferencesAsync,
  appendRunAsync,
  saveStatsAsync,
  saveStreakAsync,
  saveSkillModelAsync,
  savePersonalBestsAsync,
  appendJournalAsync,
  saveUnlocksAsync,
  clearAllStores,
  clearAllStoresExceptPreferences,
  defaultProfile,
  defaultStats,
  defaultStreak,
  defaultUnlocks,
} from './db'
import {
  loadPreferences,
  loadRuns,
  loadSkillModel,
  loadPersonalBests,
} from './storage'

export type ExportPayload = {
  version: 1
  exportedAt: string
  profile: UserProfile
  preferences: Preferences
  sessions: RunResult[]
  statsAggregate: StatsAggregate
  streaks: StreakData
  skillModel: UserSkillModel
  personalBests: PersonalBestsStore
  journal: JournalEntry[]
  unlocks: UnlockStore
}

export async function exportAllData(): Promise<ExportPayload> {
  // Try IDB first, fall back to localStorage
  const [profile, prefsIdb, sessionsIdb, stats, streaks, skillIdb, pbsIdb, journal, unlocks] = await Promise.all([
    loadProfileAsync(),
    loadPreferencesAsync(),
    loadRunsAsync(),
    loadStatsAsync(),
    loadStreakAsync(),
    loadSkillModelAsync(),
    loadPersonalBestsAsync(),
    loadJournalAsync(),
    loadUnlocksAsync(),
  ])

  // Fallbacks from localStorage if IDB returned empty
  const preferences = prefsIdb ?? loadPreferences()
  const sessions = sessionsIdb.length > 0 ? sessionsIdb : loadRuns()
  const skillModel = skillIdb ?? loadSkillModel()
  const personalBests = pbsIdb ?? loadPersonalBests()

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    preferences,
    sessions,
    statsAggregate: stats,
    streaks,
    skillModel,
    personalBests,
    journal,
    unlocks,
  }
}

export type ImportResult = {
  imported: number
  warnings: string[]
}

export async function importData(payload: ExportPayload): Promise<ImportResult> {
  const warnings: string[] = []
  let imported = 0

  if (payload.version !== 1) {
    return { imported: 0, warnings: ['Unknown export version. Import aborted.'] }
  }

  // Profile
  if (payload.profile) {
    await saveProfileAsync(payload.profile)
    imported++
  }

  // Preferences
  if (payload.preferences) {
    await savePreferencesAsync(payload.preferences)
    imported++
  }

  // Sessions
  if (Array.isArray(payload.sessions)) {
    let valid = 0
    let invalid = 0
    for (const run of payload.sessions) {
      if (typeof run.exercise_id === 'string' && typeof run.wpm === 'number' && typeof run.accuracy === 'number') {
        await appendRunAsync(run)
        valid++
      } else {
        invalid++
      }
    }
    imported += valid
    if (invalid > 0) {
      warnings.push(`${invalid} sessions had invalid data and were skipped.`)
    }
  }

  // Stats
  if (payload.statsAggregate) {
    await saveStatsAsync(payload.statsAggregate)
    imported++
  }

  // Streaks
  if (payload.streaks) {
    await saveStreakAsync(payload.streaks)
    imported++
  }

  // Skill model
  if (payload.skillModel) {
    await saveSkillModelAsync(payload.skillModel)
    imported++
  }

  // Personal bests
  if (payload.personalBests) {
    await savePersonalBestsAsync(payload.personalBests)
    imported++
  }

  // Journal
  if (Array.isArray(payload.journal)) {
    for (const entry of payload.journal) {
      if (typeof entry.timestamp === 'number') {
        await appendJournalAsync(entry)
        imported++
      }
    }
  }

  // Unlocks
  if (payload.unlocks) {
    await saveUnlocksAsync(payload.unlocks)
    imported++
  }

  return { imported, warnings }
}

export async function resetAllData(options: { keepPreferences: boolean }): Promise<void> {
  // Save prefs before wipe if requested
  let savedPrefs: Preferences | null = null
  if (options.keepPreferences) {
    savedPrefs = (await loadPreferencesAsync()) ?? loadPreferences()
  }

  if (options.keepPreferences) {
    await clearAllStoresExceptPreferences()
  } else {
    await clearAllStores()
  }

  // Clear localStorage keys
  const lktKeys = [
    'lkt_prefs_v1', 'lkt_prefs_v1_lkg', 'lkt_runs_v1', 'lkt_pbs_v1',
    'lkt_recents_v1', 'lkt_last_mode_v1', 'lkt_user_id_v1', 'lkt_skill_v1',
    'lkt_idb_migrated_v1',
  ]

  const keepKeys = options.keepPreferences ? ['lkt_prefs_v1', 'lkt_prefs_v1_lkg'] : []

  for (const key of lktKeys) {
    if (keepKeys.includes(key)) continue
    try {
      localStorage.removeItem(key)
    } catch {
      // silent
    }
  }

  // Restore prefs if kept
  if (savedPrefs) {
    await savePreferencesAsync(savedPrefs)
  }
}
