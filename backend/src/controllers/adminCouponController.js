const Coupon = require('../model/coupon_model');
const CouponUsage = require('../model/coupon_usage_model');

function sanitizeCouponPayload(body = {}) {
  const payload = {};
  if (body.code !== undefined) payload.code = String(body.code || '').trim().toUpperCase();
  if (body.description !== undefined) payload.description = String(body.description || '').trim();
  if (body.discountPercent !== undefined) payload.discountPercent = Number(body.discountPercent);
  if (body.maxDiscountAmount !== undefined) payload.maxDiscountAmount = Number(body.maxDiscountAmount);
  if (body.active !== undefined) payload.active = Boolean(body.active);
  if (body.startsAt !== undefined) payload.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.expiresAt !== undefined) payload.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.maxTotalUses !== undefined) payload.maxTotalUses = Math.max(0, Number(body.maxTotalUses) || 0);
  if (body.maxUsesPerUser !== undefined) payload.maxUsesPerUser = Math.max(1, Number(body.maxUsesPerUser) || 1);
  if (body.applicableEntityTypes !== undefined) {
    payload.applicableEntityTypes = Array.isArray(body.applicableEntityTypes)
      ? body.applicableEntityTypes.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
  }
  return payload;
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
    coupons: coupons.map((c) => ({
      ...c,
      userCount: usageMap.get(String(c._id)) || 0,
      remainingUses:
        c.maxTotalUses > 0 ? Math.max(0, Number(c.maxTotalUses) - Number(c.usedCount || 0)) : null,
      isExpired: c.expiresAt ? new Date(c.expiresAt).getTime() < now : false,
    })),
  });
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ message: 'Coupon code is required' });
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

