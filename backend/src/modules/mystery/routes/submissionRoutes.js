const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const { mysteryAdminAuth: adminAuth } = require('../../../middleware/internAdminAccess');
const { requireOwnTeam, requirePlayable } = require('../middleware/teamSession');
const ctrl = require('../controllers/submissionController');

router.post('/:teamId/submit', authenticateToken, requireOwnTeam, requirePlayable, ctrl.submitFinalCase);
router.post('/:teamId/grade', adminAuth, ctrl.gradeTheory);

module.exports = router;
