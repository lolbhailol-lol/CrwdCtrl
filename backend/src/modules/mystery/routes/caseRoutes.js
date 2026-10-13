const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/caseController');

router.post('/', authenticateToken, ctrl.createCase);
router.post('/:caseId/evidence', authenticateToken, ctrl.addEvidence);
router.post('/:caseId/branches', authenticateToken, ctrl.addBranch);
router.post('/:caseId/fights-back', authenticateToken, ctrl.addFightsBackEvent);
router.post('/:caseId/publish', authenticateToken, ctrl.publishCase);
router.get('/', ctrl.listCases);
router.get('/:caseId/admin-detail', authenticateToken, ctrl.getCaseAdminDetail);

module.exports = router;