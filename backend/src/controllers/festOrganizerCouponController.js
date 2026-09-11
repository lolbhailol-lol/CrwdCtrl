const mongoose = require('mongoose');
const Coupon = require('../model/coupon_model');
const CouponUsage = require('../model/coupon_usage_model');
const Competition = require('../model/competition_model');
const {
  parseAdminDateTime,
  isCouponExpired,
  isCouponNotStarted,
} = require('../utils/couponSchedule');

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
    && String(value).length === 24;
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

function assertDiscountValid(payload) {
  const type = payload.discountType || 'percent';
  if (type === 'flat') {
    const flat = Number(payload.flatDiscountAmount);
    if (!Number.isFinite(flat) || flat <= 0) {
      throw new Error('Enter a rupee discount greater than 0.');
    }
  } else {
    const percent = Number(payload.discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      throw new Error('Discount percent must be between 1 and 100.');
    }
  }
}

async function resolveCompetitionIds(festId, rawIds) {
  const requested = (Array.isArray(rawIds) ? rawIds : [])
    .map((id) => String(id || '').trim())
    .filter(isObjectId);
  if (!requested.length) return [];

  const unique = [...new Set(requested)];
  const rows = await Competition.find({
    _id: { $in: unique },
    fest: festId,
  }).select('_id').lean();
  if (rows.length !== unique.length) {
    throw new Error('One or more competitions do not belong to this fest.');
  }
  return unique;
}

function sanitizeOrganizerPayload(body = {}, { isCreate = false } = {}) {
  const payload = {};
  if (isCreate || body.code !== undefined) {
    payload.code = String(body.code || '').trim().toUpperCase();
  }
  if (body.description !== undefined || isCreate) {
    payload.description = String(body.description || '').trim();
  }

  if (body.discountType !== undefined || isCreate) {
    const type = String(body.discountType || 'percent').toLowerCase();
    payload.discountType = type === 'flat' ? 'flat' : 'percent';
  }
  if (body.discountPercent !== undefined || isCreate) {
    payload.discountPercent = Math.min(100, Math.max(0, Number(body.discountPercent) || 0));
  }
  if (body.maxDiscountAmount !== undefined || isCreate) {
    payload.maxDiscountAmount = Math.max(0, Number(body.maxDiscountAmount) || 0);
  }
  if (body.flatDiscountAmount !== undefined || isCreate) {
    payload.flatDiscountAmount = Math.max(0, Math.round(Number(body.flatDiscountAmount) || 0));
  }
  if (body.minAmount !== undefined || isCreate) {
    payload.minAmount = Math.max(0, Math.round(Number(body.minAmount) || 0));
  }

  if (body.active !== undefined || isCreate) payload.active = body.active !== false;
  if (body.startsAt !== undefined || isCreate) payload.startsAt = parseAdminDateTime(body.startsAt, 'start');
  if (body.expiresAt !== undefined || isCreate) payload.expiresAt = parseAdminDateTime(body.expiresAt, 'end');
  if (body.maxTotalUses !== undefined || isCreate) {
    payload.maxTotalUses = Math.max(0, Number(body.maxTotalUses) || 0);
  }
  if (body.maxUsesPerUser !== undefined || isCreate) {
    payload.maxUsesPerUser = Math.max(1, Number(body.maxUsesPerUser) || 1);
  }
  if (body.minPeople !== undefined || isCreate) {
    payload.minPeople = Math.min(50, Math.max(1, Number(body.minPeople) || 1));
  }
  if (body.maxPeople !== undefined || isCreate) {
    const maxPeople = Math.max(0, Number(body.maxPeople) || 0);
    payload.maxPeople = maxPeople > 50 ? 50 : maxPeople;
  }

  const minP = payload.minPeople;
  const maxP = payload.maxPeople;
  if (minP != null && maxP != null && maxP > 0 && maxP < minP) {
    throw new Error('Max people cannot be less than min people.');
  }

  if (payload.discountType === 'flat') {
    payload.discountPercent = 0;
    payload.maxDiscountAmount = 0;
  } else if (payload.discountType === 'percent') {
    payload.flatDiscountAmount = 0;
  }

  return payload;
}

