import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Badge, {
  crowdTone,
  difficultyTone,
  entryTone,
  trailTone,
} from '../components/Badge'
import Button from '../components/Button'
import Gallery from '../components/Gallery'
import GoingTodayPanel from '../components/GoingTodayPanel'
import StatusCard from '../components/StatusCard'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import TrekCard from '../components/TrekCard'
import LoadingScreen from '../components/LoadingScreen'
import { useTrekData } from '../context/TrekDataContext'
import { fetchTrekBySlug } from '../services/trekService'
import { formatRelativeTime } from '../utils/formatters'
import NotFound from './NotFound'

const INFO_ROWS = [
  ['Difficulty', 'difficulty'],
  ['Distance', 'distance'],
  ['Duration', 'duration'],
  ['Elevation', 'elevation'],
  ['Best season', 'bestSeason'],
  ['Starting point', 'startingPoint'],
  ['Entry fee', 'entryFee'],
  ['Forest permission', 'forestPermission'],
  ['Food', 'foodAvailability'],
  ['Water', 'waterAvailability'],
  ['Network', 'networkCoverage'],
]

export default function TrekDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { ready, getTrekBySlug, getTreksBySlugs, tick, nowTick, source } = useTrekData()
  const [trek, setTrek] = useState(null)
  const [loadingTrek, setLoadingTrek] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoadingTrek(true)
      setNotFound(false)
      const fromApi = await fetchTrekBySlug(slug)
      if (!alive) return
      if (fromApi) {
        setTrek(fromApi)
      } else if (ready) {
        const local = getTrekBySlug(slug)
        setTrek(local)
        setNotFound(!local)
      }
      setLoadingTrek(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [slug, ready, tick, getTrekBySlug])

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  if (!ready || loadingTrek) {
    return <LoadingScreen label="Loading trek…" />
  }

  if (notFound || !trek) return <NotFound />

  void nowTick

  const nearby = getTreksBySlugs(trek.nearbyTreks || [])
  const { status } = trek
  const people = status?.peopleCount ?? status?.todayPeople ?? 0
  const groups = status?.checkInGroups

  const markInPanel = <GoingTodayPanel slug={trek.slug} onSuccess={setTrek} />

  const detailsCard = (
    <div className="card-surface p-5">
      <h3 className="text-lg font-semibold text-ink">Trek details</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {INFO_ROWS.map(([label, key]) => {
          const value = trek[key]
          if (!value) return null
          return (
            <div
              key={label}
              className="flex flex-col gap-0.5 border-b border-white/8 pb-3 last:border-0 last:pb-0"
            >
              <dt className="text-xs uppercase tracking-[0.12em] text-muted">{label}</dt>
              <dd className="text-ink/90">{value}</dd>
            </div>
          )
        })}
      </dl>
      {trek.mapsUrl ? (
        <Button href={trek.mapsUrl} target="_blank" rel="noreferrer" className="mt-5 w-full">
          Open in Google Maps
        </Button>
      ) : null}
    </div>
  )

  return (
    <div>
      <div className="sticky top-14 z-40 border-b border-white/10 bg-canvas/90 backdrop-blur-md md:top-16">
        <div className="container-wide section-pad flex items-center gap-3 py-2.5">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-panel px-2.5 py-1.5 text-sm font-medium text-ink hover:border-brand/40 hover:text-brand"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
            Back
          </button>
          <span className="min-w-0 truncate text-sm text-muted">{trek.name}</span>
        </div>
      </div>

      <section className="relative min-h-[36vh] overflow-hidden sm:min-h-[48vh]">
        <img
          src={trek.heroImage}
          alt={trek.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-canvas via-canvas/55 to-canvas/25" />
        <div className="container-wide section-pad relative flex min-h-[36vh] flex-col justify-end pb-8 pt-10 sm:min-h-[48vh] sm:pb-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="soft">{trek.category}</Badge>
            <Badge tone={difficultyTone(trek.difficulty)}>{trek.difficulty}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {trek.name}
          </h1>
          <p className="mt-1.5 text-base text-muted sm:text-lg">{trek.location}</p>
          <p className="mt-3 text-sm text-muted">
            {trek.distance}
            <span className="mx-2 opacity-40">·</span>
            {trek.duration}
            <span className="mx-2 opacity-40">·</span>
            {trek.elevation}
          </p>
        </div>
      </section>

      <div className="container-wide section-pad space-y-10 py-8 sm:space-y-14 sm:py-12">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">Live status</h2>
              <p className="mt-1 text-sm text-muted">
                {people} going
                {typeof groups === 'number' && groups > 0 ? ` · ${groups} groups` : ''}
                {status?.lastUpdated ? (
                  <> · Updated {formatRelativeTime(status.lastUpdated)}</>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted/80">
                From community mark-ins, not GPS
                {source !== 'api' ? ' · Demo times' : ''}
              </p>
            </div>
            <Link
              to={`/scout/${trek.slug}`}
              className="text-[11px] text-muted/60 hover:text-muted"
            >
              Scout
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatusCard
              label="People going"
              value={`${people}`}
              hint={status?.crowdLevel ? `Crowd: ${status.crowdLevel}` : undefined}
              tone={crowdTone(status?.crowdLevel)}
            />
            <StatusCard
              label="Crowd"
              value={status?.crowdLevel || '—'}
              tone={crowdTone(status?.crowdLevel)}
            />
            <StatusCard
              label="Trail"
              value={status?.trailCondition || '—'}
              tone={trailTone(status?.trailCondition)}
            />
            <StatusCard
              label="Entry"
              value={status?.entryStatus || '—'}
              tone={entryTone(status?.entryStatus)}
            />
            <StatusCard label="Weather" value={status?.weather || '—'} tone="info" compact />
            <StatusCard
              label="Parking"
              value={status?.parkingStatus || '—'}
              tone="warning"
              compact
            />
            {status?.forestAdvisory ? (
              <StatusCard
                label="Forest advisory"
                value={status.forestAdvisory}
                tone="trail"
                compact
                className="sm:col-span-2 xl:col-span-3"
              />
            ) : null}
            {status?.alert ? (
              <StatusCard
                label="Alert"
                value={status.alert}
                tone={
                  String(status.alert).toLowerCase().includes('no active') ? 'success' : 'danger'
                }
                compact
                className="sm:col-span-2 xl:col-span-3"
              />
            ) : null}
          </div>

          {/* Mobile: mark-in above the fold */}
          <div className="mt-5 lg:hidden">{markInPanel}</div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold text-ink sm:text-2xl">About this trek</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{trek.overview}</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-ink sm:text-2xl">Photos</h2>
              <div className="mt-4">
                <Gallery images={trek.gallery} alt={trek.name} />
              </div>
            </section>

            {(trek.communityUpdates || []).length ? (
              <section>
                <h2 className="text-xl font-bold text-ink sm:text-2xl">Recent updates</h2>
                <p className="mt-1 text-sm text-muted">What people on the trail are reporting</p>
                <div className="mt-4 space-y-3">
                  {trek.communityUpdates.map((update) => (
                    <CommunityUpdateCard key={update.id} update={update} />
                  ))}
                </div>
              </section>
            ) : null}

            {(trek.safetyTips || []).length ? (
              <section>
                <h2 className="text-xl font-bold text-ink sm:text-2xl">Safety tips</h2>
                <ul className="mt-4 space-y-2.5">
                  {trek.safetyTips.map((tip) => (
                    <li
                      key={tip}
                      className="flex gap-3 rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-muted"
                    >
                      <span className="material-symbols-outlined shrink-0 text-[18px] text-brand">
                        check_circle
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Mobile details after content */}
            <div className="lg:hidden">{detailsCard}</div>
          </div>

          <aside className="hidden space-y-4 lg:sticky lg:top-36 lg:block lg:self-start">
            {markInPanel}
            {detailsCard}
          </aside>
        </div>

        {nearby.length ? (
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold text-ink sm:text-2xl">Nearby treks</h2>
              <Link to="/explore" className="text-sm font-semibold text-brand hover:underline">
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
