const mongoose = require('mongoose');
const MysteryEvent = require('../models/MysteryEvent');
const MysteryTeam = require('../models/MysteryTeam');
const MysteryCase = require('../models/MysteryCase');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const FinalSubmission = require('../models/FinalSubmission');
const InterTeamExchange = require('../models/InterTeamExchange');
const { encryptCredential, decryptCredential } = require('../../campus-hunt/utils/credentialCipher');
const { generateRandomCode } = require('../utils/generateCode');
const { findOrCreateGuestUser, uniqueTeamCode } = require('./teamController');
const { createDemoCase, createDemoEvent, DEMO_PASSWORD } = require('../services/demoCaseService');

const PLAYABLE_STATUSES = ['registration_open', 'live', 'paused'];
const ADMIN_STATUSES = ['draft', 'upcoming', 'registration_open', 'live', 'paused', 'completed', 'cancelled'];
const MAX_TEAMS_PER_BATCH = 100;

const badId = (res, label = 'id') => res.status(400).json({ success: false, message: `Invalid ${label}` });

function adminEmail(req) {
  return req.user?.email || '';
}

function randomPassword() {
  return generateRandomCode(6).toLowerCase();
}

async function assertPublishedCase(caseId) {
  if (!caseId || !mongoose.isValidObjectId(caseId)) return 'Select a case first';
  const ok = await MysteryCase.exists({ _id: caseId, status: 'published' });
  return ok ? null : 'The selected case is not published — publish it in the case builder';
}

/** Delete all game records for the given teams (progress, submissions, trades). */
async function wipeTeamGameData(teamIds) {
  if (!teamIds.length) return;
  await Promise.all([
    TeamInvestigationProgress.deleteMany({ teamId: { $in: teamIds } }),
    FinalSubmission.deleteMany({ teamId: { $in: teamIds } }),
    InterTeamExchange.deleteMany({ $or: [{ fromTeamId: { $in: teamIds } }, { toTeamId: { $in: teamIds } }] }),
  ]);
}

async function createTeamWithPassword({ event, teamName, password, captainName, captainPhone, captainEmail }) {
  const captain = await findOrCreateGuestUser({
    name: captainName || teamName,
    email: captainEmail,
    phoneNumber: captainPhone,
  });
  const team = new MysteryTeam({
    eventId: event._id,
    caseId: event.caseId,
    teamName,
    captainUserId: captain._id,
    members: [{
      userId: captain._id,
      name: captainName || teamName,
      email: captainEmail || '',
      contactNo: captainPhone || '',
      isCaptain: true,
    }],
    mode: 'competitive',
    teamCode: await uniqueTeamCode(),
    paymentStatus: 'not_required',
    gamePassCode: generateRandomCode(10),
    passwordCipher: encryptCredential(password),
  });
  await team.setPassword(password);
  await team.save();
  return team;
}

function lastActivityAt(progress) {
  const stamps = [
    progress.startedAt,
    progress.finishedAt,
    ...progress.unlockedEvidence.map((u) => u.unlockedAt),
    ...progress.trustDecisions.map((t) => t.decidedAt),
    ...progress.branchChoices.map((c) => c.chosenAt),
    ...progress.connectionsMade.map((c) => c.madeAt),
  ].filter(Boolean).map((d) => new Date(d).getTime());
  return stamps.length ? new Date(Math.max(...stamps)) : null;
}

/* ========== EVENTS ========== */

