const CampusHuntAuditLog = require('../models/CampusHuntAuditLog');

async function writeAudit({
  eventId,
  actorType,
  actorId,
  actorLabel,
  action,
  targetType,
  targetId,
  reason = '',
  before,
  after,
  metadata,
}) {
  try {
    await CampusHuntAuditLog.create({
      eventId: eventId || undefined,
      actorType,
      actorId: actorId != null ? String(actorId) : undefined,
      actorLabel,
      action,
      targetType,
      targetId: targetId != null ? String(targetId) : undefined,
      reason,
      before,
      after,
      metadata,
    });
  } catch (err) {
    // Audit must not break the main flow, but should be visible in logs.
    console.error('[campus-hunt] audit write failed', err?.message || err);
  }
}

module.exports = {
  writeAudit,
};
