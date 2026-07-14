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
  if (body.discountPercent !== undefined) {
    payload.discountPercent = Math.min(100, Math.max(1, Number(body.discountPercent) || 1));
  }
  if (body.maxDiscountAmount !== undefined) {
    payload.maxDiscountAmount = Math.max(0, Number(body.maxDiscountAmount) || 0);
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
        minPeople: Math.max(1, Number(c.minPeople) || 1),
        maxPeople: Math.max(0, Number(c.maxPeople) || 0),
        peopleRuleLabel: peopleRuleLabel(c),
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
    if (payload.discountPercent == null) {
      return res.status(400).json({ message: 'Discount percent is required' });
    }
    if (payload.maxDiscountAmount == null) payload.maxDiscountAmount = 0;
    if (payload.minPeople == null) payload.minPeople = 1;
    if (payload.maxPeople == null) payload.maxPeople = 0;
    const coupon = await Coupon.create(payload);
    res.status(201).json({ coupon });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    const coupon = await Coupon.findByIdAndUpdate(req.params.couponId, payload, { new: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ coupon });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update coupon' });
  }
};
