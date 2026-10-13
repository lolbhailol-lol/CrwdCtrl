const mongoose = require('mongoose');

const mysteryEventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    college: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    date: {
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

    // Capacity / team config — mirrors CampusHuntEvent naming so admin UI stays consistent
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
    startingScore: {
      type: Number,
      default: 100,
    },

    status: {
      type: String,
      enum: ['draft', 'registration_open', 'live', 'completed', 'cancelled'],
      default: 'draft',
    },

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
    },
  },
  { timestamps: true },
);

mysteryEventSchema.index({ college: 1 });
mysteryEventSchema.index({ status: 1 });
mysteryEventSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('MysteryEvent', mysteryEventSchema);