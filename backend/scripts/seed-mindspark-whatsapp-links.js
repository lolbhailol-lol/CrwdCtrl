/**
 * Seed MindSpark competition WhatsApp group links.
 *
 * Usage:
 *   node scripts/seed-mindspark-whatsapp-links.js
 *   node scripts/seed-mindspark-whatsapp-links.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');

const FEST_ID = '6a7f1010ed26d983b34e55c2';

/** Label from organizer list → WhatsApp invite URL (empty = skip / leave blank) */
const WHATSAPP_BY_LABEL = {
  FLASH: 'https://chat.whatsapp.com/GUifS4qsAu74P1uvouQGbZ',
  'TAKE OFF': 'https://chat.whatsapp.com/KsGlQfq3rLfDlclDVGPE84',
  TORQUEST: 'https://chat.whatsapp.com/J8yOXjg7w9k166BXKG7C6H',
  'CODE JUNKIE': 'https://chat.whatsapp.com/JoaBaXHnHxuCKfwpJB2CiL',
  WEBSCAPE: 'https://chat.whatsapp.com/BDGUl9jHUER0oyTvExbzcg',
  'NEURAL NEXUS': 'https://chat.whatsapp.com/BiW6E2RuLRACvKPdYPstnD',
  HACKATHON: '',
  QUANTQUEST: 'https://chat.whatsapp.com/DlQQSjViF5eAyXAgWbEIZy',
  'WORLD-WIZE': 'https://chat.whatsapp.com/BtA7OdjBcP94CLo4ssBb7N',
  MATHLETICS: 'https://chat.whatsapp.com/DeXmN66Ca0V0KYoC0BBFlO',
  'FUSION ID': 'https://chat.whatsapp.com/HZaY6JupVxD9vC372WK9e2',
  'REVIT RUSH': 'https://chat.whatsapp.com/E5y9NulrRzXFU1yAI1Tzee',
  ASSEMBLIX: 'https://chat.whatsapp.com/CdHTii29Rnl48Bh13FvrRt',
  FANDOM: 'https://chat.whatsapp.com/Bicn5DPXNnNKlGYFSBhheW',
  'BEYOND SUITS': '',
  SHERLOCKED: 'https://chat.whatsapp.com/FquqTqJ68ujKLHCcAybN9h',
  GOOGLER: 'https://chat.whatsapp.com/KuuJ6guTrYA839H4IAWpTY',
  UTOPIA: 'https://chat.whatsapp.com/Izp0xVhxtR0LR7F1ihg0DG',
  EDIFEX: 'https://chat.whatsapp.com/Hv8vH4ek8zmATysFtFJNAa',
  'ON THE ETCH': 'https://chat.whatsapp.com/Id7D8AU7i8AIUCYYkK0c1X',
  MICROAPPS: 'https://chat.whatsapp.com/DkUJXopwKAPDF6J5jeJiYW',
  'CIRCUIT FIXER': 'https://chat.whatsapp.com/EmZdvazgx5x1kTt0Zu6LDi',
  FOXHUNT: 'https://chat.whatsapp.com/CxLg3vgmVROFxvXsAs5azr',
  ROBOWARS: 'https://chat.whatsapp.com/GkgqXEFfgJWCIBkpcfNPs1',
  "SEARCH N' DESTROY": 'https://chat.whatsapp.com/BRUblSlD7Gj4aHiD2J586c',
  ROBOSOCCER: 'https://chat.whatsapp.com/EsM58TUqnNk0pjxPAPwiXf',
  ROBORACES: 'https://chat.whatsapp.com/BxvevYajbFAB70LDHMuZD8',
  'ROBO-ROYALE': 'https://chat.whatsapp.com/HpscmMjEkwk4jNSGpe8s2i',
  'VIRTUAL ROBOTICS': '',
  'ROBO FALCONARY': 'https://chat.whatsapp.com/CfKpB2wSSWC2hOyaYFNbfm',
  'BOT WRESTLING': 'https://chat.whatsapp.com/EmVNgD6wFhxEDKPE7H06aS',
  IDEATHON: 'https://chat.whatsapp.com/Fvp7wyYXZ7VA9wND5jMMeO',
  'GENIUS JUNIOR': 'https://chat.whatsapp.com/K6HrMVMpEi215gZUOrozBV',
  'GAME OF INNOVATION': 'https://chat.whatsapp.com/KY0YkMycQ8p0OZDXkVlEBH',
};

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Map normalized keys → URL (empty string means intentionally blank) */
const BY_NORM = {};
for (const [label, url] of Object.entries(WHATSAPP_BY_LABEL)) {
  BY_NORM[normalizeKey(label)] = String(url || '').trim();
}

