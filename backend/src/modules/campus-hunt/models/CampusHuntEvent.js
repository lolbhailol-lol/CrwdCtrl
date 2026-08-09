const mongoose = require('mongoose');
const { EVENT_STATUSES, DEFAULT_SCORING_CONFIG } = require('../constants');

const speedBandSchema = new mongoose.Schema(
  {
    maxSeconds: { type: Number, required: true },
    bonus: { type: Number, required: true },
  },
  { _id: false },
);

const clueScoringSchema = new mongoose.Schema(
  {
    basePoints: { type: Number, required: true },
    maxAttempts: { type: Number, default: 3 },
    timerSeconds: { type: Number, default: 0 },
    speedBonusBands: { type: [speedBandSchema], default: [] },
  },
  { _id: false },
);

const scoringConfigSchema = new mongoose.Schema(
  {
    startingScore: { type: Number, default: DEFAULT_SCORING_CONFIG.startingScore },
    hintCost: { type: Number, default: DEFAULT_SCORING_CONFIG.hintCost },
    clue2: { type: clueScoringSchema, default: () => ({ ...DEFAULT_SCORING_CONFIG.clue2 }) },
    clue3: { type: clueScoringSchema, default: () => ({ ...DEFAULT_SCORING_CONFIG.clue3 }) },
    clue4: { type: clueScoringSchema, default: () => ({ ...DEFAULT_SCORING_CONFIG.clue4 }) },
  },
  { _id: false },
);

const campusHuntEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    college: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    date: { type: Date },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: 'draft',
      index: true,
    },
    teamCapacity: { type: Number, default: 40 },
    teamSize: { type: Number, default: 4 },
    startingScore: { type: Number, default: 100 },
    /** When true, college appears in Profile → Campus Hunt live leaderboard only */
    publicLeaderboardLive: { type: Boolean, default: false, index: true },
    scoringConfig: {
      type: scoringConfigSchema,
      default: () => ({ ...DEFAULT_SCORING_CONFIG }),
    },
    featureNotes: { type: String, default: '' },
  },
  { timestamps: true },
);

campusHuntEventSchema.index({ college: 1, status: 1 });
campusHuntEventSchema.index({ publicLeaderboardLive: 1, status: 1 });

module.exports = mongoose.models.CampusHuntEvent
  || mongoose.model('CampusHuntEvent', campusHuntEventSchema);
