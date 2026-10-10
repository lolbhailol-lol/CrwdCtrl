const MysteryEvent = require('../models/MysteryEvent');
const MysteryCase = require('../models/MysteryCase');

const createEvent = async (req, res) => {
  try {
    const mysteryCase = await MysteryCase.findById(req.body.caseId);
    if (!mysteryCase || mysteryCase.status !== 'published') {
      return res.status(400).json({ error: 'Valid published case select karo' });
    }
    const event = await MysteryEvent.create({
      ...req.body,
      createdBy: req.user.userId,
      createdByRole: req.user.role === 'organizer' ? 'self_serve_organizer' : 'admin',
      status: 'pending_approval',
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event', detail: err.message });
  }
};

const listEvents = async (req, res) => {
  try {
    const events = await MysteryEvent.find({ status: { $in: ['upcoming', 'registration_open', 'live'] } })
      .populate('caseId', 'title tagline difficulty estimatedMinutes')
      .sort({ dateTime: 1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

const getEventDetail = async (req, res) => {
  try {
    const event = await MysteryEvent.findById(req.params.eventId).populate('caseId', 'title tagline synopsis difficulty estimatedMinutes mysteryIdentityPrompt');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

const approveEvent = async (req, res) => {
  try {
    const { approve, rejectionReason } = req.body;
    const event = await MysteryEvent.findByIdAndUpdate(
      req.params.eventId,
      approve ? { status: 'registration_open' } : { status: 'rejected', rejectionReason: rejectionReason || 'Not specified' },
      { new: true },
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event status' });
  }
};

const startEvent = async (req, res) => {
  try {
    const event = await MysteryEvent.findByIdAndUpdate(req.params.eventId, { status: 'live' }, { new: true });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start event' });
  }
};

const endEvent = async (req, res) => {
  try {
    const event = await MysteryEvent.findByIdAndUpdate(req.params.eventId, { status: 'completed' }, { new: true });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to end event' });
  }
};

module.exports = { createEvent, listEvents, getEventDetail, approveEvent, startEvent, endEvent };