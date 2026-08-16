const mongoose = require('mongoose');

/**
 * One unguessable install link per team. Phones fetch the pack once (home Wi‑Fi),
 * then play from local storage with no server.
 */
const schema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    teamCode: { type: String, required: true, uppercase: true, index: true },
    bundle: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ eventId: 1, teamCode: 1 });
// TTL — Mongo deletes docs when expiresAt passes (do not also set index: true above)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CampusHuntOfflineInstall', schema);
