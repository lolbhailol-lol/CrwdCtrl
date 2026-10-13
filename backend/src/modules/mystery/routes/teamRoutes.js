const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/teamController');

// Public — Mystery has its own login, no CrwdCtrl account needed
router.post('/register', ctrl.registerTeam);
router.post('/enter', ctrl.enterTeam);
router.post('/practice', ctrl.startPracticeTeam);

// Protected — needs a Mystery JWT (from /register, /enter, or /practice above)
router.get('/me', authenticateToken, ctrl.getMyTeam);

// Admin/volunteer only — needs a normal CrwdCtrl organizer/admin login
router.post('/checkin', authenticateToken, ctrl.checkInTeam);

module.exports = router;