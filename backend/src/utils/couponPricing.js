const Coupon = require('../model/coupon_model');
const CouponUsage = require('../model/coupon_usage_model');
const PaymentOrder = require('../model/payment_order_model');

function normalizeCouponCode(raw = '') {
  return String(raw || '').trim().toUpperCase();
}

function isCouponApplicableToEntity(coupon, entityType) {
  const types = Array.isArray(coupon.applicableEntityTypes) ? coupon.applicableEntityTypes : [];
  if (!types.length) return true;
  return types.includes(entityType);
}

function computeCouponDiscount({ baseAmount, discountPercent, maxDiscountAmount }) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  const percent = Math.max(0, Number(discountPercent) || 0);
  const rawDiscount = Math.round((safeBase * percent) / 100);
  const cap = Math.max(0, Number(maxDiscountAmount) || 0);
  const discountAmount = Math.min(rawDiscount, cap > 0 ? cap : rawDiscount);
  const finalAmount = Math.max(0, safeBase - discountAmount);
  return { discountAmount, finalAmount };
}

async function validateAndPriceCoupon({
  couponCode,
  entityType,
  userId = null,
  amountBeforeDiscount,
  failOnMissingCode = false,
}) {
  const normalizedCode = normalizeCouponCode(couponCode);
  const baseAmount = Math.max(0, Number(amountBeforeDiscount) || 0);

  if (!normalizedCode) {
    if (failOnMissingCode) {
      throw new Error('Coupon code is required.');
    }
    return {
      couponApplied: false,
      couponCode: '',
      discountAmount: 0,
      amountBeforeDiscount: baseAmount,
      amountAfterDiscount: baseAmount,
      coupon: null,
    };
  }

  if (baseAmount <= 0) {
    throw new Error('Coupons are only valid on paid registrations.');
  }

  const coupon = await Coupon.findOne({ code: normalizedCode }).lean();
  if (!coupon) throw new Error('Invalid coupon code.');
  if (!coupon.active) throw new Error('This coupon is currently inactive.');

  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    throw new Error('This coupon is not active yet.');
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    throw new Error('This coupon has expired.');
  }
  if (!isCouponApplicableToEntity(coupon, entityType)) {
    throw new Error('This coupon is not valid for this registration type.');
  }
  if (coupon.maxTotalUses > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUses)) {
    throw new Error('This coupon has reached its total usage limit.');
  }

  if (userId && coupon.maxUsesPerUser > 0) {
    const usage = await CouponUsage.findOne({ couponId: coupon._id, userId }).lean();
    if ((usage?.usedCount || 0) >= Number(coupon.maxUsesPerUser)) {
      throw new Error('You have already used this coupon the maximum allowed times.');
    }
  }

  const { discountAmount, finalAmount } = computeCouponDiscount({
    baseAmount,
    discountPercent: coupon.discountPercent,
    maxDiscountAmount: coupon.maxDiscountAmount,
  });

  return {
    couponApplied: discountAmount > 0,
    couponCode: normalizedCode,
    discountAmount,
    amountBeforeDiscount: baseAmount,
    amountAfterDiscount: finalAmount,
    coupon,
  };
}

async function consumeCouponUsageForOrder({ paymentOrderId, userId }) {
  const orderId = String(paymentOrderId || '').trim();
  if (!orderId || !userId) return;

  const paymentOrder = await PaymentOrder.findOne({ orderId });
  if (!paymentOrder || !paymentOrder.couponCode || paymentOrder.couponConsumedAt) return;

  const couponCode = normalizeCouponCode(paymentOrder.couponCode);
  const coupon = await Coupon.findOne({ code: couponCode });
  if (!coupon) return;

  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
  await CouponUsage.updateOne(
    { couponId: coupon._id, userId },
    { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
    { upsert: true },
  );

  paymentOrder.couponConsumedAt = new Date();
  await paymentOrder.save();
}

module.exports = {
  normalizeCouponCode,
  computeCouponDiscount,
  validateAndPriceCoupon,
  consumeCouponUsageForOrder,
};
