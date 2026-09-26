/**
 * Touch Grass 07 — female rate coupon (same pattern as TG05F / TG06F).
 * Female → TG07F → ₹499 instead of ₹529.
 *
 * Run: node scripts/setup-touch-grass-07-female-coupon.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const Coupon = require('../src/model/coupon_model');

const SLUG = 'touch-grass-07';
const CODE = 'TG07F';
const FEE = 529;
const FEMALE_FEE = 499;
const PCT = ((FEE - FEMALE_FEE) / FEE) * 100;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const event = await SportsEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event not found: ${SLUG}`);

  let coupon = await Coupon.findOne({ code: CODE });
  const couponPayload = {
    code: CODE,
    description: 'Touch Grass 07 female rate — ₹499 instead of ₹529',
    discountType: 'percent',
    discountPercent: PCT,
    flatDiscountAmount: 0,
    maxDiscountAmount: 0,
    active: true,
    startsAt: null,
    expiresAt: new Date('2026-09-26T18:30:00.000Z'),
    maxTotalUses: 0,
    maxUsesPerUser: 5,
    minPeople: 1,
    maxPeople: 0,
    minAmount: 0,
    festId: null,
    competitionIds: [],
    applicableEntityTypes: ['sports'],
  };
  if (coupon) {
    Object.assign(coupon, couponPayload);
    await coupon.save();
  } else {
    coupon = await Coupon.create(couponPayload);
  }

  const schema = Array.isArray(event.registration?.formSchema)
    ? event.registration.formSchema.map((f) => (f.toObject ? f.toObject() : { ...f }))
    : [];
  const genderIdx = schema.findIndex((f) =>
    String(f.fieldName || '').toLowerCase() === 'gender'
    || /^gender$/i.test(String(f.label || '')),
  );
  if (genderIdx < 0) throw new Error('Gender field missing on Touch Grass 07');

  schema[genderIdx].optionCoupons = { Female: CODE };
  if (!schema[genderIdx].bookingStep) schema[genderIdx].bookingStep = 1;

  event.registration.formSchema = schema;
  event.markModified('registration');
  await event.save();

  console.log(JSON.stringify({
    ok: true,
    event: event.title,
    slug: event.slug,
    fee: event.registrationFee,
    coupon: {
      code: coupon.code,
      percent: coupon.discountPercent,
      femaleFee: FEMALE_FEE,
      active: coupon.active,
    },
    genderOptionCoupons: schema[genderIdx].optionCoupons,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
