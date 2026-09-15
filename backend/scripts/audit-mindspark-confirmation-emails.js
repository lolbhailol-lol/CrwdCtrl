/**
 * Audit MindSpark confirmation emails against Resend history.
 *
 * Dry run (default):
 *   RESEND_AUDIT_API_KEY=... node scripts/audit-mindspark-confirmation-emails.js
 *
 * Send only registrations with no matching Resend email:
 *   RESEND_AUDIT_API_KEY=... node scripts/audit-mindspark-confirmation-emails.js --send
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { Resend } = require('resend');
const Fest = require('../src/model/fest_organizer_model');
require('../src/model/usermodel');
require('../src/model/competition_model');
const Registration = require('../src/model/registration_model');
const { sendCompetitionRegistrationEmailForRecord } = require('../src/services/emailService');

const SEND = process.argv.includes('--send');
const DAYS = 10;
const SUCCESS_EVENTS = new Set(['sent', 'delivered', 'opened', 'clicked']);
const FAILURE_EVENTS = new Set(['failed', 'bounced', 'suppressed', 'complained', 'canceled']);

function extractRegistrationIds(html = '', text = '') {
  const ids = new Set();
  const content = `${html || ''}\n${text || ''}`;
  const patterns = [
    /(?:qr-ticket|registration-details)\/([a-f\d]{24})/gi,
    /(?:registration|booking)(?:%20|\s|&nbsp;)*id[^a-f\d]*([a-f\d]{24})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) ids.add(match[1].toLowerCase());
  }
  return ids;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getEmailWithRetry(resend, emailId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await delay(275);
    const response = await resend.emails.get(emailId);
    if (!response.error) return response.data;
    const isRateLimit = response.error.statusCode === 429
      || /too many requests|rate limit/i.test(response.error.message || '');
    if (!isRateLimit || attempt === 4) {
      throw new Error(`Resend get failed for ${emailId}: ${response.error.message}`);
    }
    await delay(500 * (attempt + 1));
  }
  throw new Error(`Resend get failed for ${emailId}`);
}

async function listRecentEmails(resend, cutoff) {
  const rows = [];
  let after;
  for (let page = 0; page < 50; page += 1) {
    const response = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) });
    if (response.error) throw new Error(`Resend list failed: ${response.error.message}`);
    const batch = response.data?.data || [];
    rows.push(...batch);
    const oldest = batch[batch.length - 1];
    if (!response.data?.has_more || !oldest || new Date(oldest.created_at) < cutoff) break;
    after = oldest.id;
  }
  return rows.filter((email) => new Date(email.created_at) >= cutoff);
}

async function main() {
  const auditKey = String(process.env.RESEND_AUDIT_API_KEY || '').trim();
  if (!auditKey) throw new Error('RESEND_AUDIT_API_KEY is required');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  await mongoose.connect(process.env.MONGODB_URI);

  const fests = await Fest.find({
    $or: [{ festName: /mindspark/i }, { name: /mindspark/i }],
  }).select('_id festName name venue startDate coverImage registration').lean();
  if (!fests.length) throw new Error('MindSpark fest not found');

  const registrations = await Registration.find({
    fest: { $in: fests.map((fest) => fest._id) },
    submittedAt: { $gte: cutoff },
    isProShow: { $ne: true },
    status: 'approved',
    paymentStatus: 'paid',
  })
    .populate('user', 'email name')
    .populate('competitionId')
    .lean();

  const resend = new Resend(auditKey);
  const recentEmails = await listRecentEmails(resend, cutoff);
  const recipientSet = new Set(
    registrations.map((registration) => String(registration.user?.email || '').trim().toLowerCase())
  );
  const candidates = recentEmails.filter((email) =>
    (email.to || []).some((to) => recipientSet.has(String(to).trim().toLowerCase()))
    && /(you.?re in|registration|booking|ticket)/i.test(email.subject || '')
  );

  const details = await mapLimit(candidates, 2, (email) => getEmailWithRetry(resend, email.id));

  const evidenceByRegistration = new Map();
  for (const email of details) {
    for (const registrationId of extractRegistrationIds(email.html, email.text)) {
      const evidence = evidenceByRegistration.get(registrationId) || [];
      evidence.push({ id: email.id, event: email.last_event, createdAt: email.created_at });
      evidenceByRegistration.set(registrationId, evidence);
    }
  }

  const missing = [];
  const failedOnly = [];
  const confirmed = [];
  for (const registration of registrations) {
    const id = String(registration._id).toLowerCase();
    const evidence = evidenceByRegistration.get(id) || [];
    if (!evidence.length) missing.push(registration);
    else if (evidence.every((item) => FAILURE_EVENTS.has(item.event))) failedOnly.push(registration);
    else if (evidence.some((item) => SUCCESS_EVENTS.has(item.event))) confirmed.push(registration);
    else confirmed.push(registration); // queued/scheduled email exists; do not duplicate it
  }

  console.log(JSON.stringify({
    mode: SEND ? 'send' : 'dry-run',
    cutoff: cutoff.toISOString(),
    registrations: registrations.length,
    resendEmailsScanned: recentEmails.length,
    candidateEmailsInspected: candidates.length,
    confirmedByExactBookingId: confirmed.length,
    failedOrBouncedExisting: failedOnly.length,
    missing: missing.length,
    missingRegistrationIds: missing.map((registration) => String(registration._id)),
    failedRegistrationIds: failedOnly.map((registration) => String(registration._id)),
  }, null, 2));

  if (!SEND || !missing.length) return;

  const festById = new Map(fests.map((fest) => [String(fest._id), fest]));
  const delivery = [];
  for (const registration of missing) {
    const id = String(registration._id);
    const result = await sendCompetitionRegistrationEmailForRecord({
      user: registration.user,
      fest: festById.get(String(registration.fest)),
      competition: registration.competitionId,
      registration,
    });
    delivery.push({ id, success: Boolean(result?.success), messageId: result?.messageId || null, error: result?.error || null });
  }

  console.log(JSON.stringify({
    sent: delivery.filter((item) => item.success).length,
    failed: delivery.filter((item) => !item.success).length,
    delivery,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
