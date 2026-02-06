// Public lib API: UI/features should import only from `@lib`.
// Internal modules (storage, engines, implementation details) are not stable.

export * from '../effectivePrefs'
export * from '../feedback'
export * from '../mode'
export * from '../typing'
export * from '../typingMetrics'

export { ambientEngine } from '../ambient'
export { typewriterAudio } from '../audio'

export { isTemplateExercise, renderTemplateExercise } from '../templateRender'

export {
  generateDailySet,
  type DailySessionType,
  type DailySetItemKind,
} from '../dailySet'

export { pickQuickstartExercise, preferredQuickstartMode } from '../quickstart'

export { updateSkillModelFromRun } from '../skillModel'

export {
  updateStatsFromRun,
  updateStreakFromRun,
  computeTrend,
  type Trend,
} from '../statsEngine'

export {
  getNextRecommendations,
  type Recommendation,
  type RecommendationContext,
  type RecommendationPrefs,
} from '../recommendations'

export {
  appendRun,
  bestAccuracyForExercise,
  bestWpmForExercise,
  getOrCreateUserId,
  getPersonalBest,
  loadRuns,
  loadSkillModel,
  maybeUpdatePersonalBest,
  pushRecent,
  resetPreferencesToDefaults,
  saveLastMode,
  saveSkillModel,
  topCompetitiveRuns,
  type Preferences,
  type RunResult,
  type SprintDurationMs,
  type UserSkillModel,
} from '../storage'

export {
  type UserProfile,
  type StreakData,
  type StatsAggregate,
  type JournalEntry,
  type UnlockStore,
  defaultProfile,
  defaultStreak,
  defaultStats,
  defaultUnlocks,
  loadProfileAsync,
  saveProfileAsync,
  loadPreferencesAsync,
  savePreferencesAsync,
  loadRunsAsync,
  appendRunAsync,
  loadStatsAsync,
  saveStatsAsync,
  loadStreakAsync,
  saveStreakAsync,
  loadSkillModelAsync,
  saveSkillModelAsync,
  loadPersonalBestsAsync,
  savePersonalBestsAsync,
  loadUnlocksAsync,
  saveUnlocksAsync,
  loadJournalAsync,
  appendJournalAsync,
  clearAllStores,
  clearAllStoresExceptPreferences,
  migrateFromLocalStorage,
} from '../db'

export {
  exportAllData,
  importData,
  resetAllData,
  type ExportPayload,
  type ImportResult,
} from '../dataExport'
