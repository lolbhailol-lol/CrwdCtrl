const mongoose = require('mongoose');
const {
  FINALE_DEFAULTS,
  FINALE_MISSION_BOARD,
  DEFAULT_INTEL_LOCATION_POOL,
  DEFAULT_LOCKBOX_CONFIG,
  DEFAULT_BLACKOUT_CONFIG,
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
    /** Mission 2 — The Lockbox */
    lockbox: {
      clue: { type: String, default: () => DEFAULT_LOCKBOX_CONFIG.clue },
      locationName: { type: String, default: () => DEFAULT_LOCKBOX_CONFIG.locationName, trim: true },
      locationHint: { type: String, default: () => DEFAULT_LOCKBOX_CONFIG.locationHint },
      keyPool: {
        type: [{
          id: { type: String, required: true, trim: true },
          label: { type: String, default: '', trim: true },
          acceptedAnswers: { type: [String], default: [] },
          _id: false,
        }],
        default: () => DEFAULT_LOCKBOX_CONFIG.keyPool.map((k) => ({ ...k })),
      },
      maxAttemptsKey: { type: Number, default: FINALE_DEFAULTS.lockboxMaxAttemptsPerStep },
      maxAttemptsCode: { type: Number, default: FINALE_DEFAULTS.lockboxMaxAttemptsPerStep },
      playerPieces: {
        type: [{
          seat: { type: Number, default: 0 },
          label: { type: String, default: '', trim: true },
          info: { type: String, default: '' },
          _id: false,
        }],
        default: () => DEFAULT_LOCKBOX_CONFIG.playerPieces.map((p) => ({ ...p })),
      },
      codePool: {
        type: [{
          id: { type: String, required: true, trim: true },
          acceptedCodes: { type: [String], default: [] },
          playerPieces: {
            type: [{
              seat: { type: Number, default: 0 },
              label: { type: String, default: '', trim: true },
              info: { type: String, default: '' },
              _id: false,
            }],
            default: [],
          },
          _id: false,
        }],
        default: () => DEFAULT_LOCKBOX_CONFIG.codePool.map((c) => ({
          id: c.id,
          acceptedCodes: [...c.acceptedCodes],
          playerPieces: c.playerPieces.map((p) => ({ ...p })),
        })),
      },
      acceptedCodes: {
        type: [String],
        default: () => [...DEFAULT_LOCKBOX_CONFIG.acceptedCodes],
      },
      lockboxInstruction: {
        type: String,
        default: () => DEFAULT_LOCKBOX_CONFIG.lockboxInstruction,
      },
    },
    /** Mission 3 — Field Terminal (preferred; borrowedDevice kept for legacy docs) */
    fieldTerminal: {
      locationName: { type: String, default: '', trim: true },
      instruction: {
        type: String,
        default: 'Borrow a real laptop — phones and tablets are against the rules for this mission (Desktop site = cheating / DQ). Open CrwdCtrl Grid, enter your Team Access Code, complete all 3 levels, then enter the Completion Code here.',
      },
      maxAttempts: { type: Number, default: FINALE_DEFAULTS.fieldTerminalMaxAttempts },
    },
    /** Mission 4 — OPERATION: BLACKOUT */
    blackout: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        ...DEFAULT_BLACKOUT_CONFIG,
        scout: { ...DEFAULT_BLACKOUT_CONFIG.scout },
        cracker: { ...DEFAULT_BLACKOUT_CONFIG.cracker },
        navigator: { ...DEFAULT_BLACKOUT_CONFIG.navigator },
        controller: { ...DEFAULT_BLACKOUT_CONFIG.controller },
        routePool: [...DEFAULT_BLACKOUT_CONFIG.routePool],
      }),
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
