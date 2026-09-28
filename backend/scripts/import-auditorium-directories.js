'use strict';

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Competition = require('../src/model/competition_model');
const AuditoriumStudent = require('../src/model/mindspark_auditorium_student_model');
const { MINDSPARK_FEST_ID } = require('../src/modules/fest/plugins/mindsparkAuditorium');
const {
  DIRECTORY_YEARS,
  directoryEmailHash,
  extractDirectoryEmails,
} = require('../src/utils/auditoriumDirectory');

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const entries = argv
    .filter((arg) => arg !== '--apply')
    .map((arg) => {
      const separator = arg.indexOf('=');
      if (separator < 1) throw new Error(`Expected category=file, received: ${arg}`);
      const categoryId = arg.slice(0, separator).trim();
      const filename = path.resolve(arg.slice(separator + 1).trim());
      if (!DIRECTORY_YEARS.has(categoryId)) throw new Error(`Unsupported category: ${categoryId}`);
      if (!fs.existsSync(filename)) throw new Error(`File not found: ${filename}`);
      return { categoryId, filename };
    });
  if (!entries.length) throw new Error('Provide at least one category=file argument');
  if (new Set(entries.map((entry) => entry.categoryId)).size !== entries.length) {
    throw new Error('Each category may be provided only once');
  }
  return { apply, entries };
}

async function directorySummary(competitionId) {
  const rows = await AuditoriumStudent.aggregate([
    { $match: { competitionId } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    byCategory: Object.fromEntries(rows.map((row) => [row._id, row.count])),
  };
}

async function main() {
  const { apply, entries } = parseArgs(process.argv.slice(2));
  const prepared = [];
  for (const entry of entries) {
    const buffer = fs.readFileSync(entry.filename);
    const emails = await extractDirectoryEmails(buffer, entry.filename);
    if (!emails.length) throw new Error(`No valid emails found in ${path.basename(entry.filename)}`);
    if (emails.length > 25_000) throw new Error(`${entry.categoryId} exceeds 25,000 emails`);
    prepared.push({ ...entry, emails });
  }

  await connectDB();
  const competition = await Competition.findOne({
    fest: MINDSPARK_FEST_ID,
    'auditorium.enabled': true,
  }).select('_id name').lean();
  if (!competition) throw new Error('MindSpark auditorium competition not found');

  const before = await directorySummary(competition._id);
  const files = prepared.map((entry) => ({
    categoryId: entry.categoryId,
    file: path.basename(entry.filename),
    emails: entry.emails.length,
  }));
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', competition: competition.name, before, files }, null, 2));
    return;
  }

  for (const entry of prepared) {
    const batchId = crypto.randomUUID();
    await AuditoriumStudent.bulkWrite(entry.emails.map((email) => ({
      updateOne: {
        filter: { competitionId: competition._id, emailHash: directoryEmailHash(email) },
        update: { $set: { categoryId: entry.categoryId, batchId } },
        upsert: true,
      },
    })), { ordered: false });
    await AuditoriumStudent.deleteMany({
      competitionId: competition._id,
      categoryId: entry.categoryId,
      batchId: { $ne: batchId },
    });
  }

  const after = await directorySummary(competition._id);
  console.log(JSON.stringify({ mode: 'applied', competition: competition.name, files, before, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
