const express = require('express');
const adminAuth = require('../../../middleware/adminAuth');
const { campusHuntAdminLimiter } = require('../../../middleware/rateLimiter');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(adminAuth);
router.use(campusHuntAdminLimiter);

router.get('/events', adminController.listEvents);
router.post('/events', adminController.createEvent);
router.patch('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.get('/events/:eventId/overview', adminController.getEventOverview);

router.post('/events/:eventId/rounds', adminController.createRound);
router.patch('/rounds/:roundId', adminController.updateRound);
router.post('/rounds/:roundId/start', adminController.startRound);
router.post('/rounds/:roundId/lock', adminController.lockRound);
router.post('/rounds/:roundId/reopen', adminController.reopenRound);
router.post('/rounds/:roundId/finalize-leaderboard', adminController.finalizeLeaderboard);

router.post('/events/:eventId/routes', adminController.createRoute);
router.get('/events/:eventId/routes', adminController.listRoutes);
router.patch('/routes/:routeId', adminController.updateRoute);
router.post('/events/:eventId/routes/auto-assign', adminController.autoAssignRoutes);
router.get('/events/:eventId/starting-points', adminController.listStartingPoints);
router.post('/events/:eventId/starting-points', adminController.createStartingPoint);
router.patch('/starting-points/:startingPointId', adminController.updateStartingPoint);
router.delete('/starting-points/:startingPointId', adminController.deleteStartingPoint);
router.post('/events/:eventId/start-schedule/preview', adminController.previewStartSchedule);
router.post('/events/:eventId/start-schedule/generate', adminController.generateStartSchedule);
router.post('/events/:eventId/start-schedule/lock', adminController.lockStartSchedule);
router.get('/events/:eventId/start-dashboard', adminController.getStartDashboard);
router.post('/rounds/:roundId/releases/pause', adminController.setRoundReleasesPaused);
router.post('/rounds/:roundId/releases/resume', adminController.setRoundReleasesPaused);
router.post('/starting-points/:startingPointId/pause', adminController.setStartingPointPaused);
router.post('/starting-points/:startingPointId/resume', adminController.setStartingPointPaused);
router.post('/teams/:teamId/release', adminController.manualReleaseTeam);

router.post('/events/:eventId/teams', adminController.createTeam);
router.post('/events/:eventId/teams/bulk', adminController.bulkCreateTeams);
router.get('/events/:eventId/teams', adminController.listTeams);
router.get('/teams/:teamId', adminController.getTeamAdmin);
router.post('/teams/:teamId/reveal-access', adminController.revealTeamAccess);
router.get('/users/lookup', adminController.lookupUser);
router.patch('/teams/:teamId', adminController.updateTeam);
router.delete('/teams/:teamId', adminController.deleteTeam);
router.get('/events/:eventId/live-teams', adminController.liveTeams);

router.post('/events/:eventId/challenges', adminController.upsertChallenge);
router.get('/events/:eventId/challenges', adminController.listChallenges);
router.post('/challenges/:challengeId/void', adminController.voidChallenge);
router.get('/events/:eventId/challenge-monitor', adminController.challengeMonitor);

router.post('/events/:eventId/checkpoints', adminController.upsertCheckpoint);
router.get('/events/:eventId/checkpoints', adminController.listCheckpoints);
router.patch('/checkpoints/:checkpointId', adminController.updateCheckpoint);
router.get('/events/:eventId/station-qr', adminController.listStationQr);
router.get('/events/:eventId/checkpoint-monitor', adminController.checkpointMonitor);
router.post('/checkpoints/:checkpointId/disable', adminController.setCheckpointActive);
router.post('/checkpoints/:checkpointId/enable', adminController.setCheckpointActive);
router.post('/checkpoints/:checkpointId/rotate-qr', adminController.rotateCheckpointQr);

router.post('/events/:eventId/volunteers', adminController.createVolunteer);
router.get('/events/:eventId/volunteers', adminController.listVolunteers);

router.get('/events/:eventId/leaderboard', adminController.getLeaderboardAdmin);
router.get('/events/:eventId/issues', adminController.listIssues);
router.patch('/issues/:issueId', adminController.updateIssue);
router.get('/events/:eventId/audit', adminController.listAudit);

router.post('/teams/:teamId/manual-verify-checkpoint', adminController.manualVerifyCheckpoint);
router.post('/teams/:teamId/transfer-leader', adminController.transferLeader);
router.post('/teams/:teamId/penalty', adminController.applyPenalty);
router.post('/teams/:teamId/remove-penalty', adminController.removePenalty);
router.post('/verifications/reconcile-manual', adminController.reconcileManual);

module.exports = router;
