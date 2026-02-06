// IndexedDB persistent store for LoKey-Typer.
// Zero external dependencies. Falls back to localStorage if IDB unavailable.

import type { Mode } from '@content'
import type { Preferences, RunResult, PersonalBestsStore, UserSkillModel } from './storage'

// ─── New domain types ────────────────────────────────────────────────

export type UserProfile = {
  name: string
  pronouns: string
  goal: 'calm' | 'speed' | 'work_writing' | 'competition' | ''
  tonePreference: 'supportive' | 'direct' | 'minimal'
  onboardedAt: string
}

export type StreakData = {
  currentStreak: number
  bestStreak: number
  lastPracticeDate: string // YYYY-MM-DD
  rolling7: number[] // last 7 days: 1=practiced, 0=not (index 0=today)
  bestWeek: number
}

export type StatsAggregate = {
  rollingWpm10: number[]
  rollingAccuracy10: number[]
  bestWpm: number
  bestAccuracy: number
  totalSessions: number
  totalDurationMs: number
  byMode: Record<
    Mode,
    {
      sessions: number
      emaWpm: number
      emaAccuracy: number
      bestWpm: number
    }
  >
  errorHeatmap: Record<string, number>
  fatigue: {
    avgFirstHalfAccuracy: number
    avgSecondHalfAccuracy: number
    decaySignal: boolean
  }
}

export type JournalEntry = {
  id?: number
  sessionTimestamp: number
  timestamp: number
  note: string
  tags: string[]
}

export type UnlockStore = {
  achievements: string[]
  titles: string[]
  cosmetics: string[]
}

// ─── Defaults ────────────────────────────────────────────────────────

export function defaultProfile(): UserProfile {
  return {
    name: '',
    pronouns: '',
    goal: '',
    tonePreference: 'supportive',
    onboardedAt: '',
  }
}

export function defaultStreak(): StreakData {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastPracticeDate: '',
    rolling7: [0, 0, 0, 0, 0, 0, 0],
    bestWeek: 0,
  }
}

export function defaultStats(): StatsAggregate {
  return {
    rollingWpm10: [],
    rollingAccuracy10: [],
    bestWpm: 0,
    bestAccuracy: 0,
    totalSessions: 0,
    totalDurationMs: 0,
    byMode: {
      focus: { sessions: 0, emaWpm: 0, emaAccuracy: 1, bestWpm: 0 },
      real_life: { sessions: 0, emaWpm: 0, emaAccuracy: 1, bestWpm: 0 },
      competitive: { sessions: 0, emaWpm: 0, emaAccuracy: 1, bestWpm: 0 },
    },
    errorHeatmap: {},
    fatigue: {
      avgFirstHalfAccuracy: 1,
      avgSecondHalfAccuracy: 1,
      decaySignal: false,
    },
  }
}

export function defaultUnlocks(): UnlockStore {
  return { achievements: [], titles: [], cosmetics: [] }
}

// ─── IDB core ────────────────────────────────────────────────────────

const DB_NAME = 'lokey_db'
const DB_VERSION = 1

const STORE_PROFILE = 'profile'
const STORE_PREFERENCES = 'preferences'
const STORE_SESSIONS = 'sessions'
const STORE_STATS = 'stats_agg'
const STORE_STREAKS = 'streaks'
const STORE_UNLOCKS = 'unlocks'
const STORE_JOURNAL = 'journal'
const STORE_SKILL = 'skill'
const STORE_PBS = 'personal_bests'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      reject(new Error('IndexedDB not available'))
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result

      // Single-record stores (keyPath = 'id', we always use id=1)
      for (const name of [STORE_PROFILE, STORE_PREFERENCES, STORE_STATS, STORE_STREAKS, STORE_UNLOCKS, STORE_SKILL, STORE_PBS]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }

      // Auto-increment stores
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('mode', 'mode', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
        const store = db.createObjectStore(STORE_JOURNAL, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

// ─── Generic IDB helpers ─────────────────────────────────────────────

async function idbGet<T>(storeName: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(1)
    req.onsuccess = () => {
      const result = req.result as (T & { id?: number }) | undefined
      if (!result) {
        resolve(null)
        return
      }
      // Strip the internal `id` key before returning
      const { id: _, ...rest } = result
      resolve(rest as T)
    }
    req.onerror = () => reject(req.error)
  })
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put({ ...value, id: 1 })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve((req.result ?? []) as T[])
    req.onerror = () => reject(req.error)
  })
}

async function idbAdd<T>(storeName: string, value: T): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).add(value)
    req.onsuccess = () => resolve(req.result as number)
    tx.onerror = () => reject(tx.error)
  })
}

