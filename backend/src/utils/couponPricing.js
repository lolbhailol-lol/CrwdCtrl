const Coupon = require('../model/coupon_model');
const CouponUsage = require('../model/coupon_usage_model');
const PaymentOrder = require('../model/payment_order_model');
const { isCouponExpired, isCouponNotStarted } = require('./couponSchedule');

function normalizeCouponCode(raw = '') {
  return String(raw || '').trim().toUpperCase();
}

function isCouponApplicableToEntity(coupon, entityType) {
  const types = Array.isArray(coupon.applicableEntityTypes) ? coupon.applicableEntityTypes : [];
  if (!types.length) return true;
  return types.includes(entityType);
}

function couponEntityTypeLabel(entityType) {
  const labels = {
    trek: 'treks',
    sports: 'runs / sports events',
    fest: 'fests',
    competition: 'competitions',
    event: 'events',
    event_show: 'shows / events',
  };
  return labels[entityType] || entityType || 'this booking';
}

function assertCouponAppliesToEntity(coupon, entityType) {
  if (isCouponApplicableToEntity(coupon, entityType)) return;
  const allowed = (Array.isArray(coupon.applicableEntityTypes) ? coupon.applicableEntityTypes : [])
    .map(couponEntityTypeLabel)
    .filter(Boolean);
  if (!allowed.length) {
    throw new Error('This coupon is not valid for this registration type.');
  }
  throw new Error(
    `This coupon is only valid for ${allowed.join(' / ')} — not for ${couponEntityTypeLabel(entityType)}.`,
  );
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

function assertPeopleAllowed(coupon, people) {
  const peopleCount = Math.max(1, Number(people) || 1);
  const minPeople = Math.max(1, Number(coupon.minPeople) || 1);
  const maxPeople = Math.max(0, Number(coupon.maxPeople) || 0);

  if (peopleCount < minPeople) {
    throw new Error(
      minPeople === 1
        ? 'This coupon cannot be applied to this booking size.'
        : `This coupon needs at least ${minPeople} people in the booking.`,
    );
  }
  if (maxPeople > 0 && peopleCount > maxPeople) {
    throw new Error(
      maxPeople === minPeople
        ? `This coupon is only valid when booking exactly ${maxPeople} people.`
        : `This coupon is only valid for up to ${maxPeople} people.`,
    );
  }
  return peopleCount;
}

async function validateAndPriceCoupon({
  couponCode,
  entityType,
  userId = null,
  amountBeforeDiscount,
  people = 1,
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
      people: Math.max(1, Number(people) || 1),
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
  if (isCouponNotStarted(coupon.startsAt, now)) {
    throw new Error('This coupon is not active yet.');
  }
  if (isCouponExpired(coupon.expiresAt, now)) {
    throw new Error('This coupon has expired. Ask the organizer to extend the expiry date in admin.');
  }
  assertCouponAppliesToEntity(coupon, entityType);
  if (coupon.maxTotalUses > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUses)) {
    throw new Error('This coupon has reached its total usage limit.');
  }

  const peopleCount = assertPeopleAllowed(coupon, people);

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
    people: peopleCount,
    minPeople: Math.max(1, Number(coupon.minPeople) || 1),
    maxPeople: Math.max(0, Number(coupon.maxPeople) || 0),
    discountPercent: Number(coupon.discountPercent) || 0,
    maxDiscountAmount: Number(coupon.maxDiscountAmount) || 0,
    coupon,
  };
}

async function consumeCouponUsageForOrder({ paymentOrderId, userId }) {
  const orderId = String(paymentOrderId || '').trim();
  if (!orderId || !userId) return { ok: true, skipped: true };

  const paymentOrder = await PaymentOrder.findOne({ orderId });
  if (!paymentOrder || !paymentOrder.couponCode || paymentOrder.couponConsumedAt) {
    return { ok: true, skipped: true };
  }

  const reserved = await reserveCouponUsage({
    couponCode: paymentOrder.couponCode,
    userId,
  });
  if (!reserved.ok) {
    return reserved;
  }

  paymentOrder.couponConsumedAt = new Date();
  await paymentOrder.save();
  return { ok: true };
}

/**
 * Atomically reserve coupon usage against total + per-user caps.
 * Call BEFORE confirming a free / paid registration that uses a coupon.
 */
async function reserveCouponUsage({ couponCode, userId }) {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) return { ok: true, skipped: true };
  if (!userId) return { ok: false, message: 'Authentication required to use a coupon.' };

  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) return { ok: false, message: 'Invalid coupon code.' };

  const maxTotal = Math.max(0, Number(coupon.maxTotalUses) || 0);
  const maxPerUser = Math.max(0, Number(coupon.maxUsesPerUser) || 0);

  const totalFilter = { _id: coupon._id };
  if (maxTotal > 0) totalFilter.usedCount = { $lt: maxTotal };

  const totalUpdated = await Coupon.findOneAndUpdate(
    totalFilter,
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  if (!totalUpdated) {
    return { ok: false, message: 'This coupon has reached its total usage limit.' };
  }

  if (maxPerUser > 0) {
    const usageFilter = {
      couponId: coupon._id,
      userId,
      usedCount: { $lt: maxPerUser },
    };
    let usageUpdated = await CouponUsage.findOneAndUpdate(
      usageFilter,
      { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
      { new: true },
    );

    if (!usageUpdated) {
      // First use: upsert only if no existing over-cap doc
      const existing = await CouponUsage.findOne({ couponId: coupon._id, userId }).lean();
      if (!existing) {
        try {
          usageUpdated = await CouponUsage.create({
            couponId: coupon._id,
            userId,
            usedCount: 1,
            lastUsedAt: new Date(),
          });
        } catch (err) {
          // Parallel first-use race — re-read
          usageUpdated = await CouponUsage.findOneAndUpdate(
            usageFilter,
            { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
            { new: true },
          );
        }
      }
    }

    if (!usageUpdated) {
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      return {
        ok: false,
        message: 'You have already used this coupon the maximum allowed times.',
      };
    }
  } else {
    await CouponUsage.updateOne(
      { couponId: coupon._id, userId },
      { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
      { upsert: true },
    );
  }

  return { ok: true, couponId: coupon._id, couponCode: normalizedCode };
}

/** Consume coupon usage for organizer QR / non-Cashfree registrations. */
async function consumeCouponUsageForRegistration({ registration, userId }) {
  if (!registration || !userId) return { ok: true, skipped: true };
  const couponCode = normalizeCouponCode(registration.couponCode);
  if (!couponCode || registration.couponConsumedAt) return { ok: true, skipped: true };

  const reserved = await reserveCouponUsage({ couponCode, userId });
  if (!reserved.ok) return reserved;

  registration.couponConsumedAt = new Date();
  if (typeof registration.save === 'function') {
    await registration.save();
  } else {
    const CategoryRegistration = require('../model/category_registration_model');
    await CategoryRegistration.updateOne(
      { _id: registration._id },
      { $set: { couponConsumedAt: registration.couponConsumedAt } },
    );
  }
  return { ok: true };
}

module.exports = {
  normalizeCouponCode,
  computeCouponDiscount,
  validateAndPriceCoupon,
  reserveCouponUsage,
  consumeCouponUsageForOrder,
  consumeCouponUsageForRegistration,
};
