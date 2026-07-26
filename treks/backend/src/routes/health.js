import { Router } from 'express'
import { env } from '../config/env.js'
import { isDbReady } from '../config/db.js'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'crwdctrl-treks-backend',
    status: 'ok',
    time: new Date().toISOString(),
    keys: {
      openRouter: Boolean(env.openRouterApiKey),
      mongo: isDbReady(),
      scout: Boolean(env.scoutToken),
    },
  })
})

export default router
