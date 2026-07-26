import crypto from 'node:crypto'
import { env } from '../config/env.js'

/** Length-independent comparison so a wrong token leaks nothing via timing. */
function tokensMatch(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest()
  const b = crypto.createHash('sha256').update(String(expected)).digest()
  return crypto.timingSafeEqual(a, b)
}

export function requireScout(req, res, next) {
  if (!env.scoutToken) {
    return res.status(503).json({
      success: false,
      message: 'Scout updates are not enabled on this server.',
    })
  }

  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match?.[1]?.trim()

  if (!token || !tokensMatch(token, env.scoutToken)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing scout token.',
    })
  }

  return next()
}
