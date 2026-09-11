const mongoose = require('mongoose');

const campusHuntAuditLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      index: true,
    },
    actorType: {
      type: String,
      enum: ['admin', 'volunteer', 'system', 'player'],
      required: true,
    },
    actorId: { type: String },
    actorLabel: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String },
    targetId: { type: String },
    reason: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

campusHuntAuditLogSchema.index({ eventId: 1, createdAt: -1 });
campusHuntAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.CampusHuntAuditLog
  || mongoose.model('CampusHuntAuditLog', campusHuntAuditLogSchema);
