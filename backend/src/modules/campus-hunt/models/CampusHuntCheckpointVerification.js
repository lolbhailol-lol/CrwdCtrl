const mongoose = require('mongoose');

const campusHuntCheckpointVerificationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntTeam',
      required: true,
      index: true,
    },
    checkpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      required: true,
    },
    checkpointKey: { type: String, required: true },
    verifiedMemberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    volunteerId: { type: String },
    volunteerLabel: { type: String },
    status: {
      type: String,
      enum: ['in_progress', 'awaiting_claim', 'complete', 'manual_reconciled'],
      default: 'in_progress',
      index: true,
    },
    verifiedAt: { type: Date },
    source: {
      type: String,
      enum: ['online', 'manual'],
      default: 'online',
    },
    notes: { type: String, default: '' },
    deviceMeta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

campusHuntCheckpointVerificationSchema.index({ teamId: 1, checkpointId: 1 }, { unique: true });
campusHuntCheckpointVerificationSchema.index({ eventId: 1, checkpointId: 1, status: 1 });

module.exports = mongoose.models.CampusHuntCheckpointVerification
  || mongoose.model('CampusHuntCheckpointVerification', campusHuntCheckpointVerificationSchema);
