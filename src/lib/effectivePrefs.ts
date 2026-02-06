export type AccessibilityLockPrefs = {
  ambientEnabled: boolean
  screenReaderMode: boolean
  reducedMotion: boolean
}

export function isAmbientLockedOff(prefs: Pick<AccessibilityLockPrefs, 'screenReaderMode' | 'reducedMotion'>) {
  return Boolean(prefs.screenReaderMode || prefs.reducedMotion)
}

export function enforceAccessibilityLocks<T extends AccessibilityLockPrefs>(prefs: T): T {
  if (isAmbientLockedOff(prefs) && prefs.ambientEnabled) return { ...prefs, ambientEnabled: false }
  return prefs
}

export function getEffectiveAmbientEnabled(prefs: AccessibilityLockPrefs) {
  return enforceAccessibilityLocks(prefs).ambientEnabled
}
