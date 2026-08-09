const express = require('express');
const {
  campusHuntVolunteerLoginLimiter,
  campusHuntVerifyLimiter,
} = require('../../../middleware/rateLimiter');
const { volunteerAuth, requireCheckpointAssignment } = require('../middleware/volunteerAuth');
const volunteerController = require('../controllers/volunteerController');

const router = express.Router();

router.post('/login', campusHuntVolunteerLoginLimiter, volunteerController.login);
router.get('/me', volunteerAuth, volunteerController.me);
router.post(
  '/checkpoints/:checkpointId/scan',
  volunteerAuth,
  requireCheckpointAssignment,
  campusHuntVerifyLimiter,
  volunteerController.scanTeam,
);
router.post(
  '/checkpoints/:checkpointId/verify-member',
  volunteerAuth,
  requireCheckpointAssignment,
  campusHuntVerifyLimiter,
  volunteerController.verifyMemberHandler,
);
router.post(
  '/checkpoints/:checkpointId/complete',
  volunteerAuth,
  requireCheckpointAssignment,
  campusHuntVerifyLimiter,
  volunteerController.completeHandler,
);
router.post('/issues', volunteerAuth, volunteerController.reportIssue);

module.exports = router;
