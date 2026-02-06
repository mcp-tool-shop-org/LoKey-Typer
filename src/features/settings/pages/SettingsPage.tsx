import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import { getEffectiveAmbientEnabled, isAmbientLockedOff, modeLabel, resetPreferencesToDefaults, type SprintDurationMs } from '@lib'
import { usePreferences } from '@app'
import { Icon, type IconName } from '@app/components/Icon'

function Field({ label, icon, children }: { label: string; icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
        {icon ? <Icon name={icon} size={16} className="shrink-0 text-zinc-500" /> : null}
        {label}
      </div>
      <div className="mt-3 text-sm text-zinc-300">{children}</div>
    </div>
  )
}

export function SettingsPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const { prefs, setPrefs } = usePreferences()
  const label = modeLabel(mode)

  const ambientLockedOff = isAmbientLockedOff(prefs)
  const ambientEnabledEffective = getEffectiveAmbientEnabled(prefs)

  const ambientDescription = (() => {
    const p = prefs.ambientProfile
    if (p === 'random') return 'Varies each session. Keeps things fresh.'
    if (p === 'focus_soft') return 'Quiet, steady background for long focus.'
    if (p === 'focus_warm') return 'Softer bed with warmth and minimal presence.'
    if (p === 'competitive_clean') return 'Clearer presence for fast, precise sessions.'
    if (p === 'nature_air') return 'Airy texture with gentle movement, no beat.'
    return 'No ambient sound.'
  })()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        setPrefs(resetPreferencesToDefaults())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setPrefs])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{label} settings</h1>
          <p className="mt-1 text-sm text-zinc-400">Local-only preferences.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Back
        </button>
      </div>

      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Global</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sound" icon="sound-on">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={(e) => setPrefs({ ...prefs, soundEnabled: e.target.checked })}
                />
                Sound on/off
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={prefs.volume}
                  onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) })}
                />
              </label>
            </div>

            <div className="mt-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.bellOnCompletion}
                  onChange={(e) => setPrefs({ ...prefs, bellOnCompletion: e.target.checked })}
                />
                Bell on completion
              </label>
            </div>
          </Field>

          <Field label="Ambient" icon="ambient-wave">
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ambientEnabledEffective}
                  disabled={ambientLockedOff}
                  onChange={(e) => setPrefs({ ...prefs, ambientEnabled: e.target.checked })}
                />
                Ambient on/off
              </label>

              {ambientLockedOff ? (
                <div className="text-xs text-zinc-400">
                  Ambient is disabled while Screen Reader Mode is active.
                </div>
              ) : null}

              <label className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Soundscape</span>
                <select
                  value={prefs.ambientProfile}
                  disabled={!ambientEnabledEffective}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      ambientProfile: e.target.value as typeof prefs.ambientProfile,
                    })
                  }
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-zinc-200/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  <option value="random">Random (recommended)</option>
                  <option value="focus_soft">Soft Focus</option>
                  <option value="focus_warm">Warm Silence</option>
                  <option value="competitive_clean">Clean Drive</option>
                  <option value="nature_air">Open Air</option>
                  <option value="off">Off</option>
                </select>
              </label>

              <div className="text-xs text-zinc-400">{ambientDescription}</div>

              <label className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={prefs.ambientVolume}
                  disabled={!ambientEnabledEffective}
                  onChange={(e) => setPrefs({ ...prefs, ambientVolume: Number(e.target.value) })}
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.ambientPauseOnTyping}
                  disabled={!ambientEnabledEffective}
                  onChange={(e) => setPrefs({ ...prefs, ambientPauseOnTyping: e.target.checked })}
                />
                Pause ambient when typing
              </label>
            </div>
          </Field>

          <Field label="Font size" icon="type-text">
            <div className="flex gap-2">
              {[0.9, 1, 1.1].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, fontScale: s as 0.9 | 1 | 1.1 })}
                  className={
                    'rounded-md border px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
                    (prefs.fontScale === s
                      ? 'border-zinc-600 bg-zinc-900 text-zinc-50'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900')
                  }
                >
                  {s === 0.9 ? 'Small' : s === 1 ? 'Default' : 'Large'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Live WPM display" icon="stat-speed">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.showLiveWpm.focus}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      showLiveWpm: { ...prefs.showLiveWpm, focus: e.target.checked },
                    })
                  }
                />
                Focus
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.showLiveWpm.real_life}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      showLiveWpm: { ...prefs.showLiveWpm, real_life: e.target.checked },
                    })
                  }
                />
                Real-Life
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.showLiveWpm.competitive}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      showLiveWpm: { ...prefs.showLiveWpm, competitive: e.target.checked },
                    })
                  }
                />
                Competitive
              </label>
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-400">Mode-specific</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mode === 'focus' ? (
            <Field label="Focus HUD" icon="mode-focus">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.focusMinimalHud}
                  onChange={(e) => setPrefs({ ...prefs, focusMinimalHud: e.target.checked })}
                />
                Minimal HUD (default on)
              </label>
            </Field>
          ) : null}

          {mode === 'competitive' ? (
            <>
              <Field label="Sprint duration" icon="timer">
                <div className="flex gap-2">
                  {[30_000, 60_000, 120_000].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, competitiveSprintDurationMs: d as SprintDurationMs })}
                      className={
                        'rounded-md border px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
                        (prefs.competitiveSprintDurationMs === d
                          ? 'border-zinc-600 bg-zinc-900 text-zinc-50'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900')
                      }
                    >
                      {d / 1000}s
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Ghost run" icon="ghost">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.competitiveGhostEnabled}
                    onChange={(e) => setPrefs({ ...prefs, competitiveGhostEnabled: e.target.checked })}
                  />
                  Enable PB comparison (local)
                </label>
              </Field>
            </>
          ) : null}
        </div>
      </section>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
        Preferences, history, and PBs are stored locally in your browser (no account required).
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPrefs(resetPreferencesToDefaults())}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Reset to Safe Defaults
          </button>
          <div className="text-[11px] text-zinc-500">Shortcut: Ctrl+Alt+R</div>
        </div>
      </div>
    </div>
  )
}
