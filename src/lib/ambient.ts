import { AmbientEngineV2 } from './ambient/ambientEngine'

export const ambientEngine = new AmbientEngineV2()

// Global visibility hook (fail-safe; silence when tab is not active).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    ambientEngine.setVisibilityPaused(document.hidden)
  })
}
