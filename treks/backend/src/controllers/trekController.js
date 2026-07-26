import crypto from 'node:crypto'
import * as trekService from '../services/trekService.js'
import { CROWD_LEVEL_VALUES, ENTRY_STATUS_VALUES, TRAIL_CONDITION_VALUES } from '../models/TrekStatus.js'
import { env } from '../config/env.js'
import { isDbReady } from '../config/db.js'
import { resolvePlanDate, todayIst } from '../utils/date.js'

function badDate(res, resolved) {
  return res.status(400).json({ success: false, message: resolved.error })
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message })
}

/**
 * Hash of the browser's anonymous device id. The raw id is never stored, and a
 * missing header simply means no dedupe rather than a rejected mark-in.
 */
function deviceHashFrom(req) {
  const raw = String(req.get('X-Device-Id') || '').trim()
  if (!raw || raw.length > 100) return ''
  return crypto.createHash('sha256').update(`${env.deviceSalt}:${raw}`).digest('hex')
}

export async function getTreks(req, res, next) {
  try {
    const resolved = resolvePlanDate(req.query.date)
    if (!resolved.ok) return badDate(res, resolved)

    const { q, category, featured, limit } = req.query
    let data = trekService.listTreks()

    if (q) data = trekService.searchTreks(q)
    if (category) data = data.filter((t) => t.category === category)
    if (featured === 'true') data = data.filter((t) => t.featured)

    // A junk limit must not empty the board (Number('abc') → NaN → slice(0, NaN))
    const max = Number.parseInt(limit, 10)
    if (Number.isInteger(max) && max > 0) data = data.slice(0, max)

    data = await trekService.enrichTreks(data, resolved.date)

    res.json({
      success: true,
      count: data.length,
      forDate: resolved.date,
      source: 'live-api',
      /** false = reading the catalog without live reports behind it */
      live: isDbReady(),
      data,
    })
  } catch (err) {
    next(err)
  }
}

export async function getTrek(req, res, next) {
  try {
    const resolved = resolvePlanDate(req.query.date)
    if (!resolved.ok) return badDate(res, resolved)

    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }
    const [data, reportedContacts] = await Promise.all([
      trekService.enrichTrek(trek, resolved.date),
      trekService.listEmergencyContacts(req.params.slug),
    ])
    return res.json({
      success: true,
      forDate: resolved.date,
      source: 'live-api',
      live: isDbReady(),
      data: { ...data, reportedContacts },
    })
  } catch (err) {
    return next(err)
  }
}

export function getAlerts(req, res) {
  res.json({
    success: true,
    count: trekService.listAlerts().length,
    source: 'live-api',
    data: trekService.listAlerts(),
  })
}

export async function getCheckIns(req, res, next) {
  try {
    const resolved = resolvePlanDate(req.query.date)
    if (!resolved.ok) return badDate(res, resolved)

    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }
    const data = await trekService.getCheckInsForDate(req.params.slug, resolved.date)
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/** Alias: always today's check-ins */
export async function getTodayCheckIns(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }
    const data = await trekService.getCheckInsForDate(req.params.slug, todayIst())
    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function postCheckIn(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }

    const {
      groupSize,
      displayName,
      source,
      communityName,
      note,
      message,
      statusTag,
      date: bodyDate,
    } = req.body || {}

    const resolved = resolvePlanDate(bodyDate)
    if (!resolved.ok) return badDate(res, resolved)

    const size = Number(groupSize)
    const name = String(displayName || '').trim()
    const src = String(source || '').trim()
    const community = String(communityName || '').trim()

    if (!Number.isInteger(size) || size < 1 || size > 50) {
      return badRequest(res, 'groupSize must be an integer from 1 to 50.')
    }
    if (!name || name.length > 60) {
      return badRequest(res, 'displayName is required (max 60 chars).')
    }
    if (!['solo', 'friend', 'community'].includes(src)) {
      return badRequest(res, 'source must be solo, friend, or community.')
    }
    if (src === 'community' && !community) {
      return badRequest(res, 'communityName is required when source is community.')
    }
    if (community.length > 80) {
      return badRequest(res, 'communityName is too long (max 80 chars).')
    }

    const { checkIn, update, created } = await trekService.createCheckIn(req.params.slug, {
      date: resolved.date,
      groupSize: size,
      displayName: name,
      source: src,
      communityName: community,
      note: String(note || '').trim().slice(0, 200),
      message: message ? String(message).trim().slice(0, 280) : '',
      statusTag: ['ok', 'info', 'warning', 'alert'].includes(statusTag) ? statusTag : 'info',
      deviceHash: deviceHashFrom(req),
    })

    const enriched = await trekService.enrichTrek(trek, resolved.date)

    return res.status(created ? 201 : 200).json({
      success: true,
      forDate: resolved.date,
      created,
      data: {
        checkIn: {
          id: String(checkIn._id),
          groupSize: checkIn.groupSize,
          displayName: checkIn.displayName,
          source: checkIn.source,
          communityName: checkIn.communityName,
          note: checkIn.note,
          date: checkIn.date,
          createdAt: checkIn.createdAt,
        },
        update: update
          ? {
              id: String(update._id),
              message: update.message,
              statusTag: update.statusTag,
            }
          : null,
        created,
        trek: enriched,
      },
    })
  } catch (err) {
    return next(err)
  }
}

