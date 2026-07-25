import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { NAV_LINKS, APP_NAME } from '../utils/constants'
import { useTheme } from '../hooks/useTheme'
import Button from './Button'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive
        ? 'text-forest-800 dark:text-trail'
        : 'text-ink/70 hover:text-forest-800 dark:text-stone/70 dark:hover:text-stone'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-forest-800/8 bg-mist/80 backdrop-blur-xl dark:border-white/8 dark:bg-forest-950/80">
      <div className="container-wide section-pad flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-800 text-trail shadow-sm dark:bg-trail dark:text-forest-950">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 18L8 8L12 13L16 6L21 18H3Z" fill="currentColor" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-forest-800 dark:text-stone">
            {APP_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-forest-800/10 p-2.5 text-forest-800 transition hover:bg-forest-800/5 dark:border-white/10 dark:text-stone dark:hover:bg-white/5"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2V4M12 20V22M4 12H2M22 12H20M5 5L6.5 6.5M17.5 17.5L19 19M19 5L17.5 6.5M6.5 17.5L5 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <Button to="/explore" size="sm">
            Explore Treks
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-forest-800 md:hidden dark:text-stone"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {open ? (
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-forest-800/8 px-4 py-4 md:hidden dark:border-white/8">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-full border border-forest-800/10 px-3 py-2 text-sm dark:border-white/10"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <Button to="/explore" size="sm" onClick={() => setOpen(false)}>
                Explore Treks
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