async function createEvent(req, res, next) {
  try {
    const {
      name, college, slug, date, venue, caseId,
      teamCapacity, teamSize, startingScore, status, operationsNotes,
      allowInterTeamExchange,
    } = req.body;

    if (!String(name || '').trim() || !String(slug || '').trim()) {
      return res.status(400).json({ success: false, message: 'Event name and slug are required' });
    }
    const nextStatus = ADMIN_STATUSES.includes(status) ? status : 'draft';
    if (nextStatus !== 'draft') {
      const caseError = await assertPublishedCase(caseId);
      if (caseError) return res.status(400).json({ success: false, message: caseError });
      if (!String(college || '').trim() || !date) {
        return res.status(400).json({ success: false, message: 'College and date are required (or save as a draft)' });
      }
    }

    const event = await MysteryEvent.create({
      name: String(name).trim(),
      college: String(college || '').trim(),
      slug: String(slug).trim().toLowerCase(),
      date: date || undefined,
      venue: venue || '',
      caseId: mongoose.isValidObjectId(caseId) ? caseId : undefined,
      teamCapacity: teamCapacity != null ? Number(teamCapacity) : 20,
      teamSize: teamSize != null ? Number(teamSize) : 4,
      teamSizeMax: teamSize != null ? Number(teamSize) : 5,
      maxTeams: teamCapacity != null ? Number(teamCapacity) : 0,
      startingScore: startingScore != null ? Number(startingScore) : 100,
      allowInterTeamExchange: allowInterTeamExchange !== false,
      status: nextStatus,
      operationsNotes: operationsNotes || '',
      createdByEmail: adminEmail(req),
      createdByRole: 'admin',
    });

    return res.status(201).json({ success: true, data: { event } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This slug is already in use' });
    }
    return next(err);
  }
}

async function listEvents(req, res, next) {
  try {
    const events = await MysteryEvent.find()
      .populate('caseId', 'title status')
      .sort({ createdAt: -1 })
      .lean();

    const eventIds = events.map((e) => e._id);
    const counts = await MysteryTeam.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: '$eventId', teams: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.teams]));

    const data = events.map((e) => ({ ...e, teamsRegistered: countMap.get(String(e._id)) || 0 }));
    return res.json({ success: true, data: { events: data } });
  } catch (err) {
    return next(err);
  }
}

async function updateEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');

    const event = await MysteryEvent.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const allowedFields = [
      'name', 'college', 'date', 'venue', 'caseId',
      'teamCapacity', 'teamSize', 'startingScore', 'status',
      'operationsNotes', 'publicLoginLive', 'publicLeaderboardLive', 'allowInterTeamExchange',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.status !== undefined && !ADMIN_STATUSES.includes(updates.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (updates.caseId !== undefined && String(updates.caseId) !== String(event.caseId || '')) {
      if (await MysteryTeam.exists({ eventId })) {
        return res.status(409).json({ success: false, message: 'Teams have already been created — the case can no longer be changed' });
      }
    }

    const nextStatus = updates.status ?? event.status;
    const nextCaseId = updates.caseId ?? event.caseId;
    if (PLAYABLE_STATUSES.includes(nextStatus)) {
      const caseError = await assertPublishedCase(nextCaseId);
      if (caseError) return res.status(400).json({ success: false, message: caseError });
      if (!String(updates.college ?? event.college ?? '').trim() || !(updates.date ?? event.date)) {
        return res.status(400).json({ success: false, message: 'Set the college and date before opening registration or going live' });
      }
    }
    if (updates.name !== undefined) updates.title = updates.name;
    if (updates.date !== undefined) updates.dateTime = updates.date;
    if (updates.teamCapacity !== undefined) updates.maxTeams = Number(updates.teamCapacity);
    if (updates.teamSize !== undefined) updates.teamSizeMax = Number(updates.teamSize);
    if (updates.status === 'live' && !event.startedAt) updates.startedAt = new Date();
    if (updates.status === 'completed' && !event.endedAt) updates.endedAt = new Date();

    event.set(updates);
    await event.save();
    return res.json({ success: true, data: { event } });
  } catch (err) {
    return next(err);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');

    const event = await MysteryEvent.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const teamIds = (await MysteryTeam.find({ eventId }).select('_id').lean()).map((t) => t._id);
    await wipeTeamGameData(teamIds);
    await Promise.all([
      MysteryTeam.deleteMany({ eventId }),
      MysteryEvent.deleteOne({ _id: eventId }),
    ]);

    return res.json({ success: true, data: { deletedEventId: String(eventId), teamsDeleted: teamIds.length } });
  } catch (err) {
    return next(err);
  }
}

