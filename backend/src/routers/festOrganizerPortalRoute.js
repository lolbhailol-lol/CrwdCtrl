const express = require('express');
const ctrl = require('../controllers/festOrganizerPortalController');
const stallCtrl = require('../controllers/festStallLeadController');
const probableCtrl = require('../controllers/festCompetitionProbableController');
const proShowCtrl = require('../controllers/festProShowController');
const liveCtrl = require('../controllers/festLiveUpdateController');
const { authenticateFestOrganizer, requireFestAccess } = require('../middleware/festOrganizerAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/auth/login', authLimiter, ctrl.login);
router.post('/auth/signup', authLimiter, ctrl.signup);
router.get('/me', authenticateFestOrganizer, ctrl.getMe);
router.get('/logged-in', authenticateFestOrganizer, ctrl.listLoggedInUsers);

router.get('/fests/:festId/dashboard', authenticateFestOrganizer, requireFestAccess, ctrl.getDashboard);
router.get('/fests/:festId/live-updates/meta', authenticateFestOrganizer, requireFestAccess, liveCtrl.getLiveUpdateMeta);
router.get('/fests/:festId/live-updates', authenticateFestOrganizer, requireFestAccess, liveCtrl.listLiveUpdates);
router.post('/fests/:festId/live-updates', authenticateFestOrganizer, requireFestAccess, liveCtrl.createLiveUpdate);
router.patch('/fests/:festId/live-updates/:updateId', authenticateFestOrganizer, requireFestAccess, liveCtrl.updateLiveUpdate);
router.post('/fests/:festId/live-updates/:updateId/publish', authenticateFestOrganizer, requireFestAccess, liveCtrl.publishLiveUpdate);
router.post('/fests/:festId/live-updates/:updateId/archive', authenticateFestOrganizer, requireFestAccess, liveCtrl.archiveLiveUpdate);
router.delete('/fests/:festId/live-updates/:updateId', authenticateFestOrganizer, requireFestAccess, liveCtrl.deleteLiveUpdate);
router.get('/fests/:festId/pro-show', authenticateFestOrganizer, requireFestAccess, proShowCtrl.getProShowOps);
router.patch('/fests/:festId/pro-show', authenticateFestOrganizer, requireFestAccess, proShowCtrl.updateProShowConfig);
router.get('/fests/:festId/pro-show/tickets', authenticateFestOrganizer, requireFestAccess, proShowCtrl.listProShowTickets);
router.post('/fests/:festId/pro-show/passes', authenticateFestOrganizer, requireFestAccess, proShowCtrl.issueProShowPass);
router.get('/fests/:festId/competitions/probables', authenticateFestOrganizer, requireFestAccess, probableCtrl.listProbables);
router.post('/fests/:festId/competitions/probables', authenticateFestOrganizer, requireFestAccess, probableCtrl.createProbable);
router.patch('/fests/:festId/competitions/probables/:probableId', authenticateFestOrganizer, requireFestAccess, probableCtrl.updateProbable);
router.delete('/fests/:festId/competitions/probables/:probableId', authenticateFestOrganizer, requireFestAccess, probableCtrl.deleteProbable);
router.post('/fests/:festId/competitions/probables/:probableId/convert', authenticateFestOrganizer, requireFestAccess, probableCtrl.convertProbable);
router.get('/fests/:festId/competitions/:competitionId/ops', authenticateFestOrganizer, requireFestAccess, ctrl.getCompetitionOps);
router.patch('/fests/:festId/competitions/:competitionId/slots', authenticateFestOrganizer, requireFestAccess, ctrl.updateCompetitionSlots);
router.post('/fests/:festId/participants/manual', authenticateFestOrganizer, requireFestAccess, ctrl.createManualParticipant);
router.patch('/fests/:festId/participants/bulk-status', authenticateFestOrganizer, requireFestAccess, ctrl.bulkUpdateParticipantStatus);
router.get('/fests/:festId/participants/export', authenticateFestOrganizer, requireFestAccess, ctrl.exportParticipants);
router.get('/fests/:festId/participants/:registrationId', authenticateFestOrganizer, requireFestAccess, ctrl.getParticipant);
router.patch('/fests/:festId/participants/:registrationId/status', authenticateFestOrganizer, requireFestAccess, ctrl.updateParticipantStatus);
router.post('/fests/:festId/participants/:registrationId/notify', authenticateFestOrganizer, requireFestAccess, ctrl.notifyParticipant);
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
router.get('/fests/:festId/notifications/contacts', authenticateFestOrganizer, requireFestAccess, ctrl.listNotifyContacts);

module.exports = router;
