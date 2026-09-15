/**
 * Create/publish the Resend Techfest campaign template and send it to active,
 * logged-in users who have not disabled email reminders.
 *
 * Required: RESEND_AUDIT_API_KEY (full-access Resend key)
 * Run: node scripts/send-techfest-free-competitions-campaign.js --send
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const User = require('../src/model/usermodel');

const SHOULD_SEND = process.argv.includes('--send');
const TEMPLATE_NAME = 'Techfest IIT Bombay — 15 Free Competitions';
const TEMPLATE_ALIAS = 'techfest-iit-bombay-free-competitions-2026';
const SUBJECT = '15 FREE Techfest IIT Bombay competitions — register on CrwdCtrl';
const FROM = 'CrwdCtrl <onboarding@crwdctrl.in>';
const REPLY_TO = 'team.crwdctrl@gmail.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
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

function loadHostedTemplateHtml() {
  const file = path.join(__dirname, '..', '..', 'preview', 'emails', 'techfest-iit-bombay-free-competitions-preview.html');
  return fs.readFileSync(file, 'utf8')
    .replace('assets/logo-crwdctrl.png', 'https://www.crwdctrl.in/logo-crwdctrl.png')
    .replace(
      'assets/techfest-theme-logo.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729283/crwdctrl/fests/techfest/theme-logo.webp'
    );
}

async function upsertAndPublishTemplate(resend, html) {
  const listed = await resend.templates.list({ limit: 100 });
  if (listed.error) throw new Error(`Unable to list templates: ${listed.error.message}`);
  const existing = (listed.data?.data || []).find(
    (template) => template.alias === TEMPLATE_ALIAS || template.name === TEMPLATE_NAME
  );

  let templateId;
  if (existing) {
    templateId = existing.id;
    const updated = await resend.templates.update(templateId, {
      name: TEMPLATE_NAME,
      alias: TEMPLATE_ALIAS,
      subject: SUBJECT,
      from: FROM,
      replyTo: REPLY_TO,
      html,
    });
    if (updated.error) throw new Error(`Unable to update template: ${updated.error.message}`);
  } else {
    const created = await resend.templates.create({
      name: TEMPLATE_NAME,
      alias: TEMPLATE_ALIAS,
      subject: SUBJECT,
      from: FROM,
      replyTo: REPLY_TO,
      html,
    });
    if (created.error) throw new Error(`Unable to create template: ${created.error.message}`);
    templateId = created.data.id;
  }

  const published = await resend.templates.publish(templateId);
  if (published.error) throw new Error(`Unable to publish template: ${published.error.message}`);
  return templateId;
}

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_AUDIT_API_KEY is required');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const resend = new Resend(apiKey);
  const html = loadHostedTemplateHtml();
  const templateId = await upsertAndPublishTemplate(resend, html);

  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({
    isDeleted: { $ne: true },
    lastLoginAt: { $ne: null },
    email: { $type: 'string', $ne: '' },
    'notificationPreferences.emailReminders': { $ne: false },
  }).select('email').lean();

  const suppressions = await listSuppressions(resend);
  const suppressed = new Set(suppressions.map((item) => String(item.email || '').trim().toLowerCase()));
  const recipients = [...new Set(
    users.map((user) => String(user.email || '').trim().toLowerCase())
  )]
    .filter((email) => EMAIL_RE.test(email) && !suppressed.has(email))
    .sort();

  console.log(JSON.stringify({
    templateId,
    templateAlias: TEMPLATE_ALIAS,
    templatePublished: true,
    loggedInOptedInUsers: users.length,
    suppressedExcluded: users.length - recipients.length,
    eligibleRecipients: recipients.length,
    mode: SHOULD_SEND ? 'send' : 'template-only',
  }, null, 2));

  if (!SHOULD_SEND) return;

  const batches = chunk(recipients, 100);
  let accepted = 0;
  let failed = 0;
  for (let index = 0; index < batches.length; index += 1) {
    const payload = batches[index].map((email) => ({
      from: FROM,
      to: email,
      template: { id: templateId },
      tags: [
        { name: 'campaign', value: 'techfest-free-2026' },
        { name: 'audience', value: 'logged-in-users' },
      ],
    }));
    const response = await resend.batch.send(payload, {
      batchValidation: 'permissive',
      idempotencyKey: `techfest-free-2026-logged-in-v1-${String(index + 1).padStart(2, '0')}`,
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
