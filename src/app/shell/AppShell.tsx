import { Link, NavLink, Outlet } from 'react-router-dom'
import { Icon } from '@app/components/Icon'
import { useAmbient } from '@app/providers/AmbientProvider'
import { usePreferences } from '@app/providers/PreferencesProvider'

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
  const { prefs, patchPrefs } = usePreferences()
  const { skipTrack } = useAmbient()

  function handleMuteToggle() {
    patchPrefs({ ambientEnabled: !prefs.ambientEnabled })
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-80">
            <Icon name="logo-mark" size={22} className="text-zinc-400" />
            <div className="text-base font-semibold tracking-tight text-zinc-50">LoKey Typer</div>
            <div className="hidden text-xs text-zinc-500 sm:block">·</div>
            <div className="hidden text-xs text-zinc-500 sm:block">Speed • Accuracy • Consistency</div>
          </Link>
          <nav className="flex items-center gap-2.5">
            <NavItem to="/" label="Home" />
            <NavItem to="/daily" label="Daily" />
            <NavItem to="/focus" label="Focus" />
            <NavItem to="/real-life" label="Real-Life" />
            <NavItem to="/competitive" label="Competitive" />

            {/* Divider */}
            <div className="mx-0.5 h-5 w-px bg-zinc-800" />

            {/* Skip to random ambient track */}
            <button
              type="button"
              onClick={skipTrack}
              className={`${ICON_BTN} text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200`}
              aria-label="Random ambient track"
              title="Random ambient track"
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

          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <Outlet />
      </main>

    </div>
  )
}