/** Data for the Setup / Teams / Live / Results tabs in a single call. */
async function getEventOverview(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');

    const event = await MysteryEvent.findById(eventId).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const [mysteryCase, evidence, branchCount, twistCount, teams] = await Promise.all([
      event.caseId
        ? MysteryCase.findById(event.caseId).select('title tagline status mysteryIdentityName correctIdentityTheory difficulty estimatedMinutes').lean()
        : null,
      event.caseId ? EvidenceNode.find({ caseId: event.caseId }).select('requiresQR').lean() : [],
      event.caseId ? InvestigationBranch.countDocuments({ caseId: event.caseId }) : 0,
      event.caseId ? FightsBackEvent.countDocuments({ caseId: event.caseId }) : 0,
      MysteryTeam.find({ eventId })
        .select('teamName teamCode mode members checkedInAt createdAt finalScore resultFinalized gamePassCode +passwordCipher')
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    const teamIds = teams.map((t) => t._id);
    const [progressList, submissions] = await Promise.all([
      TeamInvestigationProgress.find({ teamId: { $in: teamIds } }).lean(),
      FinalSubmission.find({ teamId: { $in: teamIds } }).lean(),
    ]);
    const progressByTeam = new Map(progressList.map((p) => [String(p.teamId), p]));
    const submissionByTeam = new Map(submissions.map((s) => [String(s.teamId), s]));

    const rows = teams.map((t) => {
      const p = progressByTeam.get(String(t._id));
      const s = submissionByTeam.get(String(t._id));
      const captain = (t.members || []).find((m) => m.isCaptain) || {};
      return {
        _id: t._id,
        teamName: t.teamName,
        teamCode: t.teamCode,
        gamePassCode: t.gamePassCode,
        captainName: captain.name || '',
        captainPhone: captain.contactNo || '',
        membersCount: (t.members || []).length,
        checkedInAt: t.checkedInAt,
        createdByAdmin: Boolean(t.passwordCipher),
        createdAt: t.createdAt,
        resultFinalized: t.resultFinalized,
        finalScore: t.finalScore,
        progress: p ? {
          status: p.status,
          totalScore: p.totalScore,
          unlocked: p.unlockedEvidence.length,
          invalidated: p.unlockedEvidence.filter((u) => u.invalidatedAt).length,
          trustCalls: p.trustDecisions.length,
          branchChoices: p.branchChoices.length,
          connections: p.connectionsMade.length,
          startedAt: p.startedAt,
          finishedAt: p.finishedAt,
          lastActivityAt: lastActivityAt(p),
        } : null,
        submission: s ? {
          identityTheory: s.identityTheory,
          fullExplanation: s.fullExplanation,
          confidenceLevel: s.confidenceLevel,
          submittedAt: s.submittedAt,
          scoreBreakdown: s.scoreBreakdown,
          graded: s.graded,
        } : null,
      };
    });

    return res.json({
      success: true,
      data: {
        event,
        case: mysteryCase,
        caseStats: {
          evidence: evidence.length,
          qrEvidence: evidence.filter((e) => e.requiresQR).length,
          branches: branchCount,
          twists: twistCount,
        },
        counts: {
          teamsRegistered: rows.length,
          teamsCheckedIn: rows.filter((t) => t.checkedInAt).length,
          teamsPlaying: rows.filter((t) => t.progress?.status === 'active').length,
          teamsSubmitted: rows.filter((t) => t.submission).length,
          teamsGraded: rows.filter((t) => t.submission?.graded).length,
          teamCapacity: event.teamCapacity,
        },
        teams: rows,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function listRegistrations(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');
    const teams = await MysteryTeam.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { teams } });
  } catch (err) {
    return next(err);
  }
}

/* ========== TEAMS ========== */

/** Admin bulk team create — returns each team's code + password (for sharing on WhatsApp). */
async function createTeams(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');

    const event = await MysteryEvent.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const caseError = await assertPublishedCase(event.caseId);
    if (caseError) return res.status(400).json({ success: false, message: caseError });

    const commonPassword = String(req.body.password || '').trim();
    if (commonPassword && commonPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    let specs = Array.isArray(req.body.teams) ? req.body.teams : [];
    if (!specs.length) {
      const count = Math.floor(Number(req.body.count) || 0);
      const prefix = String(req.body.namePrefix || 'Team').trim() || 'Team';
      const existing = await MysteryTeam.countDocuments({ eventId });
      specs = Array.from({ length: count }, (_, i) => ({ teamName: `${prefix} ${existing + i + 1}` }));
    }
    specs = specs.filter((s) => String(s?.teamName || '').trim());
    if (!specs.length) return res.status(400).json({ success: false, message: 'How many teams should be created? (provide a count or team names)' });
    if (specs.length > MAX_TEAMS_PER_BATCH) {
      return res.status(400).json({ success: false, message: `You can create at most ${MAX_TEAMS_PER_BATCH} teams at a time` });
    }

    const capacity = event.teamCapacity || 0;
    const current = await MysteryTeam.countDocuments({ eventId, mode: 'competitive' });
    if (capacity > 0 && current + specs.length > capacity) {
      return res.status(409).json({ success: false, message: `Capacity is ${capacity} and ${current} teams already exist` });
    }

    const created = [];
    for (const spec of specs) {
      const password = commonPassword || String(spec.password || '').trim() || randomPassword();
      // eslint-disable-next-line no-await-in-loop
      const team = await createTeamWithPassword({
        event,
        teamName: String(spec.teamName).trim().slice(0, 60),
        password,
        captainName: String(spec.captainName || '').trim(),
        captainPhone: String(spec.captainPhone || '').trim(),
        captainEmail: String(spec.captainEmail || '').trim(),
      });
      created.push({ _id: team._id, teamName: team.teamName, teamCode: team.teamCode, password });
    }

    return res.status(201).json({ success: true, data: { teams: created } });
  } catch (err) {
    return next(err);
  }
}

/** Login details for links / WhatsApp — passwords are shown only for admin-created (or reset) teams. */
async function listCredentials(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');

    const teams = await MysteryTeam.find({ eventId })
      .select('teamName teamCode members +passwordCipher')
      .sort({ createdAt: 1 })
      .lean();

    const credentials = teams.map((t) => {
      const captain = (t.members || []).find((m) => m.isCaptain) || {};
      return {
        _id: t._id,
        teamName: t.teamName,
        teamCode: t.teamCode,
        captainName: captain.name || '',
        captainPhone: captain.contactNo || '',
        password: t.passwordCipher ? decryptCredential(t.passwordCipher) || null : null,
      };
    });
    return res.json({ success: true, data: { credentials } });
  } catch (err) {
    return next(err);
  }
}

async function setAllTeamPasswords(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return badId(res, 'event id');
    const password = String(req.body.password || '').trim();
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    const teams = await MysteryTeam.find({ eventId });
    for (const team of teams) {
      // eslint-disable-next-line no-await-in-loop
      await team.setPassword(password);
      team.passwordCipher = encryptCredential(password);
      // eslint-disable-next-line no-await-in-loop
      await team.save();
    }
    return res.json({ success: true, data: { teamsUpdated: teams.length } });
  } catch (err) {
    return next(err);
  }
}

async function resetTeamPassword(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return badId(res, 'team id');
    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const password = String(req.body.password || '').trim() || randomPassword();
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }
    await team.setPassword(password);
    team.passwordCipher = encryptCredential(password);
    await team.save();
    return res.json({ success: true, data: { teamId: team._id, teamCode: team.teamCode, password } });
  } catch (err) {
    return next(err);
  }
}

