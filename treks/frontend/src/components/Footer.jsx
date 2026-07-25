import { Link } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE, NAV_LINKS } from '../utils/constants'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-forest-800/10 bg-forest-900 text-stone dark:border-white/5">
      <div className="container-wide section-pad grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-bold">{APP_NAME}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone/70">{APP_TAGLINE}</p>
          <p className="mt-6 text-xs uppercase tracking-[0.16em] text-trail">
            A CrwdCtrl discovery surface
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone/50">Navigate</p>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/" className="text-sm text-stone/80 transition hover:text-trail">
                Home
              </Link>
            </li>
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-stone/80 transition hover:text-trail">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone/50">Note</p>
          <p className="mt-4 text-sm leading-relaxed text-stone/70">
            This is a trek discovery & information platform — not a booking site. Always verify
            local conditions before you leave.
          </p>
        </div>
      </div>

      <div className="border-t border-white/8 py-5 text-center text-xs text-stone/45">
        © {new Date().getFullYear()} {APP_NAME}. Built for Maharashtra trails.
      </div>
    </footer>
  )
}
