/**
 * Resend MindSpark bundle confirmation emails with per-competition WhatsApp links.
 *
 * Dry run (default):
 *   node scripts/resend-mindspark-bundle-confirmation-emails.js
 *
 * Send:
 *   node scripts/resend-mindspark-bundle-confirmation-emails.js --send
 *
 * Single bundle:
 *   node scripts/resend-mindspark-bundle-confirmation-emails.js --send --bundle-id=<id>
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Bundle = require('../src/model/mindspark_bundle_model');
require('../src/model/usermodel');
const { resendMindSparkBundleConfirmationEmail } = require('../src/services/mindsparkBundleService');

const SEND = process.argv.includes('--send');
const bundleIdArg = process.argv.find((arg) => arg.startsWith('--bundle-id='));
const onlyBundleId = bundleIdArg ? bundleIdArg.split('=')[1]?.trim() : '';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const filter = {
    status: { $in: ['paid', 'paid_review'] },
    'items.registrationId': { $exists: true, $ne: null },
  };
  if (onlyBundleId) {
    filter._id = onlyBundleId;
  }

  const bundles = await Bundle.find(filter)
    .select('_id status confirmationEmailSentAt user items.competitionName items.registrationId')
    .populate('user', 'email name')
    .sort({ updatedAt: -1 })
    .lean();

  const eligible = bundles.filter((b) => Array.isArray(b.items) && b.items.length === 3
    && b.items.every((item) => item.registrationId));

  console.log(JSON.stringify({
    mode: SEND ? 'send' : 'dry-run',
    total: eligible.length,
    bundles: eligible.map((b) => ({
      id: String(b._id),
      status: b.status,
      email: b.user?.email || '',
      competitions: b.items.map((i) => i.competitionName),
      priorEmailSentAt: b.confirmationEmailSentAt || null,
    })),
  }, null, 2));

  if (!SEND) {
    console.log('\nPass --send to deliver emails (350ms between sends).');
    await mongoose.disconnect();
    return;
  }

  const results = { sent: 0, skipped: 0, failed: 0, details: [] };
  for (const row of eligible) {
    try {
      const outcome = await resendMindSparkBundleConfirmationEmail(row._id);
      if (outcome.sent) {
        results.sent += 1;
        results.details.push({ id: String(row._id), email: outcome.email, ok: true });
      } else {
        results.skipped += 1;
        results.details.push({ id: String(row._id), ok: false, reason: outcome.reason });
      }
    } catch (error) {
      results.failed += 1;
      results.details.push({ id: String(row._id), ok: false, error: error.message });
    }
    await delay(350);
  }

  console.log('\nDone:', JSON.stringify(results, null, 2));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
