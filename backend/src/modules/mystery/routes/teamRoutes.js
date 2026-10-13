const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const adminAuth = require('../../../middleware/adminAuth');
const ctrl = require('../controllers/teamController');

// Public — Mystery has its own login, no CrwdCtrl account needed
router.post('/register', ctrl.registerTeam);
router.post('/enter', ctrl.enterTeam);
router.post('/practice', ctrl.startPracticeTeam);

// Protected — needs a Mystery JWT (from /register, /enter, or /practice above)
router.get('/me', authenticateToken, ctrl.getMyTeam);

// Check-in desk — admin only
router.post('/checkin', adminAuth, ctrl.checkInTeam);

module.exports = router;
