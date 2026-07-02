const express = require('express');
const ctrl = require('../controllers/trekOrganizerController');
const { authenticateTrekOrganizer, requireTrekAccess } = require('../middleware/trekOrganizerAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.get('/me', authenticateTrekOrganizer, ctrl.getMe);

router.get('/treks/:trekId/dashboard', authenticateTrekOrganizer, requireTrekAccess, ctrl.getDashboard);
// Specific participant paths before :bookingId and the list route
router.get('/treks/:trekId/participants/export', authenticateTrekOrganizer, requireTrekAccess, ctrl.exportParticipants);
router.get('/treks/:trekId/participants/lookup', authenticateTrekOrganizer, requireTrekAccess, ctrl.lookupParticipant);
router.get('/treks/:trekId/participants/:bookingId', authenticateTrekOrganizer, requireTrekAccess, ctrl.getParticipant);
router.delete('/treks/:trekId/participants/:bookingId', authenticateTrekOrganizer, requireTrekAccess, ctrl.deleteParticipant);
router.get('/treks/:trekId/participants', authenticateTrekOrganizer, requireTrekAccess, ctrl.listParticipants);

router.get('/treks/:trekId/checkin/stats', authenticateTrekOrganizer, requireTrekAccess, ctrl.getCheckinStats);
router.post('/treks/:trekId/checkin', authenticateTrekOrganizer, requireTrekAccess, ctrl.checkin);

router.post('/treks/:trekId/participants/:bookingId/resend-confirmation', authenticateTrekOrganizer, requireTrekAccess, ctrl.resendConfirmation);
router.post('/treks/:trekId/notifications/reminder', authenticateTrekOrganizer, requireTrekAccess, ctrl.sendReminder);
router.post('/treks/:trekId/notifications/broadcast', authenticateTrekOrganizer, requireTrekAccess, ctrl.broadcastAnnouncement);

module.exports = router;
