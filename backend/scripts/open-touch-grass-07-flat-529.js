/**
 * Touch Grass 07 — remove Gender (Male/Female) step; flat ₹529 open booking.
 * Disables TG07F / TG07M and gender seat quotas.
 *
 * Run: node scripts/open-touch-grass-07-flat-529.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const Coupon = require('../src/model/coupon_model');

const SLUG = 'touch-grass-07';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const event = await SportsEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event not found: ${SLUG}`);

  const schema = Array.isArray(event.registration?.formSchema)
    ? event.registration.formSchema
      .map((f) => (f.toObject ? f.toObject() : { ...f }))
      .filter((f) => String(f.fieldName || '').toLowerCase() !== 'gender'
        && !/^gender$/i.test(String(f.label || '')))
    : [];

  event.registrationFee = 529;
  event.registration.formSchema = schema;
  event.registration.genderQuotas = {
    enabled: false,
    femaleSeats: 0,
    maleSeats: 0,
    othersSeats: 0,
  };
  event.registration.genderPhase = 'all';
  event.markModified('registration');
  await event.save();

  await Coupon.updateMany(
    { code: { $in: ['TG07F', 'TG07M'] } },
    { $set: { active: false } },
  );

  const coupons = await Coupon.find({ code: /TG07/i }).select('code active').lean();
  console.log(JSON.stringify({
    ok: true,
    slug: event.slug,
    fee: event.registrationFee,
    formFields: schema.map((f) => f.fieldName),
    genderQuotas: event.registration.genderQuotas,
    coupons,
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
