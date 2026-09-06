import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Badge, {
  crowdTone,
  difficultyTone,
  entryTone,
  trailTone,
} from '../components/Badge'
import Gallery from '../components/Gallery'
import StatusCard from '../components/StatusCard'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import ShareUpdate from '../components/ShareUpdate'
import AddEmergencyContact from '../components/AddEmergencyContact'
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

const HEADING = 'text-lg font-semibold text-ink sm:text-xl'

export default function TrekDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { ready, getTrekBySlug, tick, nowTick, planDate, refresh } = useTrekData()
  // A row on Saturday's board must open Saturday's page, not today's
  const dateParam = searchParams.get('date') || planDate
  const [trek, setTrek] = useState(null)
  const [loadingTrek, setLoadingTrek] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAllUpdates, setShowAllUpdates] = useState(false)
  const [justPostedId, setJustPostedId] = useState('')
  const [addedContacts, setAddedContacts] = useState([])
  const trekRef = useRef(null)
  trekRef.current = trek

  useEffect(() => {
    window.scrollTo(0, 0)
    setAddedContacts([])
  }, [slug])

  useEffect(() => {
    let alive = true
    const requestedDate = dateParam
    async function load() {
      // Silent on poll refreshes: only blank the page when the trek or day changes
      if (!trekRef.current || trekRef.current.slug !== slug) setLoadingTrek(true)
      setNotFound(false)
      const fromApi = await fetchTrekBySlug(slug, requestedDate)
      if (!alive || requestedDate !== dateParam) return
      if (fromApi) {
        setTrek(fromApi)
        setNotFound(false)
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
  }, [slug, dateParam, ready, tick, getTrekBySlug])

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  function handlePosted(updatedTrek, update) {
    if (updatedTrek) setTrek(updatedTrek)
    setJustPostedId(update?.id || '')
    setShowAllUpdates(false)
    // Home and Alerts read the shared cache — refresh so the post shows there too
    refresh({ force: true, silent: true })
  }

  if (!ready || loadingTrek) {
    return <LoadingScreen label="Loading trek…" />
  }

  if (notFound || !trek) return <NotFound />

  void nowTick

  const { status } = trek
  const people = status?.peopleCount ?? status?.todayPeople ?? 0
  const entry = status?.entryStatus
  const showEntryBanner = entry && entry !== 'Open'

  const conditionsAt = status?.statusUpdatedAt ?? null
  const conditionsFresh = Boolean(status?.conditionsFresh)

  const going = trek.goingSummary || {}
  const countCells = [
    { label: 'Going', value: people },
    { label: 'Solo', value: going.solo || 0 },
    { label: 'Groups', value: going.friend || 0 },
    { label: 'Communities', value: going.community || 0 },
  ]

  const updates = trek.communityUpdates || []
  const visibleUpdates = showAllUpdates ? updates : updates.slice(0, 5)

  // A contact just added shows straight away, then arrives with the next fetch
  const reported = trek.reportedContacts || []
  const reportedIds = new Set(reported.map((c) => c.id))
  const contacts = [...reported, ...addedContacts.filter((c) => !reportedIds.has(c.id))]

  const beforeYouGo = (
    <section className="card-surface p-5">
      <h3 className={HEADING}>Before you go</h3>
      {(trek.howToReach || []).length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">How to reach</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/90">
            {trek.howToReach.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-brand">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Emergency / help</p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink/90">
          {(trek.emergencyContacts || []).map((line) => (
            <li key={line} className="flex gap-2">
              <span
                aria-hidden="true"
                className="material-symbols-outlined shrink-0 text-[16px] text-danger"
              >
                emergency
              </span>
              <span>{line}</span>
            </li>
          ))}
          {contacts.map((contact) => (
            <li key={contact.id} className="flex gap-2">
              <span
                aria-hidden="true"
                className="material-symbols-outlined shrink-0 text-[16px] text-brand"
              >
                call
              </span>
              <span className="min-w-0">
                {contact.label} —{' '}
                <a href={`tel:${contact.phone}`} className="font-medium text-brand hover:underline">
                  {contact.phone}
                </a>
                {contact.addedBy ? (
                  <span className="text-muted/70"> · added by {contact.addedBy}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {contacts.length ? (
          <p className="mt-2 text-[11px] text-muted/70">
            Numbers added by trekkers — verify before you rely on them.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted/70">
            Know a forest office, guide or jeep number for this trail? Add it for others.
          </p>
        )}
        <AddEmergencyContact
          slug={trek.slug}
          onAdded={(contact) => setAddedContacts((list) => [...list, contact])}
        />
      </div>
    </section>
  )

  const detailsCard = (
    <div className="card-surface p-5">
      <h3 className={HEADING}>Trek details</h3>
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
      <Link
        to={`/scout/${trek.slug}`}
        className="mt-4 inline-block text-[11px] text-muted/60 hover:text-muted"
      >
        Scout this trail
      </Link>
    </div>
  )

  return (
    <div>
      <div className="sticky top-14 z-40 border-b border-white/10 bg-canvas/90 backdrop-blur-md md:top-16">
        <div className="container-wide section-pad flex items-center gap-3 py-2.5">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/12 bg-panel px-3 text-sm font-medium text-ink hover:border-brand/40 hover:text-brand"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">
              arrow_back
            </span>
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
            {showEntryBanner ? (
              <Badge tone={entryTone(entry)}>Entry {entry}</Badge>
            ) : null}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
            {trek.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted sm:text-base">{trek.location}</p>
          <p className="mt-3 text-sm text-muted">
            {trek.distance}
            <span className="mx-2 opacity-40">·</span>
            {trek.duration}
            <span className="mx-2 opacity-40">·</span>
            {trek.elevation}
          </p>
        </div>
      </section>

      <div className="container-wide section-pad space-y-8 py-8 sm:space-y-12 sm:py-12">
        <section>
          <h2 className={HEADING}>Live status</h2>

          <dl className="mt-3 grid grid-cols-4 divide-x divide-white/8 rounded-xl border border-white/10 bg-panel">
            {countCells.map((cell) => (
              <div key={cell.label} className="px-2 py-3 text-center">
                <dd className="text-2xl font-semibold text-ink">{cell.value}</dd>
                <dt className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
                  {cell.label}
                </dt>
              </div>
            ))}
          </dl>

          <div className="mt-3">
            <ShareUpdate slug={trek.slug} onSuccess={handlePosted} />
          </div>

          {showEntryBanner ? (
            <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
              <span className="font-semibold">Entry: {entry}</span>
              {status?.alert ? <span className="text-ink/90"> — {status.alert}</span> : null}
            </div>
          ) : status?.alert && !String(status.alert).toLowerCase().includes('no active') ? (
            <div className="mt-4 rounded-xl border border-warn/35 bg-warn/10 px-4 py-3 text-sm text-[#ffcd98]">
              <span className="font-semibold">Alert</span>
              <span className="text-ink/90"> — {status.alert}</span>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatusCard
              label="Crowd"
              value={status?.crowdLevel}
              tone={crowdTone(status?.crowdLevel)}
            />
            <StatusCard
              label="Trail"
              value={status?.trailCondition}
              tone={trailTone(status?.trailCondition)}
            />
            <StatusCard label="Weather" value={status?.weather} tone="info" compact />
            <StatusCard label="Parking" value={status?.parkingStatus} tone="warning" compact />
            {status?.forestAdvisory ? (
              <StatusCard
                label="Forest advisory"
                value={status.forestAdvisory}
                tone="trail"
                compact
                className="col-span-2 xl:col-span-4"
              />
            ) : null}
          </div>

          <p className="mt-2 text-xs text-muted/80">
            {conditionsAt
              ? conditionsFresh
                ? `Conditions reported ${formatRelativeTime(conditionsAt)}`
                : `Conditions last reported ${formatRelativeTime(conditionsAt)} — may have changed`
              : 'No conditions reported yet — be the first to share an update below'}
          </p>

          <div className="mt-5 lg:hidden">{beforeYouGo}</div>
        </section>

        <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-8 sm:space-y-12">
            <section>
              <h2 className={HEADING}>About this trek</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{trek.overview}</p>
            </section>

            <section>
              <h2 className={HEADING}>Photos</h2>
              <div className="mt-4">
                <Gallery images={trek.gallery} alt={trek.name} />
              </div>
            </section>

            <section>
              <h2 className={HEADING}>
                Updates
                {updates.length ? <span className="ml-2 text-muted">{updates.length}</span> : null}
              </h2>
              <p className="mt-1 text-sm text-muted">What people on the trail are reporting</p>

              <div className="mt-4 space-y-3">
                {visibleUpdates.length ? (
                  visibleUpdates.map((update) => (
                    <CommunityUpdateCard
                      key={update.id}
                      update={update}
                      highlight={update.id === justPostedId}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted">No updates yet — be the first to share.</p>
                )}
              </div>

              {updates.length > visibleUpdates.length ? (
                <button
                  type="button"
                  onClick={() => setShowAllUpdates(true)}
                  className="mt-3 text-sm font-medium text-brand hover:underline"
                >
                  Show all {updates.length} updates
                </button>
              ) : null}
            </section>

            {(trek.safetyTips || []).length ? (
              <section>
                <h2 className={HEADING}>Safety tips</h2>
                <ul className="mt-4 space-y-2.5">
                  {trek.safetyTips.map((tip) => (
                    <li
                      key={tip}
                      className="flex gap-3 rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined shrink-0 text-[18px] text-brand"
                      >
                        check_circle
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="space-y-4 lg:hidden">
              {detailsCard}
            </div>
          </div>

          <aside className="hidden space-y-4 lg:sticky lg:top-36 lg:block lg:self-start">
            {beforeYouGo}
            {detailsCard}
          </aside>
        </div>

        <div className="border-t border-white/10 pt-6 text-center">
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-panel px-4 py-2.5 text-sm font-medium text-ink hover:border-brand/40 hover:text-brand"
          >
            Explore other treks
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
