const express = require('express');
const mongoose = require('mongoose');
const { mysteryAdminAuth: adminAuth } = require('../../../middleware/internAdminAccess');
const adminController = require('../controllers/adminController');

const router = express.Router();

function requireDbReady(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    message: 'Database briefly unavailable — try again in a few seconds.',
    code: 'DB_UNAVAILABLE',
  });
}

router.use(adminAuth);
router.use(requireDbReady);

// Events
router.get('/events', adminController.listEvents);
router.post('/events', adminController.createEvent);
router.patch('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.get('/events/:eventId/overview', adminController.getEventOverview);
router.get('/events/:eventId/registrations', adminController.listRegistrations);

// Teams + login links
router.post('/events/:eventId/teams', adminController.createTeams);
router.get('/events/:eventId/credentials', adminController.listCredentials);
router.post('/events/:eventId/teams/password', adminController.setAllTeamPasswords);
router.patch('/teams/:teamId', adminController.updateTeam);
router.delete('/teams/:teamId', adminController.deleteTeam);
router.post('/teams/:teamId/reset-password', adminController.resetTeamPassword);
router.post('/teams/:teamId/reset-progress', adminController.resetTeamProgress);
router.post('/teams/:teamId/finalize-result', adminController.finalizeResult);

// Check-in desk (game pass or team code)
router.post('/checkin', adminController.checkInGamePass);

// One-click demo (sample case + live event + team)
router.post('/demo', adminController.createDemo);

module.exports = router;