const UPDATE_TAGS = ['crowd', 'trail', 'weather', 'closure', 'info']

export async function postCommunityUpdate(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }

    const { message, tag, displayName } = req.body || {}
    const note = String(message || '').trim()
    const updateTag = String(tag || 'info').trim()
    const name = String(displayName || 'Trekker').trim().slice(0, 60) || 'Trekker'

    if (!note || note.length > 280) {
      return badRequest(res, 'message is required (max 280 chars).')
    }
    if (!UPDATE_TAGS.includes(updateTag)) {
      return badRequest(res, `tag must be one of: ${UPDATE_TAGS.join(', ')}`)
    }

    const update = await trekService.createCommunityUpdate(req.params.slug, {
      message: note,
      tag: updateTag,
      displayName: name,
    })

    const enriched = await trekService.enrichTrek(trek)

    return res.status(201).json({
      success: true,
      data: {
        update: {
          id: String(update._id),
          message: update.message,
          status: update.statusTag,
          source: update.displayName || 'Trekker',
          timestamp: update.createdAt,
        },
        trek: enriched,
      },
    })
  } catch (err) {
    return next(err)
  }
}

const CONTACT_FIELDS = new Set(['label', 'phone', 'addedBy'])

/**
 * Keeps the digits (and a single leading +) so two people typing the same
 * number in different styles collide on the unique index instead of both
 * landing in the list.
 */
function normalizePhone(raw) {
  const value = String(raw || '').trim()
  const plus = value.startsWith('+')
  const digits = value.replace(/\D/g, '')
  if (digits.length < 6 || digits.length > 15) return ''
  return plus ? `+${digits}` : digits
}

export async function postEmergencyContact(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }

    const body = req.body || {}
    const unknown = Object.keys(body).filter((key) => !CONTACT_FIELDS.has(key))
    if (unknown.length) {
      return badRequest(res, `Unexpected field: ${unknown[0]}`)
    }

    const label = String(body.label || '').trim()
    const phone = normalizePhone(body.phone)
    const addedBy = String(body.addedBy || '').trim().slice(0, 60)

    if (!label || label.length > 60) {
      return badRequest(res, 'Say who this number belongs to (max 60 chars).')
    }
    if (!phone) {
      return badRequest(res, 'Enter a phone number with 6 to 15 digits.')
    }

    const existing = await trekService.countEmergencyContacts(req.params.slug)
    if (existing >= trekService.CONTACTS_PER_TREK) {
      return res.status(409).json({
        success: false,
        message: 'This trail already has the maximum number of contacts.',
      })
    }

    const contact = await trekService.createEmergencyContact(req.params.slug, {
      label,
      phone,
      addedBy,
      deviceHash: deviceHashFrom(req),
    })

    return res.status(201).json({ success: true, data: { contact } })
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'That number is already listed for this trail.',
      })
    }
    return next(err)
  }
}

const SCOUT_FIELDS = new Set([
  'crowdLevel',
  'weather',
  'trailCondition',
  'parkingStatus',
  'forestAdvisory',
  'entryStatus',
  'alert',
])

const SCOUT_MAX_LENGTH = 240

export async function patchTrekStatus(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }

    const body = req.body || {}

    const unknown = Object.keys(body).filter((key) => !SCOUT_FIELDS.has(key))
    if (unknown.length) {
      return badRequest(res, `Unexpected field: ${unknown[0]}`)
    }

    const enums = {
      crowdLevel: CROWD_LEVEL_VALUES,
      trailCondition: TRAIL_CONDITION_VALUES,
      entryStatus: ENTRY_STATUS_VALUES,
    }
    for (const [field, values] of Object.entries(enums)) {
      const value = body[field]
      if (value && !values.includes(value)) {
        return badRequest(res, `${field} must be one of: ${values.join(', ')}`)
      }
    }

    const fields = {}
    for (const key of SCOUT_FIELDS) {
      const value = body[key]
      if (value === undefined || value === null) continue
      if (typeof value !== 'string') return badRequest(res, `${key} must be text.`)
      const trimmed = value.trim().slice(0, SCOUT_MAX_LENGTH)
      // Blank is "no answer" for the pick-one fields, not a value to store
      if (!trimmed && enums[key]) continue
      fields[key] = trimmed
    }

    await trekService.upsertTrekStatus(req.params.slug, fields)
    const enriched = await trekService.enrichTrek(trek)

    return res.json({ success: true, data: enriched })
  } catch (err) {
    return next(err)
  }
}
