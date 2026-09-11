const mongoose = require('mongoose');

const paymentAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    actor: { type: String, default: 'system', trim: true },
    orderId: { type: String, default: '', trim: true },
    payoutId: { type: String, default: '', trim: true },
    source: { type: String, default: '', trim: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

paymentAuditLogSchema.index({ createdAt: -1 });
paymentAuditLogSchema.index({ orderId: 1, createdAt: -1 });
paymentAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports =
  mongoose.models.PaymentAuditLog || mongoose.model('PaymentAuditLog', paymentAuditLogSchema);
