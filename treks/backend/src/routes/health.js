import { Router } from 'express'
import { env } from '../config/env.js'
import { isDbReady } from '../config/db.js'

const router = Router()

/**
 * Deployment probe. Reports degraded (503) when Mongo is configured but down,
 * so a broken database is never reported as a healthy service.
 */
router.get('/', (req, res) => {
  const mongoConfigured = Boolean(env.mongoUri)
  const mongoReady = isDbReady()
  const degraded = mongoConfigured && !mongoReady

  res.status(degraded ? 503 : 200).json({
    success: !degraded,
    service: 'crwdctrl-treks-backend',
    status: degraded ? 'degraded' : 'ok',
    live: mongoReady,
    time: new Date().toISOString(),
  })
})

export default router
