import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getTrek,
  getTreks,
  getCheckIns,
  getTodayCheckIns,
  postCheckIn,
  postCommunityUpdate,
  postEmergencyContact,
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

// A help number is written once and read forever, so this can be tight
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many contacts added from this IP. Try again in a few minutes.',
  },
})

// Guessing the scout token should be slow and boring
const scoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many status updates. Try again in a few minutes.',
  },
})

router.get('/', getTreks)
router.get('/:slug/check-ins/today', getTodayCheckIns)
router.get('/:slug/check-ins', getCheckIns)
router.post('/:slug/check-ins', requireDb, checkInLimiter, postCheckIn)
router.post('/:slug/updates', requireDb, updateLimiter, postCommunityUpdate)
router.post('/:slug/contacts', requireDb, contactLimiter, postEmergencyContact)
router.patch('/:slug/status', scoutLimiter, requireDb, requireScout, patchTrekStatus)
router.get('/:slug', getTrek)

export default router
