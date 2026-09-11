const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usedCount: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

couponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.CouponUsage || mongoose.model('CouponUsage', couponUsageSchema);
