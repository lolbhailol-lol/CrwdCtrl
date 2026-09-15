const mongoose = require('mongoose');
const { FINALE_ENTRY_STATUS } = require('../constants');

const campusHuntFinaleEntrySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntRound',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntTeam',
      required: true,
      index: true,
    },
    promotionSource: {
      type: String,
      enum: ['direct_r1', 'manual_pick'],
      required: true,
    },
    r1Rank: { type: Number },
    r1Score: { type: Number },
    finaleScore: { type: Number, required: true, default: 500 },
    finalScore: { type: Number },
    status: {
      type: String,
      enum: FINALE_ENTRY_STATUS,
      default: 'eligible',
      index: true,
    },
    completedMissionIds: {
      type: [String],
      default: [],
    },
    activeMissionId: { type: String, default: null },
    activeMissionRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntFinaleMissionRun',
      default: null,
    },
    stoppedAt: { type: Date },
    lockedAt: { type: Date },
    /** Finale meet + release (mirrors Round 1 start desk, 4 locs × 3 teams) */
    finaleSlot: { type: Number },
    meetLocationCode: { type: String, trim: true },
    meetLocationName: { type: String, trim: true },
    scheduledStartAt: { type: Date },
    releasedAt: { type: Date },
    releaseWave: { type: Number },
  },
  { timestamps: true },
);

campusHuntFinaleEntrySchema.index({ eventId: 1, teamId: 1 }, { unique: true });
campusHuntFinaleEntrySchema.index({ eventId: 1, finaleScore: -1 });

module.exports = mongoose.models.CampusHuntFinaleEntry
  || mongoose.model('CampusHuntFinaleEntry', campusHuntFinaleEntrySchema);
