/**
 * Re-sync MindSpark competition content from the Drive rulebook zip.
 * Updates existing competitions (does not create duplicates).
 *
 * Usage:
 *   node scripts/resync-mindspark-from-rulebooks.js [--dry-run]
 *   node scripts/resync-mindspark-from-rulebooks.js --zip "C:/path/to.zip"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');
const { parseTicketPrice } = require('../src/utils/platformFee');
const { parseRulebookZip } = require('../src/services/rulebookImportService');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const DEFAULT_ZIP = 'C:/Users/KARAN/Downloads/drive-download-20260813T171409Z-1-001.zip';
const VENUE = 'COEP Technological University, Pune';
const DEFAULT_DATETIME = "During MindSpark'26 (3–4 Oct 2026)";

const dryRun = process.argv.includes('--dry-run');
const zipArgIdx = process.argv.indexOf('--zip');
const ZIP_PATH = zipArgIdx >= 0
  ? path.resolve(process.argv[zipArgIdx + 1])
  : DEFAULT_ZIP;

function normName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map parsed rulebook names → existing DB competition names */
const NAME_MATCH = {
  'beyond suits': 'BEYOND SUITS',
  'fandom': 'FANDOM.',
  'fox hunt': 'Fox Hunt',
  'code junkie': 'Code Junkie',
  'neural nexus': 'Neural Nexus',
  'game of innovation': 'Game of Innovation',
  'flash': 'FLASH',
  'worldwize': 'WORLDWIZE',
  'googler': 'Googler',
  'sherlocked': 'SHERLOCKED',
  'ideathon': 'Ideathon',
  'hackathon': 'Hackathon',
  'circuit fixer': 'CIRCUIT FIXER',
  'microapps': 'MICROAPPS',
  'on the etch': 'ON THE ETCH',
  'fusion id': 'FUSION ID',
  'revit rush': 'REVIT RUSH',
  'utopia': 'Utopia',
  'take off': 'Take Off',
  'torquest': 'TORQUEST',
  'assemblix': 'Assemblix',
  'bot wrestling': 'Bot Wrestling',
  'robo falconry': 'Robo Falconry',
  'robosoccer': 'Robosoccer',
  'roboroyale': 'RoboRoyale',
  'robowars': 'Robowars',
  'search n destroy': 'SEARCH N DESTROY',
  'mathletics': 'Mathletics',
  'roboraces': 'Roboraces',
  'virtual robotics': 'Virtual Robotics',
  'webscape': 'Webscape',
  'edifex': 'Edifex',
  'quantquest': 'QuantQuest',
};

/** Tanvi / organizer corrections that override rulebook text */
const OVERRIDES = {
  'Fox Hunt': {
    feeAmount: 299,
    registrationFee: '₹299 per team',
  },
  'Code Junkie': {
    teamSize: 'Individual event (strictly individual)',
    registrationFee: '₹199 per person',
    feeAmount: 199,
  },
  Ideathon: {
    // Final is 3 Oct; Round-1 results listed as 29 Oct in rulebook is after the fest — treat as 29 Sep.
    rewriteRules: (rules) =>
      (rules || []).map((r) =>
        String(r).replace(/29th\s+of\s+October\s+202\s*6/gi, '29th of September 2026')
          .replace(/29th\s+October\s+202\s*6/gi, '29th September 2026')
          .replace(/5t\s*h\s+September\s+202\s*6/gi, '5th September 2026')
          .replace(/26th\s+September\s+202\s*6/gi, '26th September 2026'),
      ),
  },
  'Robo Falconry': {
    name: 'Robo Falconry',
  },
  'BEYOND SUITS': {
    name: 'Beyond Suits',
  },
  'FANDOM.': {
    name: 'FANDOM',
  },
};

function findExisting(compsByNorm, parsedName) {
  const key = normName(parsedName);
  const mapped = NAME_MATCH[key];
  if (mapped) {
    const hit = compsByNorm.get(normName(mapped));
    if (hit) return hit;
  }
  if (compsByNorm.has(key)) return compsByNorm.get(key);

  // Fuzzy contains
  for (const [n, doc] of compsByNorm.entries()) {
    if (n.includes(key) || key.includes(n)) return doc;
  }
  return null;
}

function applyDescriptionTeamSize(description, teamSize) {
  const body = String(description || '').replace(/^Team size:[^\n]*\n*/i, '').trim();
  if (!teamSize) return body;
  return `Team size: ${teamSize}\n\n${body}`;
}

