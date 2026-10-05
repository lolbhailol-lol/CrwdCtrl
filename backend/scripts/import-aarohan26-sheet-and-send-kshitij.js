/**
 * Import Aarohan26 Google Sheet responses into OutreachDataset (admin Data),
 * then optionally email the Kshitij cultural template to unique emails.
 *
 * Dry-run: node scripts/import-aarohan26-sheet-and-send-kshitij.js
 * Send:    node scripts/import-aarohan26-sheet-and-send-kshitij.js --send
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const OutreachDataset = require('../src/model/outreach_dataset_model');
const Fest = require('../src/model/fest_organizer_model');
const Registration = require('../src/model/registration_model');
require('../src/model/usermodel');

const SHOULD_SEND = process.argv.includes('--send');
const TEMPLATE_ALIAS = 'kshitij-pune-multicity-cultural-competitions-2026';
const TEMPLATE_NAME = 'Kshitij Pune Multicity — Cultural Competitions';
const SUBJECT = 'Kshitij Pune Multicity cultural comps are open — register on CrwdCtrl';
const FROM = 'CrwdCtrl <onboarding@crwdctrl.in>';
const REPLY_TO = 'team.crwdctrl@gmail.com';
const FEST_URL = 'https://www.crwdctrl.in/view-details/kshitij-pune-multicity-event-2026';
const DATASET_KEY = 'aarohan26-responses';
const SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1kJC0D1iQVxlPyKVZY-KyT-q86BO12AEVJgtal0zl4WE/edit?usp=sharing';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IDEMPOTENCY_PREFIX = 'kshitij-cultural-2026-aarohan26-sheet-v2';

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function cleanCell(value) {
  return String(value || '')
    .replace(/\\_/g, '_')
    .replace(/\\-/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeEmail(value) {
  const email = cleanCell(value).toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
}

function parseMarkdownTable(md) {
  const lines = md.split(/\r?\n/).filter((line) => /^\|\s*\d+\s*\|/.test(line));
  const contacts = [];

  for (const line of lines) {
    const cells = line.split('|').map((c) => cleanCell(c)).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    // cells[0] = row number
    if (cells.length < 6) continue;
    const rowNum = Number(cells[0]);
    if (!Number.isFinite(rowNum) || rowNum < 2) continue;

    let emailIdx = -1;
    let email = '';
    for (let i = 0; i < cells.length; i += 1) {
      const found = looksLikeEmail(cells[i]);
      if (found) {
        emailIdx = i;
        email = found;
        break;
      }
    }
    if (!email) continue;

    // Expected: #, Timestamp, Name, Instagram, Phone, Email, DOB, Competition, Participants?, City, College, Payment, Txn, Screenshot
    const timestamp = cells[1] || '';
    const name = cells[2] || '';
    const instagramId = cells[3] || '';
    const phone = cells[4] || '';
    const dob = emailIdx >= 6 ? cells[6] : '';
    const competition = emailIdx >= 7 ? cells[7] : '';

    // After competition, columns drift when participants is blank
    const rest = cells.slice(8);
    let participantsCount = '';
    let city = '';
    let college = '';
    let paymentMode = '';
    let transactionId = '';
    let paymentScreenshot = '';

    const paymentModes = new Set(['gpay', 'phonepe', 'paytm']);
    const driveIdx = rest.findIndex((c) => /drive\.google\.com/i.test(c));
    if (driveIdx >= 0) paymentScreenshot = rest[driveIdx];

    const payIdx = rest.findIndex((c) => paymentModes.has(c.toLowerCase()));
    if (payIdx >= 0) {
      paymentMode = rest[payIdx];
      transactionId = rest[payIdx + 1] || '';
      // before pay: participants?, city, college — or city, college
      const before = rest.slice(0, payIdx);
      if (before.length >= 3) {
        participantsCount = before[0];
        city = before[1];
        college = before[2];
      } else if (before.length === 2) {
        city = before[0];
        college = before[1];
      } else if (before.length === 1) {
        city = before[0];
      }
    } else if (rest.length >= 2) {
      city = rest[0];
      college = rest[1];
    }

    contacts.push({
      name,
      email,
      phone,
      instagramId,
      competition,
      city,
      college,
      dateOfBirth: dob,
      paymentMode,
      transactionId,
      paymentScreenshot,
      participantsCount,
      submittedAt: timestamp,
      sourceRow: rowNum,
    });
  }

  return contacts;
}

function loadHostedTemplateHtml() {
  const file = path.join(__dirname, '..', '..', 'preview', 'emails', 'kshitij-pune-multicity-cultural-competitions-2026.html');
  return fs.readFileSync(file, 'utf8');
}

async function ensurePublishedTemplate(resend, html) {
  const listed = await resend.templates.list({ limit: 100 });
  if (listed.error) throw new Error(`Unable to list templates: ${listed.error.message}`);
  const existing = (listed.data?.data || []).find(
    (template) => template.alias === TEMPLATE_ALIAS || template.name === TEMPLATE_NAME
  );
  if (!existing) throw new Error(`Template ${TEMPLATE_ALIAS} missing`);

  const updated = await resend.templates.update(existing.id, {
    name: TEMPLATE_NAME,
    alias: TEMPLATE_ALIAS,
    subject: SUBJECT,
    from: FROM,
    replyTo: REPLY_TO,
    html,
  });
  if (updated.error) throw new Error(`Unable to update template: ${updated.error.message}`);

  const published = await resend.templates.publish(existing.id);
  if (published.error) throw new Error(`Unable to publish template: ${published.error.message}`);
  return existing.id;
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

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY required');
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) throw new Error('MONGODB_URI required');

  const mdPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor',
    'projects',
    'c-Users-KARAN-CrwdCtrl',
    'uploads',
    'edit-0.md'
  );
  if (!fs.existsSync(mdPath)) throw new Error(`Sheet dump not found: ${mdPath}`);

  const contacts = parseMarkdownTable(fs.readFileSync(mdPath, 'utf8'));
  const uniqueEmails = [...new Set(contacts.map((c) => c.email).filter(Boolean))].sort();

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const dataset = await OutreachDataset.findOneAndUpdate(
    { key: DATASET_KEY },
    {
      $set: {
        key: DATASET_KEY,
        name: 'Aarohan26 Responses',
        description: 'Google Form responses imported from Aarohan26 sheet for cultural outreach.',
        sourceUrl: SOURCE_URL,
        contacts,
        contactCount: contacts.length,
        uniqueEmailCount: uniqueEmails.length,
      },
    },
    { upsert: true, new: true }
  );

  const kshitij = await Fest.findOne({
    $or: [
      { slug: 'kshitij-pune-multicity-event-2026' },
      { slug: 'kshitij-pune-regionals-2026' },
      { previousSlugs: 'kshitij-pune-regionals-2026' },
    ],
  }).select('_id').lean();

  const alreadyOnKshitij = new Set();
  if (kshitij) {
    const regs = await Registration.find({
      fest: kshitij._id,
      isProShow: { $ne: true },
      status: { $in: ['pending', 'approved'] },
    }).populate('user', 'email').select('responses user').lean();
    for (const reg of regs) {
      const email = pickEmail(reg.user, responsesToObject(reg.responses));
      if (email) alreadyOnKshitij.add(email);
    }
  }

  const recipients = uniqueEmails.filter((email) => !alreadyOnKshitij.has(email));

  const resend = new Resend(apiKey);
  const html = loadHostedTemplateHtml();
  const templateId = await ensurePublishedTemplate(resend, html);

  console.log(JSON.stringify({
    datasetId: String(dataset._id),
    datasetKey: DATASET_KEY,
    adminPath: '/admin/data',
    importedRows: contacts.length,
    uniqueEmails: uniqueEmails.length,
    alreadyOnKshitij: alreadyOnKshitij.size,
    eligibleRecipients: recipients.length,
    festUrl: FEST_URL,
    mode: SHOULD_SEND ? 'send' : 'dry-run',
  }, null, 2));

  if (!SHOULD_SEND) {
    console.log('Dry-run only. Re-run with --send to email this sheet list.');
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
        { name: 'campaign', value: 'kshitij-cultural-2026' },
        { name: 'audience', value: 'aarohan26-sheet' },
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
