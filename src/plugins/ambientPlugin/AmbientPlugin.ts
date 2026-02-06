import type { Mode } from '@content'
import type { Preferences } from '@lib'
import { ambientEngine } from '@lib'

export type AmbientRuntimeContext = {
  mode: Mode
  prefs: Preferences
  sessionPaused?: boolean
  exerciseRemainingMs?: number | null
}

/**
 * AmbientPlugin
 * - Global singleton friendly (create once, keep alive)
 * - Handles user-gesture unlock + page visibility
 * - Plays perpetually when enabled (no 'sessionActive' concept required by host app)
 */
export class AmbientPlugin {
  private didInit = false
  private removeGestureListeners: (() => void) | null = null
  private removeVisibilityListener: (() => void) | null = null

  init(triggerUnlock: boolean = false) {
    if (this.didInit) return
    this.didInit = true

    // Keep the engine ready so the first user gesture fades in instantly.
    ambientEngine.ensureReady().catch(() => {
      // ignore
    })

    // Unlock audio on first user gesture.
    let didUnlock = false
    const unlock = () => {
      if (didUnlock) return
      didUnlock = true
      ambientEngine.ensureReady().catch(() => {
        // ignore
      })
      ambientEngine.userGestureUnlock().catch(() => {
        // ignore
      })
    }

    // If the host called init() from within a user gesture handler,
    // unlock immediately so audio starts on the *first* gesture.
    if (triggerUnlock) {
      unlock()
    }

    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    window.addEventListener('touchstart', unlock, { capture: true })

    this.removeGestureListeners = () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
      window.removeEventListener('touchstart', unlock, { capture: true })
    }

    // Pause when tab is hidden; resume when visible.
    const onVis = () => {
      try {
        ambientEngine.setVisibilityPaused(Boolean(document.hidden))
      } catch {
        // ignore
      }
    }
    document.addEventListener('visibilitychange', onVis, { passive: true })
    onVis()

    this.removeVisibilityListener = () => {
      document.removeEventListener('visibilitychange', onVis)
    }
  }

  /**
   * Update ambient parameters.
   * Ambient is treated as "global + perpetual" when enabled:
   * - sessionActive is always true
   * - host can optionally pause it (sessionPaused)
   */
  update(ctx: AmbientRuntimeContext) {
    this.init()
    ambientEngine.update({
      mode: ctx.mode,
      prefs: ctx.prefs,
      sessionActive: true,
      sessionPaused: Boolean(ctx.sessionPaused),
      exerciseRemainingMs: ctx.exerciseRemainingMs ?? null,
    })
  }

  noteTypingActivity() {
    ambientEngine.noteTypingActivity()
  }

  dispose() {
    this.removeGestureListeners?.()
    this.removeGestureListeners = null
    this.removeVisibilityListener?.()
    this.removeVisibilityListener = null
    this.didInit = false
  }
}

export const ambientPlugin = new AmbientPlugin()
