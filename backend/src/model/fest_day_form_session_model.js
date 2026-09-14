const mongoose = require('mongoose');

const festDayFormSessionSchema = new mongoose.Schema({
  fest: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer', required: true },
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

festDayFormSessionSchema.index({ fest: 1, competition: 1, user: 1 }, { unique: true });
festDayFormSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.FestDayFormSession
  || mongoose.model('FestDayFormSession', festDayFormSessionSchema);
