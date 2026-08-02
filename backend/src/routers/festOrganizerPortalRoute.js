const express = require('express');
const ctrl = require('../controllers/festOrganizerPortalController');
const stallCtrl = require('../controllers/festStallLeadController');
const { authenticateFestOrganizer, requireFestAccess } = require('../middleware/festOrganizerAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.post('/auth/signup', authLimiter, ctrl.signup);
router.get('/me', authenticateFestOrganizer, ctrl.getMe);
router.get('/logged-in', authenticateFestOrganizer, ctrl.listLoggedInUsers);

router.get('/fests/:festId/dashboard', authenticateFestOrganizer, requireFestAccess, ctrl.getDashboard);
router.get('/fests/:festId/participants/export', authenticateFestOrganizer, requireFestAccess, ctrl.exportParticipants);
router.get('/fests/:festId/participants/:registrationId', authenticateFestOrganizer, requireFestAccess, ctrl.getParticipant);
router.patch('/fests/:festId/participants/:registrationId/status', authenticateFestOrganizer, requireFestAccess, ctrl.updateParticipantStatus);
router.delete('/fests/:festId/participants/:registrationId', authenticateFestOrganizer, requireFestAccess, ctrl.deleteParticipant);
router.get('/fests/:festId/participants', authenticateFestOrganizer, requireFestAccess, ctrl.listParticipants);

router.get('/fests/:festId/leads/export', authenticateFestOrganizer, requireFestAccess, stallCtrl.exportLeads);
router.get('/fests/:festId/leads/stats', authenticateFestOrganizer, requireFestAccess, stallCtrl.getLeadStats);
router.patch('/fests/:festId/leads/:leadId', authenticateFestOrganizer, requireFestAccess, stallCtrl.updateLeadContacted);
router.delete('/fests/:festId/leads/:leadId', authenticateFestOrganizer, requireFestAccess, stallCtrl.deleteLead);
router.post('/fests/:festId/leads', authenticateFestOrganizer, requireFestAccess, stallCtrl.createKioskLead);
router.get('/fests/:festId/leads', authenticateFestOrganizer, requireFestAccess, stallCtrl.listLeads);

router.get('/fests/:festId/checkin/stats', authenticateFestOrganizer, requireFestAccess, ctrl.getCheckinStats);
router.post('/fests/:festId/checkin', authenticateFestOrganizer, requireFestAccess, ctrl.checkin);

router.post('/fests/:festId/notifications/reminder', authenticateFestOrganizer, requireFestAccess, ctrl.sendReminder);
router.post('/fests/:festId/notifications/broadcast', authenticateFestOrganizer, requireFestAccess, ctrl.broadcastAnnouncement);

module.exports = router;
