const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const adminAuth = require('../../../middleware/adminAuth');
const ctrl = require('../controllers/eventController');

router.post('/', adminAuth, ctrl.createEvent);
router.get('/', ctrl.listEvents);
router.get('/:eventId', ctrl.getEventDetail);
router.post('/:eventId/approve', adminAuth, ctrl.approveEvent);
router.post('/:eventId/start', adminAuth, ctrl.startEvent);
router.post('/:eventId/end', adminAuth, ctrl.endEvent);

module.exports = router;