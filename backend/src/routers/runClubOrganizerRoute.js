const express = require('express');
const ctrl = require('../controllers/runClubOrganizerController');
const { authenticateRunClubOrganizer, requireEventAccess } = require('../middleware/runClubOrganizerAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const uploadCtrl = require('../controllers/uploadController');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.post('/auth/signup', authLimiter, ctrl.signup);
router.get('/auth/clubs', ctrl.listSignupClubs);
router.get('/auth/profile-eligible', authenticateToken, ctrl.profileEligible);
router.post('/auth/app-session', authenticateToken, ctrl.appSession);
router.get('/me', authenticateRunClubOrganizer, ctrl.getMe);

router.get('/events', authenticateRunClubOrganizer, ctrl.listEvents);
router.post('/events', authenticateRunClubOrganizer, ctrl.createEvent);
router.get('/events/:eventId', authenticateRunClubOrganizer, requireEventAccess, ctrl.getEvent);
router.patch('/events/:eventId', authenticateRunClubOrganizer, requireEventAccess, ctrl.updateEvent);
router.post('/events/:eventId/publish', authenticateRunClubOrganizer, requireEventAccess, ctrl.publishEvent);
router.post(
    '/events/:eventId/registration-status',
    authenticateRunClubOrganizer,
    requireEventAccess,
    ctrl.setRegistrationStatus,
);
router.post(
    '/events/:eventId/expire-pending-payments',
    authenticateRunClubOrganizer,
    requireEventAccess,
    ctrl.expirePendingPayments,
);

router.post(
    '/upload/image',
    authenticateRunClubOrganizer,
    uploadCtrl.uploadSingle,
    uploadCtrl.multerErrorHandler,
    (req, res, next) => {
        if (!req.body) req.body = {};
        req.body.folder = req.body.folder || 'crwdctrl/sports';
        next();
    },
    uploadCtrl.uploadImage,
);

router.get('/events/:eventId/dashboard', authenticateRunClubOrganizer, requireEventAccess, ctrl.getDashboard);
router.get('/events/:eventId/participants/export', authenticateRunClubOrganizer, requireEventAccess, ctrl.exportParticipants);
router.get('/events/:eventId/participants/lookup', authenticateRunClubOrganizer, requireEventAccess, ctrl.lookupParticipant);
router.get('/events/:eventId/participants/:bookingId', authenticateRunClubOrganizer, requireEventAccess, ctrl.getParticipant);
router.delete('/events/:eventId/participants/:bookingId', authenticateRunClubOrganizer, requireEventAccess, ctrl.deleteParticipant);
router.get('/events/:eventId/participants', authenticateRunClubOrganizer, requireEventAccess, ctrl.listParticipants);
router.post(
    '/events/:eventId/participants/:bookingId/review-payment',
    authenticateRunClubOrganizer,
    requireEventAccess,
    ctrl.reviewPayment,
);

router.get('/events/:eventId/checkin/stats', authenticateRunClubOrganizer, requireEventAccess, ctrl.getCheckinStats);
router.post('/events/:eventId/checkin', authenticateRunClubOrganizer, requireEventAccess, ctrl.checkin);

router.post('/events/:eventId/participants/:bookingId/resend-confirmation', authenticateRunClubOrganizer, requireEventAccess, ctrl.resendConfirmation);
router.post('/events/:eventId/participants/:bookingId/notify', authenticateRunClubOrganizer, requireEventAccess, ctrl.notifyParticipant);
router.post('/events/:eventId/notifications/reminder', authenticateRunClubOrganizer, requireEventAccess, ctrl.sendReminder);
router.post('/events/:eventId/notifications/broadcast', authenticateRunClubOrganizer, requireEventAccess, ctrl.broadcastAnnouncement);

module.exports = router;
