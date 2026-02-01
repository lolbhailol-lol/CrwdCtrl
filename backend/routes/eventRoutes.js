const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find();
    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('[Events] Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch events', status: 500 });
  }
});

// Get event by ID
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    console.log('[EventDetails] Fetching event:', eventId);

    let event = await Event.findById(eventId);

    if (!event) {
      event = await Event.findOne({ name: eventId });
    }

    if (!event) {
      console.warn('[EventDetails] Event not found:', eventId);
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    console.log('[EventDetails] Event found:', event.name);

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('[EventDetails] Error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch event details',
      status: 500,
    });
  }
});

// Register for event
router.post('/:eventId/register', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fullName, email, phone, teamName } = req.body;

    console.log('[EventRegister] Registration for event:', eventId);

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        message: 'Full name, email, and phone are required',
        status: 400,
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found', status: 404 });
    }

    const availableSeats = event.capacity - event.registeredCount;
    if (availableSeats <= 0) {
      return res.status(400).json({ message: 'Event is full', status: 400 });
    }

    // Create registration
    const Registration = require('../models/Registration');
    const registration = await Registration.create({
      eventId,
      fullName,
      email,
      phone,
      teamName,
      registeredAt: new Date(),
    });

    // Update event registered count
    event.registeredCount += 1;
    await event.save();

    console.log('[EventRegister] Success for:', email);

    res.status(200).json({
      success: true,
      registration,
      message: 'Registration successful',
    });
  } catch (error) {
    console.error('[EventRegister] Error:', error.message);
    res.status(500).json({ message: 'Registration failed', status: 500 });
  }
});

module.exports = router;