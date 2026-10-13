const mongoose = require('mongoose');
const { EVENT_STATUS } = require('../constants');

const ALL_STATUSES = Array.from(new Set([
  'draft', 'registration_open', 'live', 'completed', 'cancelled',
  ...Object.values(EVENT_STATUS),
]));

const mysteryEventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    college: {
      type: String,
      trim: true,
      default: '',
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    date: {
      type: Date,
    },
    dateTime: {
      type: Date,
    },
    venue: {
      type: String,
      trim: true,
      default: '',
    },

    // Which case this event runs
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MysteryCase',
    },

    // Capacity / team config
    teamCapacity: {
      type: Number,
      default: 20,
      min: 1,
    },
    teamSize: {
      type: Number,
      default: 4,
      min: 1,
    },
    teamSizeMin: { type: Number, default: 2 },
    teamSizeMax: { type: Number, default: 5 },
    maxTeams: { type: Number, default: 0 },
    startingScore: {
      type: Number,
      default: 100,
    },

    entryFeePerTeam: { type: Number, default: 0, min: 0 },
    platformFeeAmount: { type: Number, default: 0, min: 0 },
    organizerPayoutAmount: { type: Number, default: 0, min: 0 },

    // Inter-team trading allow karna hai ya nahi is event me
    allowInterTeamExchange: { type: Boolean, default: true },

    status: {
      type: String,
      enum: ALL_STATUSES,
      default: 'draft',
    },
    rejectionReason: { type: String, default: '' },

    // Public visibility toggles (same pattern as Campus Hunt)
    publicLoginLive: {
      type: Boolean,
      default: false,
    },
    publicLeaderboardLive: {
      type: Boolean,
      default: false,
    },

    operationsNotes: {
      type: String,
      trim: true,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByEmail: { type: String, trim: true, default: '' },
    createdByRole: { type: String, enum: ['admin', 'self_serve_organizer'], default: 'self_serve_organizer' },
  },
  { timestamps: true },
);

mysteryEventSchema.pre('save', function (next) {
  if (!this.name && this.title) this.name = this.title;
  if (!this.title && this.name) this.title = this.name;
  if (!this.date && this.dateTime) this.date = this.dateTime;
  if (!this.dateTime && this.date) this.dateTime = this.date;
  next();
});

mysteryEventSchema.index({ college: 1, status: 1 });
mysteryEventSchema.index({ status: 1, dateTime: 1 });
mysteryEventSchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.MysteryEvent || mongoose.model('MysteryEvent', mysteryEventSchema);
