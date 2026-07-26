import { Link, useLocation } from 'react-router-dom'
import { APP_BRAND, APP_NAME, APP_TAGLINE, NAV_LINKS } from '../utils/constants'

export default function Footer() {
  const { pathname } = useLocation()
  // Hide on mobile Home — sticky Mark-in + bottom nav already take the chrome
  const hideOnMobileHome = pathname === '/'

  return (
    <footer
      className={`mt-12 border-t border-white/10 bg-surface md:pb-0 ${
        hideOnMobileHome ? 'hidden md:block' : 'pb-28 md:pb-0'
      }`}
    >
      <div className="container-wide section-pad grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-bold text-ink">{APP_NAME}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{APP_TAGLINE}</p>
          <p className="mt-6 text-xs uppercase tracking-[0.16em] text-brand">
            A {APP_BRAND} vertical · live trek information
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Navigate</p>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-muted transition hover:text-brand">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/contact" className="text-sm text-muted transition hover:text-brand">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Note</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Not a booking site. No login. Check crowd, weather, trail & parking before you leave —
            then verify locally on the day.
          </p>
        </div>
      </div>

      <div className="border-t border-white/8 py-5 text-center text-xs text-muted/50">
        © {new Date().getFullYear()} {APP_BRAND}. {APP_NAME}.
      </div>
    </footer>
  )
}
