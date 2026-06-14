const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EventShow = require('../model/event_show_model');

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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const show = await EventShow.findOne({ _id: id, status: 'published' }).lean();
    if (!show) return res.status(404).json({ message: 'Event not found' });
    res.json({ show });
  } catch (error) {
    console.error('publicEventShow getById error:', error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});

module.exports = router;
