import Button from '../components/Button'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'

export default function About() {
  return (
    <div className="container-narrow section-pad py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trail-dark dark:text-trail">
        About
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-forest-800 dark:text-stone sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-lg text-ink/70 dark:text-stone/70">{APP_TAGLINE}</p>

      <div className="prose-trek mt-10 space-y-6 text-ink/75 dark:text-stone/75">
        <p>
          CrwdCtrl Treks is a dedicated trek discovery and information platform for Maharashtra.
          It is not a booking website. The goal is simpler and more useful: help every trekker
          understand the trail before leaving home.
        </p>
        <p>
          Look up difficulty, distance, elevation, parking, forest permissions, water, food,
          network, washrooms, safety tips — and the unique <strong>Today&apos;s Trek Status</strong>{' '}
          layer covering crowd, trail condition, weather, parking, and forest advisories.
        </p>
        <p>
          Community updates add ground-level signals: rain since morning, parking almost full,
          waterfall at full flow, slippery midpoints. All MVP data is mock JSON today, designed
          so a future CrwdCtrl backend can plug in cleanly.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button to="/explore">Explore Treks</Button>
        <Button to="/contact" variant="secondary">
          Contact
        </Button>
      </div>
    </div>
  )
}
