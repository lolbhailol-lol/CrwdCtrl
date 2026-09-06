import { useMemo, useState } from 'react'
import { useTrekData } from '../context/TrekDataContext'

export function useTrekSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery)
  const { ready, tick, searchTreks } = useTrekData()

  const results = useMemo(() => {
    if (!ready) return []
    return searchTreks(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tick, query])

  return { query, setQuery, results }
}
