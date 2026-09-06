import { Link } from 'react-router-dom'
import TrekCard from './TrekCard'

export default function TrekSection({ title, subtitle, treks = [], viewAllTo, className = '' }) {
  if (!treks.length) return null

  return (
    <section className={`container-wide section-pad py-10 sm:py-14 ${className}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p> : null}
        </div>
        {viewAllTo ? (
          <Link to={viewAllTo} className="text-sm font-bold text-brand hover:underline">
            View all →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {treks.map((trek) => (
          <TrekCard key={trek.id} trek={trek} />
        ))}
      </div>
    </section>
  )
}
