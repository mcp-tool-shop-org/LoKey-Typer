import { preferredQuickstartMode } from '@lib'
import { SettingsPage } from './SettingsPage'

/**
 * Global /settings route — loads settings for the user's last-used mode.
 * All the important prefs (font, volume, ambient, sound) are shared across
 * modes, so the mode only affects the header label and a few mode-specific
 * toggles.
 */
export function GlobalSettingsPage() {
  const mode = preferredQuickstartMode()
  return <SettingsPage mode={mode} />
}
