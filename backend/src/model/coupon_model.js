const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, default: '', trim: true },
    /** Percent off the payable amount (e.g. 10 = 10% of money). */
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    /**
     * Cap on ₹ saved. 0 = no cap (full percent applies).
     * Example: 10% of ₹2000 = ₹200, but maxDiscountAmount 100 → save only ₹100.
     */
    maxDiscountAmount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    maxTotalUses: { type: Number, default: 0, min: 0 },
    maxUsesPerUser: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    /**
     * Party size rules for runs / bookings with a people count.
     * minPeople=1, maxPeople=0 → anyone (1+)
     * minPeople=2, maxPeople=2 → only when booking exactly 2 people
     * minPeople=2, maxPeople=0 → only when booking 2 or more
     */
    minPeople: { type: Number, default: 1, min: 1, max: 50 },
    maxPeople: { type: Number, default: 0, min: 0, max: 50 },
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
