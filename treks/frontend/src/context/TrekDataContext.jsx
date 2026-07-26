import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  getAlerts,
  getAllTreks,
  getApiInfo,
  getDataSource,
  getLatestCommunityUpdates,
  getRecentlyUpdatedTreks,
  getReportedAlerts,
  getTrailIssues,
  getTrekAlert,
  getTrekBySlug,
  getTreksByCategory,
  getTreksBySlugs,
  getTrendingTreks,
  loadLiveData,
  searchTreks,
} from '../services/trekService'
import useRelativeClock from '../hooks/useRelativeClock'
import { todayIst } from '../utils/planDates'

const TrekDataContext = createContext(null)

/** How often to pick up other people's mark-ins and scout reports. */
const POLL_MS = 50_000

export function TrekDataProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('idle')
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const [planDate, setPlanDate] = useState(() => todayIst())
  const loadingRef = useRef(false)
  const nowTick = useRelativeClock(60_000)

  const refresh = useCallback(async ({ force = true, silent = false } = {}) => {
    if (loadingRef.current && silent) return
    loadingRef.current = true
    if (!silent) setLoading(true)
    try {
      const result = await loadLiveData({ force })
      setSource(result.source)
      setError(getApiInfo().error)
      setTick((n) => n + 1)
    } finally {
      setReady(true)
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  /**
   * Board fetches happen outside this provider, so they report back here — the
   * Live pill and the offline banner must never disagree.
   */
  const reportSource = useCallback((nextSource, nextError = null) => {
    if (!nextSource) return
    setSource(nextSource)
    setError(nextError)
  }, [])

  useEffect(() => {
    refresh({ force: true })
  }, [refresh])

  // Shared poll: every page re-reads on tick, so no screen shows frozen data
  // under a ticking "Xm ago" label.
  useEffect(() => {
    if (!ready) return
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      refresh({ force: true, silent: true })
    }
    const id = window.setInterval(poll, POLL_MS)
    const onVisible = () => poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ready, refresh])

  const value = {
    ready,
    loading,
    source,
    error,
    apiBase: getApiInfo().baseUrl,
    refresh,
    reportSource,
    /** Plan date shared by the board, the mark-in modal and trek pages */
    planDate,
    setPlanDate,
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
    getTrailIssues,
    getTrekAlert,
    getReportedAlerts,
    getDataSource,
  }

  return <TrekDataContext.Provider value={value}>{children}</TrekDataContext.Provider>
}

export function useTrekData() {
  const ctx = useContext(TrekDataContext)
  if (!ctx) throw new Error('useTrekData must be used within TrekDataProvider')
  return ctx
}
