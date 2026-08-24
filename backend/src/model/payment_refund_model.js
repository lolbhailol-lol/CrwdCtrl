const mongoose = require('mongoose');

const paymentRefundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      default: null,
      trim: true,
    },
    orderId: { type: String, required: true, trim: true },
    paymentId: { type: String, default: null, trim: true },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, default: '', trim: true },
    source: {
      type: String,
      enum: ['webhook', 'csv', 'api'],
      required: true,
    },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentRefundSchema.index(
  { refundId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { refundId: { $type: 'string', $gt: '' } },
  },
);
paymentRefundSchema.index({ orderId: 1 });
paymentRefundSchema.index({ paymentId: 1 }, { sparse: true });

module.exports =
  mongoose.models.PaymentRefund || mongoose.model('PaymentRefund', paymentRefundSchema);
