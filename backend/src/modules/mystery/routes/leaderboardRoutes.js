const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leaderboardController');

router.get('/events/:eventId', ctrl.getEventLeaderboard);
router.get('/cases/:caseId', ctrl.getCaseLeaderboard);

module.exports = router;