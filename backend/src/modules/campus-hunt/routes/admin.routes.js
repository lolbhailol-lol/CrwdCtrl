const express = require('express');
const adminAuth = require('../../../middleware/adminAuth');
const { campusHuntAdminLimiter } = require('../../../middleware/rateLimiter');
const adminController = require('../controllers/adminController');
const finaleController = require('../controllers/finaleController');

const router = express.Router();

router.use(adminAuth);
router.use(campusHuntAdminLimiter);

router.get('/events', adminController.listEvents);
router.post('/events', adminController.createEvent);
router.patch('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.get('/events/:eventId/overview', adminController.getEventOverview);
router.patch('/events/:eventId/campus-stations', adminController.updateEventCampusStations);
router.post('/events/:eventId/bootstrap-round1', adminController.bootstrapRound1);

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
router.post('/events/:eventId/resync-clue1', adminController.resyncClue1Bindings);
router.post('/events/:eventId/clue1/bulk-save', adminController.bulkSaveClue1Variants);
router.post('/events/:eventId/clue2/bulk-save', adminController.bulkSaveClue2Variants);
router.post('/events/:eventId/clue3/bulk-save', adminController.bulkSaveClue3Variants);
router.post('/events/:eventId/clue4/bulk-save', adminController.bulkSaveClue4Variants);
router.post('/events/:eventId/clue5/bulk-save', adminController.bulkSaveClue5Variants);
router.put('/events/:eventId/clue-scoring/:clueNumber', adminController.saveClueScoringSettings);
router.get('/events/:eventId/start-dashboard', adminController.getStartDashboard);
router.post('/rounds/:roundId/releases/pause', adminController.setRoundReleasesPaused);
router.post('/rounds/:roundId/releases/resume', adminController.setRoundReleasesPaused);
router.post('/starting-points/:startingPointId/pause', adminController.setStartingPointPaused);
router.post('/starting-points/:startingPointId/resume', adminController.setStartingPointPaused);
router.post('/teams/:teamId/release', adminController.manualReleaseTeam);
router.post('/teams/:teamId/mark-start-reached', adminController.markTeamStartReached);

router.post('/events/:eventId/teams', adminController.createTeam);
router.post('/events/:eventId/teams/bulk', adminController.bulkCreateTeams);
router.post('/events/:eventId/teams/repair-rosters', adminController.repairTeamRosters);
router.get('/events/:eventId/teams', adminController.listTeams);
router.get('/teams/:teamId', adminController.getTeamAdmin);
router.post('/teams/:teamId/reveal-access', adminController.revealTeamAccess);
router.post('/teams/:teamId/team-password', adminController.setTeamPassword);
router.post('/events/:eventId/teams/set-password', adminController.setAllTeamPasswords);
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
router.get('/events/:eventId/offline-export', adminController.exportOfflinePacks);
router.post('/events/:eventId/offline-import', adminController.importOfflineResults);
router.get('/events/:eventId/offline-installs', adminController.listOfflineInstalls);
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
router.post('/teams/:teamId/playtest-complete-scan', adminController.playtestCompleteScan);
router.post('/teams/:teamId/playtest-reset', adminController.playtestResetTeam);
router.post('/teams/:teamId/transfer-leader', adminController.transferLeader);
router.post('/teams/:teamId/penalty', adminController.applyPenalty);
router.post('/teams/:teamId/remove-penalty', adminController.removePenalty);
router.post('/verifications/reconcile-manual', adminController.reconcileManual);

router.post('/events/:eventId/finale/bootstrap', finaleController.bootstrap);
router.get('/events/:eventId/finale/config', finaleController.getConfig);
router.patch('/events/:eventId/finale/config', finaleController.patchConfig);
router.post('/events/:eventId/finale/promote/auto', finaleController.promoteAuto);
router.post('/events/:eventId/finale/promote/manual', finaleController.promoteManual);
router.post('/events/:eventId/finale/promote/demo', finaleController.promoteDemo);
router.post('/events/:eventId/finale/promote/selected', finaleController.promoteSelected);
router.get('/events/:eventId/finale/entries', finaleController.getEntries);
router.get('/events/:eventId/finale/candidates', finaleController.getCandidates);
router.get('/events/:eventId/finale/grid-sessions', finaleController.getGridSessions);
router.get('/events/:eventId/finale/mission-assignments', finaleController.getMissionAssignments);
router.post('/events/:eventId/finale/schedule/preview', finaleController.previewSchedule);
router.post('/events/:eventId/finale/schedule/generate', finaleController.generateSchedule);
router.post('/events/:eventId/finale/schedule/lock', finaleController.lockSchedule);
router.get('/events/:eventId/finale/live-dashboard', finaleController.getLiveDashboard);
router.post('/events/:eventId/finale/releases/sync', finaleController.syncReleases);
router.post('/events/:eventId/finale/releases/pause', finaleController.setReleasesPaused);
router.post('/events/:eventId/finale/releases/resume', finaleController.setReleasesPaused);
router.post('/events/:eventId/finale/meet/:meetCode/pause', finaleController.setMeetPaused);
router.post('/events/:eventId/finale/meet/:meetCode/resume', finaleController.setMeetPaused);
router.post('/events/:eventId/finale/teams/:teamId/release', finaleController.releaseTeam);
router.post('/events/:eventId/finale/teams/:teamId/stop', finaleController.adminStopFinaleTeam);
router.post('/events/:eventId/finale/teams/:teamId/resume', finaleController.adminResumeFinaleTeam);
router.post('/events/:eventId/finale/teams/:teamId/playtest-complete-mission', finaleController.adminPlaytestCompleteFinaleMission);
router.post('/events/:eventId/finale/teams/:teamId/playtest-advance-mission', finaleController.adminPlaytestAdvanceFinaleMission);
router.post('/events/:eventId/finale/teams/:teamId/playtest-reset', finaleController.adminPlaytestResetFinaleTeam);
router.post('/events/:eventId/finale/playtest-reset-round', finaleController.adminResetFinaleForRetest);
router.get('/events/:eventId/finale/leaderboard', finaleController.getFinaleLeaderboardAdmin);
router.post('/rounds/:roundId/finale/start', finaleController.startFinale);
router.post('/rounds/:roundId/finale/lock', finaleController.lockFinale);
router.post('/rounds/:roundId/finale/finalize-leaderboard', finaleController.finalizeFinale);

module.exports = router;
