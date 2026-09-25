/**
 * Send today's missing MindSpark booking confirmations.
 * The approved WhatsApp template links to Registration Details, which shows
 * the correct competition group CTA after the accompanying deploy.
 *
 * Usage:
 *   node scripts/backfill-mindspark-whatsapp.js --dry-run
 *   node scripts/backfill-mindspark-whatsapp.js --send
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('../src/model/registration_model');
const Bundle = require('../src/model/mindspark_bundle_model');
require('../src/model/usermodel');
require('../src/model/competition_model');
require('../src/model/fest_organizer_model');
const { sendBookingConfirmedWhatsApp, resolveBookingPhone } = require('../src/utils/bookingWhatsApp');
const { sendBundleWhatsAppOnce } = require('../src/services/mindsparkBundleService');

const FEST_ID = '6a7f1010ed26d983b34e55c2';

function startOfTodayInIndia() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+05:30`);
}

async function main() {
  const send = process.argv.includes('--send');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing Mongo URI');
  await mongoose.connect(uri);
  const registrations = await Registration.find({
    fest: FEST_ID,
    status: 'approved',
    paymentStatus: 'paid',
    isProShow: { $ne: true },
    createdAt: { $gte: startOfTodayInIndia() },
  })
    .populate('user', 'name phoneNumber phone')
    .populate('competitionId', 'name registration.whatsappGroupLink')
    .populate('fest', 'festName festDate startDate registration.whatsappCommunityLink')
    .sort({ createdAt: 1 });

  const stats = {
    mode: send ? 'send' : 'dry-run', totalPaidRegistrations: registrations.length,
    normalCandidates: 0, bundleCandidates: 0, alreadyTracked: 0,
    missingGroupLink: 0, missingPhone: 0, accepted: 0, failed: 0,
  };
  const bundleIds = new Set();

  for (const registration of registrations) {
    const responses = registration.responses instanceof Map
      ? Object.fromEntries(registration.responses)
      : (registration.responses || {});
    const bundleId = String(responses.mindspark_bundle_id || '').trim();
    if (bundleId) {
      bundleIds.add(bundleId);
      continue;
    }
    if (registration.confirmationWhatsAppSentAt) {
      stats.alreadyTracked += 1;
      continue;
    }
    const groupLink = String(
      registration.competitionId?.registration?.whatsappGroupLink
      || registration.fest?.registration?.whatsappCommunityLink
      || '',
    ).trim();
    if (!groupLink) {
      stats.missingGroupLink += 1;
      continue;
    }
    if (!resolveBookingPhone({ user: registration.user, responses })) {
      stats.missingPhone += 1;
      continue;
    }
    stats.normalCandidates += 1;
    if (!send) continue;
    const result = await sendBookingConfirmedWhatsApp({
      user: registration.user,
      responses,
      name: registration.user?.name || responses.full_name,
      eventName: registration.competitionId?.name || 'MindSpark competition',
      bookingId: registration._id,
      date: registration.fest?.festDate || registration.fest?.startDate || '',
      amount: registration.amountPaid,
    });
    if (result?.success) {
      registration.confirmationWhatsAppSentAt = new Date();
      await registration.save();
      stats.accepted += 1;
    } else {
      stats.failed += 1;
    }
  }

  const bundles = bundleIds.size
    ? await Bundle.find({ _id: { $in: [...bundleIds] }, status: 'paid' }).select('confirmationWhatsAppSentAt')
    : [];
  for (const bundle of bundles) {
    if (bundle.confirmationWhatsAppSentAt) {
      stats.alreadyTracked += 1;
      continue;
    }
    stats.bundleCandidates += 1;
    if (!send) continue;
    const result = await sendBundleWhatsAppOnce(bundle._id);
    if (result?.sent) stats.accepted += 1;
    else stats.failed += 1;
  }

  console.log(JSON.stringify(stats, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
