const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, default: '', trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    maxDiscountAmount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    maxTotalUses: { type: Number, default: 0, min: 0 },
    maxUsesPerUser: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    applicableEntityTypes: {
      type: [String],
      default: [],
      enum: ['trek', 'fest', 'competition', 'event', 'event_show', 'sports'],
    },
  },
  { timestamps: true },
);

couponSchema.index({ active: 1, code: 1 });
couponSchema.index({ expiresAt: 1 });

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
