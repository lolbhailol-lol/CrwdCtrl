const mongoose = require('mongoose');
const { PROGRESS_STATES } = require('../constants');

const campusHuntTeamProgressSchema = new mongoose.Schema(
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
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntChallenge',
      required: true,
    },
    challengeNumber: { type: Number, required: true },
    state: {
      type: String,
      enum: PROGRESS_STATES,
      default: 'LOCKED',
    },
    attempts: { type: Number, default: 0 },
    hintUsed: { type: Boolean, default: false },
    hintUsedAt: { type: Date },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    submittedAt: { type: Date },
    completedAt: { type: Date },
    awardedPoints: { type: Number },
    failureReason: { type: String },
    lastRequestId: { type: String },
    hintRequestId: { type: String },
  },
  { timestamps: true },
);

campusHuntTeamProgressSchema.index({ teamId: 1, challengeId: 1 }, { unique: true });
campusHuntTeamProgressSchema.index({ teamId: 1, challengeNumber: 1 }, { unique: true });
campusHuntTeamProgressSchema.index({ eventId: 1, challengeNumber: 1, state: 1 });

module.exports = mongoose.models.CampusHuntTeamProgress
  || mongoose.model('CampusHuntTeamProgress', campusHuntTeamProgressSchema);
