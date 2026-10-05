/**
 * Re-import full Aarohan26 Google Sheet (Form responses 1 ≈ 460 rows)
 * into admin Data, then email Kshitij template to not-yet-sent unique emails.
 *
 * Dry-run: node scripts/import-aarohan26-full-xlsx-and-send.js
 * Send:    node scripts/import-aarohan26-full-xlsx-and-send.js --send
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
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
const DATASET_KEY = 'aarohan26-responses';
const SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1kJC0D1iQVxlPyKVZY-KyT-q86BO12AEVJgtal0zl4WE/edit?usp=sharing';
const XLSX_PATH = path.join(__dirname, 'assets', 'aarohan26-responses.xlsx');
const HTML_PATH = path.join(__dirname, '..', '..', 'preview', 'emails', 'kshitij-pune-multicity-cultural-competitions-2026.html');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IDEMPOTENCY_PREFIX = 'kshitij-cultural-2026-aarohan26-full-v1';

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function cell(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return '';
}

function parseContactsFromXlsx(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => /form responses/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });
  const contacts = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const email = cell(row, 'Email Id', 'Email', 'email').toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    contacts.push({
      name: cell(row, 'Name'),
      email,
      phone: cell(row, 'Contact Number', 'Phone'),
      instagramId: cell(row, 'Instagram Id', 'Instagram'),
      competition: cell(row, 'Name of Competition', 'Competition'),
      city: cell(row, 'City'),
      college: cell(row, 'College / Organization Name', 'College'),
      dateOfBirth: cell(row, 'Date of Birth'),
      paymentMode: cell(row, 'Payment Mode'),
      transactionId: cell(row, 'Transaction ID'),
      paymentScreenshot: cell(row, 'Payment Screenshot'),
      participantsCount: cell(row, 'Number of Participants (Only in the Case of Group Competitions)'),
      submittedAt: cell(row, 'Timestamp'),
      sourceRow: i + 2,
    });
  }
  return { sheetName, rowCount: rows.length, contacts };
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

async function listRecentKshitijRecipients(resend) {
  const sent = new Set();
  let after;
  for (let page = 0; page < 20; page += 1) {
    const response = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) });
    if (response.error) throw new Error(`Unable to list emails: ${response.error.message}`);
    const batch = response.data?.data || [];
    if (!batch.length) break;
    for (const email of batch) {
      if (!String(email.subject || '').includes('Kshitij')) continue;
      const tos = Array.isArray(email.to) ? email.to : [email.to];
      for (const to of tos) {
        const value = String(to || '').trim().toLowerCase();
        if (EMAIL_RE.test(value)) sent.add(value);
      }
    }
    if (!response.data?.has_more) break;
    after = batch[batch.length - 1].id;
  }
  return sent;
}

async function ensurePublishedTemplate(resend) {
  const listed = await resend.templates.list({ limit: 100 });
  if (listed.error) throw new Error(listed.error.message);
  const existing = (listed.data?.data || []).find(
    (t) => t.alias === TEMPLATE_ALIAS || t.name === TEMPLATE_NAME
  );
  if (!existing) throw new Error(`Template ${TEMPLATE_ALIAS} missing`);
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const updated = await resend.templates.update(existing.id, {
    name: TEMPLATE_NAME,
    alias: TEMPLATE_ALIAS,
    subject: SUBJECT,
    from: FROM,
    replyTo: REPLY_TO,
    html,
  });
  if (updated.error) throw new Error(updated.error.message);
  const published = await resend.templates.publish(existing.id);
  if (published.error) throw new Error(published.error.message);
  return existing.id;
}

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY required');
  if (!fs.existsSync(XLSX_PATH)) throw new Error(`Missing ${XLSX_PATH}`);

  const { sheetName, rowCount, contacts } = parseContactsFromXlsx(XLSX_PATH);
  const uniqueEmails = [...new Set(contacts.map((c) => c.email))].sort();

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const dataset = await OutreachDataset.findOneAndUpdate(
    { key: DATASET_KEY },
    {
      $set: {
        key: DATASET_KEY,
        name: 'Aarohan26 Responses',
        description: `Full Google Sheet import from "${sheetName}" (${rowCount} rows).`,
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

  const resend = new Resend(apiKey);
  const alreadyEmailed = await listRecentKshitijRecipients(resend);
  const recipients = uniqueEmails.filter(
    (email) => !alreadyOnKshitij.has(email) && !alreadyEmailed.has(email)
  );

  const templateId = await ensurePublishedTemplate(resend);

  console.log(JSON.stringify({
    sheetName,
    sheetRows: rowCount,
    importedContacts: contacts.length,
    uniqueEmails: uniqueEmails.length,
    alreadyOnKshitij: [...alreadyOnKshitij].filter((e) => uniqueEmails.includes(e)).length,
    alreadyEmailedKshitij: [...alreadyEmailed].filter((e) => uniqueEmails.includes(e)).length,
    remainingToSend: recipients.length,
    datasetKey: DATASET_KEY,
    datasetId: String(dataset._id),
    adminPath: '/admin/data',
    mode: SHOULD_SEND ? 'send' : 'dry-run',
  }, null, 2));

  if (!SHOULD_SEND) {
    console.log('Dry-run only. Re-run with --send to email remaining recipients.');
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
        { name: 'audience', value: 'aarohan26-full-sheet' },
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
