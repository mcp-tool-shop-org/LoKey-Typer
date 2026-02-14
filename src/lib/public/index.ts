// Public lib API: UI/features should import only from `@lib`.
// Internal modules (storage, engines, implementation details) are not stable.

export * from '../effectivePrefs'
export * from '../feedback'
export * from '../mode'
export * from '../typing'
export * from '../typingMetrics'
export * from '../focusProgression'

export { ambientPlayer } from '../ambient'
export { typewriterAudio } from '../audio'

export { isTemplateExercise, renderTemplateExercise } from '../templateRender'

export {
  generateDailySet,
  loadDailyProgress,
  saveDailyProgress,
  type DailyItemResult,
  type DailyProgress,
  type DailySessionType,
  type DailySet,
  type DailySetItem,
  type DailySetItemKind,
} from '../dailySet'

export {
  pickNextExercise,
  getPoolStatus,
  type ContentEngineResult,
  type PoolStatus,
} from '../contentEngine'

// preferredQuickstartMode is now re-exported from ../mode (via export * above)

export { updateSkillModelFromRun } from '../skillModel'

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
  loadFocusProfile,
  saveFocusProfile,
  resetFocusProfile,
  maybeUpdatePersonalBest,
  pushRecent,
  resetPreferencesToDefaults,
  saveLastMode,
  saveSkillModel,
  topCompetitiveRuns,
  type Preferences,
  type FocusProfile,
  type RunResult,
  type SprintDurationMs,
  type UserSkillModel,
} from '../storage'
