import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ambientEngine, typewriterAudio } from '@lib'
import { usePreferences } from '@app'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          isActive ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

export function AppShell() {
  const { prefs } = usePreferences()
  const location = useLocation()
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lkt_audio_unlocked') === '1'
    } catch {
      return false
    }
  })

  const shellMode = useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/competitive')) return 'competitive' as const
    if (p.startsWith('/real-life')) return 'real_life' as const
    return 'focus' as const
  }, [location.pathname])

  useEffect(() => {
    let didUnlock = false

    const unlock = () => {
      if (didUnlock) return
      didUnlock = true

      typewriterAudio
        .ensureReady()
        .then(() => typewriterAudio.resume())
        .catch(() => {
          // ignore
        })

      ambientEngine.ensureReady()
      ambientEngine.userGestureUnlock().catch(() => {
        // ignore
      })

      setAudioUnlocked(true)
      try {
        localStorage.setItem('lkt_audio_unlocked', '1')
      } catch {
        // ignore
      }
    }

    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    window.addEventListener('touchstart', unlock, { capture: true })

    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
      window.removeEventListener('touchstart', unlock, { capture: true })
    }
  }, [])

  useEffect(() => {
    const path = location.pathname
    const isRunRoute = path.includes('/run/')

    // Typing sessions own ambient control while a run is active.
    if (isRunRoute) return

    // Preload/arm immediately on app open so first gesture fades in instantly.
    ambientEngine.ensureReady().catch(() => {
      // ignore
    })

    ambientEngine.update({
      mode: shellMode,
      prefs,
      sessionActive: true,
      sessionPaused: false,
      exerciseRemainingMs: null,
    })

    return () => {
      ambientEngine.update({
        mode: shellMode,
        prefs,
        sessionActive: false,
        sessionPaused: true,
        exerciseRemainingMs: null,
      })
    }
  }, [location.pathname, prefs, shellMode])

  const showUnlockHint = !audioUnlocked && prefs.soundEnabled && prefs.ambientEnabled

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <div className="text-base font-semibold tracking-tight text-zinc-50">LoKey Typer</div>
            <div className="hidden text-xs text-zinc-400 sm:block">Speed • Accuracy • Consistency</div>
          </div>
          <nav className="flex items-center gap-2">
            <NavItem to="/" label="Home" />
            <NavItem to="/daily" label="Daily" />
            <NavItem to="/focus" label="Focus" />
            <NavItem to="/real-life" label="Real-Life" />
            <NavItem to="/competitive" label="Competitive" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {showUnlockHint ? (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                Sound is ready. Tap or press any key to enable audio.
              </div>
              <button
                type="button"
                onClick={() => {
                  setAudioUnlocked(true)
                  try {
                    localStorage.setItem('lkt_audio_unlocked', '1')
                  } catch {
                    // ignore
                  }
                }}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-zinc-500">
          <div>Built with Vite + React + TypeScript</div>
          <div className="hidden sm:block">PWA-ready for Windows packaging</div>
        </div>
      </footer>
    </div>
  )
}
