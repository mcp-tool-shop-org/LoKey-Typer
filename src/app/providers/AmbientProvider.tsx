import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { ambientPlayer } from '@lib-internal/ambient'
import { resumeAudioContext } from '@lib-internal/audioContext'
import { getEffectiveAmbientEnabled } from '@lib-internal/effectivePrefs'
import { usePreferences } from './PreferencesProvider'

type AmbientContextValue = {
  noteTypingActivity: () => void
}

const AmbientContext = createContext<AmbientContextValue>({
  noteTypingActivity: () => {},
})

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = usePreferences()
  const startedRef = useRef(false)

  // Sync preferences to engine on every change.
  useEffect(() => {
    ambientPlayer.setPreferences({
      enabled: getEffectiveAmbientEnabled(prefs),
      volume: prefs.ambientVolume,
      category: prefs.ambientCategory,
      pauseOnTyping: prefs.ambientPauseOnTyping,
      reducedMotion: Boolean(prefs.reducedMotion),
      screenReaderMode: Boolean(prefs.screenReaderMode),
    })
  }, [prefs])

  // One-time user gesture unlock: first click or keypress starts ambient.
  useEffect(() => {
    if (startedRef.current) return

    const unlock = async () => {
      if (startedRef.current) return
      startedRef.current = true
      await resumeAudioContext()
      await ambientPlayer.start()
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)

    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const noteTypingActivity = useCallback(() => {
    ambientPlayer.noteTypingActivity()
  }, [])

  return (
    <AmbientContext.Provider value={{ noteTypingActivity }}>
      {children}
    </AmbientContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAmbient() {
  return useContext(AmbientContext)
}
