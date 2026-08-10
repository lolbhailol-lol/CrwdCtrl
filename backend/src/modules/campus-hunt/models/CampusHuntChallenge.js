const mongoose = require('mongoose');
const { CHALLENGE_TYPES } = require('../constants');

const speedBandSchema = new mongoose.Schema(
  {
    maxSeconds: { type: Number, required: true },
    bonus: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Answers are server-only. Controllers must never serialize answer/acceptedAnswers/hint
 * to player clients until hint is purchased (hintText only after purchase).
 */
const campusHuntChallengeSchema = new mongoose.Schema(
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
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntRoute',
      required: true,
      index: true,
    },
    startingPointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntStartingPoint',
      index: true,
    },
    firstCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    /** Clue 2 variant → team-bound Checkpoint 2 (progressionKey 2). */
    secondCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    /** Clue 3 variant → team-bound Checkpoint 3 (progressionKey 3). */
    thirdCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    challengeNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    type: {
      type: String,
      enum: CHALLENGE_TYPES,
      required: true,
    },
    /** Shared prompt (Clue 1–3). */
    prompt: { type: String, default: '' },
    /** Clue 4: four pieces keyed by member index 0=leader, 1–3=members. */
    memberPrompts: {
      type: [String],
      default: undefined,
    },
    /** Canonical answer (plain, server-side only). */
    answer: { type: String, select: false },
    /** Alternate accepted answers (e.g. Clue 1 synonyms). */
    acceptedAnswers: { type: [String], select: false, default: undefined },
    hintText: { type: String, select: false, default: '' },
    hintCost: { type: Number, default: 15 },
    maxAttempts: { type: Number, default: 3 },
    timerSeconds: { type: Number, default: 0 },
    basePoints: { type: Number, default: 0 },
    speedBonusBands: { type: [speedBandSchema], default: [] },
    /** Shown after correct solve — checkpoint destination instruction. */
    destinationInstruction: { type: String, default: '' },
    variantKey: { type: String, default: 'DEFAULT', trim: true, uppercase: true },
    active: { type: Boolean, default: true },
    voided: { type: Boolean, default: false },
    voidedAt: { type: Date },
  },
  { timestamps: true },
);

campusHuntChallengeSchema.index(
  { eventId: 1, roundId: 1, routeId: 1, challengeNumber: 1, variantKey: 1 },
  { unique: true },
);

const LEGACY_CHALLENGE_INDEXES = [
  'eventId_1_routeId_1_challengeNumber_1',
  'eventId_1_roundId_1_routeId_1_challengeNumber_1',
];

/**
 * Old unique indexes omitted variantKey and block Clue 1 multi-variant upserts.
 * Safe to call repeatedly (no-op when already dropped).
 */
async function ensureChallengeIndexes() {
  const collection = mongoose.models.CampusHuntChallenge?.collection
    || mongoose.connection.collection('campushuntchallenges');
  for (const name of LEGACY_CHALLENGE_INDEXES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await collection.dropIndex(name);
    } catch (error) {
      if (error.codeName !== 'IndexNotFound' && error.code !== 27) throw error;
    }
  }
  await (mongoose.models.CampusHuntChallenge || mongoose.model('CampusHuntChallenge', campusHuntChallengeSchema))
    .syncIndexes();
}

const CampusHuntChallenge = mongoose.models.CampusHuntChallenge
  || mongoose.model('CampusHuntChallenge', campusHuntChallengeSchema);

CampusHuntChallenge.ensureChallengeIndexes = ensureChallengeIndexes;

module.exports = CampusHuntChallenge;
