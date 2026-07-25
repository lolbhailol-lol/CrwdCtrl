import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Search from '../components/Search'
import TrekSection from '../components/TrekSection'
import LiveStatusRow from '../components/LiveStatusRow'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import Badge, { crowdTone, trailTone } from '../components/Badge'
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE, CATEGORY_META } from '../utils/constants'
import {
  getLatestCommunityUpdates,
  getRecentlyUpdatedTreks,
  getTodaysStatusBoard,
  getTrendingTreks,
  getTreksByCategory,
} from '../services/trekService'
import { formatRelativeTime } from '../utils/formatters'
import { Link } from 'react-router-dom'

export default function Home() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const statusBoard = getTodaysStatusBoard(8)
  const trending = getTrendingTreks(6)
  const recentlyUpdated = getRecentlyUpdatedTreks(6)
  const waterfalls = getTreksByCategory('Waterfall Trek', 4)
  const forts = getTreksByCategory('Fort Trek', 6)
  const jungles = getTreksByCategory('Jungle & Nature Trek', 3)
  const community = getLatestCommunityUpdates(8)

  const handleSearch = (value) => {
    const q = (value ?? query).trim()
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  return (
    <>
      {/* Dashboard hero */}
      <section className="relative overflow-hidden border-b border-forest-800/8 dark:border-white/8">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-900 via-forest-800 to-forest-950" />
        <div className="absolute inset-0 opacity-30">
          <img
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="h-full w-full object-cover mix-blend-overlay"
          />
        </div>
        <div className="grain absolute inset-0 opacity-50" />

        <div className="container-wide section-pad relative py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-trail backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live trek information · Maharashtra
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {APP_TAGLINE}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/75 sm:text-lg">{APP_SUBTITLE}</p>
          <p className="mt-2 text-sm text-white/50">
            {APP_NAME} — open to everyone. No login. Check conditions before you leave.
          </p>

          <div className="mt-8 max-w-xl">
            <Search
              value={query}
              onChange={setQuery}
              onSubmit={handleSearch}
              placeholder="Search Lohagad, Devkund, Andharban…"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {Object.entries(CATEGORY_META).map(([category, meta]) => (
              <Link
                key={category}
                to={`/explore?category=${encodeURIComponent(category)}`}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition hover:bg-white/15"
              >
                {meta.emoji} {meta.short}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Today's Trek Status board */}
      <section className="container-wide section-pad py-10 sm:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-trail-dark dark:text-trail">
              Live board
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-forest-800 dark:text-stone">
              Today&apos;s Trek Status
            </h2>
            <p className="mt-1 text-sm text-ink/55 dark:text-stone/55">
              Crowd, trail, weather & alerts — updated like a field dashboard
            </p>
          </div>
          <Link
            to="/explore"
            className="text-sm font-semibold text-forest-700 dark:text-trail"
          >
            View all destinations →
          </Link>
        </div>

        <div className="grid gap-3">
          {statusBoard.map((item) => (
            <LiveStatusRow key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="container-wide section-pad pb-10 sm:pb-14">
        <div className="mb-6">
          <h2 className="font-display text-3xl font-bold text-forest-800 dark:text-stone">
            Trending Treks
          </h2>
          <p className="mt-1 text-sm text-ink/55 dark:text-stone/55">
            Highest activity right now across iconic destinations
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((trek, index) => (
            <Link
              key={trek.id}
              to={`/trek/${trek.slug}`}
              className="card-surface group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={trek.heroImage}
                  alt={trek.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-forest-950/70 px-2.5 py-1 text-xs font-bold text-trail backdrop-blur">
                  #{index + 1}
                </span>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-display text-xl font-bold text-white">{trek.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={crowdTone(trek.status.crowdLevel)}>{trek.status.crowdLevel}</Badge>
                    <Badge tone={trailTone(trek.status.trailCondition)}>
                      {trek.status.trailCondition}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recently updated */}
      <section className="border-y border-forest-800/8 bg-forest-50/50 py-10 dark:border-white/8 dark:bg-forest-900/30 sm:py-14">
        <div className="container-wide section-pad">
          <h2 className="font-display text-3xl font-bold text-forest-800 dark:text-stone">
            Recently Updated
          </h2>
          <p className="mt-1 text-sm text-ink/55 dark:text-stone/55">
            Freshest status pings from the field
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentlyUpdated.map((trek) => (
              <Link
                key={trek.id}
                to={`/trek/${trek.slug}`}
                className="card-surface p-4 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-forest-800 dark:text-stone">
                      {trek.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink/45 dark:text-stone/45">
                      {formatRelativeTime(trek.status.lastUpdated)}
                    </p>
                  </div>
                  <Badge tone={crowdTone(trek.status.crowdLevel)}>{trek.status.crowdLevel}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink/65 dark:text-stone/65">
                  {trek.status.weather}
                </p>
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  🚨 {trek.status.alert}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <TrekSection
        title="Popular Waterfall Treks"
        subtitle="Monsoon icons — flow, parking, and crowd before you drive."
        treks={waterfalls}
        viewAllTo="/explore?category=Waterfall%20Trek"
      />

      <TrekSection
        title="Popular Fort Treks"
        subtitle="Maharashtra’s most visited Sahyadri forts."
        treks={forts}
        viewAllTo="/explore?category=Fort%20Trek"
      />

      <TrekSection
        title="Popular Jungle Treks"
        subtitle="Dense canopy routes — permissions and trail pulse first."
        treks={jungles}
        viewAllTo="/explore?category=Jungle%20%26%20Nature%20Trek"
      />

      {/* Community feed */}
      <section className="container-wide section-pad py-12 sm:py-16">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-trail-dark dark:text-trail">
            Field feed
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-forest-800 dark:text-stone">
            Latest Community Updates
          </h2>
          <p className="mt-1 text-sm text-ink/55 dark:text-stone/55">
            Ground notes with timestamps — rain, parking, flow, permissions
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {community.map((update) => (
            <CommunityUpdateCard key={`${update.trekSlug}-${update.id}`} update={update} showTrek />
          ))}
        </div>
      </section>
    </>
  )
}
