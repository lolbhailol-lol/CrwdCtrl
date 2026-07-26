import { useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { APP_EYEBROW, APP_NAME, NAV_LINKS } from '../utils/constants'
import { useTrekData } from '../context/TrekDataContext'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { ready, tick, getAlerts } = useTrekData()
  const alertCount = useMemo(
    () => (ready ? getAlerts().length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, tick],
  )

  const pillClass = ({ isActive }) =>
    `px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
      isActive
        ? 'bg-brand text-brand-ink shadow-md'
        : 'text-muted hover:text-brand hover:bg-white/5'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-surface/80 backdrop-blur-xl">
      <div className="container-wide section-pad flex items-center justify-between py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden rounded-full p-2 text-brand hover:bg-brand/10"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span
              className="material-symbols-outlined text-3xl text-brand transition-transform group-hover:scale-105"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              radar
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-none tracking-tight text-ink sm:text-xl">
                {APP_NAME}
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-brand sm:inline-block">
                {APP_EYEBROW}
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-canvas/60 p-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={pillClass}>
              {link.label}
              {link.label === 'Alerts' && alertCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-warn px-1.5 text-[10px] font-bold text-warn-ink">
                  {alertCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/alerts"
          className="relative rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-brand"
          aria-label="View alerts"
        >
          <span className="material-symbols-outlined text-2xl">notifications</span>
          {alertCount > 0 ? (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-warn" />
          ) : null}
        </Link>
      </div>

      {open ? (
        <div className="border-t border-white/10 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-sm font-semibold ${
                    isActive ? 'bg-brand/15 text-brand' : 'text-muted'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
