const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/investigationController');

router.post('/:teamId/start', authenticateToken, ctrl.startSession);
router.get('/:teamId/state', authenticateToken, ctrl.getState);
router.post('/:teamId/unlock-qr', authenticateToken, ctrl.unlockViaQR);
router.post('/:teamId/choose-branch', authenticateToken, ctrl.chooseBranch);
router.post('/:teamId/trust-decision', authenticateToken, ctrl.setTrustDecision);
router.post('/:teamId/connect-evidence', authenticateToken, ctrl.connectEvidence);
router.post('/:teamId/acknowledge-twist', authenticateToken, ctrl.acknowledgeFightsBack);
router.get('/:teamId/pending-twists', authenticateToken, ctrl.getPendingFightsBack);

module.exports = router;