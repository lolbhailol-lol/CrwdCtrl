import { env } from '../config/env.js'

export function requireScout(req, res, next) {
  if (!env.scoutToken) {
    return res.status(503).json({
      success: false,
      message: 'SCOUT_TOKEN is not configured on the server.',
    })
  }

  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match?.[1]?.trim()

  if (!token || token !== env.scoutToken) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing scout token.',
    })
  }

  return next()
}
