const mongoose = require('mongoose');
const {
  FINALE_DEFAULTS,
  FINALE_MISSION_BOARD,
  DEFAULT_INTEL_LOCATION_POOL,
} = require('../constants');

const intelLocationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, default: '', trim: true },
    instruction: { type: String, default: '', trim: true },
    acceptedAnswers: { type: [String], default: [] },
    fragment: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const campusHuntFinaleMissionConfigSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      unique: true,
      index: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntRound',
      index: true,
    },
    startingScore: { type: Number, default: FINALE_DEFAULTS.startingScore },
    durationMinutes: { type: Number, default: FINALE_DEFAULTS.durationMinutes },
    missionDurationMinutes: { type: Number, default: FINALE_DEFAULTS.missionDurationMinutes },
    missions: {
      type: [{
        id: String,
        title: String,
        emoji: String,
        points: Number,
        enabled: Boolean,
        comingSoon: Boolean,
        _id: false,
      }],
      default: () => FINALE_MISSION_BOARD.map((m) => ({ ...m })),
    },
    intelHunt: {
      locationPool: {
        type: [intelLocationSchema],
        default: () => DEFAULT_INTEL_LOCATION_POOL.map((loc) => ({ ...loc })),
      },
      maxAttemptsPerStep: { type: Number, default: FINALE_DEFAULTS.intelMaxAttemptsPerStep },
    },
    borrowedDevice: {
      locationName: { type: String, default: '', trim: true },
      instruction: {
        type: String,
        default: 'Borrow a real laptop — phones and tablets are against the rules for this mission (Desktop site = cheating / DQ). Open CrwdCtrl Grid, enter your Team Access Code, complete all 3 levels, then enter the Completion Code here.',
      },
      maxAttempts: { type: Number, default: FINALE_DEFAULTS.borrowedDeviceMaxAttempts },
    },
    /** Mission 2 — Field Terminal (preferred; borrowedDevice kept for legacy docs) */
    fieldTerminal: {
      locationName: { type: String, default: '', trim: true },
      instruction: {
        type: String,
        default: 'Borrow a real laptop — phones and tablets are against the rules for this mission (Desktop site = cheating / DQ). Open CrwdCtrl Grid, enter your Team Access Code, complete all 3 levels, then enter the Completion Code here.',
      },
      maxAttempts: { type: Number, default: FINALE_DEFAULTS.fieldTerminalMaxAttempts },
    },
    finaleRelease: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        meetLocations: [],
        pausedMeetCodes: [],
        releaseIntervalMinutes: 5,
      }),
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.CampusHuntFinaleMissionConfig
  || mongoose.model('CampusHuntFinaleMissionConfig', campusHuntFinaleMissionConfigSchema);
