const express = require('express');
const router = express.Router();
const EventShow = require('../model/event_show_model');
const { findByIdOrSlug } = require('../utils/slug');

// GET /api/events — list published event shows
router.get('/', async (req, res) => {
  try {
    const filter = { status: 'published' };
    if (req.query.eventType) filter.eventType = req.query.eventType;
    if (req.query.city) filter.city = { $regex: req.query.city, $options: 'i' };

    const shows = await EventShow.find(filter)
      .sort({ pagePriority: 1, createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ shows });
  } catch (error) {
    console.error('publicEventShow getAll error:', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// GET /api/events/:id — single published event
router.get('/:idOrSlug', async (req, res) => {
  try {
    const show = await findByIdOrSlug(EventShow, req.params.idOrSlug, {
      baseFilter: { status: 'published' },
      pickName: (row) => row.title,
      lean: true,
    });
    if (!show) return res.status(404).json({ message: 'Event not found' });
    res.json({ show });
  } catch (error) {
    console.error('publicEventShow getById error:', error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});

module.exports = router;
