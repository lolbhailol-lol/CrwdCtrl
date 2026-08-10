const mongoose = require('mongoose');
const crypto = require('crypto');

const campusHuntCheckpointSchema = new mongoose.Schema(
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
    code: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    progressionKey: {
      type: String,
      enum: ['1', '2', '3', 'FINISH'],
      default: function defaultProgressionKey() {
        const key = String(this.checkpointKey || this.checkpointNumber || '1').toUpperCase();
        if (key === 'FINISH' || key.startsWith('FINISH')) return 'FINISH';
        const match = key.match(/^([123])(?:-|$)/);
        return match ? match[1] : '1';
      },
      index: true,
    },
    allowedTeamIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntTeam' }],
      default: [],
    },
    capacityGuidance: { type: Number, min: 1 },
    concurrencyGuidance: { type: String, default: '', trim: true },
    /** 1 | 2 | 3 | or use checkpointKey FINISH */
    checkpointNumber: { type: Number, required: true },
    checkpointKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    locationName: { type: String, required: true, trim: true },
    /** Stable hunt-station id (S01–S10) so admin renames propagate everywhere. */
    stationCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    publicInstruction: { type: String, default: '' },
    /** Server secret for station identity — never expose to players. */
    qrSecret: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex'),
      select: false,
    },
    /**
     * Short ops/player fallback code (same privilege as scanning the poster QR).
     * Printed under the QR / shared when camera fails in production.
     */
    pasteCode: {
      type: String,
      default: () => crypto.randomBytes(4).toString('hex').toUpperCase(),
      uppercase: true,
      select: false,
    },
    active: { type: Boolean, default: true },
    sequence: { type: Number, required: true },
    compensationPolicyKey: {
      type: String,
      default: 'skip_and_continue',
    },
  },
  { timestamps: true },
);

campusHuntCheckpointSchema.index({ eventId: 1, code: 1 }, { unique: true, sparse: true });
campusHuntCheckpointSchema.index(
  { eventId: 1, routeId: 1, progressionKey: 1, code: 1 },
  { unique: true, sparse: true },
);
campusHuntCheckpointSchema.index({ eventId: 1, routeId: 1, sequence: 1 });
campusHuntCheckpointSchema.index({ eventId: 1, pasteCode: 1 });

module.exports = mongoose.models.CampusHuntCheckpoint
  || mongoose.model('CampusHuntCheckpoint', campusHuntCheckpointSchema);
