const Coupon = require('../model/coupon_model');
const CouponUsage = require('../model/coupon_usage_model');
const {
  parseAdminDateTime,
  isCouponExpired,
  isCouponNotStarted,
} = require('../utils/couponSchedule');

function sanitizeCouponPayload(body = {}) {
  const payload = {};
  if (body.code !== undefined) payload.code = String(body.code || '').trim().toUpperCase();
  if (body.description !== undefined) payload.description = String(body.description || '').trim();

  if (body.discountType !== undefined) {
    const type = String(body.discountType || 'percent').toLowerCase();
    payload.discountType = type === 'flat' ? 'flat' : 'percent';
  }

  if (body.discountPercent !== undefined) {
    payload.discountPercent = Math.min(100, Math.max(0, Number(body.discountPercent) || 0));
  }
  if (body.maxDiscountAmount !== undefined) {
    payload.maxDiscountAmount = Math.max(0, Number(body.maxDiscountAmount) || 0);
  }
  if (body.flatDiscountAmount !== undefined) {
    payload.flatDiscountAmount = Math.max(0, Math.round(Number(body.flatDiscountAmount) || 0));
  }
  if (body.minAmount !== undefined) {
    payload.minAmount = Math.max(0, Math.round(Number(body.minAmount) || 0));
  }

  if (body.active !== undefined) payload.active = Boolean(body.active);
  if (body.startsAt !== undefined) payload.startsAt = parseAdminDateTime(body.startsAt, 'start');
  if (body.expiresAt !== undefined) payload.expiresAt = parseAdminDateTime(body.expiresAt, 'end');
  if (body.maxTotalUses !== undefined) payload.maxTotalUses = Math.max(0, Number(body.maxTotalUses) || 0);
  if (body.maxUsesPerUser !== undefined) payload.maxUsesPerUser = Math.max(1, Number(body.maxUsesPerUser) || 1);
  if (body.minPeople !== undefined) payload.minPeople = Math.min(50, Math.max(1, Number(body.minPeople) || 1));
  if (body.maxPeople !== undefined) {
    const maxPeople = Math.max(0, Number(body.maxPeople) || 0);
    payload.maxPeople = maxPeople > 50 ? 50 : maxPeople;
  }
  if (body.applicableEntityTypes !== undefined) {
    payload.applicableEntityTypes = Array.isArray(body.applicableEntityTypes)
      ? body.applicableEntityTypes.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
  }

  const minP = payload.minPeople;
  const maxP = payload.maxPeople;
  if (minP != null && maxP != null && maxP > 0 && maxP < minP) {
    throw new Error('Max people cannot be less than min people.');
  }

  return payload;
}

function peopleRuleLabel(coupon) {
  const min = Math.max(1, Number(coupon.minPeople) || 1);
  const max = Math.max(0, Number(coupon.maxPeople) || 0);
  if (min <= 1 && max <= 0) return 'Anyone (1+ people)';
  if (max > 0 && max === min) return `Exactly ${min} people`;
  if (max > 0) return `${min}–${max} people`;
  return `At least ${min} people`;
}

function discountLabel(coupon) {
  const type = String(coupon.discountType || 'percent').toLowerCase();
  if (type === 'flat') {
    const amount = Math.max(0, Number(coupon.flatDiscountAmount) || 0);
    return `₹${amount} off`;
  }
  const percent = Number(coupon.discountPercent) || 0;
  const cap = Number(coupon.maxDiscountAmount) || 0;
  return cap > 0 ? `${percent}% off (max ₹${cap})` : `${percent}% off`;
}

function assertDiscountValid(payload, { isCreate = false } = {}) {
  const type = payload.discountType
    || (isCreate ? 'percent' : undefined);

  if (type === 'flat') {
    const flat = Number(payload.flatDiscountAmount);
    if (!Number.isFinite(flat) || flat <= 0) {
      throw new Error('Enter a flat discount amount in ₹ (greater than 0).');
    }
  } else if (type === 'percent' || (isCreate && payload.discountPercent != null)) {
    const percent = Number(payload.discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      throw new Error('Discount percent must be between 1 and 100.');
    }
  } else if (isCreate) {
    throw new Error('Choose percent (%) or flat (₹) discount.');
  }
}

