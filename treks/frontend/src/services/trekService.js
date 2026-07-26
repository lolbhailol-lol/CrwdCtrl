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
  forDate: null,
}

/** Board rows per plan date, kept out of `cache` so Explore/Alerts always read today. */
const boardByDate = new Map()

const crowdRank = { 'Very High': 4, High: 3, Moderate: 2, Low: 1 }

export function getDataSource() {
  return cache.source
}

export function getLastError() {
  return cache.error
}

/** Offline rows: static facts with nothing claimed about the trail. */
function emptyStatus(forDate) {
  return {
    crowdLevel: null,
    weather: null,
    trailCondition: null,
    parkingStatus: null,
    forestAdvisory: null,
    entryStatus: null,
    alert: null,
    forDate: forDate || null,
    peopleCount: 0,
    todayPeople: 0,
    checkInGroups: 0,
    statusUpdatedAt: null,
    checkInUpdatedAt: null,
    lastUpdated: null,
    conditionsFresh: false,
  }
}

function withoutLiveData(list, forDate) {
  return list.map((t) => ({
    ...t,
    forDate: forDate || null,
    status: emptyStatus(forDate),
    goingSummary: { solo: 0, friend: 0, community: 0, communityNames: [] },
    communityUpdates: [],
    reportedContacts: [],
  }))
}

/**
 * Loads today's catalog — the default read behind Explore, Alerts and the nav
 * badge. Board rows for other dates go through `fetchTreksForDate`.
 */
export async function loadLiveData({ force = false } = {}) {
  if (!force && cache.treks && cache.alerts) {
    return { treks: cache.treks, alerts: cache.alerts, source: cache.source, forDate: cache.forDate }
  }

  try {
    const [treksRes, alertsRes] = await Promise.all([apiGet('/api/treks'), apiGet('/api/alerts')])

    if (!treksRes || !Array.isArray(treksRes.data)) {
      throw new Error('Invalid treks API response')
    }

    const forDate = treksRes.forDate || null
    // API up but its database is down: rows are real, live reports are missing
    const source = treksRes.live === false ? 'api-no-db' : 'api'
    cache = {
      treks: treksRes.data,
      alerts: Array.isArray(alertsRes?.data) ? alertsRes.data : [],
      source,
      error: treksRes.live === false ? 'Live reports unavailable' : null,
      forDate,
    }
    boardByDate.set(forDate, { treks: treksRes.data, forDate, source })
  } catch (err) {
    console.warn('[trekService] API unavailable, using local catalog:', err.message)
    cache = {
      treks: withoutLiveData([...localTreks], null),
      alerts: [...localAlerts],
      source: 'mock-fallback',
      error: err.message,
      forDate: null,
    }
  }

  return {
    treks: cache.treks,
    alerts: cache.alerts,
    source: cache.source,
    forDate: cache.forDate,
  }
}

/**
 * Board rows for a plan date. Cached per date so a future-day board never
 * becomes the answer for Explore, Alerts or the nav badge.
 */
export async function fetchTreksForDate(date) {
  try {
    const json = await apiGet(`/api/treks?date=${encodeURIComponent(date)}`)
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Invalid treks API response')
    }
    const forDate = json.forDate || date
    const source = json.live === false ? 'api-no-db' : 'api'
    const error = json.live === false ? 'Live reports unavailable' : null
    const result = { treks: json.data, forDate, source, error }
    boardByDate.set(forDate, result)
    cache = { ...cache, source, error }
    return result
  } catch (err) {
    // The board falls back to the catalog, so the pill and banner must both say Demo.
    cache = { ...cache, source: 'mock-fallback', error: err.message }
    return {
      treks: withoutLiveData([...localTreks], date),
      forDate: date,
      source: 'mock-fallback',
      error: err.message,
    }
  }
}

/** Last known rows for a date — lets the board switch days without a blank flash. */
export function getCachedBoard(date) {
  return boardByDate.get(date)?.treks || null
}

function requireTreks() {
  return cache.treks || withoutLiveData([...localTreks], cache.forDate)
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
    if (!json?.data) throw new Error('Invalid trek API response')
    cache = { ...cache, source: 'api', error: null }
    return json.data
  } catch (err) {
    cache = { ...cache, source: 'mock-fallback', error: err.message }
    const local = localTreks.find((t) => t.slug === slug)
    return local ? withoutLiveData([local], date)[0] : null
  }
}

