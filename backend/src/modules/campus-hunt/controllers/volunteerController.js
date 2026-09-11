const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getJwtSecret } = require('../../../config/jwtSecret');
const CampusHuntVolunteerAccess = require('../models/CampusHuntVolunteerAccess');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntIssueReport = require('../models/CampusHuntIssueReport');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const {
  getCheckpoint,
  scanTeamPreview,
  verifyMember,
  completeCheckpoint,
} = require('../services/checkpointService');
const { validateIssueBody } = require('../validators/adminValidators');
const { writeAudit } = require('../services/auditService');

function parseHuntQrPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return {
      teamCode: parsed.teamCode || parsed.code || null,
      userId: parsed.userId || parsed.memberId || null,
      type: parsed.type || 'campus_hunt_member',
    };
  } catch {
    // Plain team code like CC027
    if (/^CC\d{1,4}$/i.test(trimmed)) {
      return { teamCode: trimmed.toUpperCase() };
    }
    return { teamCode: trimmed.toUpperCase() };
  }
}

async function login(req, res, next) {
  try {
    const { eventId, code, password } = req.body || {};
    if (!eventId || !code || !password) {
      return res.status(400).json({
        success: false,
        message: 'eventId, code, and password are required',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    }

    const access = await CampusHuntVolunteerAccess.findOne({
      eventId,
      code: String(code).trim().toUpperCase(),
      enabled: true,
    }).select('+passwordHash');

    if (!access || !(await access.verifyPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid volunteer credentials' });
    }

    const token = jwt.sign(
      {
        role: 'campus_hunt_volunteer',
        volunteerAccessId: String(access._id),
        eventId: String(access.eventId),
        label: access.label,
        code: access.code,
      },
      getJwtSecret(),
      { expiresIn: '12h' },
    );

    await writeAudit({
      eventId,
      actorType: 'volunteer',
      actorId: access._id,
      actorLabel: access.label,
      action: 'volunteer_login',
      targetType: 'volunteer_access',
      targetId: access._id,
    });

    return res.json({
      success: true,
      data: {
        token,
        volunteer: {
          id: String(access._id),
          label: access.label,
          code: access.code,
          eventId: String(access.eventId),
          checkpointIds: (access.checkpointIds || []).map(String),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const checkpoints = await CampusHuntCheckpoint.find({
      eventId: req.huntVolunteer.eventId,
      ...(req.huntVolunteer.checkpointIds.length
        ? { _id: { $in: req.huntVolunteer.checkpointIds } }
        : {}),
      active: true,
    })
      .select('checkpointKey checkpointNumber locationName routeId sequence active')
      .sort({ sequence: 1 });

    return res.json({
      success: true,
      data: {
        volunteer: req.huntVolunteer,
        checkpoints,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function scanTeam(req, res, next) {
  try {
    const checkpoint = await getCheckpoint(req.params.checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    }
    if (String(checkpoint.eventId) !== req.huntVolunteer.eventId) {
      return res.status(403).json({ success: false, message: 'Checkpoint not in your event' });
    }

    let teamCode = req.body?.teamCode;
    let memberUserId = req.body?.userId;

    // Accept raw QR payload: plain CC001, or JSON { teamCode, userId }
    const raw = req.body?.raw || req.body?.qr || req.body?.payload;
    if (raw && !teamCode) {
      const parsed = parseHuntQrPayload(raw);
      teamCode = parsed.teamCode;
      memberUserId = memberUserId || parsed.userId;
    }

    if (!teamCode) {
      return res.status(400).json({ success: false, message: 'teamCode is required' });
    }

    const preview = await scanTeamPreview(req.huntVolunteer.eventId, checkpoint, teamCode);
    if (preview.valid && memberUserId && preview.team?.id) {
      // Auto-verify scanned member when QR includes userId
      try {
        const team = await CampusHuntTeam.findById(preview.team.id);
        const { verifyMember } = require('../services/checkpointService');
        const result = await verifyMember({
          team,
          checkpoint,
          userId: memberUserId,
          volunteer: req.huntVolunteer,
        });
        const refreshed = await scanTeamPreview(
          req.huntVolunteer.eventId,
          checkpoint,
          teamCode,
        );
        return res.json({
          success: true,
          data: { ...refreshed, autoVerified: result },
        });
      } catch {
        /* fall through with preview only */
      }
    }
    return res.json({ success: true, data: preview });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function verifyMemberHandler(req, res, next) {
  try {
    const checkpoint = await getCheckpoint(req.params.checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    }

    const { teamId, userId } = req.body || {};
    if (!teamId || !userId) {
      return res.status(400).json({ success: false, message: 'teamId and userId are required' });
    }

    const team = await CampusHuntTeam.findById(teamId);
    if (!team || String(team.eventId) !== req.huntVolunteer.eventId) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const result = await verifyMember({
      team,
      checkpoint,
      userId,
      volunteer: req.huntVolunteer,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function completeHandler(req, res, next) {
  try {
    const checkpoint = await getCheckpoint(req.params.checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    }

    const { teamId, reason } = req.body || {};
    if (!teamId) {
      return res.status(400).json({ success: false, message: 'teamId is required' });
    }
    const reasonText = String(reason || '').trim();
    if (reasonText.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'reason is required (min 8 chars) — player station scan is the primary path',
        code: 'REASON_REQUIRED',
      });
    }

    // Bind volunteer to this checkpoint when assigned
    const assigned = req.huntVolunteer?.checkpointIds || [];
    if (
      assigned.length
      && !assigned.map(String).includes(String(checkpoint._id))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Volunteer is not assigned to this checkpoint',
        code: 'CHECKPOINT_NOT_ASSIGNED',
      });
    }

    const team = await CampusHuntTeam.findById(teamId);
    if (!team || String(team.eventId) !== req.huntVolunteer.eventId) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const result = await completeCheckpoint({
      team,
      checkpoint,
      volunteer: req.huntVolunteer,
      source: 'online',
      notes: `Volunteer complete: ${reasonText.slice(0, 500)}`,
    });

    await writeAudit({
      eventId: req.huntVolunteer.eventId,
      actorType: 'volunteer',
      actorId: req.huntVolunteer.volunteerAccessId,
      actorLabel: req.huntVolunteer.label,
      action: 'volunteer_checkpoint_complete',
      targetType: 'team',
      targetId: team._id,
      reason: reasonText.slice(0, 500),
      after: result,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function reportIssue(req, res, next) {
  try {
    const payload = validateIssueBody(req.body);
    const issue = await CampusHuntIssueReport.create({
      eventId: req.huntVolunteer.eventId,
      teamId: payload.teamId,
      checkpointId: payload.checkpointId || req.body.checkpointId,
      category: payload.category,
      notes: payload.notes,
      volunteerId: req.huntVolunteer.volunteerAccessId,
      volunteerLabel: req.huntVolunteer.label,
    });

    await writeAudit({
      eventId: req.huntVolunteer.eventId,
      actorType: 'volunteer',
      actorId: req.huntVolunteer.volunteerAccessId,
      actorLabel: req.huntVolunteer.label,
      action: 'issue_reported',
      targetType: 'issue',
      targetId: issue._id,
      metadata: { category: payload.category },
    });

    return res.status(201).json({ success: true, data: { issue } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

module.exports = {
  login,
  me,
  scanTeam,
  verifyMemberHandler,
  completeHandler,
  reportIssue,
};
