import Button from '../components/Button'
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE } from '../utils/constants'

export default function About() {
  return (
    <div className="container-narrow section-pad py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trail-dark dark:text-trail">
        About
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-forest-800 dark:text-stone sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-xl font-medium text-forest-800 dark:text-stone">{APP_TAGLINE}</p>
      <p className="mt-2 text-ink/70 dark:text-stone/70">{APP_SUBTITLE}</p>

      <div className="mt-10 space-y-6 text-ink/75 dark:text-stone/75">
        <p>
          This is a <strong>live information platform</strong> for Maharashtra trekkers — not a
          booking site, marketplace, or social network. Before leaving for a trek, open CrwdCtrl
          Treks to know crowd, weather, trail condition, parking, forest advisories, and field
          updates.
        </p>
        <p>
          The site is fully open: <strong>no login, no signup, no payments, no profiles</strong>.
          Anyone can check conditions instantly.
        </p>
        <p>
          This MVP demo focuses only on Maharashtra&apos;s most famous, highly visited destinations —
          forts, waterfalls, jungle routes, peaks, and valley / nature sites — with realistic mock
          live data structured for future API connection.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button to="/explore">Explore destinations</Button>
        <Button to="/contact" variant="secondary">
          Contact
        </Button>
      </div>
    </div>
  )
}