export async function submitCheckIn(slug, payload) {
  const json = await apiPost(`/api/treks/${encodeURIComponent(slug)}/check-ins`, payload)
  return { ...json.data, created: json.created !== false }
}

export async function submitEmergencyContact(slug, payload) {
  const json = await apiPost(`/api/treks/${encodeURIComponent(slug)}/contacts`, payload)
  return json.data.contact
}

export async function submitCommunityUpdate(slug, payload) {
  const json = await apiPost(`/api/treks/${encodeURIComponent(slug)}/updates`, payload)
  return json.data
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
    .sort((a, b) => (crowdRank[b.status?.crowdLevel] ?? 0) - (crowdRank[a.status?.crowdLevel] ?? 0))
    .slice(0, limit)
}

export function getRecentlyUpdatedTreks(limit = 6) {
  return [...requireTreks()]
    .filter((t) => t.status?.lastUpdated)
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
        trekCategory: trek.category,
      })),
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

export function getAlerts() {
  return [...(cache.alerts || localAlerts)]
}

/** Reported alert text, minus the "no active alert" placeholders scouts type. */
function meaningfulAlert(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  return value.toLowerCase().includes('no active') ? '' : value
}

/**
 * The one warning read for a trail. Board rows, the Alerts page and both nav
 * badges call this, so they can never disagree about what is wrong.
 * Returns null when nothing is reported.
 */
export function getTrailSignal(status) {
  const s = status || {}
  const entryBlocked = s.entryStatus && s.entryStatus !== 'Open'
  const trailBlocked = s.trailCondition && s.trailCondition !== 'Open'
  const note = meaningfulAlert(s.alert)
  if (!entryBlocked && !trailBlocked && !note) return null

  const headline = entryBlocked
    ? `Entry ${s.entryStatus}`
    : trailBlocked
      ? `Trail ${s.trailCondition}`
      : 'Advisory'

  return {
    headline,
    note,
    label: entryBlocked || trailBlocked ? headline : note,
    severity: entryBlocked || s.trailCondition === 'Closed' ? 'critical' : 'warning',
    reportedAt: s.statusUpdatedAt || null,
  }
}

/** How long a trekker's closure or caution report keeps counting as an alert. */
const REPORTED_ISSUE_HOURS = 24

/** A trekker posting "Closure" is an alert for that trail, not just a note. */
function reportedIssue(trek) {
  const cutoff = Date.now() - REPORTED_ISSUE_HOURS * 60 * 60 * 1000
  const posts = (trek?.communityUpdates || []).filter(
    (u) =>
      (u.status === 'alert' || u.status === 'warning') &&
      new Date(u.timestamp).getTime() >= cutoff,
  )
  if (!posts.length) return null

  const worst = posts.find((u) => u.status === 'alert') || posts[0]
  const headline = worst.status === 'alert' ? 'Closure reported' : 'Caution reported'
  return {
    headline,
    note: worst.message,
    label: headline,
    severity: worst.status === 'alert' ? 'critical' : 'warning',
    reportedAt: worst.timestamp,
  }
}

const worstFirst = (a, b) => {
  if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
  return new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0)
}

/**
 * The single warning read for a trail, from scout status *or* what trekkers
 * posted. Board rows, Alerts and the nav badges all go through this.
 */
export function getTrekAlert(trek) {
  const candidates = [getTrailSignal(trek?.status), reportedIssue(trek)].filter(Boolean)
  if (!candidates.length) return null
  return candidates.sort(worstFirst)[0]
}

/** Trails that are closed, restricted or carrying a warning right now. */
export function getTrailIssues() {
  return requireTreks()
    .map((trek) => {
      const signal = getTrekAlert(trek)
      if (!signal) return null
      return {
        slug: trek.slug,
        name: trek.name,
        location: trek.location,
        category: trek.category,
        headline: signal.headline,
        severity: signal.severity,
        note: signal.note,
        lastUpdated: signal.reportedAt,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
      return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0)
    })
}

/** Trekker-posted updates tagged as a closure or caution. */
export function getReportedAlerts(limit = 20) {
  return getLatestCommunityUpdates(80)
    .filter((update) => update.status === 'alert' || update.status === 'warning')
    .slice(0, limit)
}

export function getApiInfo() {
  return { baseUrl: getApiBase(), source: cache.source, error: cache.error }
}
