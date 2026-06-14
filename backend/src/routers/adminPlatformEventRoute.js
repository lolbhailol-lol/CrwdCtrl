const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminPlatformEventCtrl = require('../controllers/adminPlatformEventController');

// POST   /api/admin/platform-events          — create platform event
router.post('/', adminAuth, adminPlatformEventCtrl.createEvent);

// GET    /api/admin/platform-events          — list platform events (supports ?category=trek)
router.get('/', adminAuth, adminPlatformEventCtrl.getAllEvents);

// PUT    /api/admin/platform-events/:id      — update platform event
router.put('/:id', adminAuth, adminPlatformEventCtrl.updateEvent);

// DELETE /api/admin/platform-events/:id      — delete platform event
router.delete('/:id', adminAuth, adminPlatformEventCtrl.deleteEvent);

module.exports = router;