async function updateTeam(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return badId(res, 'team id');
    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const teamName = String(req.body.teamName ?? '').trim();
    if (teamName) team.teamName = teamName.slice(0, 60);
    const captain = team.members.find((m) => m.isCaptain);
    if (captain) {
      if (req.body.captainName !== undefined) captain.name = String(req.body.captainName).trim() || captain.name;
      if (req.body.captainPhone !== undefined) captain.contactNo = String(req.body.captainPhone).trim();
    }
    if (req.body.checkedIn !== undefined) team.checkedInAt = req.body.checkedIn ? (team.checkedInAt || new Date()) : null;
    await team.save();
    return res.json({ success: true, data: { teamId: team._id } });
  } catch (err) {
    return next(err);
  }
}

async function deleteTeam(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return badId(res, 'team id');
    const team = await MysteryTeam.findById(teamId).select('_id');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    await wipeTeamGameData([team._id]);
    await MysteryTeam.deleteOne({ _id: team._id });
    return res.json({ success: true, data: { deletedTeamId: String(teamId) } });
  } catch (err) {
    return next(err);
  }
}

/** Give a team a fresh start after a test run — the login stays the same. */
async function resetTeamProgress(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return badId(res, 'team id');
    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    await wipeTeamGameData([team._id]);
    team.finalScore = 0;
    team.resultFinalized = false;
    team.resultFinalizedAt = undefined;
    await team.save();
    return res.json({ success: true, data: { teamId: team._id } });
  } catch (err) {
    return next(err);
  }
}

