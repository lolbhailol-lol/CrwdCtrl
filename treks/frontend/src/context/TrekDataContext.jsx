import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  getAlerts,
  getAllTreks,
  getApiInfo,
  getDataSource,
  getLatestCommunityUpdates,
  getRecentlyUpdatedTreks,
  getTrekBySlug,
  getTreksByCategory,
  getTreksBySlugs,
  getTrendingTreks,
  loadLiveData,
  searchTreks,
} from '../services/trekService'
import useRelativeClock from '../hooks/useRelativeClock'

const TrekDataContext = createContext(null)

export function TrekDataProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('idle')
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const loadingRef = useRef(false)
  const nowTick = useRelativeClock(60_000)

  const refresh = useCallback(async ({ force = true, date, silent = false } = {}) => {
    if (loadingRef.current && silent) return
    loadingRef.current = true
    if (!silent) setLoading(true)
    try {
      const result = await loadLiveData({ force, date })
      setSource(result.source)
      setError(getApiInfo().error)
      setTick((n) => n + 1)
    } finally {
      setReady(true)
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    refresh({ force: true })
  }, [refresh])

  const value = {
    ready,
    loading,
    source,
    error,
    apiBase: getApiInfo().baseUrl,
    refresh,
    // bind helpers so they read latest cache after tick
    tick,
    /** Bumps every 60s — use in deps so “Xm ago” advances without refetch */
    nowTick,
    getAllTreks,
    getTrekBySlug,
    getTreksByCategory,
    getTreksBySlugs,
    getTrendingTreks,
    getRecentlyUpdatedTreks,
    getLatestCommunityUpdates,
    searchTreks,
    getAlerts,
    getDataSource,
  }

  return <TrekDataContext.Provider value={value}>{children}</TrekDataContext.Provider>
}

export function useTrekData() {
  const ctx = useContext(TrekDataContext)
  if (!ctx) throw new Error('useTrekData must be used within TrekDataProvider')
  return ctx
}
