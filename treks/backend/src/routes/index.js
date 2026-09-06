import { Router } from 'express'
import healthRoutes from './health.js'
import trekRoutes from './treks.js'
import { getAlerts } from '../controllers/trekController.js'

const router = Router()

router.use('/health', healthRoutes)
router.get('/alerts', getAlerts)
router.use('/treks', trekRoutes)

export default router
