import { Link } from 'react-router-dom'
import TrekCard from './TrekCard'

export default function TrekSection({ title, subtitle, treks = [], viewAllTo }) {
  if (!treks.length) return null

  return (
    <section className="container-wide section-pad py-12 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-forest-800 dark:text-stone sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-ink/60 dark:text-stone/60 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {viewAllTo ? (
          <Link
            to={viewAllTo}
            className="text-sm font-semibold text-forest-700 transition hover:text-forest-900 dark:text-trail dark:hover:text-trail-dark"
          >
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