async function idbClear(storeName: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Public async API ────────────────────────────────────────────────

// Profile
export async function loadProfileAsync(): Promise<UserProfile> {
  try {
    const data = await idbGet<UserProfile>(STORE_PROFILE)
    return data ?? defaultProfile()
  } catch {
    return defaultProfile()
  }
}

export async function saveProfileAsync(profile: UserProfile): Promise<void> {
  try {
    await idbPut(STORE_PROFILE, profile)
  } catch {
    // silent
  }
}

// Preferences
export async function loadPreferencesAsync(): Promise<Preferences | null> {
  try {
    return await idbGet<Preferences>(STORE_PREFERENCES)
  } catch {
    return null
  }
}

export async function savePreferencesAsync(prefs: Preferences): Promise<void> {
  try {
    await idbPut(STORE_PREFERENCES, prefs)
  } catch {
    // silent
  }
}

// Sessions (runs)
export async function loadRunsAsync(): Promise<RunResult[]> {
  try {
    return await idbGetAll<RunResult>(STORE_SESSIONS)
  } catch {
    return []
  }
}

export async function appendRunAsync(run: RunResult): Promise<void> {
  try {
    await idbAdd(STORE_SESSIONS, { ...run, v: 2 })
  } catch {
    // silent
  }
}

// Stats aggregate
export async function loadStatsAsync(): Promise<StatsAggregate> {
  try {
    const data = await idbGet<StatsAggregate>(STORE_STATS)
    return data ?? defaultStats()
  } catch {
    return defaultStats()
  }
}

export async function saveStatsAsync(stats: StatsAggregate): Promise<void> {
  try {
    await idbPut(STORE_STATS, stats)
  } catch {
    // silent
  }
}

// Streaks
export async function loadStreakAsync(): Promise<StreakData> {
  try {
    const data = await idbGet<StreakData>(STORE_STREAKS)
    return data ?? defaultStreak()
  } catch {
    return defaultStreak()
  }
}

export async function saveStreakAsync(streak: StreakData): Promise<void> {
  try {
    await idbPut(STORE_STREAKS, streak)
  } catch {
    // silent
  }
}

// Skill model
export async function loadSkillModelAsync(): Promise<UserSkillModel | null> {
  try {
    return await idbGet<UserSkillModel>(STORE_SKILL)
  } catch {
    return null
  }
}

export async function saveSkillModelAsync(model: UserSkillModel): Promise<void> {
  try {
    await idbPut(STORE_SKILL, model)
  } catch {
    // silent
  }
}

// Personal bests
export async function loadPersonalBestsAsync(): Promise<PersonalBestsStore | null> {
  try {
    return await idbGet<PersonalBestsStore>(STORE_PBS)
  } catch {
    return null
  }
}

export async function savePersonalBestsAsync(pbs: PersonalBestsStore): Promise<void> {
  try {
    await idbPut(STORE_PBS, pbs)
  } catch {
    // silent
  }
}

// Unlocks
export async function loadUnlocksAsync(): Promise<UnlockStore> {
  try {
    const data = await idbGet<UnlockStore>(STORE_UNLOCKS)
    return data ?? defaultUnlocks()
  } catch {
    return defaultUnlocks()
  }
}

export async function saveUnlocksAsync(unlocks: UnlockStore): Promise<void> {
  try {
    await idbPut(STORE_UNLOCKS, unlocks)
  } catch {
    // silent
  }
}

// Journal
export async function loadJournalAsync(): Promise<JournalEntry[]> {
  try {
    return await idbGetAll<JournalEntry>(STORE_JOURNAL)
  } catch {
    return []
  }
}

export async function appendJournalAsync(entry: Omit<JournalEntry, 'id'>): Promise<void> {
  try {
    await idbAdd(STORE_JOURNAL, entry)
  } catch {
    // silent
  }
}

// ─── Bulk operations (for export/import/reset) ──────────────────────

export async function clearAllStores(): Promise<void> {
  const stores = [STORE_PROFILE, STORE_PREFERENCES, STORE_SESSIONS, STORE_STATS, STORE_STREAKS, STORE_UNLOCKS, STORE_JOURNAL, STORE_SKILL, STORE_PBS]
  for (const store of stores) {
    await idbClear(store)
  }
}

export async function clearAllStoresExceptPreferences(): Promise<void> {
  const stores = [STORE_PROFILE, STORE_SESSIONS, STORE_STATS, STORE_STREAKS, STORE_UNLOCKS, STORE_JOURNAL, STORE_SKILL, STORE_PBS]
  for (const store of stores) {
    await idbClear(store)
  }
}

// ─── Migration from localStorage ─────────────────────────────────────

const MIGRATION_FLAG = 'lkt_idb_migrated_v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    if (typeof localStorage === 'undefined') return false
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return false

    const db = await openDb()
    if (!db) return false

    // Migrate preferences
    const prefs = safeParse<Preferences>(localStorage.getItem('lkt_prefs_v1'))
    if (prefs) await savePreferencesAsync(prefs)

    // Migrate runs
    const runs = safeParse<RunResult[]>(localStorage.getItem('lkt_runs_v1'))
    if (runs && Array.isArray(runs)) {
      for (const run of runs) {
        await appendRunAsync(run)
      }
    }

    // Migrate skill model
    const skill = safeParse<UserSkillModel>(localStorage.getItem('lkt_skill_v1'))
    if (skill) await saveSkillModelAsync(skill)

    // Migrate personal bests
    const pbs = safeParse<PersonalBestsStore>(localStorage.getItem('lkt_pbs_v1'))
    if (pbs) await savePersonalBestsAsync(pbs)

    // Build initial stats aggregate from existing runs
    if (runs && runs.length > 0) {
      const stats = defaultStats()
      stats.totalSessions = runs.length

      const last10 = runs.slice(-10)
      stats.rollingWpm10 = last10.map((r) => r.wpm)
      stats.rollingAccuracy10 = last10.map((r) => r.accuracy)

      for (const r of runs) {
        stats.totalDurationMs += r.duration_ms
        if (r.wpm > stats.bestWpm) stats.bestWpm = r.wpm
        if (r.accuracy > stats.bestAccuracy) stats.bestAccuracy = r.accuracy

        const m = stats.byMode[r.mode]
        if (m) {
          m.sessions++
          if (r.wpm > m.bestWpm) m.bestWpm = r.wpm
        }
      }

      await saveStatsAsync(stats)
    }

    localStorage.setItem(MIGRATION_FLAG, '1')
    return true
  } catch {
    return false
  }
}
