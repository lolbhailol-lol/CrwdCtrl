const express = require('express');
const router = express.Router();

router.use('/cases', require('./caseRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/teams', require('./teamRoutes'));
router.use('/investigation', require('./investigationRoutes'));
router.use('/exchange', require('./exchangeRoutes'));
router.use('/submissions', require('./submissionRoutes'));
router.use('/leaderboard', require('./leaderboardRoutes'));

module.exports = router;