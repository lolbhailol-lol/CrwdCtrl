const mongoose = require('mongoose');
const { FINALE_RUN_STATUS } = require('../constants');

const campusHuntFinaleMissionRunSchema = new mongoose.Schema(
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
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntFinaleEntry',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntTeam',
      required: true,
      index: true,
    },
    missionId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: FINALE_RUN_STATUS,
      default: 'active',
      index: true,
    },
    state: { type: mongoose.Schema.Types.Mixed, default: {} },
    pointsAwarded: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

campusHuntFinaleMissionRunSchema.index({ entryId: 1, missionId: 1, status: 1 });

module.exports = mongoose.models.CampusHuntFinaleMissionRun
  || mongoose.model('CampusHuntFinaleMissionRun', campusHuntFinaleMissionRunSchema);
