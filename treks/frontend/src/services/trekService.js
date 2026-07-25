import treks from '../data/treks'

/**
 * Trek data access layer.
 * Mock JSON today — swap internals for API calls later without rewriting pages.
 */

export function getAllTreks() {
  return [...treks]
}

export function getTrekBySlug(slug) {
  return treks.find((trek) => trek.slug === slug) ?? null
}

export function getFeaturedTreks(limit = 6) {
  return treks.filter((trek) => trek.featured).slice(0, limit)
}

export function getTreksByCategory(category, limit) {
  const list = treks.filter((trek) => trek.category === category)
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

export function searchTreks(query) {
  const q = query.trim().toLowerCase()
  if (!q) return getAllTreks()

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
  return [...new Set(treks.map((t) => t.category))]
}

/** Highest crowd / most activity — for "Trending" */
export function getTrendingTreks(limit = 6) {
  const rank = { 'Very High': 4, High: 3, Moderate: 2, Low: 1 }
  return [...treks]
    .sort((a, b) => (rank[b.status.crowdLevel] ?? 0) - (rank[a.status.crowdLevel] ?? 0))
    .slice(0, limit)
}

/** Sorted by status.lastUpdated descending */
export function getRecentlyUpdatedTreks(limit = 6) {
  return [...treks]
    .sort((a, b) => new Date(b.status.lastUpdated) - new Date(a.status.lastUpdated))
    .slice(0, limit)
}

/** Flattened community feed across all treks */
export function getLatestCommunityUpdates(limit = 8) {
  return treks
    .flatMap((trek) =>
      trek.communityUpdates.map((update) => ({
        ...update,
        trekName: trek.name,
        trekSlug: trek.slug,
      })),
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/** Compact live board for homepage dashboard */
export function getTodaysStatusBoard(limit = 8) {
  return getRecentlyUpdatedTreks(limit).map((trek) => ({
    id: trek.id,
    slug: trek.slug,
    name: trek.name,
    category: trek.category,
    crowdLevel: trek.status.crowdLevel,
    trailCondition: trek.status.trailCondition,
    weather: trek.status.weather,
    parkingStatus: trek.status.parkingStatus,
    alert: trek.status.alert,
    lastUpdated: trek.status.lastUpdated,
  }))
}
