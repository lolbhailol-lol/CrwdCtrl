const express = require('express');
const { authenticateToken } = require('../../../middleware/authmiddleware');
const { requireTeamMember, requireTeamLeader } = require('../middleware/playerAuthz');
const {
  campusHuntLoginLimiter,
  campusHuntAnswerLimiter,
  campusHuntHintLimiter,
  campusHuntVerifyLimiter,
} = require('../../../middleware/rateLimiter');
const {
  getEventBySlug,
  getTeamLoginCard,
  unlockTeamRoster,
  loginTeamMember,
  enterTeamAsMember,
  listColleges,
  getPublicLeaderboard,
  getMyTeam,
  getTeamProgress,
  submitClue1,
  submitChallengeAnswer,
  requestChallengeHint,
  getLeaderboard,
  scanStation,
  confirmStation,
  rewindStep,
  forceUnlockClue2,
} = require('../controllers/playerController');

const router = express.Router();

router.get('/colleges', listColleges);
router.get('/events/:eventId/leaderboard/public', getPublicLeaderboard);
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
router.post(
  '/teams/:teamId/challenges/1/submit',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  campusHuntAnswerLimiter,
  submitClue1,
);
router.post(
  '/teams/:teamId/challenges/:n/submit',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  campusHuntAnswerLimiter,
  submitChallengeAnswer,
);
router.post(
  '/teams/:teamId/challenges/:n/hint',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  campusHuntHintLimiter,
  requestChallengeHint,
);
router.post(
  '/teams/:teamId/checkpoints/scan',
  authenticateToken,
  requireTeamMember,
  campusHuntVerifyLimiter,
  scanStation,
);
router.post(
  '/teams/:teamId/checkpoints/confirm',
  authenticateToken,
  requireTeamMember,
  campusHuntVerifyLimiter,
  confirmStation,
);
router.post(
  '/teams/:teamId/rewind',
  authenticateToken,
  requireTeamMember,
  requireTeamLeader,
  rewindStep,
);
router.post(
  '/teams/:teamId/dev/force-clue2',
  authenticateToken,
  requireTeamMember,
  forceUnlockClue2,
);
router.get(
  '/events/:eventId/leaderboard',
  authenticateToken,
  getLeaderboard,
);

module.exports = router;
