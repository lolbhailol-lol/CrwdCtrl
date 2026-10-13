const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../../../middleware/adminAuth'); // ⚠ confirm this exact path exists — see note below
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

// Games (events) CRUD — this is what the "College Games" admin panel calls
router.get('/events', adminController.listEvents);
router.post('/events', adminController.createEvent);
router.patch('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.get('/events/:eventId/overview', adminController.getEventOverview);
router.get('/events/:eventId/registrations', adminController.listRegistrations);

// Finalize result for a team
router.post('/teams/:teamId/finalize-result', adminController.finalizeResult);

// Check-in game pass (paste signed QR token / gamePassCode)
router.post('/checkin', adminController.checkInGamePass);

module.exports = router;