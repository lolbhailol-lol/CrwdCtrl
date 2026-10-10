const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/submissionController');

router.post('/:teamId/submit', authenticateToken, ctrl.submitFinalCase);
router.post('/:teamId/grade', authenticateToken, ctrl.gradeTheory);

module.exports = router;