const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Theatre = require('../model/theatre_model');

// GET /api/theatre — list published theatre shows
router.get('/', async (req, res) => {
  try {
    const filter = { status: 'published' };
    if (req.query.theatreType) filter.theatreType = req.query.theatreType;
    if (req.query.city) filter.city = { $regex: req.query.city, $options: 'i' };

    const shows = await Theatre.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ shows });
  } catch (error) {
    console.error('publicTheatre getAll error:', error);
    res.status(500).json({ message: 'Failed to fetch theatre shows' });
  }
});

// GET /api/theatre/:id — single published show
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid theatre show ID' });
    }
    const show = await Theatre.findOne({ _id: id, status: 'published' }).lean();
    if (!show) return res.status(404).json({ message: 'Theatre show not found' });
    res.json({ show });
  } catch (error) {
    console.error('publicTheatre getById error:', error);
    res.status(500).json({ message: 'Failed to fetch theatre show' });
  }
});

module.exports = router;
