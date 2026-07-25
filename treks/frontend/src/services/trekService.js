import treks from '../data/treks'

/**
 * Trek data access layer.
 * Currently reads mock JSON. Later: replace internals with API calls
 * to the CrwdCtrl backend without changing page components.
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
    const haystack = [
      trek.name,
      trek.location,
      trek.category,
      trek.difficulty,
      trek.overview,
    ]
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
