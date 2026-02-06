import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '@app/components/Icon'

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
  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Icon name="logo-mark" size={22} className="text-zinc-400" />
            <div className="text-base font-semibold tracking-tight text-zinc-50">LoKey Typer</div>
            <div className="hidden text-xs text-zinc-500 sm:block">·</div>
            <div className="hidden text-xs text-zinc-500 sm:block">Speed • Accuracy • Consistency</div>
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
