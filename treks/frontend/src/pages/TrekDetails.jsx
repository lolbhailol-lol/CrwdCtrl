import { Link, useParams } from 'react-router-dom'
import Badge, { crowdTone, difficultyTone, trailTone } from '../components/Badge'
import Button from '../components/Button'
import Gallery from '../components/Gallery'
import InformationCard from '../components/InformationCard'
import StatusCard from '../components/StatusCard'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import TrekCard from '../components/TrekCard'
import { getTrekBySlug, getTreksBySlugs } from '../services/trekService'
import { formatLastUpdated } from '../utils/formatters'
import NotFound from './NotFound'

export default function TrekDetails() {
  const { slug } = useParams()
  const trek = getTrekBySlug(slug)

  if (!trek) return <NotFound />

  const nearby = getTreksBySlugs(trek.nearbyTreks)
  const { status } = trek

  return (
    <div>
      <section className="relative min-h-[48vh] overflow-hidden sm:min-h-[56vh]">
        <img
          src={trek.heroImage}
          alt={trek.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/55 to-forest-950/25" />
        <div className="container-wide section-pad relative flex min-h-[48vh] flex-col justify-end pb-10 pt-28 sm:min-h-[56vh] sm:pb-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live status
            </span>
            <Badge tone="soft">{trek.category}</Badge>
            <Badge tone={difficultyTone(trek.difficulty)}>{trek.difficulty}</Badge>
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {trek.name}
          </h1>
          <p className="mt-2 text-lg text-white/80">{trek.location}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/75">
            <span>{trek.distance}</span>
            <span className="opacity-40">·</span>
            <span>{trek.duration}</span>
            <span className="opacity-40">·</span>
            <span>{trek.elevation}</span>
          </div>
        </div>
      </section>

      <div className="container-wide section-pad py-10 sm:py-14">
        {/* Live dashboard — first on page for the core product feel */}
        <section className="mb-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-trail-dark dark:text-trail">
                Field dashboard
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-forest-800 dark:text-stone">
                Today&apos;s Trek Status
              </h2>
              <p className="mt-1 text-sm text-ink/50 dark:text-stone/50">
                Last updated {formatLastUpdated(status.lastUpdated)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatusCard
              label="Crowd Status"
              value={status.crowdLevel}
              tone={crowdTone(status.crowdLevel)}
              icon={<span aria-hidden>🟢</span>}
            />
            <StatusCard
              label="Weather"
              value={status.weather}
              tone="info"
              compact
              icon={<span aria-hidden>🌧</span>}
            />
            <StatusCard
              label="Trail Condition"
              value={status.trailCondition}
              tone={trailTone(status.trailCondition)}
              icon={<span aria-hidden>🥾</span>}
            />
            <StatusCard
              label="Parking Status"
              value={status.parkingStatus}
              tone="warning"
              compact
              icon={<span aria-hidden>🅿</span>}
            />
            <StatusCard
              label="Forest Advisory"
              value={status.forestAdvisory}
              tone="trail"
              compact
              className="sm:col-span-2 xl:col-span-1"
            />
            <StatusCard
              label="Alerts"
              value={status.alert}
              tone={status.alert?.toLowerCase().includes('no active') ? 'success' : 'danger'}
              compact
              icon={<span aria-hidden>🚨</span>}
              className="sm:col-span-2 xl:col-span-3"
            />
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section>
              <h2 className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
                Gallery
              </h2>
              <div className="mt-4">
                <Gallery images={trek.gallery} alt={trek.name} />
              </div>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
                Overview
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink/75 dark:text-stone/75">
                {trek.overview}
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
                Community Updates
              </h2>
              <p className="mt-1 text-sm text-ink/50 dark:text-stone/50">
                Live-looking field feed · mock timestamps
              </p>
              <div className="mt-4 space-y-3">
                {trek.communityUpdates.map((update) => (
                  <CommunityUpdateCard key={update.id} update={update} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
                Safety Information
              </h2>
              <ul className="mt-4 space-y-3">
                {trek.safetyTips.map((tip) => (
                  <li
                    key={tip}
                    className="card-surface flex gap-3 p-4 text-sm text-ink/75 dark:text-stone/75"
                  >
                    <span className="mt-0.5 text-trail">▸</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card-surface p-5">
              <h3 className="font-display text-lg font-semibold text-forest-800 dark:text-stone">
                Trek Information
              </h3>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ['Difficulty', trek.difficulty],
                  ['Distance', trek.distance],
                  ['Duration', trek.duration],
                  ['Elevation', trek.elevation],
                  ['Best season', trek.bestSeason],
                  ['Starting point', trek.startingPoint],
                  ['Entry fee', trek.entryFee],
                  ['Forest permission', trek.forestPermission],
                  ['Food', trek.foodAvailability],
                  ['Water', trek.waterAvailability],
                  ['Network', trek.networkCoverage],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-0.5 border-b border-forest-800/8 pb-3 last:border-0 dark:border-white/8"
                  >
                    <dt className="text-xs uppercase tracking-[0.12em] text-ink/45 dark:text-stone/45">
                      {label}
                    </dt>
                    <dd className="text-ink/80 dark:text-stone/80">{value}</dd>
                  </div>
                ))}
              </dl>
              <Button
                href={trek.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 w-full"
              >
                Open in Google Maps
              </Button>
            </div>

            <InformationCard title="Food Availability">{trek.foodAvailability}</InformationCard>
            <InformationCard title="Water Availability">{trek.waterAvailability}</InformationCard>
            <InformationCard title="Network Coverage">{trek.networkCoverage}</InformationCard>
          </aside>
        </div>

        {nearby.length ? (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
                Nearby Treks
              </h2>
              <Link to="/explore" className="text-sm font-semibold text-forest-700 dark:text-trail">
                Explore more →
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((item) => (
                <TrekCard key={item.id} trek={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
