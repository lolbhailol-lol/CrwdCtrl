import { apiGet, apiPatch, apiPost, getApiBase } from './api'
import localTreks from '../data/treks'
import localAlerts from '../data/alerts'

/**
 * Live data layer.
 * Prefers Treks backend API; falls back to local mock if API is down.
 */

let cache = {
  treks: null,
  alerts: null,
  source: 'idle',
  error: null,
}

const crowdRank = { 'Very High': 4, High: 3, Moderate: 2, Low: 1 }

export function getDataSource() {
  return cache.source
}

export function getLastError() {
  return cache.error
}

function withZeroPeople(list, forDate) {
  return list.map((t) => ({
    ...t,
    forDate,
    status: {
      ...t.status,
      forDate,
      peopleCount: 0,
      todayPeople: 0,
      checkInGroups: 0,
    },
  }))
}

export async function loadLiveData({ force = false, date } = {}) {
  if (!force && cache.treks && cache.alerts && !date) {
    return { treks: cache.treks, alerts: cache.alerts, source: cache.source, forDate: cache.forDate }
  }

  const qs = date ? `?date=${encodeURIComponent(date)}` : ''

  try {
    const [treksRes, alertsRes] = await Promise.all([
      apiGet(`/api/treks${qs}`),
      apiGet('/api/alerts'),
    ])

    if (!treksRes || !Array.isArray(treksRes.data)) {
      throw new Error('Invalid treks API response')
    }

    const forDate = treksRes.forDate || date || null
    cache = {
      treks: treksRes.data,
      alerts: Array.isArray(alertsRes?.data) ? alertsRes.data : [],
      source: 'api',
      error: null,
      forDate,
    }
  } catch (err) {
    console.warn('[trekService] API unavailable, using local mock:', err.message)
    const forDate = date || null
    const base = [...localTreks]
    cache = {
      treks: forDate ? withZeroPeople(base, forDate) : base,
      alerts: [...localAlerts],
      source: 'mock-fallback',
      error: err.message,
      forDate,
    }
  }

  return {
    treks: cache.treks,
    alerts: cache.alerts,
    source: cache.source,
    forDate: cache.forDate,
  }
}

/** Fetch board rows for a plan date without wiping global cache alerts. */
export async function fetchTreksForDate(date) {
  try {
    const json = await apiGet(`/api/treks?date=${encodeURIComponent(date)}`)
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Invalid treks API response')
    }
    const list = json.data
    const forDate = json.forDate || date
    cache = {
      ...cache,
      treks: list,
      source: 'api',
      error: null,
      forDate,
    }
    return { treks: list, forDate, source: 'api' }
  } catch (err) {
    const list = withZeroPeople([...localTreks], date)
    return { treks: list, forDate: date, source: 'mock-fallback', error: err.message }
  }
}

function requireTreks() {
  return cache.treks || [...localTreks]
}

export function getAllTreks() {
  return [...requireTreks()]
}

export function getTrekBySlug(slug) {
  return requireTreks().find((trek) => trek.slug === slug) ?? null
}

export async function fetchTrekBySlug(slug, date) {
  try {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ''
    const json = await apiGet(`/api/treks/${encodeURIComponent(slug)}${qs}`)
    return json.data ?? null
  } catch {
    return getTrekBySlug(slug)
  }
}

export async function submitCheckIn(slug, payload) {
  const json = await apiPost(`/api/treks/${encodeURIComponent(slug)}/check-ins`, payload)
  return json.data
}

export async function submitCommunityUpdate(slug, payload) {
  const json = await apiPost(`/api/treks/${encodeURIComponent(slug)}/updates`, payload)
  return json.data
}

export function formatGoingSummary(summary) {
  if (!summary) return ''
  const parts = []
  if (summary.solo) parts.push(`${summary.solo} solo`)
  if (summary.friend) parts.push(`${summary.friend} group${summary.friend === 1 ? '' : 's'}`)
  if (summary.community) parts.push(`${summary.community} community`)
  const names = (summary.communityNames || []).slice(0, 3)
  if (names.length) parts.push(names.join(', '))
  return parts.join(' · ')
}

export async function fetchTodayCheckIns(slug) {
  const json = await apiGet(`/api/treks/${encodeURIComponent(slug)}/check-ins/today`)
  return json.data
}

export async function fetchCheckInsForDate(slug, date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const json = await apiGet(`/api/treks/${encodeURIComponent(slug)}/check-ins${qs}`)
  return json.data
}

export async function patchTrekStatus(slug, fields, token) {
  const json = await apiPatch(`/api/treks/${encodeURIComponent(slug)}/status`, fields, { token })
  return json.data
}

export function getFeaturedTreks(limit = 6) {
  return requireTreks()
    .filter((trek) => trek.featured)
    .slice(0, limit)
}

export function getTreksByCategory(category, limit) {
  const list = requireTreks().filter((trek) => trek.category === category)
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

export function searchTreks(query) {
  const q = query.trim().toLowerCase()
  const treks = requireTreks()
  if (!q) return [...treks]

  return treks.filter((trek) => {
    const haystack = [trek.name, trek.location, trek.category, trek.difficulty, trek.overview]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getTreksBySlugs(slugs = []) {
  return slugs.map((slug) => getTrekBySlug(slug)).filter(Boolean)
}

export function getCategories() {
  return [...new Set(requireTreks().map((t) => t.category))]
}

export function getTrendingTreks(limit = 6) {
  return [...requireTreks()]
    .sort((a, b) => (crowdRank[b.status.crowdLevel] ?? 0) - (crowdRank[a.status.crowdLevel] ?? 0))
    .slice(0, limit)
}

export function getRecentlyUpdatedTreks(limit = 6) {
  return [...requireTreks()]
    .sort((a, b) => new Date(b.status.lastUpdated) - new Date(a.status.lastUpdated))
    .slice(0, limit)
}

export function getLatestCommunityUpdates(limit = 8) {
  return requireTreks()
    .flatMap((trek) =>
      (trek.communityUpdates || []).map((update) => ({
        ...update,
        trekName: trek.name,
        trekSlug: trek.slug,
      })),
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

export function getAlerts() {
  return [...(cache.alerts || localAlerts)]
}

export function getApiInfo() {
  return { baseUrl: getApiBase(), source: cache.source, error: cache.error }
}
