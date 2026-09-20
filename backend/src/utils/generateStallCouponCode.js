const StallCoupon = require('../model/stall_coupon_model');

// O/0, I/1 jaise confusing characters hata diye — stall pe manually padhna easy rahega
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 5) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/** Svvad Pro branded codes: SV + 5 chars (e.g. SV7K3MP) */
async function generateUniqueStallCouponCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `SV${randomSuffix(5)}`;
    const exists = await StallCoupon.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique coupon code, please retry');
}

module.exports = { generateUniqueStallCouponCode };