(async () => {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`Zip not found: ${ZIP_PATH}`);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const existing = await Competition.find({ fest: FEST_ID });
  const compsByNorm = new Map(existing.map((c) => [normName(c.name), c]));

  const parsed = await parseRulebookZip(fs.readFileSync(ZIP_PATH));
  console.log(`Parsed ${parsed.ok}/${parsed.total} rulebooks${dryRun ? ' (dry run)' : ''}`);

  let updated = 0;
  let unmatched = [];

  for (const item of parsed.items) {
    if (item.status !== 'ok' || !item.parsed) {
      console.log(`  SKIP ${item.sourceFile}: ${item.status} ${(item.warnings || []).join('; ')}`);
      continue;
    }

    const row = item.parsed;
    const doc = findExisting(compsByNorm, row.name);
    if (!doc) {
      unmatched.push(row.name);
      console.log(`  NO MATCH for parsed "${row.name}" (${item.sourceFile})`);
      continue;
    }

    const overrideKey = Object.keys(OVERRIDES).find(
      (k) => normName(k) === normName(doc.name) || normName(k) === normName(row.name),
    );
    const override = overrideKey ? OVERRIDES[overrideKey] : {};

    const teamSize = override.teamSize || row.teamSize || '';
    let commonRules = Array.isArray(row.commonRules) ? [...row.commonRules] : [];
    if (typeof override.rewriteRules === 'function') {
      commonRules = override.rewriteRules(commonRules);
    }

    const feeAmount = override.feeAmount != null
      ? Number(override.feeAmount)
      : parseTicketPrice(row.feeAmount) || parseTicketPrice(row.registrationFee);
    const registrationFee = override.registrationFee
      || row.registrationFee
      || doc.registrationFee;

    const nextName = override.name || (
      /falconary/i.test(doc.name) ? 'Robo Falconry' : doc.name
    );

    const patch = {
      name: nextName,
      description: applyDescriptionTeamSize(row.description, teamSize),
      commonRules,
      rounds: Array.isArray(row.rounds) && row.rounds.length ? row.rounds : doc.rounds,
      contact: {
        name: row.contact?.name || doc.contact?.name || '',
        phone: row.contact?.phone || doc.contact?.phone || '',
        email: row.contact?.email || doc.contact?.email || '',
        instagram: row.contact?.instagram || doc.contact?.instagram || '',
      },
      registrationFee,
      feeAmount,
      venue: doc.venue || VENUE,
      dateTime: (!doc.dateTime || /tba/i.test(doc.dateTime)) ? DEFAULT_DATETIME : doc.dateTime,
    };

    // Prefer richer contact from parse when available
    if (row.contact?.phone) {
      patch.contact = {
        name: row.contact.name || patch.contact.name || '',
        phone: row.contact.phone,
        email: row.contact.email || '',
        instagram: row.contact.instagram || '',
      };
    }
    if (/^NOTE$/i.test(patch.contact.name || '')) {
      patch.contact.name = '';
    }

    console.log(
      `  UPDATE ${doc.name} ← ${row.name}` +
      ` | team=${teamSize || '—'} | fee=${registrationFee}` +
      ` | contact=${patch.contact.name || '—'} ${patch.contact.phone || ''}` +
      ` | rules=${commonRules.length} rounds=${(patch.rounds || []).length}`,
    );

    if (!dryRun) {
      Object.assign(doc, patch);
      doc.markModified('commonRules');
      doc.markModified('rounds');
      doc.markModified('contact');
      await doc.save();
      // refresh map key if renamed
      compsByNorm.delete(normName(doc.name));
      compsByNorm.set(normName(nextName), doc);
    }
    updated += 1;
  }

  // Extra name/fee fixes for comps not in zip (QuantQuest) + spelling
  if (!dryRun) {
    await Competition.updateMany(
      { fest: FEST_ID, name: /falconary/i },
      { $set: { name: 'Robo Falconry' } },
    );
    await Competition.updateOne(
      { fest: FEST_ID, name: /^BEYOND SUITS$/i },
      { $set: { name: 'Beyond Suits' } },
    );
    await Competition.updateOne(
      { fest: FEST_ID, name: /^FANDOM\.?$/i },
      { $set: { name: 'FANDOM' } },
    );
  }

  console.log(dryRun ? `Dry run: would update ${updated}` : `Updated ${updated} competitions`);
  if (unmatched.length) console.log('Unmatched parsed names:', unmatched.join(', '));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
