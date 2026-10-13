const mongoose = require('mongoose');
const MysteryEvent = require('../models/MysteryEvent');
const MysteryTeam = require('../models/MysteryTeam');
const MysteryCase = require('../models/MysteryCase');

/* =========================
   CREATE GAME (EVENT)
   POST /api/mystery/admin/events
========================= */
async function createEvent(req, res, next) {
  try {
    const {
      name,
      college,
      slug,
      date,
      venue,
      caseId,
      teamCapacity,
      teamSize,
      startingScore,
      status,
      operationsNotes,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'name and slug are required' });
    }

    const event = await MysteryEvent.create({
      name,
      college: college || '',
      slug: String(slug).trim().toLowerCase(),
      date: date || null,
      venue: venue || '',
      caseId: caseId || null,
      teamCapacity: teamCapacity != null ? Number(teamCapacity) : 20,
      teamSize: teamSize != null ? Number(teamSize) : 4,
      startingScore: startingScore != null ? Number(startingScore) : 100,
      status: status || 'draft',
      operationsNotes: operationsNotes || '',
      createdBy: req.user?._id || req.user?.id || null,
    });

    return res.status(201).json({ success: true, data: { event } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Event slug already exists' });
    }
    console.error('[mystery admin createEvent]', err);
    return next(err);
  }
}

/* =========================
   LIST GAMES (EVENTS)
   GET /api/mystery/admin/events
========================= */
async function listEvents(req, res, next) {
  try {
    const events = await MysteryEvent.find()
      .populate('caseId', 'title status')
      .sort({ createdAt: -1 })
      .lean();

    // attach live team counts, same spirit as campus-hunt's "0/20 teams"
    const eventIds = events.map((e) => e._id);
    const counts = await MysteryTeam.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: '$eventId', teams: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.teams]));

    const data = events.map((e) => ({
      ...e,
      teamsRegistered: countMap.get(String(e._id)) || 0,
    }));

    return res.json({ success: true, data: { events: data } });
  } catch (err) {
    console.error('[mystery admin listEvents]', err);
    return next(err);
  }
}

/* =========================
   UPDATE GAME (status / publish / complete / edit)
   PATCH /api/mystery/admin/events/:eventId
========================= */
async function updateEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const allowedFields = [
      'name', 'college', 'date', 'venue', 'caseId',
      'teamCapacity', 'teamSize', 'startingScore', 'status',
      'operationsNotes', 'publicLoginLive', 'publicLeaderboardLive',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const event = await MysteryEvent.findByIdAndUpdate(
      eventId,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    return res.json({ success: true, data: { event } });
  } catch (err) {
    console.error('[mystery admin updateEvent]', err);
    return next(err);
  }
}

/* =========================
   DELETE GAME
   DELETE /api/mystery/admin/events/:eventId
========================= */
async function deleteEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const event = await MysteryEvent.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    await Promise.all([
      MysteryTeam.deleteMany({ eventId }),
      MysteryEvent.deleteOne({ _id: eventId }),
    ]);

    return res.json({ success: true, data: { deletedEventId: String(eventId) } });
  } catch (err) {
    console.error('[mystery admin deleteEvent]', err);
    return next(err);
  }
}

/* =========================
   EVENT OVERVIEW (teams, registrations, status)
   GET /api/mystery/admin/events/:eventId/overview
========================= */
async function getEventOverview(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const event = await MysteryEvent.findById(eventId).populate('caseId', 'title status');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const teams = await MysteryTeam.find({ eventId })
      .select('teamName teamCode mode paymentStatus checkedInAt createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        event,
        counts: {
          teamsRegistered: teams.length,
          teamsCheckedIn: teams.filter((t) => t.checkedInAt).length,
          teamCapacity: event.teamCapacity,
        },
        teams,
      },
    });
  } catch (err) {
    console.error('[mystery admin getEventOverview]', err);
    return next(err);
  }
}

/* =========================
   FINALIZE RESULT
   POST /api/mystery/admin/teams/:teamId/finalize-result
========================= */
async function finalizeResult(req, res, next) {
  try {
    const { teamId } = req.params;
    const { points } = req.body;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ success: false, message: 'Invalid team id' });
    }

    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    team.finalScore = points != null ? Number(points) : team.finalScore;
    team.resultFinalized = true;
    team.resultFinalizedAt = new Date();
    await team.save();

    return res.json({ success: true, data: { team } });
  } catch (err) {
    console.error('[mystery admin finalizeResult]', err);
    return next(err);
  }
}

/* =========================
   CHECK-IN GAME PASS (paste signed QR token)
   POST /api/mystery/admin/checkin
========================= */
async function checkInGamePass(req, res, next) {
  try {
    const { gamePassCode } = req.body;
    if (!gamePassCode) {
      return res.status(400).json({ success: false, message: 'gamePassCode is required' });
    }

    const team = await MysteryTeam.findOne({ gamePassCode: String(gamePassCode).trim() });
    if (!team) {
      return res.status(404).json({ success: false, message: 'No team found for this game pass' });
    }
    if (team.checkedInAt) {
      return res.status(409).json({ success: false, message: 'Team already checked in', data: { team } });
    }

    team.checkedInAt = new Date();
    await team.save();

    return res.json({ success: true, data: { team } });
  } catch (err) {
    console.error('[mystery admin checkInGamePass]', err);
    return next(err);
  }
}

/* =========================
   LIST REGISTRATIONS (for a specific event)
   GET /api/mystery/admin/events/:eventId/registrations
========================= */
async function listRegistrations(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const teams = await MysteryTeam.find({ eventId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { teams } });
  } catch (err) {
    console.error('[mystery admin listRegistrations]', err);
    return next(err);
  }
}

module.exports = {
  createEvent,
  listEvents,
  updateEvent,
  deleteEvent,
  getEventOverview,
  finalizeResult,
  checkInGamePass,
  listRegistrations,
};