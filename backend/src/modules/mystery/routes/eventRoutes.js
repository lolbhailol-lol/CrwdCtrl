const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/eventController');

router.post('/', authenticateToken, ctrl.createEvent);
router.get('/', ctrl.listEvents);
router.get('/:eventId', ctrl.getEventDetail);
router.post('/:eventId/approve', authenticateToken, ctrl.approveEvent);
router.post('/:eventId/start', authenticateToken, ctrl.startEvent);
router.post('/:eventId/end', authenticateToken, ctrl.endEvent);

module.exports = router;