function serializeCoupon(coupon, { userCount = 0, competitions = [] } = {}) {
  const now = new Date();
  const expired = isCouponExpired(coupon.expiresAt, now);
  const notStarted = isCouponNotStarted(coupon.startsAt, now);
  const compIds = (coupon.competitionIds || []).map((id) => String(id));
  const named = competitions.filter((c) => compIds.includes(String(c.id || c._id)));
  return {
    id: String(coupon._id),
    code: coupon.code,
    description: coupon.description || '',
    discountType: coupon.discountType || 'percent',
    discountPercent: Number(coupon.discountPercent) || 0,
    maxDiscountAmount: Number(coupon.maxDiscountAmount) || 0,
    flatDiscountAmount: Number(coupon.flatDiscountAmount) || 0,
    minAmount: Number(coupon.minAmount) || 0,
    active: Boolean(coupon.active),
    startsAt: coupon.startsAt || null,
    expiresAt: coupon.expiresAt || null,
    maxTotalUses: Number(coupon.maxTotalUses) || 0,
    maxUsesPerUser: Number(coupon.maxUsesPerUser) || 1,
    usedCount: Number(coupon.usedCount) || 0,
    minPeople: Math.max(1, Number(coupon.minPeople) || 1),
    maxPeople: Math.max(0, Number(coupon.maxPeople) || 0),
    competitionIds: compIds,
    competitionNames: named.map((c) => c.name).filter(Boolean),
    allCompetitions: !compIds.length,
    peopleRuleLabel: peopleRuleLabel(coupon),
    discountLabel: discountLabel(coupon),
    userCount,
    remainingUses:
      Number(coupon.maxTotalUses) > 0
        ? Math.max(0, Number(coupon.maxTotalUses) - Number(coupon.usedCount || 0))
        : null,
    isExpired: expired,
    isNotStarted: notStarted,
    isLive: Boolean(coupon.active) && !expired && !notStarted,
  };
}

async function loadFestCompetitions(festId) {
  const rows = await Competition.find({ fest: festId }).select('_id name').sort({ name: 1 }).lean();
  return rows.map((c) => ({ id: String(c._id), name: c.name || 'Competition' }));
}

async function usageMapFor(coupons) {
  const couponIds = coupons.map((c) => c._id);
  if (!couponIds.length) return new Map();
  const usage = await CouponUsage.aggregate([
    { $match: { couponId: { $in: couponIds } } },
    { $group: { _id: '$couponId', userCount: { $sum: 1 } } },
  ]);
  return new Map(usage.map((x) => [String(x._id), x.userCount]));
}

exports.listCoupons = async (req, res) => {
  try {
    const festId = req.festId;
    const [coupons, competitions] = await Promise.all([
      Coupon.find({ festId }).sort({ createdAt: -1 }).lean(),
      loadFestCompetitions(festId),
    ]);
    const usageMap = await usageMapFor(coupons);
    res.json({
      success: true,
      competitions,
      coupons: coupons.map((c) => serializeCoupon(c, {
        userCount: usageMap.get(String(c._id)) || 0,
        competitions,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load coupons' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const festId = req.festId;
    const payload = sanitizeOrganizerPayload(req.body, { isCreate: true });
    if (!payload.code) return res.status(400).json({ success: false, message: 'Coupon code is required' });
    assertDiscountValid(payload);

    const competitionIds = await resolveCompetitionIds(festId, req.body.competitionIds);
    const competitions = await loadFestCompetitions(festId);

    const coupon = await Coupon.create({
      ...payload,
      festId,
      competitionIds,
      applicableEntityTypes: ['competition'],
    });

    res.status(201).json({
      success: true,
      coupon: serializeCoupon(coupon.toObject(), { competitions }),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'That coupon code already exists. Pick a different code.',
      });
    }
    res.status(400).json({ success: false, message: err.message || 'Failed to create coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const festId = req.festId;
    const existing = await Coupon.findOne({ _id: req.params.couponId, festId });
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const payload = sanitizeOrganizerPayload(req.body, { isCreate: false });
    if (payload.discountType || payload.discountPercent != null || payload.flatDiscountAmount != null) {
      const merged = {
        discountType: payload.discountType || existing.discountType || 'percent',
        discountPercent: payload.discountPercent != null ? payload.discountPercent : existing.discountPercent,
        flatDiscountAmount: payload.flatDiscountAmount != null
          ? payload.flatDiscountAmount
          : existing.flatDiscountAmount,
      };
      assertDiscountValid(merged);
      payload.discountType = merged.discountType;
      if (merged.discountType === 'flat') {
        payload.discountPercent = 0;
        payload.maxDiscountAmount = 0;
      } else {
        payload.flatDiscountAmount = 0;
      }
    }

    if (payload.code) {
      const clash = await Coupon.findOne({
        code: payload.code,
        _id: { $ne: existing._id },
      }).select('_id').lean();
      if (clash) {
        return res.status(400).json({
          success: false,
          message: `Code ${payload.code} is already used by another coupon.`,
        });
      }
    }

    if (req.body.competitionIds !== undefined) {
      payload.competitionIds = await resolveCompetitionIds(festId, req.body.competitionIds);
    }

    Object.assign(existing, payload);
    await existing.save();

    const competitions = await loadFestCompetitions(festId);
    const usageMap = await usageMapFor([existing]);
    res.json({
      success: true,
      coupon: serializeCoupon(existing.toObject(), {
        userCount: usageMap.get(String(existing._id)) || 0,
        competitions,
      }),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ success: false, message: 'That coupon code already exists.' });
    }
    res.status(400).json({ success: false, message: err.message || 'Failed to update coupon' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndDelete({
      _id: req.params.couponId,
      festId: req.festId,
    });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    await CouponUsage.deleteMany({ couponId: coupon._id });
    res.json({
      success: true,
      message: `Deleted ${coupon.code}. You can create this code again.`,
      code: coupon.code,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Failed to delete coupon' });
  }
};
