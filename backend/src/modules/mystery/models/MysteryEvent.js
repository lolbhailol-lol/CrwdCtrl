const mongoose = require('mongoose');
const { EVENT_STATUS } = require('../constants');

const mysteryEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },
    title: { type: String, required: true, trim: true },
    college: { type: String, required: true, trim: true },
    venue: { type: String, default: '', trim: true },
    dateTime: { type: Date, required: true },

    teamSizeMin: { type: Number, default: 2 },
    teamSizeMax: { type: Number, default: 5 },
    maxTeams: { type: Number, default: 0 },

    entryFeePerTeam: { type: Number, default: 0, min: 0 },
    platformFeeAmount: { type: Number, default: 0, min: 0 },
    organizerPayoutAmount: { type: Number, default: 0, min: 0 },

    // Inter-team trading allow karna hai ya nahi is event me
    allowInterTeamExchange: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, enum: ['admin', 'self_serve_organizer'], default: 'self_serve_organizer' },

    status: { type: String, enum: Object.values(EVENT_STATUS), default: EVENT_STATUS.PENDING_APPROVAL },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true },
);

mysteryEventSchema.index({ status: 1, dateTime: 1 });
mysteryEventSchema.index({ college: 1, status: 1 });

module.exports = mongoose.models.MysteryEvent || mongoose.model('MysteryEvent', mysteryEventSchema);