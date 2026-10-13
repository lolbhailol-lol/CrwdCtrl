const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const { requireOwnTeam, requirePlayable } = require('../middleware/teamSession');
const ctrl = require('../controllers/investigationController');

router.use('/:teamId', authenticateToken, requireOwnTeam);

router.post('/:teamId/start', ctrl.startSession);
router.get('/:teamId/state', ctrl.getState);
router.post('/:teamId/unlock-qr', requirePlayable, ctrl.unlockViaQR);
router.post('/:teamId/choose-branch', requirePlayable, ctrl.chooseBranch);
router.post('/:teamId/trust-decision', requirePlayable, ctrl.setTrustDecision);
router.post('/:teamId/connect-evidence', requirePlayable, ctrl.connectEvidence);
router.post('/:teamId/acknowledge-twist', ctrl.acknowledgeFightsBack);
router.get('/:teamId/pending-twists', ctrl.getPendingFightsBack);

module.exports = router;
