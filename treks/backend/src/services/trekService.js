import treks from '../data/treks.js'
import alerts from '../data/alerts.js'
import { isDbReady } from '../config/db.js'
import TrekStatus from '../models/TrekStatus.js'
import CheckIn from '../models/CheckIn.js'
import CommunityUpdate from '../models/CommunityUpdate.js'
import EmergencyContact from '../models/EmergencyContact.js'
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

/** A trail report older than this is history, not news. */
const UPDATE_WINDOW_HOURS = 48
const UPDATES_PER_TREK = 12

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
  const since = new Date(Date.now() - UPDATE_WINDOW_HOURS * 60 * 60 * 1000)

  const [statusDocs, checkInAgg, updatesPerSlug] = await Promise.all([
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
    // Per slug, so one busy trail can never starve the others of their updates
    Promise.all(
      unique.map((slug) =>
        CommunityUpdate.find({ trekSlug: slug, createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(UPDATES_PER_TREK)
          .lean(),
      ),
    ),
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
  const updatesBySlug = new Map(unique.map((slug, i) => [slug, updatesPerSlug[i] || []]))

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

function mapCommunityUpdates(liveDocs = []) {
  return liveDocs.map((doc) => ({
    id: String(doc._id),
    message: doc.message,
    timestamp: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
    status: doc.statusTag || 'info',
    source: doc.communityName
      ? `${doc.communityName}${doc.displayName ? ` · ${doc.displayName}` : ''}`
      : doc.displayName || 'Community',
  }))
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function maxIso(...values) {
  const list = values.filter(Boolean)
  if (!list.length) return null
  return list.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b))
}

/**
 * How long a reported condition can still be treated as current. After this it
 * is dropped rather than shown as "live" — a day-old parking report is noise.
 */
const STATUS_TTL_HOURS = {
  crowdLevel: 3,
  weather: 12,
  parkingStatus: 12,
  trailCondition: 24,
  entryStatus: 24,
  forestAdvisory: 24,
  alert: 24,
}

/** Within this window the UI presents conditions as current, not "last reported". */
const CONDITIONS_FRESH_HOURS = 12

/**
 * Live status is only what someone actually reported: scout status for today
 * plus check-ins for the selected date. Unknown fields stay null so the UI can
 * say "no reports yet" instead of inventing a condition.
 */
function mergeStatus(override, checkInStats, forDate) {
  const peopleCount = checkInStats?.peopleCount || 0
  const isToday = forDate === todayIst()
  const checkInUpdatedAt = toIsoOrNull(checkInStats?.latestCheckInAt)

  const status = {
    crowdLevel: null,
    weather: null,
    trailCondition: null,
    parkingStatus: null,
    forestAdvisory: null,
    entryStatus: null,
    alert: null,
    forDate,
    peopleCount,
    /** Alias: people for the selected board date */
    todayPeople: peopleCount,
    checkInGroups: checkInStats?.checkInGroups || 0,
    statusUpdatedAt: null,
    checkInUpdatedAt,
    lastUpdated: null,
    conditionsFresh: false,
  }

  // A scout report describes the day it was made, so it only applies to today.
  if (override && isToday) {
    for (const [field, hours] of Object.entries(STATUS_TTL_HOURS)) {
      const value = override[field]
      if (value == null || value === '') continue
      if (!isNewerThanHours(override.lastUpdated, hours)) continue
      status[field] = value
      status.statusUpdatedAt = toIsoOrNull(override.lastUpdated)
    }
  }

  // People marked in drive crowd for any date; a fresh scout count wins for today.
  const scoutCrowdFresh =
    isToday &&
    status.crowdLevel &&
    override?.updatedBy === 'scout' &&
    isNewerThanHours(override?.lastUpdated, 2)

  const rollupCrowd = crowdLevelFromPeople(peopleCount)
  if (rollupCrowd && !scoutCrowdFresh) {
    status.crowdLevel = rollupCrowd
  }

  status.conditionsFresh = isNewerThanHours(status.statusUpdatedAt, CONDITIONS_FRESH_HOURS)
  status.lastUpdated = maxIso(status.statusUpdatedAt, checkInUpdatedAt)

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
    status: mergeStatus(override, checkInStats, forDate),
    goingSummary: checkInStats?.goingSummary || {
      solo: 0,
      friend: 0,
      community: 0,
      communityNames: [],
    },
    communityUpdates: mapCommunityUpdates(liveUpdates),
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

/** Aggregates only — who marked in is nobody else's business. */
export async function getCheckInsForDate(slug, forDate = todayIst()) {
  if (!isDbReady()) {
    return {
      date: forDate,
      totalPeople: 0,
      groups: 0,
      goingSummary: { solo: 0, friend: 0, community: 0, communityNames: [] },
      latestCheckInAt: null,
    }
  }
  const items = await CheckIn.find({ trekSlug: slug, date: forDate })
    .select('groupSize source communityName createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const totalPeople = items.reduce((sum, row) => sum + (row.groupSize || 0), 0)
  const goingSummary = buildGoingSummary(items)
  return {
    date: forDate,
    totalPeople,
    groups: items.length,
    goingSummary,
    latestCheckInAt: items[0]?.createdAt || null,
  }
}

/** @deprecated use getCheckInsForDate */
export async function getTodayCheckIns(slug) {
  return getCheckInsForDate(slug, todayIst())
}

/**
 * Records a mark-in. With a device hash this is an upsert, so tapping "Mark in"
 * twice corrects your entry instead of inflating the count for everyone.
 */
export async function createCheckIn(slug, payload) {
  const date = payload.date || todayIst()
  const deviceHash = payload.deviceHash || ''
  const fields = {
    groupSize: payload.groupSize,
    displayName: payload.displayName,
    source: payload.source,
    communityName: payload.communityName || '',
    note: payload.note || '',
  }

  let doc = null
  let created = true

  if (deviceHash) {
    const filter = { trekSlug: slug, date, deviceHash }
    const existing = await CheckIn.findOneAndUpdate(
      filter,
      { $set: { ...fields, updatedAt: new Date() } },
      { new: true },
    )
    if (existing) {
      doc = existing
      created = false
    } else {
      try {
        doc = await CheckIn.create({ ...filter, ...fields })
      } catch (err) {
        // Two taps in flight at once — the loser reads back the winner's row
        if (err?.code !== 11000) throw err
        doc = await CheckIn.findOneAndUpdate(
          filter,
          { $set: { ...fields, updatedAt: new Date() } },
          { new: true },
        )
        created = false
      }
    }
  } else {
    doc = await CheckIn.create({ trekSlug: slug, date, ...fields })
  }

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

  return { checkIn: doc, update, created }
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

/** How many help numbers one trail can carry before we stop taking more. */
export const CONTACTS_PER_TREK = 20

export async function listEmergencyContacts(slug) {
  if (!isDbReady()) return []
  const docs = await EmergencyContact.find({ trekSlug: slug })
    .sort({ createdAt: 1 })
    .limit(CONTACTS_PER_TREK)
    .lean()

  return docs.map((doc) => ({
    id: String(doc._id),
    label: doc.label,
    phone: doc.phone,
    addedBy: doc.addedBy || '',
    createdAt: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
  }))
}

export async function countEmergencyContacts(slug) {
  if (!isDbReady()) return 0
  return EmergencyContact.countDocuments({ trekSlug: slug })
}

export async function createEmergencyContact(slug, payload) {
  const doc = await EmergencyContact.create({
    trekSlug: slug,
    label: payload.label,
    phone: payload.phone,
    addedBy: payload.addedBy || '',
    deviceHash: payload.deviceHash || '',
  })
  return {
    id: String(doc._id),
    label: doc.label,
    phone: doc.phone,
    addedBy: doc.addedBy || '',
    createdAt: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
  }
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
