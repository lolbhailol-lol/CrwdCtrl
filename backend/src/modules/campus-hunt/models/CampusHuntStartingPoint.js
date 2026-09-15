const mongoose = require('mongoose');

const campusHuntStartingPointSchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: '', trim: true },
    capacity: { type: Number, default: 10, min: 1 },
    displayOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    releasesPaused: { type: Boolean, default: false },
  },
  { timestamps: true },
);

campusHuntStartingPointSchema.index({ eventId: 1, code: 1 }, { unique: true });
campusHuntStartingPointSchema.index({ eventId: 1, roundId: 1, displayOrder: 1 });

module.exports = mongoose.models.CampusHuntStartingPoint
  || mongoose.model('CampusHuntStartingPoint', campusHuntStartingPointSchema);
