const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminEventCtrl = require('../controllers/adminEventController');

// POST   /api/admin/events          — create event
router.post('/', adminAuth, adminEventCtrl.createEvent);

// GET    /api/admin/events          — list events (supports ?category=trek)
router.get('/', adminAuth, adminEventCtrl.getAllEvents);

// PUT    /api/admin/events/:id      — update event
router.put('/:id', adminAuth, adminEventCtrl.updateEvent);

// DELETE /api/admin/events/:id      — delete event
router.delete('/:id', adminAuth, adminEventCtrl.deleteEvent);

module.exports = router;
