const express = require('express');
const ctrl = require('../controllers/eventShowOrganizerController');
const { authenticateEventShowOrganizer, requireEventShowAccess } = require('../middleware/eventShowOrganizerAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.post('/auth/signup', authLimiter, ctrl.signup);
router.get('/auth/events', ctrl.listSignupEvents);
router.get('/auth/profile-eligible', authenticateToken, ctrl.profileEligible);
router.post('/auth/app-session', authenticateToken, ctrl.appSession);
router.get('/me', authenticateEventShowOrganizer, ctrl.getMe);

router.get('/events', authenticateEventShowOrganizer, ctrl.listEvents);
router.get('/events/:eventId', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.getEvent);
router.post(
    '/events/:eventId/registration-status',
    authenticateEventShowOrganizer,
    requireEventShowAccess,
    ctrl.setRegistrationStatus,
);

router.get('/events/:eventId/dashboard', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.getDashboard);
router.get('/events/:eventId/participants/export', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.exportParticipants);
router.get('/events/:eventId/participants/:registrationId', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.getParticipant);
router.patch('/events/:eventId/participants/:registrationId/status', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.updateParticipantStatus);
router.delete('/events/:eventId/participants/:registrationId', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.deleteParticipant);
router.get('/events/:eventId/participants', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.listParticipants);

router.get('/events/:eventId/checkin/stats', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.getCheckinStats);
router.post('/events/:eventId/checkin', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.checkin);

router.post('/events/:eventId/notifications/reminder', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.sendReminder);
router.post('/events/:eventId/notifications/broadcast', authenticateEventShowOrganizer, requireEventShowAccess, ctrl.broadcastAnnouncement);

module.exports = router;
