const express = require('express');
const { authenticateToken, optionalAuthenticateToken } = require('../../../middleware/authmiddleware');
const { requireTeamMember, requireTeamLeader, blockEmergencyStopped } = require('../middleware/playerAuthz');
const {
  campusHuntLoginLimiter,
  campusHuntOfflineSyncLimiter,
  campusHuntAnswerLimiter,
  campusHuntHintLimiter,
  campusHuntVerifyLimiter,
} = require('../../../middleware/rateLimiter');
const finaleController = require('../controllers/finaleController');
const {
  getEventBySlug,
  getTeamLoginCard,
  unlockTeamRoster,
  loginTeamMember,
  enterTeamAsMember,
  listColleges,
  listProfileEntries,
  getPublicLeaderboard,
  getOfflineInstallPack,
  ackOfflineInstall,
  postOfflineProgress,
  postOfflinePull,
  postOfflineGridEnsure,
  getMyTeam,
  getTeamProgress,
  streamTeamProgress,
  submitClue1,
  submitChallengeAnswer,
  requestChallengeHint,
  revealTimedChallenge,
  getLeaderboard,
  scanStation,
  confirmStation,
  rewindStep,
  forceUnlockClue2,
  submitFinishCode,
  startHuntWithCode,
} = require('../controllers/playerController');

const router = express.Router();

router.get('/offline-install/:token', campusHuntLoginLimiter, getOfflineInstallPack);
router.post('/offline-install/:token/ack', campusHuntLoginLimiter, ackOfflineInstall);
router.post('/events/:eventId/offline-progress', campusHuntOfflineSyncLimiter, blockEmergencyStopped, postOfflineProgress);
router.post('/events/:eventId/offline-pull', campusHuntOfflineSyncLimiter, postOfflinePull);
router.post('/events/:eventId/offline-grid-ensure', campusHuntOfflineSyncLimiter, blockEmergencyStopped, postOfflineGridEnsure);
router.get('/colleges', listColleges);
router.get('/profile-entries', optionalAuthenticateToken, listProfileEntries);
router.get('/events/:eventId/leaderboard/public', getPublicLeaderboard);
router.get('/events/:eventId/finale/leaderboard', finaleController.getFinaleLeaderboardPublic);
router.get('/events/by-slug/:slug', getEventBySlug);
router.get('/events/by-slug/:slug/teams/:teamCode', getTeamLoginCard);
router.post(
  '/events/by-slug/:slug/teams/:teamCode/unlock',
  campusHuntLoginLimiter,
  unlockTeamRoster,
);
router.post(
  '/events/by-slug/:slug/teams/:teamCode/login',
  campusHuntLoginLimiter,
  loginTeamMember,
);
router.post(
  '/events/by-slug/:slug/teams/:teamCode/enter',
  campusHuntLoginLimiter,
  enterTeamAsMember,
);

router.get('/me/team', authenticateToken, getMyTeam);
router.get(
  '/teams/:teamId/progress',
  authenticateToken,
  requireTeamMember,
  getTeamProgress,
);
router.get(
  '/teams/:teamId/stream',
  authenticateToken,
  requireTeamMember,
  streamTeamProgress,
);
router.post(
  '/teams/:teamId/challenges/1/submit',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  submitClue1,
);
router.post(
  '/teams/:teamId/challenges/:n/submit',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  submitChallengeAnswer,
);
router.post(
  '/teams/:teamId/challenges/:n/hint',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntHintLimiter,
  requestChallengeHint,
);
router.post(
  '/teams/:teamId/challenges/:n/timer-reveal',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  revealTimedChallenge,
);
router.post(
  '/teams/:teamId/start',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  startHuntWithCode,
);
router.post(
  '/teams/:teamId/finish',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  submitFinishCode,
);
router.post(
  '/teams/:teamId/checkpoints/scan',
  authenticateToken,
  requireTeamMember,
  blockEmergencyStopped,
  campusHuntVerifyLimiter,
  scanStation,
);
router.post(
  '/teams/:teamId/checkpoints/confirm',
  authenticateToken,
  requireTeamMember,
  blockEmergencyStopped,
  campusHuntVerifyLimiter,
  confirmStation,
);
router.post(
  '/teams/:teamId/rewind',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  rewindStep,
);
router.post(
  '/teams/:teamId/dev/force-clue2',
  authenticateToken,
  requireTeamMember,
  blockEmergencyStopped,
  forceUnlockClue2,
);
router.get(
  '/events/:eventId/leaderboard',
  authenticateToken,
  getLeaderboard,
);

router.get(
  '/events/:eventId/finale/me',
  authenticateToken,
  finaleController.loadHuntTeamFromEvent,
  finaleController.requireFinaleParticipant,
  finaleController.getFinaleMe,
);
router.post(
  '/teams/:teamId/finale/missions/:missionId/start',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  finaleController.requireFinaleParticipant,
  finaleController.startFinaleMission,
);
router.post(
  '/teams/:teamId/finale/missions/:missionId/submit',
  authenticateToken,
  requireTeamMember,
  blockEmergencyStopped,
  campusHuntAnswerLimiter,
  finaleController.requireFinaleParticipant,
  finaleController.submitFinaleMission,
);
router.post(
  '/teams/:teamId/finale/missions/abandon',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  finaleController.requireFinaleParticipant,
  finaleController.abandonFinaleMission,
);
router.post(
  '/teams/:teamId/finale/stop',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
  finaleController.requireFinaleParticipant,
  finaleController.stopFinaleTeam,
);

module.exports = router;
