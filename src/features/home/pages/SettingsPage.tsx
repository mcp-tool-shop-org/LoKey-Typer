import { resetFocusProfile } from '@lib'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '@app/providers/PreferencesProvider'

export function SettingsPage() {
  const [resetConfirm, setResetConfirm] = useState(false)
  const { prefs, patchPrefs } = usePreferences()

  function handleReset() {
    resetFocusProfile()
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-400">Manage your proficiency profile.</p>
      </div>

      <section className="space-y-4 rounded-2xl bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-200">Focus Mode Configuration</h2>
        
        <div className="space-y-6">
             {/* Growth Speed */}
             <div>
                <label className="block text-sm font-medium text-zinc-400">Growth Speed</label>
                <select 
                   value={prefs.focusGrowthMode} 
                   onChange={(e) => patchPrefs({ focusGrowthMode: e.target.value as any })}
                   className="mt-1.5 block w-full rounded-lg bg-zinc-950 border border-zinc-700/50 text-zinc-200 p-2.5 sm:text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                   <option value="slow">Slow (Steady)</option>
                   <option value="normal">Normal (Balanced)</option>
                   <option value="fast">Fast (Aggressive)</option>
                </select>
             </div>

             {/* Max Length */}
             <div>
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-zinc-400">Max Exercise Length</label>
                    <span className="text-xs text-zinc-500 font-mono">{prefs.focusMaxLength} chars</span>
                </div>
                <input 
                   type="range" min="30" max="1000" step="10"
                   value={prefs.focusMaxLength}
                   onChange={(e) => patchPrefs({ focusMaxLength: Number(e.target.value) })}
                   className="w-full mt-3 accent-zinc-500 cursor-pointer"
                />
             </div>

             {/* Paste */}
             <div className="flex items-center gap-3">
                 <input 
                    id="allow-paste"
                    type="checkbox" 
                    checked={prefs.focusAllowPaste} 
                    onChange={(e) => patchPrefs({ focusAllowPaste: e.target.checked })} 
                    className="accent-zinc-500 w-4 h-4 rounded border-zinc-700 bg-zinc-950 focus:ring-zinc-500 focus:ring-offset-zinc-900"
                 />
                 <label htmlFor="allow-paste" className="text-sm text-zinc-300">Allow Paste in Focus Mode (Not Recommended)</label>
             </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-zinc-900/40 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Audio Mix</h2>
            <p className="text-sm text-zinc-400">Fine-tune the balance between typing sounds, UI cues, and ambience.</p>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'crisp', label: 'Crisp', mix: { master: 1, typing: 1, ui: 0.6, ambient: 0.35 } },
              { id: 'balanced', label: 'Studio', mix: { master: 1, typing: 0.9, ui: 0.7, ambient: 0.5 } },
              { id: 'cinematic', label: 'Relax', mix: { master: 1, typing: 0.5, ui: 0.6, ambient: 0.8 } },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => patchPrefs({ audioMix: p.mix })}
                className="rounded-lg border border-zinc-700/50 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                title={`Apply ${p.label} Preset`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Master */}
          <div>
            <div className="flex justify-between">
              <label className="text-sm font-medium text-zinc-300">Master Volume</label>
              <span className="text-xs font-mono text-zinc-500">{Math.round(prefs.audioMix.master * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs.audioMix.master}
              onChange={(e) =>
                patchPrefs({ audioMix: { ...prefs.audioMix, master: parseFloat(e.target.value) } })
              }
              className="mt-2 w-full cursor-pointer accent-zinc-200"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Typing */}
            <div>
              <div className="flex justify-between">
                <label className="text-sm font-medium text-zinc-400">Typing Sounds</label>
                <span className="text-xs font-mono text-zinc-500">{Math.round(prefs.audioMix.typing * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.audioMix.typing}
                onChange={(e) =>
                  patchPrefs({ audioMix: { ...prefs.audioMix, typing: parseFloat(e.target.value) } })
                }
                className="mt-2 w-full cursor-pointer accent-zinc-500"
              />
            </div>

            {/* UI */}
            <div>
              <div className="flex justify-between">
                <label className="text-sm font-medium text-zinc-400">UI & Cues</label>
                <span className="text-xs font-mono text-zinc-500">{Math.round(prefs.audioMix.ui * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.audioMix.ui}
                onChange={(e) =>
                  patchPrefs({ audioMix: { ...prefs.audioMix, ui: parseFloat(e.target.value) } })
                }
                className="mt-2 w-full cursor-pointer accent-zinc-500"
              />
            </div>

            {/* Ambient */}
            <div>
              <div className="flex justify-between">
                <label className="text-sm font-medium text-zinc-400">Ambient Atmosphere</label>
                <span className="text-xs font-mono text-zinc-500">{Math.round(prefs.audioMix.ambient * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.audioMix.ambient}
                onChange={(e) =>
                  patchPrefs({
                    audioMix: { ...prefs.audioMix, ambient: parseFloat(e.target.value) },
                    // Also update legacy ambientVolume for back-compat/ambient player if it uses it directly
                    ambientVolume: parseFloat(e.target.value) * prefs.audioMix.master
                  })
                }
                className="mt-2 w-full cursor-pointer accent-zinc-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <Link to="/audio-diagnostics" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            Open Audio Diagnostics Panel
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-200">Accessibility</h2>
        
        <div className="space-y-4">
             <div className="flex items-center gap-3">
                 <input
                    id="sr-mode" 
                    type="checkbox" 
                    checked={prefs.screenReaderMode} 
                    onChange={(e) => patchPrefs({ screenReaderMode: e.target.checked })} 
                    className="accent-zinc-500 w-4 h-4 rounded border-zinc-700 bg-zinc-950 focus:ring-zinc-500 focus:ring-offset-zinc-900"
                 />
                 <label htmlFor="sr-mode" className="text-sm text-zinc-300">
                    Screen Reader Mode 
                    <span className="block text-xs text-zinc-500">Excludes visual-only exercises and multiline blocks.</span>
                 </label>
             </div>
             
             <div className="flex items-center gap-3">
                 <input 
                    id="reduced-motion"
                    type="checkbox" 
                    checked={prefs.reducedMotion} 
                    onChange={(e) => patchPrefs({ reducedMotion: e.target.checked })} 
                    className="accent-zinc-500 w-4 h-4 rounded border-zinc-700 bg-zinc-950 focus:ring-zinc-500 focus:ring-offset-zinc-900"
                 />
                 <label htmlFor="reduced-motion" className="text-sm text-zinc-300">Reduced Motion</label>
             </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-200">Focus Mode Progress</h2>
        <p className="text-sm text-zinc-400">
           Resetting will revert your focus level to 30 characters and clear your streak history. 
           Your typing stats (WPM/Accuracy) will remain.
        </p>

        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Reset Progress
          </button>
        ) : (
          <div className="flex items-center gap-3 animate-fade-in">
             <button
                onClick={handleReset}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
             >
               Confirm Reset
             </button>
             <button
                onClick={() => setResetConfirm(false)}
                className="rounded-lg hover:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors"
             >
               Cancel
             </button>
          </div>
        )}
      </section>
    </div>
  )
}
