import * as trekService from '../services/trekService.js'
import { CROWD_LEVEL_VALUES } from '../models/TrekStatus.js'
import { resolvePlanDate, todayIst } from '../utils/date.js'

function badDate(res, resolved) {
  return res.status(400).json({ success: false, message: resolved.error })
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
    if (limit) data = data.slice(0, Number(limit))

    data = await trekService.enrichTreks(data, resolved.date)

    res.json({
      success: true,
      count: data.length,
      forDate: resolved.date,
      source: 'live-api',
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
    const data = await trekService.enrichTrek(trek, resolved.date)
    return res.json({
      success: true,
      forDate: resolved.date,
      source: 'live-api',
      data,
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

    if (!Number.isInteger(size) || size < 1 || size > 50) {
      return res.status(400).json({
        success: false,
        message: 'groupSize must be an integer from 1 to 50.',
      })
    }
    if (!name || name.length > 60) {
      return res.status(400).json({
        success: false,
        message: 'displayName is required (max 60 chars).',
      })
    }
    if (!['solo', 'friend', 'community'].includes(src)) {
      return res.status(400).json({
        success: false,
        message: 'source must be solo, friend, or community.',
      })
    }
    if (src === 'community' && !String(communityName || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'communityName is required when source is community.',
      })
    }

    const { checkIn, update } = await trekService.createCheckIn(req.params.slug, {
      date: resolved.date,
      groupSize: size,
      displayName: name,
      source: src,
      communityName: String(communityName || '').trim(),
      note: String(note || '').trim().slice(0, 200),
      message: message ? String(message).trim().slice(0, 280) : '',
      statusTag: ['ok', 'info', 'warning', 'alert'].includes(statusTag) ? statusTag : 'info',
    })

    const enriched = await trekService.enrichTrek(trek, resolved.date)

    return res.status(201).json({
      success: true,
      forDate: resolved.date,
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
      return res.status(400).json({
        success: false,
        message: 'message is required (max 280 chars).',
      })
    }
    if (!UPDATE_TAGS.includes(updateTag)) {
      return res.status(400).json({
        success: false,
        message: `tag must be one of: ${UPDATE_TAGS.join(', ')}`,
      })
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

export async function patchTrekStatus(req, res, next) {
  try {
    const trek = trekService.getTrekBySlug(req.params.slug)
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' })
    }

    const body = req.body || {}
    if (body.crowdLevel && !CROWD_LEVEL_VALUES.includes(body.crowdLevel)) {
      return res.status(400).json({
        success: false,
        message: `crowdLevel must be one of: ${CROWD_LEVEL_VALUES.join(', ')}`,
      })
    }

    await trekService.upsertTrekStatus(req.params.slug, body)
    const enriched = await trekService.enrichTrek(trek)

    return res.json({ success: true, data: enriched })
  } catch (err) {
    return next(err)
  }
}
