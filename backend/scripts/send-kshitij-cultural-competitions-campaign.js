/**
 * Blast Kshitij cultural competitions outreach to participants of all cultural fests.
 *
 * Audience: unique emails from Registration on festType=cultural
 *           (pending/approved, non-pro-show), plus legacy CompetitionRegistration emails.
 * Excludes: Resend suppressions, already-registered Kshitij participants.
 *
 * Dry-run:  node scripts/send-kshitij-cultural-competitions-campaign.js
 * Send:     node scripts/send-kshitij-cultural-competitions-campaign.js --send
 *
 * Required: RESEND_API_KEY or RESEND_AUDIT_API_KEY, MONGODB_URI
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const Fest = require('../src/model/fest_organizer_model');
const Registration = require('../src/model/registration_model');
const CompetitionRegistration = require('../src/model/competition_registration_model');
const User = require('../src/model/usermodel');

const SHOULD_SEND = process.argv.includes('--send');
const TEMPLATE_NAME = 'Kshitij Pune Multicity — Cultural Competitions';
const TEMPLATE_ALIAS = 'kshitij-pune-multicity-cultural-competitions-2026';
const SUBJECT = 'Kshitij Pune Multicity cultural comps are open — register on CrwdCtrl';
const FROM = 'CrwdCtrl <onboarding@crwdctrl.in>';
const REPLY_TO = 'team.crwdctrl@gmail.com';
const KSHITIJ_SLUG = 'kshitij-pune-multicity-event-2026';
const KSHITIJ_LEGACY_SLUG = 'kshitij-pune-regionals-2026';
const CAMPAIGN_TAG = 'kshitij-cultural-2026';
const IDEMPOTENCY_PREFIX = 'kshitij-cultural-2026-cultural-fests-v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function responsesToObject(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses === 'object') return responses;
  return {};
}

function pickEmail(user, responses = {}) {
  const members = responses.team_members;
  const leadEmail = Array.isArray(members) && members[0] && typeof members[0] === 'object'
    ? String(members[0].email || '').trim().toLowerCase()
    : '';
  const email = String(user?.email || responses.email || leadEmail || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
}

async function listSuppressions(resend) {
  const rows = [];
  let after;
  for (let page = 0; page < 100; page += 1) {
    const response = await resend.suppressions.list({ limit: 100, ...(after ? { after } : {}) });
    if (response.error) throw new Error(`Unable to list suppressions: ${response.error.message}`);
    const batch = response.data?.data || [];
    rows.push(...batch);
    if (!response.data?.has_more || !batch.length) break;
    after = batch[batch.length - 1].id;
  }
  return rows;
}

async function ensurePublishedTemplate(resend) {
  const listed = await resend.templates.list({ limit: 100 });
  if (listed.error) throw new Error(`Unable to list templates: ${listed.error.message}`);
  const existing = (listed.data?.data || []).find(
    (template) => template.alias === TEMPLATE_ALIAS || template.name === TEMPLATE_NAME
  );
  if (!existing) throw new Error(`Template ${TEMPLATE_ALIAS} not found — run upsert-kshitij-cultural-competitions-template.js first`);

  const htmlPath = path.join(__dirname, '..', '..', 'preview', 'emails', 'kshitij-pune-multicity-cultural-competitions-2026.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const updated = await resend.templates.update(existing.id, {
      name: TEMPLATE_NAME,
      alias: TEMPLATE_ALIAS,
      subject: SUBJECT,
      from: FROM,
      replyTo: REPLY_TO,
      html,
    });
    if (updated.error) throw new Error(`Unable to update template: ${updated.error.message}`);
  }

  const published = await resend.templates.publish(existing.id);
  if (published.error) throw new Error(`Unable to publish template: ${published.error.message}`);
  return existing.id;
}

async function collectAudience() {
  const culturalFests = await Fest.find({ festType: 'cultural' }).select('_id festName slug status').lean();
  const culturalFestIds = culturalFests.map((f) => f._id);

  const kshitij = await Fest.findOne({
    $or: [
      { slug: KSHITIJ_SLUG },
      { slug: KSHITIJ_LEGACY_SLUG },
      { previousSlugs: KSHITIJ_LEGACY_SLUG },
    ],
  }).select('_id').lean();

  const regs = await Registration.find({
    fest: { $in: culturalFestIds },
    isProShow: { $ne: true },
    status: { $in: ['pending', 'approved'] },
  }).populate('user', 'email notificationPreferences').select('responses user fest').lean();

  const emailMeta = new Map(); // email -> { sources: Set, optedOut: bool }
  const byFest = culturalFests.map((fest) => ({
    festName: fest.festName,
    slug: fest.slug || null,
    status: fest.status,
    registrations: 0,
    uniqueEmails: 0,
  }));
  const festIndex = new Map(culturalFests.map((f, i) => [String(f._id), i]));

  for (const reg of regs) {
    const email = pickEmail(reg.user, responsesToObject(reg.responses));
    if (!email) continue;
    const festKey = String(reg.fest);
    const idx = festIndex.get(festKey);
    if (idx != null) byFest[idx].registrations += 1;

    const optedOut = reg.user?.notificationPreferences?.emailReminders === false;
    if (!emailMeta.has(email)) {
      emailMeta.set(email, { sources: new Set(), optedOut: false });
    }
    const meta = emailMeta.get(email);
    if (idx != null) meta.sources.add(byFest[idx].festName);
    if (optedOut) meta.optedOut = true;
  }

  // Legacy Instagram/manual competition regs (no fest link) — include if they look cultural-adjacent by having email
  const legacy = await CompetitionRegistration.find({
    email: { $type: 'string', $ne: '' },
    status: { $nin: ['rejected'] },
  }).select('email').lean();
  for (const row of legacy) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    if (!emailMeta.has(email)) {
      emailMeta.set(email, { sources: new Set(['legacy-competition-registration']), optedOut: false });
    } else {
      emailMeta.get(email).sources.add('legacy-competition-registration');
    }
  }

  // Exclude people already registered for Kshitij
  const alreadyOnKshitij = new Set();
  if (kshitij) {
    const kRegs = await Registration.find({
      fest: kshitij._id,
      isProShow: { $ne: true },
      status: { $in: ['pending', 'approved'] },
    }).populate('user', 'email').select('responses user').lean();
    for (const reg of kRegs) {
      const email = pickEmail(reg.user, responsesToObject(reg.responses));
      if (email) alreadyOnKshitij.add(email);
    }
  }

  for (const fest of byFest) {
    const emails = [...emailMeta.entries()]
      .filter(([, meta]) => meta.sources.has(fest.festName))
      .map(([email]) => email);
    fest.uniqueEmails = new Set(emails).size;
  }

  return { byFest, emailMeta, alreadyOnKshitij, culturalFests };
}

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY or RESEND_AUDIT_API_KEY is required');
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) throw new Error('MONGODB_URI is required');

  const resend = new Resend(apiKey);
  const templateId = await ensurePublishedTemplate(resend);

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { byFest, emailMeta, alreadyOnKshitij } = await collectAudience();

  let suppressions = [];
  try {
    suppressions = await listSuppressions(resend);
  } catch (error) {
    console.warn(`Suppressions list skipped: ${error.message}`);
  }
  const suppressed = new Set(suppressions.map((item) => String(item.email || '').trim().toLowerCase()));

  const recipients = [];
  let excludedOptOut = 0;
  let excludedKshitij = 0;
  let excludedSuppressed = 0;

  for (const [email, meta] of emailMeta.entries()) {
    if (meta.optedOut) {
      excludedOptOut += 1;
      continue;
    }
    if (alreadyOnKshitij.has(email)) {
      excludedKshitij += 1;
      continue;
    }
    if (suppressed.has(email)) {
      excludedSuppressed += 1;
      continue;
    }
    recipients.push(email);
  }
  recipients.sort();

  console.log(JSON.stringify({
    templateId,
    templateAlias: TEMPLATE_ALIAS,
    culturalFests: byFest,
    rawUniqueEmails: emailMeta.size,
    alreadyOnKshitij: alreadyOnKshitij.size,
    excludedOptOut,
    excludedKshitij,
    excludedSuppressed,
    eligibleRecipients: recipients.length,
    mode: SHOULD_SEND ? 'send' : 'dry-run',
  }, null, 2));

  if (!SHOULD_SEND) {
    console.log('Dry-run only. Re-run with --send to blast.');
    return;
  }

  const batches = chunk(recipients, 100);
  let accepted = 0;
  let failed = 0;
  for (let index = 0; index < batches.length; index += 1) {
    const payload = batches[index].map((email) => ({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      template: { id: templateId },
      tags: [
        { name: 'campaign', value: CAMPAIGN_TAG },
        { name: 'audience', value: 'cultural-fest-participants' },
      ],
    }));
    const response = await resend.batch.send(payload, {
      batchValidation: 'permissive',
      idempotencyKey: `${IDEMPOTENCY_PREFIX}-${String(index + 1).padStart(2, '0')}`,
    });
    if (response.error) throw new Error(`Batch ${index + 1} failed: ${response.error.message}`);
    const errors = response.data?.errors || [];
    const sentCount = (response.data?.data || []).length;
    accepted += sentCount;
    failed += errors.length;
    console.log(`Batch ${index + 1}/${batches.length}: accepted=${sentCount}, failed=${errors.length}`);
  }

  console.log(JSON.stringify({ sent: accepted, failed, batches: batches.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
