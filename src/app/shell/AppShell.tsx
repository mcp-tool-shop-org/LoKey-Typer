import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '@app/components/Icon'
import { usePreferences } from '@app/providers/PreferencesProvider'
import { modeToPath, preferredQuickstartMode } from '@lib'

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

const ICON_BTN =
  'rounded-md p-2 transition outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'

export function AppShell() {
  const navigate = useNavigate()
  const { prefs, patchPrefs } = usePreferences()

  function handleRandom() {
    const mode = preferredQuickstartMode()
    navigate(`/${modeToPath(mode)}?autostart=${Date.now()}`)
  }

  function handleMuteToggle() {
    patchPrefs({ ambientEnabled: !prefs.ambientEnabled })
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-80">
            <Icon name="logo-mark" size={22} className="text-zinc-400" />
            <div className="text-base font-semibold tracking-tight text-zinc-50">LoKey Typer</div>
            <div className="hidden text-xs text-zinc-500 sm:block">·</div>
            <div className="hidden text-xs text-zinc-500 sm:block">Speed • Accuracy • Consistency</div>
          </Link>
          <nav className="flex items-center gap-2">
            <NavItem to="/" label="Home" />
            <NavItem to="/daily" label="Daily" />
            <NavItem to="/focus" label="Focus" />
            <NavItem to="/real-life" label="Real-Life" />
            <NavItem to="/competitive" label="Competitive" />

            {/* Divider */}
            <div className="mx-0.5 h-5 w-px bg-zinc-800" />

            {/* Random exercise */}
            <button
              type="button"
              onClick={handleRandom}
              className={`${ICON_BTN} text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200`}
              aria-label="Random exercise"
              title="Random exercise"
            >
              <Icon name="shuffle" size={18} />
            </button>

            {/* Mute / unmute ambient */}
            <button
              type="button"
              onClick={handleMuteToggle}
              className={`${ICON_BTN} ${prefs.ambientEnabled ? 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200' : 'text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400'}`}
              aria-label={prefs.ambientEnabled ? 'Mute ambient' : 'Unmute ambient'}
              title={prefs.ambientEnabled ? 'Mute ambient' : 'Unmute ambient'}
            >
              <Icon name={prefs.ambientEnabled ? 'sound-on' : 'sound-off'} size={18} />
            </button>

            {/* Settings */}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                [
                  ICON_BTN,
                  isActive ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                ].join(' ')
              }
              aria-label="Settings"
            >
              <Icon name="settings" size={18} />
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
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
