import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Search from '../components/Search'
import Button from '../components/Button'
import TrekSection from '../components/TrekSection'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import {
  getFeaturedTreks,
  getTreksByCategory,
} from '../services/trekService'

const reasons = [
  {
    title: 'Know before you go',
    body: 'Distance, difficulty, permissions, parking, and water — all in one place before you leave home.',
  },
  {
    title: "Today's trail pulse",
    body: 'Crowd level, trail condition, weather summary, and forest advisories updated with mock live status.',
  },
  {
    title: 'Community signals',
    body: 'Recent notes from the trail — rain, parking, waterfall flow — so your plan stays grounded.',
  },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const featured = getFeaturedTreks(6)
  const waterfalls = getTreksByCategory('Waterfall Trek', 3)
  const forts = getTreksByCategory('Fort Trek', 3)
  const jungles = getTreksByCategory('Jungle Trek', 3)

  const handleSearch = (value) => {
    const q = (value ?? query).trim()
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-forest-950/75 via-forest-950/55 to-mist dark:to-forest-950" />
          <div className="grain absolute inset-0 opacity-40" />
        </div>

        <div className="container-wide section-pad relative flex min-h-[88vh] flex-col justify-end pb-16 pt-28 sm:pb-20">
          <p className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            {APP_NAME}
          </p>
          <p className="mt-4 max-w-xl text-lg text-white/85 sm:text-xl">{APP_TAGLINE}</p>
          <p className="mt-3 max-w-lg text-sm text-white/65 sm:text-base">
            Maharashtra trek discovery — waterfall, fort, jungle, and mountain trails with the
            details that matter on the morning you leave.
          </p>

          <div className="mt-8 max-w-xl">
            <Search value={query} onChange={setQuery} onSubmit={handleSearch} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button to="/explore" size="lg">
              Explore Treks
            </Button>
            <Button to="/about" variant="secondary" size="lg" className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
              Why Treks
            </Button>
          </div>
        </div>
      </section>

      <TrekSection
        title="Featured Treks"
        subtitle="Popular Maharashtra trails worth checking before your next weekend."
        treks={featured}
        viewAllTo="/explore"
      />

      <TrekSection
        title="Popular Waterfall Treks"
        subtitle="Monsoon favourites with flow, parking, and trail notes."
        treks={waterfalls}
        viewAllTo="/explore?category=Waterfall%20Trek"
      />

      <TrekSection
        title="Popular Fort Treks"
        subtitle="Sahyadri forts from easy sunrise walks to serious day climbs."
        treks={forts}
        viewAllTo="/explore?category=Fort%20Trek"
      />

      <TrekSection
        title="Popular Jungle Treks"
        subtitle="Dense canopy routes — know permissions and conditions first."
        treks={jungles}
        viewAllTo="/explore?category=Jungle%20Trek"
      />

      <section className="container-wide section-pad py-12 sm:py-20">
        <div className="card-surface overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="bg-forest-800 p-8 text-stone sm:p-12">
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Why CrwdCtrl Treks</h2>
              <p className="mt-4 max-w-md text-stone/75">
                Before leaving home, every trekker should open CrwdCtrl Treks — not to book a seat,
                but to understand the day ahead.
              </p>
            </div>
            <div className="grid gap-6 p-8 sm:p-12">
              {reasons.map((item) => (
                <div key={item.title}>
                  <h3 className="font-display text-lg font-semibold text-forest-800 dark:text-stone">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/65 dark:text-stone/65">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
