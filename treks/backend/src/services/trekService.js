import treks from '../data/treks.js'
import alerts from '../data/alerts.js'
import { isDbReady } from '../config/db.js'
import TrekStatus from '../models/TrekStatus.js'
import CheckIn from '../models/CheckIn.js'
import CommunityUpdate from '../models/CommunityUpdate.js'
import {
  crowdLevelFromPeople,
  isNewerThanHours,
  todayIst,
} from '../utils/date.js'

export function listTreks() {
  return [...treks]
}

export function getTrekBySlug(slug) {
  return treks.find((t) => t.slug === slug) ?? null
}

export function listAlerts() {
  return [...alerts]
}

export function getFeaturedTreks(limit = 6) {
  return treks.filter((t) => t.featured).slice(0, limit)
}

export function getTreksByCategory(category, limit) {
  const list = treks.filter((t) => t.category === category)
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

export function searchTreks(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!q) return listTreks()
  return treks.filter((trek) => {
    const haystack = [trek.name, trek.location, trek.category, trek.difficulty, trek.overview]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

async function loadLiveMaps(slugs, forDate = todayIst()) {
  if (!isDbReady() || !slugs.length) {
    return {
      forDate,
      statusBySlug: new Map(),
      checkInBySlug: new Map(),
      updatesBySlug: new Map(),
    }
  }

  const unique = [...new Set(slugs)]

  const [statusDocs, checkInAgg, updateDocs] = await Promise.all([
    TrekStatus.find({ slug: { $in: unique } }).lean(),
    CheckIn.aggregate([
      { $match: { trekSlug: { $in: unique }, date: forDate } },
      {
        $group: {
          _id: '$trekSlug',
          peopleCount: { $sum: '$groupSize' },
          checkInGroups: { $sum: 1 },
          latestCheckInAt: { $max: '$createdAt' },
          entries: {
            $push: {
              source: '$source',
              communityName: '$communityName',
              groupSize: '$groupSize',
            },
          },
        },
      },
    ]),
    CommunityUpdate.find({ trekSlug: { $in: unique } })
      .sort({ createdAt: -1 })
      .limit(unique.length * 10)
      .lean(),
  ])

  const statusBySlug = new Map(statusDocs.map((d) => [d.slug, d]))
  const checkInBySlug = new Map(
    checkInAgg.map((row) => [
      row._id,
      {
        peopleCount: row.peopleCount || 0,
        checkInGroups: row.checkInGroups || 0,
        latestCheckInAt: row.latestCheckInAt || null,
        goingSummary: buildGoingSummary(row.entries || []),
      },
    ]),
  )
  const updatesBySlug = new Map()
  for (const doc of updateDocs) {
    const list = updatesBySlug.get(doc.trekSlug) || []
    if (list.length < 12) list.push(doc)
    updatesBySlug.set(doc.trekSlug, list)
  }

  return { forDate, statusBySlug, checkInBySlug, updatesBySlug }
}

function buildGoingSummary(entries = []) {
  const summary = {
    solo: 0,
    friend: 0,
    community: 0,
    communityNames: [],
  }
  const names = new Set()
  for (const row of entries) {
    if (row.source === 'solo') summary.solo += 1
    else if (row.source === 'friend') summary.friend += 1
    else if (row.source === 'community') {
      summary.community += 1
      const n = String(row.communityName || '').trim()
      if (n) names.add(n)
    }
  }
  summary.communityNames = [...names].slice(0, 6)
  return summary
}

function mergeCommunityUpdates(catalogUpdates = [], liveDocs = []) {
  const live = liveDocs.map((doc) => ({
    id: String(doc._id),
    message: doc.message,
    timestamp: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
    status: doc.statusTag || 'info',
    source: doc.communityName
      ? `${doc.communityName}${doc.displayName ? ` · ${doc.displayName}` : ''}`
      : doc.displayName || 'Community',
  }))
  return [...live, ...catalogUpdates].slice(0, 20)
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Latest timestamp among scout/catalog status and check-in activity */
function resolveLastUpdated(baseStatus, override, checkInStats) {
  const candidates = [
    toIsoOrNull(override?.lastUpdated),
    toIsoOrNull(checkInStats?.latestCheckInAt),
    toIsoOrNull(baseStatus?.lastUpdated),
  ].filter(Boolean)
  if (!candidates.length) return baseStatus?.lastUpdated || new Date().toISOString()
  return candidates.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b))
}

function mergeStatus(baseStatus = {}, override, checkInStats, forDate) {
  const peopleCount = checkInStats?.peopleCount || 0
  const checkInGroups = checkInStats?.checkInGroups || 0
  const rollupCrowd = crowdLevelFromPeople(peopleCount)
  const isToday = forDate === todayIst()
  const lastUpdated = resolveLastUpdated(baseStatus, override, checkInStats)

  const status = {
    ...baseStatus,
    ...(override
      ? {
          crowdLevel: override.crowdLevel ?? baseStatus.crowdLevel,
          weather: override.weather ?? baseStatus.weather,
          trailCondition: override.trailCondition ?? baseStatus.trailCondition,
          parkingStatus: override.parkingStatus ?? baseStatus.parkingStatus,
          forestAdvisory: override.forestAdvisory ?? baseStatus.forestAdvisory,
          entryStatus: override.entryStatus ?? baseStatus.entryStatus,
          alert: override.alert ?? baseStatus.alert,
        }
      : {}),
    lastUpdated,
    forDate,
    peopleCount,
    /** Alias: people for the selected board date */
    todayPeople: peopleCount,
    checkInGroups,
  }

  // Scout crowd only overrides for "today"; future days use people rollup / catalog
  const scoutCrowdFresh =
    isToday &&
    override?.crowdLevel &&
    override?.updatedBy === 'scout' &&
    isNewerThanHours(override.lastUpdated, 2)

  if (!scoutCrowdFresh && rollupCrowd) {
    status.crowdLevel = rollupCrowd
  }

  return status
}

export function enrichTrekSync(trek, maps) {
  if (!trek) return null
  const override = maps.statusBySlug.get(trek.slug)
  const checkInStats = maps.checkInBySlug.get(trek.slug)
  const liveUpdates = maps.updatesBySlug.get(trek.slug) || []
  const forDate = maps.forDate || todayIst()

  return {
    ...trek,
    forDate,
    status: mergeStatus(trek.status, override, checkInStats, forDate),
    goingSummary: checkInStats?.goingSummary || {
      solo: 0,
      friend: 0,
      community: 0,
      communityNames: [],
    },
    communityUpdates: mergeCommunityUpdates(trek.communityUpdates, liveUpdates),
  }
}

export async function enrichTrek(trek, forDate = todayIst()) {
  if (!trek) return null
  const maps = await loadLiveMaps([trek.slug], forDate)
  return enrichTrekSync(trek, maps)
}

export async function enrichTreks(list, forDate = todayIst()) {
  if (!list?.length) return []
  const maps = await loadLiveMaps(
    list.map((t) => t.slug),
    forDate,
  )
  return list.map((t) => enrichTrekSync(t, maps))
}

export async function getCheckInsForDate(slug, forDate = todayIst()) {
  if (!isDbReady()) {
    return {
      date: forDate,
      totalPeople: 0,
      groups: 0,
      goingSummary: { solo: 0, friend: 0, community: 0, communityNames: [] },
      items: [],
    }
  }
  const items = await CheckIn.find({ trekSlug: slug, date: forDate })
    .sort({ createdAt: -1 })
    .lean()

  const totalPeople = items.reduce((sum, row) => sum + (row.groupSize || 0), 0)
  const goingSummary = buildGoingSummary(items)
  return {
    date: forDate,
    totalPeople,
    groups: items.length,
    goingSummary,
    items: items.map((row) => ({
      id: String(row._id),
      groupSize: row.groupSize,
      displayName: row.displayName,
      source: row.source,
      communityName: row.communityName || '',
      note: row.note || '',
      createdAt: row.createdAt,
    })),
  }
}

/** @deprecated use getCheckInsForDate */
export async function getTodayCheckIns(slug) {
  return getCheckInsForDate(slug, todayIst())
}

export async function createCheckIn(slug, payload) {
  const date = payload.date || todayIst()
  const doc = await CheckIn.create({
    trekSlug: slug,
    date,
    groupSize: payload.groupSize,
    displayName: payload.displayName,
    source: payload.source,
    communityName: payload.communityName || '',
    note: payload.note || '',
  })

  let update = null
  if (payload.message) {
    update = await CommunityUpdate.create({
      trekSlug: slug,
      message: payload.message,
      statusTag: payload.statusTag || 'info',
      displayName: payload.displayName,
      communityName: payload.communityName || '',
    })
  }

  return { checkIn: doc, update }
}

const UPDATE_TAG_TO_STATUS = {
  crowd: 'warning',
  trail: 'warning',
  weather: 'info',
  closure: 'alert',
  info: 'info',
}

export async function createCommunityUpdate(slug, payload) {
  const tag = payload.tag || 'info'
  const statusTag = UPDATE_TAG_TO_STATUS[tag] || 'info'
  const doc = await CommunityUpdate.create({
    trekSlug: slug,
    message: payload.message,
    statusTag,
    displayName: payload.displayName || 'Trekker',
    communityName: '',
  })
  return doc
}

export async function upsertTrekStatus(slug, fields) {
  const allowed = [
    'crowdLevel',
    'weather',
    'trailCondition',
    'parkingStatus',
    'forestAdvisory',
    'entryStatus',
    'alert',
  ]
  const patch = {}
  for (const key of allowed) {
    if (fields[key] !== undefined && fields[key] !== null) {
      patch[key] = fields[key]
    }
  }
  patch.lastUpdated = new Date()
  patch.updatedBy = 'scout'

  return TrekStatus.findOneAndUpdate(
    { slug },
    { $set: { ...patch, slug } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
}
