import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useTrekData } from '../context/TrekDataContext'

const items = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'explore' },
  { to: '/alerts', label: 'Alerts', icon: 'warning', badge: true },
  { to: '/about', label: 'About', icon: 'info' },
]

export default function BottomNav() {
  const { ready, tick, getTrailIssues } = useTrekData()
  const alertCount = useMemo(
    () => (ready ? getTrailIssues().length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, tick],
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around rounded-t-3xl border-t border-white/10 bg-surface/90 px-4 py-2.5 shadow-2xl backdrop-blur-2xl md:hidden pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `relative flex min-h-11 min-w-11 flex-col items-center justify-center px-4 py-1 transition-colors ${
              isActive ? 'text-brand' : 'text-muted hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <div className="absolute -top-2.5 h-1 w-8 rounded-full bg-brand" />
              ) : null}
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-2xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.badge && alertCount > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-warn"
                    aria-label={`${alertCount} trails with warnings`}
                    role="status"
                  />
                ) : null}
              </div>
              <span className="mt-0.5 text-[10px] font-bold tracking-wider">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
