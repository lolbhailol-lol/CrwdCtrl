const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const { mysteryAdminAuth: adminAuth } = require('../../../middleware/internAdminAccess');
const ctrl = require('../controllers/caseController');

router.post('/', adminAuth, ctrl.createCase);
router.post('/:caseId/evidence', adminAuth, ctrl.addEvidence);
router.post('/:caseId/branches', adminAuth, ctrl.addBranch);
router.post('/:caseId/fights-back', adminAuth, ctrl.addFightsBackEvent);
router.post('/:caseId/publish', adminAuth, ctrl.publishCase);
router.patch('/:caseId', adminAuth, ctrl.updateCase);
router.delete('/:caseId', adminAuth, ctrl.deleteCase);
router.patch('/:caseId/evidence/:evidenceId', adminAuth, ctrl.updateEvidence);
router.delete('/:caseId/evidence/:evidenceId', adminAuth, ctrl.deleteEvidence);
router.post('/:caseId/evidence/:evidenceId/rotate-qr', adminAuth, ctrl.rotateEvidenceQr);
router.delete('/:caseId/branches/:branchId', adminAuth, ctrl.deleteBranch);
router.delete('/:caseId/fights-back/:fightsBackId', adminAuth, ctrl.deleteFightsBack);
router.get('/', ctrl.listCases);
router.get('/admin/all', adminAuth, ctrl.listAllCasesAdmin);
router.get('/:caseId/admin-detail', adminAuth, ctrl.getCaseAdminDetail);

module.exports = router;