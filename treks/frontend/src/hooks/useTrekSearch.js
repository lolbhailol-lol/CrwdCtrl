import { useMemo, useState } from 'react'
import { searchTreks } from '../services/trekService'

export function useTrekSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery)

  const results = useMemo(() => searchTreks(query), [query])

  return { query, setQuery, results }
}
