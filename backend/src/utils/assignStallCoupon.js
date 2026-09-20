'use strict';

const StallCoupon = require('../model/stall_coupon_model');
const { generateUniqueStallCouponCode } = require('./generateStallCouponCode');
const { logger } = require('./logger');

function resolveDiscountPercent(fest, coupon) {
  const fromCoupon = Number(coupon?.discountPercent);
  if (Number.isFinite(fromCoupon) && fromCoupon > 0) return fromCoupon;
  const fromFest = Number(fest?.stallDiscountPercent);
  if (Number.isFinite(fromFest) && fromFest > 0) return fromFest;
  return 20;
}

/**
 * If fest has stallBrand, ensure this user has one coupon for that fest.
 * Never throws — registration must succeed even if coupon fails.
 * @returns {{ code: string, brand: string, discountPercent: number } | null}
 */
async function assignStallCouponIfEligible({ fest, userId }) {
  const brand = String(fest?.stallBrand || '').trim();
  const festId = fest?._id || fest;
  if (!brand || !festId || !userId) return null;

  const discountPercent = resolveDiscountPercent(fest, null);

  try {
    let stallCoupon = await StallCoupon.findOne({ festId, userId });
    if (!stallCoupon) {
      const code = await generateUniqueStallCouponCode();
      try {
        stallCoupon = await StallCoupon.create({
          festId,
          userId,
          brand,
          discountPercent,
          code,
        });
        logger.debug('🎟️ Stall coupon assigned:', code, `${discountPercent}% OFF`);
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          stallCoupon = await StallCoupon.findOne({ festId, userId });
        } else {
          throw dupErr;
        }
      }
    }
    if (!stallCoupon) return null;
    return {
      code: stallCoupon.code,
      brand: stallCoupon.brand,
      discountPercent: resolveDiscountPercent(fest, stallCoupon),
    };
  } catch (err) {
    logger.error('❌ Stall coupon assignment failed:', err.message);
    return null;
  }
}

module.exports = { assignStallCouponIfEligible };
