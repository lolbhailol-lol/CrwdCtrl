const mongoose = require('mongoose');

const campusHuntRouteSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    routeKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    teamSlots: { type: Number, default: 10 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

campusHuntRouteSchema.index({ eventId: 1, routeKey: 1 }, { unique: true });

module.exports = mongoose.models.CampusHuntRoute
  || mongoose.model('CampusHuntRoute', campusHuntRouteSchema);