exports.listCoupons = async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  const couponIds = coupons.map((c) => c._id);
  const usage = await CouponUsage.aggregate([
    { $match: { couponId: { $in: couponIds } } },
    { $group: { _id: '$couponId', userCount: { $sum: 1 } } },
  ]);
  const usageMap = new Map(usage.map((x) => [String(x._id), x.userCount]));
  const now = Date.now();
  res.json({
    coupons: coupons.map((c) => {
      const expired = isCouponExpired(c.expiresAt, new Date(now));
      const notStarted = isCouponNotStarted(c.startsAt, new Date(now));
      return {
        ...c,
        discountType: c.discountType || 'percent',
        flatDiscountAmount: Math.max(0, Number(c.flatDiscountAmount) || 0),
        minPeople: Math.max(1, Number(c.minPeople) || 1),
        maxPeople: Math.max(0, Number(c.maxPeople) || 0),
        peopleRuleLabel: peopleRuleLabel(c),
        discountLabel: discountLabel(c),
        userCount: usageMap.get(String(c._id)) || 0,
        remainingUses:
          c.maxTotalUses > 0 ? Math.max(0, Number(c.maxTotalUses) - Number(c.usedCount || 0)) : null,
        isExpired: expired,
        isNotStarted: notStarted,
        /** Usable right now (active + in window) */
        isLive: Boolean(c.active) && !expired && !notStarted,
      };
    }),
  });
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ message: 'Coupon code is required' });
    if (!payload.discountType) payload.discountType = 'percent';
    assertDiscountValid(payload, { isCreate: true });
    if (payload.discountType === 'flat') {
      payload.discountPercent = 0;
      payload.maxDiscountAmount = 0;
    } else {
      payload.flatDiscountAmount = 0;
      if (payload.maxDiscountAmount == null) payload.maxDiscountAmount = 0;
    }
    if (payload.minPeople == null) payload.minPeople = 1;
    if (payload.maxPeople == null) payload.maxPeople = 0;
    const coupon = await Coupon.create(payload);
    res.status(201).json({ coupon });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({
        message: 'That coupon code already exists. Delete the old coupon first to reuse this code.',
      });
    }
    res.status(400).json({ message: err.message || 'Failed to create coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    if (payload.discountType || payload.discountPercent != null || payload.flatDiscountAmount != null) {
      const existing = await Coupon.findById(req.params.couponId).lean();
      if (!existing) return res.status(404).json({ message: 'Coupon not found' });
      const merged = {
        discountType: payload.discountType || existing.discountType || 'percent',
        discountPercent: payload.discountPercent != null ? payload.discountPercent : existing.discountPercent,
        flatDiscountAmount: payload.flatDiscountAmount != null
          ? payload.flatDiscountAmount
          : existing.flatDiscountAmount,
      };
      assertDiscountValid(merged, { isCreate: true });
      payload.discountType = merged.discountType;
      if (merged.discountType === 'flat') {
        payload.discountPercent = 0;
        payload.maxDiscountAmount = 0;
      } else {
        payload.flatDiscountAmount = 0;
      }
    }
    // Changing code: ensure uniqueness excluding this doc
    if (payload.code) {
      const clash = await Coupon.findOne({
        code: payload.code,
        _id: { $ne: req.params.couponId },
      }).select('_id').lean();
      if (clash) {
        return res.status(400).json({ message: `Code ${payload.code} is already used by another coupon.` });
      }
    }
    const coupon = await Coupon.findByIdAndUpdate(req.params.couponId, payload, { new: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ coupon });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'That coupon code already exists. Delete the old one first, or pick a new code.' });
    }
    res.status(400).json({ message: err.message || 'Failed to update coupon' });
  }
};

/** Hard-delete coupon so the same code can be created again. Also clears usage history. */
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.couponId);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    await CouponUsage.deleteMany({ couponId: coupon._id });
    res.json({
      success: true,
      message: `Deleted ${coupon.code}. You can create this code again.`,
      code: coupon.code,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to delete coupon' });
  }
};

/**
 * Reset total + per-user usage counters so the coupon can be applied again
 * without deleting/recreating it.
 */
exports.resetCouponUsage = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    const usageDeleted = await CouponUsage.deleteMany({ couponId: coupon._id });
    coupon.usedCount = 0;
    await coupon.save();
    res.json({
      success: true,
      coupon,
      message: `Reset usage for ${coupon.code}. Cleared ${usageDeleted.deletedCount || 0} user use records.`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to reset coupon usage' });
  }
};
