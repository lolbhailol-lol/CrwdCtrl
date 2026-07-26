import treks from '../backend/src/data/treks.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const keep = treks.filter(
  (t) => t.category === 'Waterfall Trek' || t.category === 'Jungle Trek',
)
const slugs = new Set(keep.map((t) => t.slug))

function nearbyFor(t, all) {
  let next = (t.nearbyTreks || []).filter((s) => slugs.has(s))
  if (next.length < 2) {
    const same = all
      .filter((x) => x.category === t.category && x.slug !== t.slug)
      .map((x) => x.slug)
    next = [...new Set([...next, ...same])]
  }
  return next.slice(0, 3)
}

function q(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}

function minsAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(1, Math.round(ms / 60000))
}

function timeExpr(iso) {
  const m = minsAgo(iso)
  if (m >= 60) return `ago.h(${(m / 60).toFixed(1)})`
  return `ago.m(${m})`
}

const cleaned = keep.map((t, i) => ({
  ...t,
  id: String(i + 1),
  nearbyTreks: nearbyFor(t, keep),
}))

const parts = []
parts.push(`/**
 * CrwdCtrl Treks lite catalog — Waterfall + Jungle only.
 * Status + community updates are realistic mock "live" data for demo validation.
 */

const img = {
  ridge: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1600&q=80',
  ridge2: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=1600&q=80',
  peak: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
  peak2: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80',
  peak3: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
  fall: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1600&q=80',
  fall2: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
  fall3: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?auto=format&fit=crop&w=1600&q=80',
  jungle: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80',
  jungle2: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=80',
  jungle3: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1600&q=80',
  valley: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1600&q=80',
  mist: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1600&q=80',
}

const ago = {
  m: (n) => new Date(Date.now() - n * 60 * 1000).toISOString(),
  h: (n) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString(),
}

function trek(base) {
  return {
    featured: false,
    gallery: [base.heroImage, img.mist, img.ridge, img.valley].filter(Boolean),
    relatedTreks: base.nearbyTreks ?? [],
    ...base,
  }
}

export const treks = [
`)

for (const t of cleaned) {
  const gallery = (t.gallery || [t.heroImage])
    .slice(0, 4)
    .map((url) => `'${url}'`)
    .join(', ')
  const tips = (t.safetyTips || [])
    .map((x) => `      '${q(x)}',`)
    .join('\n')
  const updates = (t.communityUpdates || [])
    .map(
      (u) =>
        `      { id: '${u.id}', message: '${q(u.message)}', timestamp: ${timeExpr(u.timestamp)}, status: '${u.status}', source: '${q(u.source)}' },`,
    )
    .join('\n')

  parts.push(`  trek({
    id: '${t.id}',
    slug: '${t.slug}',
    name: '${q(t.name)}',
    location: '${q(t.location)}',
    category: '${t.category}',
    featured: ${Boolean(t.featured)},
    difficulty: '${t.difficulty}',
    distance: '${q(t.distance)}',
    duration: '${q(t.duration)}',
    elevation: '${q(t.elevation)}',
    heroImage: '${t.heroImage}',
    gallery: [${gallery}],
    overview:
      '${q(t.overview)}',
    startingPoint: '${q(t.startingPoint)}',
    mapsUrl: '${t.mapsUrl}',
    bestSeason: '${q(t.bestSeason)}',
    entryFee: '${q(t.entryFee)}',
    forestPermission: '${q(t.forestPermission)}',
    foodAvailability: '${q(t.foodAvailability)}',
    waterAvailability: '${q(t.waterAvailability)}',
    networkCoverage: '${q(t.networkCoverage)}',
    safetyTips: [
${tips}
    ],
    nearbyTreks: ${JSON.stringify(t.nearbyTreks)},
    status: {
      crowdLevel: '${t.status.crowdLevel}',
      weather: '${q(t.status.weather)}',
      trailCondition: '${q(t.status.trailCondition)}',
      parkingStatus: '${q(t.status.parkingStatus)}',
      forestAdvisory: '${q(t.status.forestAdvisory)}',
      alert: '${q(t.status.alert || '')}',
      lastUpdated: ${timeExpr(t.status.lastUpdated)},
      entryStatus: '${t.status.entryStatus}',
    },
    communityUpdates: [
${updates}
    ],
  }),
`)
}

parts.push(`]

export default treks
`)

const out = parts.join('\n')
const backendPath = path.resolve(__dirname, '../backend/src/data/treks.js')
const frontendPath = path.resolve(__dirname, '../frontend/src/data/treks.js')
fs.writeFileSync(backendPath, out)
fs.writeFileSync(frontendPath, out)
console.log(`Wrote ${cleaned.length} treks → backend + frontend`)
