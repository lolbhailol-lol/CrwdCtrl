const mongoose = require('mongoose');
const { ROUND_STATUSES } = require('../constants');

const campusHuntRoundSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    roundNumber: { type: Number, required: true },
    name: {
      type: String,
      required: true,
      trim: true,
      // THE_HUNT | MAUT_KA_KUVA | DANGER_LEVEL | FINALE
    },
    status: {
      type: String,
      enum: ROUND_STATUSES,
      default: 'scheduled',
      index: true,
    },
    startsAt: { type: Date },
    endsAt: { type: Date },
    releaseIntervalMinutes: { type: Number, default: 2, min: 1 },
    assignmentStrategy: {
      type: String,
      enum: ['sequential', 'route_balanced'],
      default: 'route_balanced',
    },
    scheduleStatus: {
      type: String,
      enum: ['draft', 'locked'],
      default: 'draft',
      index: true,
    },
    scheduleLockedAt: { type: Date },
    releasesPaused: { type: Boolean, default: false },
    qualification: {
      topNDirectFinale: { type: Number, default: 8 },
      nextRoundName: { type: String, default: 'MAUT_KA_KUVA' },
    },
    lockedAt: { type: Date },
    finalizedAt: { type: Date },
  },
  { timestamps: true },
);

campusHuntRoundSchema.index({ eventId: 1, roundNumber: 1 }, { unique: true });
campusHuntRoundSchema.index({ eventId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.CampusHuntRound
  || mongoose.model('CampusHuntRound', campusHuntRoundSchema);
