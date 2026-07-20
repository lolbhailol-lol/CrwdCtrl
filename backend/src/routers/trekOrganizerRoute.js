const express = require('express');
const ctrl = require('../controllers/trekOrganizerController');
const { authenticateTrekOrganizer, requireTrekAccess } = require('../middleware/trekOrganizerAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.post('/auth/signup', authLimiter, ctrl.signup);
router.get('/auth/communities', ctrl.listSignupCommunities);
router.get('/auth/profile-eligible', authenticateToken, ctrl.profileEligible);
router.post('/auth/app-session', authenticateToken, ctrl.appSession);
router.get('/me', authenticateTrekOrganizer, ctrl.getMe);

router.get('/treks/:trekId/dashboard', authenticateTrekOrganizer, requireTrekAccess, ctrl.getDashboard);
router.patch('/treks/:trekId/registration', authenticateTrekOrganizer, requireTrekAccess, ctrl.updateRegistrationSettings);
// Specific participant paths before :bookingId and the list route
router.get('/treks/:trekId/participants/export', authenticateTrekOrganizer, requireTrekAccess, ctrl.exportParticipants);
router.get('/treks/:trekId/participants/lookup', authenticateTrekOrganizer, requireTrekAccess, ctrl.lookupParticipant);
router.post('/treks/:trekId/participants/message', authenticateTrekOrganizer, requireTrekAccess, ctrl.sendParticipantMessages);
router.get('/treks/:trekId/participants/:bookingId', authenticateTrekOrganizer, requireTrekAccess, ctrl.getParticipant);
router.delete('/treks/:trekId/participants/:bookingId', authenticateTrekOrganizer, requireTrekAccess, ctrl.deleteParticipant);
router.get('/treks/:trekId/participants', authenticateTrekOrganizer, requireTrekAccess, ctrl.listParticipants);

router.get('/treks/:trekId/checkin/stats', authenticateTrekOrganizer, requireTrekAccess, ctrl.getCheckinStats);
router.post('/treks/:trekId/checkin', authenticateTrekOrganizer, requireTrekAccess, ctrl.checkin);

router.post('/treks/:trekId/participants/:bookingId/resend-confirmation', authenticateTrekOrganizer, requireTrekAccess, ctrl.resendConfirmation);
router.post('/treks/:trekId/participants/:bookingId/review-payment', authenticateTrekOrganizer, requireTrekAccess, ctrl.reviewPayment);
router.post('/treks/:trekId/notifications/reminder', authenticateTrekOrganizer, requireTrekAccess, ctrl.sendReminder);
router.post('/treks/:trekId/notifications/broadcast', authenticateTrekOrganizer, requireTrekAccess, ctrl.broadcastAnnouncement);

module.exports = router;