async function finalizeResult(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return badId(res, 'team id');

    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const points = req.body.points != null ? Number(req.body.points) : null;
    if (points != null && Number.isFinite(points)) {
      team.finalScore = points;
    } else {
      const progress = await TeamInvestigationProgress.findOne({ teamId }).select('totalScore').lean();
      team.finalScore = progress?.totalScore || 0;
    }
    team.resultFinalized = true;
    team.resultFinalizedAt = new Date();
    await team.save();

    return res.json({ success: true, data: { team } });
  } catch (err) {
    return next(err);
  }
}

async function checkInGamePass(req, res, next) {
  try {
    const code = String(req.body.gamePassCode || req.body.teamCode || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'Provide a game pass or team code' });

    const team = await MysteryTeam.findOne({ $or: [{ gamePassCode: code }, { teamCode: code }] });
    if (!team) return res.status(404).json({ success: false, message: 'No team found with this code' });
    if (team.checkedInAt) {
      return res.status(409).json({ success: false, message: `${team.teamName} is already checked in`, data: { team } });
    }

    team.checkedInAt = new Date();
    await team.save();
    return res.json({ success: true, data: { team } });
  } catch (err) {
    return next(err);
  }
}

/* ========== DEMO ========== */

/** One click: sample case (published) + live demo event + 1 team with known password. */
async function createDemo(req, res, next) {
  try {
    const createdByEmail = adminEmail(req);
    const mysteryCase = await createDemoCase({ createdByEmail });
    const event = await createDemoEvent(mysteryCase, { createdByEmail });
    const team = await createTeamWithPassword({
      event,
      teamName: 'Demo Team',
      password: DEMO_PASSWORD,
      captainName: 'Demo Captain',
    });

    return res.status(201).json({
      success: true,
      data: {
        case: { _id: mysteryCase._id, title: mysteryCase.title },
        event: { _id: event._id, name: event.name, slug: event.slug },
        team: { _id: team._id, teamName: team.teamName, teamCode: team.teamCode, password: DEMO_PASSWORD },
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createEvent,
  listEvents,
  updateEvent,
  deleteEvent,
  getEventOverview,
  listRegistrations,
  createTeams,
  listCredentials,
  setAllTeamPasswords,
  resetTeamPassword,
  updateTeam,
  deleteTeam,
  resetTeamProgress,
  finalizeResult,
  checkInGamePass,
  createDemo,
};
