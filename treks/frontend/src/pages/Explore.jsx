import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Search from '../components/Search'
import TrekCard from '../components/TrekCard'
import Badge from '../components/Badge'
import { CATEGORIES, DIFFICULTIES } from '../utils/constants'
import { getAllTreks, searchTreks } from '../services/trekService'

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const initialCategory = params.get('category') ?? 'All'
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [difficulty, setDifficulty] = useState('All')

  const results = useMemo(() => {
    let list = query.trim() ? searchTreks(query) : getAllTreks()
    if (category !== 'All') list = list.filter((t) => t.category === category)
    if (difficulty !== 'All') list = list.filter((t) => t.difficulty === difficulty)
    return list
  }, [query, category, difficulty])

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

  return (
    <div className="container-wide section-pad py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-forest-800 dark:text-stone sm:text-5xl">
          Explore Treks
        </h1>
        <p className="mt-3 text-ink/60 dark:text-stone/60">
          Browse Maharashtra waterfall, fort, jungle, and mountain trails.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <Search value={query} onChange={updateQuery} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {['All', ...CATEGORIES].map((item) => (
          <button key={item} type="button" onClick={() => updateCategory(item)}>
            <Badge tone={category === item ? 'trail' : 'soft'}>{item}</Badge>
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

      <p className="mt-8 text-sm text-ink/50 dark:text-stone/50">
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
          <p className="font-display text-xl font-semibold text-forest-800 dark:text-stone">
            No treks match your filters
          </p>
          <p className="mt-2 text-sm text-ink/60 dark:text-stone/60">
            Try a different search or clear category filters.
          </p>
        </div>
      )}
    </div>
  )
}
