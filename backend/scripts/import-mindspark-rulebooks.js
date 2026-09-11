/**
 * One-shot import of MindSpark rulebooks from a local zip into a fest.
 *
 * Usage:
 *   node scripts/import-mindspark-rulebooks.js <festId> [zipPath]
 *   node scripts/import-mindspark-rulebooks.js --fest-name "MindWork" [zipPath]
 *
 * Defaults zipPath to ../drive-download-20260813T171409Z-1-001 (1).zip
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const FestOrganizer = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');
const { parseTicketPrice } = require('../src/utils/platformFee');
const {
  parseRulebookZip,
  buildCompetitionFromImportRow,
} = require('../src/services/rulebookImportService');

const DEFAULT_ZIP = path.resolve(
  __dirname,
  '../../drive-download-20260813T171409Z-1-001 (1).zip'
);

function getCompetitionBaseFee(registrationFee, feeAmount) {
  const numericFeeAmount = parseTicketPrice(feeAmount);
  return numericFeeAmount || parseTicketPrice(registrationFee);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    festId: null,
    festName: null,
    zipPath: DEFAULT_ZIP,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--fest-name') {
      options.festName = args[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--zip') {
      options.zipPath = path.resolve(args[i + 1]);
      i += 1;
    } else if (!options.festId && !arg.startsWith('-')) {
      if (/\.zip$/i.test(arg)) {
        options.zipPath = path.resolve(arg);
      } else {
        options.festId = arg;
      }
    } else if (!arg.startsWith('-') && /\.zip$/i.test(arg)) {
      options.zipPath = path.resolve(arg);
    }
  }

  return options;
}

async function resolveFest({ festId, festName }) {
  if (festId) {
    const fest = await FestOrganizer.findById(festId);
    if (!fest) throw new Error(`Fest not found for id ${festId}`);
    return fest;
  }

  if (!festName) {
    throw new Error('Provide festId or --fest-name');
  }

  const fest = await FestOrganizer.findOne({
    festName: new RegExp(festName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  });

  if (!fest) {
    throw new Error(`Fest not found matching name "${festName}"`);
  }

  return fest;
}

async function main() {
  const options = parseArgs(process.argv);

  if (!fs.existsSync(options.zipPath)) {
    throw new Error(`Zip file not found: ${options.zipPath}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const fest = await resolveFest(options);
  const zipBuffer = fs.readFileSync(options.zipPath);
  const parsed = await parseRulebookZip(zipBuffer);

  const existing = await Competition.find({ fest: fest._id }).select('name').lean();
  const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

  const toCreate = parsed.items.filter(
    (item) =>
      item.status === 'ok' &&
      item.parsed?.name &&
      !existingNames.has(item.parsed.name.trim().toLowerCase())
  );

  console.log('Fest:', fest.festName, String(fest._id));
  console.log('Zip:', options.zipPath);
  console.log('Parsed:', parsed.total, 'files,', parsed.ok, 'ok,', parsed.errors, 'errors');
  console.log('Will create:', toCreate.length, 'competitions');
  console.log('Skipping existing:', parsed.items.filter((item) => item.duplicate).length);

  if (options.dryRun) {
    toCreate.slice(0, 5).forEach((item) => {
      console.log('-', item.parsed.name, '|', item.parsed.registrationFee, '|', item.parsed.subtitle);
    });
    await mongoose.disconnect();
    return;
  }

  let created = 0;
  for (const item of toCreate) {
    const doc = buildCompetitionFromImportRow(item.parsed, fest._id, getCompetitionBaseFee);
    const competition = new Competition(doc);
    const saved = await competition.save();
    fest.competitions.push(saved._id);
    existingNames.add(item.parsed.name.trim().toLowerCase());
    created += 1;
    console.log('Created:', saved.name);
  }

  if (created) {
    await fest.save();
  }

  console.log('Done. Created', created, 'competition(s).');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Import failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
