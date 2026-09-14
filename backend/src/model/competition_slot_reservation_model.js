const mongoose = require('mongoose');

const competitionSlotReservationSchema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  slot: { type: Number, required: true, min: 1 },
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  orderId: { type: String, default: '', index: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

competitionSlotReservationSchema.index({ competitionId: 1, slot: 1 }, { unique: true });
competitionSlotReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.CompetitionSlotReservation
  || mongoose.model('CompetitionSlotReservation', competitionSlotReservationSchema);
