const mongoose = require('mongoose');

const stallCouponSchema = new mongoose.Schema(
  {
    festId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FestOrganizer',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Snapshot rakha hai — agar admin baad me fest ka brand change kare,
    // purane users ka code apni assignment-time wali brand hi dikhayega
    brand: { type: String, required: true, trim: true },
    // e.g. 20 → "20% OFF at brand stall"
    discountPercent: { type: Number, default: 20, min: 1, max: 100 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    isRedeemed: { type: Boolean, default: false },
    redeemedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Ek user ko ek fest ke liye sirf ek hi coupon — duplicate register call bhi safe rahega
stallCouponSchema.index({ festId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.StallCoupon || mongoose.model('StallCoupon', stallCouponSchema);