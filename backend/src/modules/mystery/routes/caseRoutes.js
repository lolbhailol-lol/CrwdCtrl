const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const adminAuth = require('../../../middleware/adminAuth');
const ctrl = require('../controllers/caseController');

router.post('/', adminAuth, ctrl.createCase);
router.post('/:caseId/evidence', adminAuth, ctrl.addEvidence);
router.post('/:caseId/branches', adminAuth, ctrl.addBranch);
router.post('/:caseId/fights-back', adminAuth, ctrl.addFightsBackEvent);
router.post('/:caseId/publish', adminAuth, ctrl.publishCase);
router.get('/', ctrl.listCases);
router.get('/admin/all', adminAuth, ctrl.listAllCasesAdmin);
router.get('/:caseId/admin-detail', adminAuth, ctrl.getCaseAdminDetail);

module.exports = router;