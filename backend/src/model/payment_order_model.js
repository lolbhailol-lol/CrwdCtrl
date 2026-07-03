const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['trek', 'fest', 'competition', 'event', 'event_show', 'sports'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ticketPrice: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    people: { type: Number, default: 1 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    paymentId: { type: String, default: null },
    paymentSessionId: { type: String, default: null },
    orderTags: { type: mongoose.Schema.Types.Mixed, default: {} },
    customerEmail: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

paymentOrderSchema.index({ entityType: 1, entityId: 1 });
paymentOrderSchema.index({ status: 1 });
paymentOrderSchema.index({ userId: 1, entityType: 1, entityId: 1, status: 1, createdAt: -1 });
paymentOrderSchema.index({ status: 1, updatedAt: -1 });

module.exports =
  mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', paymentOrderSchema);
