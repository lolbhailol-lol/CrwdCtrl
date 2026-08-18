const Registration = require('../model/registration_model');

/**
 * Unique payment_order_id can lose a race between webhook fulfill and client
 * register. Treat that as "already saved" instead of 500.
 */
async function saveRegistrationIdempotent(registration, query) {
  try {
    await registration.save();
    return { registration, created: true };
  } catch (err) {
    if (err?.code !== 11000 || !query?.payment_order_id) throw err;
    const existing = await Registration.findOne(query);
    if (existing) return { registration: existing, created: false };
    throw err;
  }
}

module.exports = { saveRegistrationIdempotent };
