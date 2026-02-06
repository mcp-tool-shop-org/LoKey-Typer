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
  type SkillTreeState,
  type SkillBranch,
  type BranchProgress,
  type CompetitiveState,
  type League,
  type RuleSet,
  type GoalsState,
  defaultProfile,
  defaultStreak,
  defaultStats,
  defaultUnlocks,
  defaultSkillTreeState,
  defaultCompetitiveState,
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
  loadGoalsAsync,
  saveGoalsAsync,
  loadSkillTreeAsync,
  saveSkillTreeAsync,
  loadCompetitiveAsync,
  saveCompetitiveAsync,
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

export {
  suggestWeeklyIntent,
  generateDailyGoal,
  checkGoalCompletion,
  updateGoalsAfterRun,
  intentLabel,
  intentDescription,
  defaultGoals,
  type WeeklyIntent,
  type DailyGoal,
  type DayCompletion,
} from '../goalsEngine'

export {
  computeXpFromRun,
  applyXp,
  xpForLevel,
  type XpGains,
} from '../skillTree'

export {
  determineLeague,
  validateRunAgainstRuleSet,
  updateCompetitiveAfterRun,
  type RunValidation,
} from '../competitiveEngine'

export {
  assessRunValidity,
  computeRatingDelta,
  applyRatingDelta,
  validityLabel,
  getRestartCount,
  incrementRestartCount,
  resetRestartCount,
  RESTART_SESSION_KEY,
  type RunValidity,
} from '../ratingEngine'

export {
  getPackRule,
  getPackUnlockStatus,
  evaluatePackUnlock,
  type PackUnlockRule,
  type PackUnlockStatus,
} from '../progressionEngine'

export {
  computeAdaptiveProfile,
  scoreExerciseForProfile,
  adjustDifficultyBand,
  type AdaptiveProfile,
} from '../adaptiveEngine'

export {
  planNextSessions,
  generatePlanReasons,
  resolvePlanExercise,
  type SessionPlan,
} from '../rotationEngine'
