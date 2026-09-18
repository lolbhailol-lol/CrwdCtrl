const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  group: { type: String, enum: ['technical', 'non_technical', 'bundle'], required: true },
  feeTierId: { type: String, default: '' },
  competitionName: { type: String, required: true },
  roster: { type: mongoose.Schema.Types.Mixed, default: {} },
  originalAmount: { type: Number, required: true },
  allocatedPaidAmount: { type: Number, default: 0 },
  reservationToken: { type: String, default: '' },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null },
}, { _id: true });

const schema = new mongoose.Schema({
  fest: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer', required: true },
  source: { type: String, enum: ['public', 'desk'], default: 'public' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByOrganizer: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizerAccount', default: null },
  submissionKey: { type: String, required: true },
  paymentToken: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ['pending','confirming','paid','failed','expired','paid_review','refunded'], default: 'pending' },
  fulfillmentState: { type: String, enum: ['idle', 'processing', 'complete', 'review'], default: 'idle', index: true },
  fulfillmentStartedAt: { type: Date, default: null },
  confirmationEmailSentAt: { type: Date, default: null },
  items: { type: [itemSchema], validate: v => Array.isArray(v) && v.length === 3 },
  subtotal: { type: Number, required: true },
  discountPercent: { type: Number, default: 65 },
  discountAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  activeOrderId: { type: String, default: '' },
  orderIds: { type: [String], default: [] },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ source: 1, user: 1, submissionKey: 1 }, { unique: true });
schema.index({ activeOrderId: 1 });
module.exports = mongoose.models.MindSparkBundle || mongoose.model('MindSparkBundle', schema);
