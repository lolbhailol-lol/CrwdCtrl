const express = require('express');
const ctrl = require('../controllers/runClubOrganizerController');
const { authenticateRunClubOrganizer, requireEventAccess } = require('../middleware/runClubOrganizerAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.get('/me', authenticateRunClubOrganizer, ctrl.getMe);

router.get('/events/:eventId/dashboard', authenticateRunClubOrganizer, requireEventAccess, ctrl.getDashboard);
router.get('/events/:eventId/participants/export', authenticateRunClubOrganizer, requireEventAccess, ctrl.exportParticipants);
router.get('/events/:eventId/participants/lookup', authenticateRunClubOrganizer, requireEventAccess, ctrl.lookupParticipant);
router.get('/events/:eventId/participants/:bookingId', authenticateRunClubOrganizer, requireEventAccess, ctrl.getParticipant);
router.delete('/events/:eventId/participants/:bookingId', authenticateRunClubOrganizer, requireEventAccess, ctrl.deleteParticipant);
router.get('/events/:eventId/participants', authenticateRunClubOrganizer, requireEventAccess, ctrl.listParticipants);

router.get('/events/:eventId/checkin/stats', authenticateRunClubOrganizer, requireEventAccess, ctrl.getCheckinStats);
router.post('/events/:eventId/checkin', authenticateRunClubOrganizer, requireEventAccess, ctrl.checkin);

router.post('/events/:eventId/participants/:bookingId/resend-confirmation', authenticateRunClubOrganizer, requireEventAccess, ctrl.resendConfirmation);
router.post('/events/:eventId/notifications/reminder', authenticateRunClubOrganizer, requireEventAccess, ctrl.sendReminder);
router.post('/events/:eventId/notifications/broadcast', authenticateRunClubOrganizer, requireEventAccess, ctrl.broadcastAnnouncement);

module.exports = router;
