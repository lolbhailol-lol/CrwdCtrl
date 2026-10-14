const mongoose = require('mongoose');
const { EVENT_STATUS } = require('../constants');

const DRAFT_STATUS = 'draft';

function requiredUnlessDraft() {
  return this.status !== DRAFT_STATUS;
}

const mysteryEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: requiredUnlessDraft },
    title: { type: String, required: requiredUnlessDraft, trim: true },
    college: { type: String, required: requiredUnlessDraft, trim: true },
    venue: { type: String, default: '', trim: true },
    dateTime: { type: Date, required: requiredUnlessDraft },

    teamSizeMin: { type: Number, default: 2 },
    teamSizeMax: { type: Number, default: 5 },
    maxTeams: { type: Number, default: 0 },

    entryFeePerTeam: { type: Number, default: 0, min: 0 },
    platformFeeAmount: { type: Number, default: 0, min: 0 },
    organizerPayoutAmount: { type: Number, default: 0, min: 0 },

    // Inter-team trading allow karna hai ya nahi is event me
    allowInterTeamExchange: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByEmail: { type: String, trim: true, default: '' },
    createdByRole: { type: String, enum: ['admin', 'self_serve_organizer'], default: 'self_serve_organizer' },

    status: {
      type: String,
      enum: [DRAFT_STATUS, ...Object.values(EVENT_STATUS)],
      default: EVENT_STATUS.PENDING_APPROVAL,
    },
    rejectionReason: { type: String, default: '' },

    // Admin game-control fields (same naming as CampusHuntEvent).
    // `name` and `date` mirror `title` and `dateTime`; keep both pairs in sync.
    name: { type: String, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    date: { type: Date },
    teamCapacity: { type: Number, default: 20, min: 1 },
    teamSize: { type: Number, default: 4, min: 1 },
    startingScore: { type: Number, default: 100 },
    publicLoginLive: { type: Boolean, default: false },
    publicLeaderboardLive: { type: Boolean, default: false },
    operationsNotes: { type: String, trim: true, default: '' },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

function syncAliases(target) {
  if (!target) return;
  if (target.name && !target.title) target.title = target.name;
  if (target.title && !target.name) target.name = target.title;
  if (target.date && !target.dateTime) target.dateTime = target.date;
  if (target.dateTime && !target.date) target.date = target.dateTime;
}

mysteryEventSchema.pre('validate', function syncDocumentAliases() {
  syncAliases(this);
});

mysteryEventSchema.pre('findOneAndUpdate', function syncUpdateAliases() {
  const update = this.getUpdate() || {};
  const set = update.$set || update;
  if (set.name !== undefined && set.title === undefined) set.title = set.name;
  if (set.title !== undefined && set.name === undefined) set.name = set.title;
  if (set.date !== undefined && set.dateTime === undefined) set.dateTime = set.date;
  if (set.dateTime !== undefined && set.date === undefined) set.date = set.dateTime;
});

mysteryEventSchema.index({ status: 1, dateTime: 1 });
mysteryEventSchema.index({ college: 1, status: 1 });
mysteryEventSchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.MysteryEvent || mongoose.model('MysteryEvent', mysteryEventSchema);
