import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Search from '../components/Search'
import TrekCard from '../components/TrekCard'
import Badge from '../components/Badge'
import LoadingScreen from '../components/LoadingScreen'
import { CATEGORIES, DIFFICULTIES } from '../utils/constants'
import { useTrekData } from '../context/TrekDataContext'

const ACTIVE_CATEGORIES = CATEGORIES

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? 'All')
  const [difficulty, setDifficulty] = useState('All')
  const { ready, loading, tick, searchTreks, getAllTreks } = useTrekData()

  const results = useMemo(() => {
    if (!ready) return []
    let list = query.trim() ? searchTreks(query) : getAllTreks()
    if (category !== 'All') list = list.filter((t) => t.category === category)
    if (difficulty !== 'All') list = list.filter((t) => t.difficulty === difficulty)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tick, query, category, difficulty])

  const updateQuery = (value) => {
    setQuery(value)
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value.trim())
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const updateCategory = (value) => {
    setCategory(value)
    const next = new URLSearchParams(params)
    if (value !== 'All') next.set('category', value)
    else next.delete('category')
    setParams(next, { replace: true })
  }

  if (!ready) {
    return <LoadingScreen label={loading ? 'Loading destinations…' : 'Loading…'} />
  }

  return (
    <div className="container-wide section-pad py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Explore Destinations
        </h1>
        <p className="mt-3 text-muted">
          Curated iconic Maharashtra destinations — check today&apos;s situation before you leave.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <Search value={query} onChange={updateQuery} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {['All', ...ACTIVE_CATEGORIES].map((item) => (
          <button key={item} type="button" onClick={() => updateCategory(item)}>
            <Badge tone={category === item ? 'brand' : 'soft'}>{item === 'All' ? 'All' : item}</Badge>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {['All', ...DIFFICULTIES].map((item) => (
          <button key={item} type="button" onClick={() => setDifficulty(item)}>
            <Badge tone={difficulty === item ? 'default' : 'soft'}>
              {item === 'All' ? 'All difficulties' : item}
            </Badge>
          </button>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        {results.length} trek{results.length === 1 ? '' : 's'} found
      </p>

      {results.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((trek) => (
            <TrekCard key={trek.id} trek={trek} />
          ))}
        </div>
      ) : (
        <div className="card-surface mt-6 p-10 text-center">
          <p className="text-xl font-semibold text-ink">No treks match your filters</p>
          <p className="mt-2 text-sm text-muted">Try a different search or clear category filters.</p>
        </div>
      )}
    </div>
  )
}
