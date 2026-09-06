import Button from '../components/Button'
import { APP_BRAND, APP_NAME, APP_SUBTITLE, APP_TAGLINE } from '../utils/constants'

export default function About() {
  return (
    <div className="container-narrow section-pad py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{APP_BRAND}</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-xl font-semibold text-ink">{APP_TAGLINE}</p>
      <p className="mt-2 text-muted">{APP_SUBTITLE}</p>

      <div className="mt-10 space-y-6 text-muted">
        <p>
          {APP_NAME} is a vertical under {APP_BRAND}. Not a booking marketplace — the place
          Maharashtra trekkers open <strong className="text-ink">before leaving</strong> to know
          today&apos;s situation.
        </p>
        <p>
          Version 1 is a lite CrwdCtrl vertical focused on Waterfall and Jungle treks — Today&apos;s
          Trek Status, Trek Information, and Community Updates. No login, signup, bookings, payments,
          or profiles.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button to="/explore">Explore destinations</Button>
        <Button to="/alerts" variant="secondary">
          View alerts
        </Button>
      </div>
    </div>
  )
}