/** Extra aliases for DB names that differ from the sheet labels */
const ALIASES = {
  [normalizeKey('WORLDWIZE')]: BY_NORM[normalizeKey('WORLD-WIZE')],
  [normalizeKey('Fox Hunt')]: BY_NORM[normalizeKey('FOXHUNT')],
  [normalizeKey('Robo Falconry')]: BY_NORM[normalizeKey('ROBO FALCONARY')],
  [normalizeKey('RoboRoyale')]: BY_NORM[normalizeKey('ROBO-ROYALE')],
  [normalizeKey('SEARCH N DESTROY')]: BY_NORM[normalizeKey("SEARCH N' DESTROY")],
  [normalizeKey('Take Off')]: BY_NORM[normalizeKey('TAKE OFF')],
  [normalizeKey('Code Junkie')]: BY_NORM[normalizeKey('CODE JUNKIE')],
  [normalizeKey('Neural Nexus')]: BY_NORM[normalizeKey('NEURAL NEXUS')],
  [normalizeKey('Beyond Suits')]: BY_NORM[normalizeKey('BEYOND SUITS')],
  [normalizeKey('Game of Innovation')]: BY_NORM[normalizeKey('GAME OF INNOVATION')],
  [normalizeKey('Genius Junior')]: BY_NORM[normalizeKey('GENIUS JUNIOR')],
};

function resolveUrl(compName) {
  const key = normalizeKey(compName);
  if (Object.prototype.hasOwnProperty.call(BY_NORM, key)) return BY_NORM[key];
  if (Object.prototype.hasOwnProperty.call(ALIASES, key)) return ALIASES[key];
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI / MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const festOid = new mongoose.Types.ObjectId(FEST_ID);
  const comps = await Competition.find({ fest: festOid }).select('name registration.whatsappGroupLink');
  console.log(`MindSpark competitions: ${comps.length}`);

  const matched = [];
  const unmatched = [];
  const skippedEmpty = [];
  let updated = 0;

  for (const comp of comps) {
    const url = resolveUrl(comp.name);
    if (url === null) {
      unmatched.push(comp.name);
      continue;
    }
    if (!url) {
      skippedEmpty.push(comp.name);
      continue;
    }

    const prev = String(comp.registration?.whatsappGroupLink || '').trim();
    matched.push({ name: comp.name, url, changed: prev !== url });
    if (prev === url) continue;

    if (!dryRun) {
      await Competition.updateOne(
        { _id: comp._id },
        { $set: { 'registration.whatsappGroupLink': url } },
      );
    }
    updated += 1;
    console.log(`${dryRun ? '[dry-run] ' : ''}${comp.name} → ${url}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Matched with URL: ${matched.length}`);
  console.log(`Would update / updated: ${updated}`);
  console.log(`Listed but empty (left unchanged): ${skippedEmpty.length}`, skippedEmpty);
  console.log(`DB comps with no sheet match: ${unmatched.length}`, unmatched);

  const sheetKeys = new Set(Object.keys(BY_NORM));
  const matchedKeys = new Set(matched.map((m) => normalizeKey(m.name)));
  const unusedLabels = [...sheetKeys].filter((k) => {
    if (!BY_NORM[k]) return false;
    return ![...matchedKeys].some((mk) => mk === k || ALIASES[mk] === BY_NORM[k]);
  });
  // Better unused check: labels whose URL wasn't applied to any comp
  const usedUrls = new Set(matched.map((m) => m.url));
  const unusedWithUrl = Object.entries(WHATSAPP_BY_LABEL)
    .filter(([, u]) => u && !usedUrls.has(u))
    .map(([label]) => label);
  if (unusedWithUrl.length) {
    console.log('Sheet rows with URL but no DB match:', unusedWithUrl);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
