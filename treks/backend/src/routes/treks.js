import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getTrek,
  getTreks,
  getCheckIns,
  getTodayCheckIns,
  postCheckIn,
  postCommunityUpdate,
  patchTrekStatus,
} from '../controllers/trekController.js'
import { requireDb } from '../config/db.js'
import { requireScout } from '../middleware/scoutAuth.js'

const router = Router()

const checkInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many check-ins from this IP. Try again in a few minutes.',
  },
})

const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many updates from this IP. Try again in a few minutes.',
  },
})

router.get('/', getTreks)
router.get('/:slug/check-ins/today', getTodayCheckIns)
router.get('/:slug/check-ins', getCheckIns)
router.post('/:slug/check-ins', requireDb, checkInLimiter, postCheckIn)
router.post('/:slug/updates', requireDb, updateLimiter, postCommunityUpdate)
router.patch('/:slug/status', requireDb, requireScout, patchTrekStatus)
router.get('/:slug', getTrek)

export default router
