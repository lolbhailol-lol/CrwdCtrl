const mongoose = require('mongoose');

const levelProgressSchema = new mongoose.Schema(
  {
    levelIndex: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    failed: { type: Boolean, default: false },
    timedOut: { type: Boolean, default: false },
    moves: { type: Number, default: 0 },
    pointsAwarded: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    completedAt: { type: Date },
    startedAt: { type: Date },
  },
  { _id: false },
);

const campusHuntGridSessionSchema = new mongoose.Schema(
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
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntFinaleEntry',
      index: true,
    },
    missionRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntFinaleMissionRun',
      index: true,
    },
    sessionToken: { type: String, required: true, unique: true, index: true },
    accessCode: { type: String, required: true, unique: true, index: true },
    teamCode: { type: String, required: true, trim: true },
    teamLabel: { type: String, default: '', trim: true },
    puzzles: { type: [mongoose.Schema.Types.Mixed], default: [] },
    levelProgress: { type: [levelProgressSchema], default: [] },
    currentLevelIndex: { type: Number, default: 0 },
    scoreEarned: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired'],
      default: 'active',
      index: true,
    },
    completionCode: { type: String, default: null, index: true },
    completionCodeUsed: { type: Boolean, default: false },
    completionCodeUsedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

campusHuntGridSessionSchema.index({ accessCode: 1, status: 1 });
campusHuntGridSessionSchema.index({ completionCode: 1, completionCodeUsed: 1 });

module.exports = mongoose.models.CampusHuntGridSession
  || mongoose.model('CampusHuntGridSession', campusHuntGridSessionSchema);
