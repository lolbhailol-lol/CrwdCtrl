const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  fest: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer', required: true, index: true },
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  responses: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending', index: true },
  paymentOrderId: { type: String, default: null, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null },
  submissionKey: { type: String, required: true, trim: true },
  paymentToken: { type: String, required: true, trim: true, unique: true, select: false },
}, { timestamps: true });

schema.index({ fest: 1, submissionKey: 1 }, { unique: true });

module.exports = mongoose.models.FestDayAssistedRegistration
  || mongoose.model('FestDayAssistedRegistration', schema);
