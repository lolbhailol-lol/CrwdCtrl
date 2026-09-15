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
  'FLASH': {
    description:
      'This event brings out the inner shutterbugs in us — capturing unique moments out of the ordinary. Photographers and videographers of all skill levels can join this theme-based contest across Photography and Videography categories.',
    teamSize: 'Individual Participation',
    rewriteRounds: () => [
      {
        roundNumber: 1,
        title: 'Photography',
        description:
          'A theme will be provided a few days before the event. Submit a set of 3–5 images judged on composition, post-processing, theme communication, and overall aesthetics.',
        rules: [],
        dateTime: "During MindSpark'26 (3–4 Oct 2026)",
        venue: '',
      },
      {
        roundNumber: 2,
        title: 'Videography',
        description:
          'Make a video of not more than 90 seconds that tells a visual story or aesthetic. Horizontal or vertical format allowed. Time-lapses, hyper-lapses, and compilations are allowed. Relevant video editing software may be used. Background music (non-explicit) is allowed.',
        rules: [],
        dateTime: "During MindSpark'26 (3–4 Oct 2026)",
        venue: '',
      },
    ],
  },
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
    rewriteRules: (rules) => {
      const fixed = (rules || []).map((r) =>
        String(r).replace(/29th\s+of\s+October\s+202\s*6/gi, '29th of September 2026')
          .replace(/29th\s+October\s+202\s*6/gi, '29th September 2026')
          .replace(/5t\s*h\s+September\s+202\s*6/gi, '5th September 2026')
          .replace(/26th\s+September\s+202\s*6/gi, '26th September 2026')
          .replace(/\bF\s+inal\b/gi, 'Final'),
      );
      // Ensure website-update line is its own bullet when glued to prior rule
      const out = [];
      for (const rule of fixed) {
        const split = String(rule).split(/(?<=\.)\s+(?=Participants are requested to check)/i);
        out.push(...split.map((s) => s.trim()).filter(Boolean));
      }
      return out;
    },
  },
  'Take Off': {
    rewriteRules: (rules) => {
      const list = (rules || []).map((r) => String(r));
      // Rulebook OCR splits rule 5 mid-sentence into 5+6 — merge back
      const merged = [];
      for (let i = 0; i < list.length; i += 1) {
        const cur = list[i].trim();
        const next = (list[i + 1] || '').trim();
        if (/then the points\.?$/i.test(cur) && /^Points will be counted/i.test(next)) {
          merged.push(
            `${cur.replace(/\.$/, '')} ${next.replace(/^Points will/i, 'will')}`
              .replace(/\s+/g, ' ')
              .replace(/then the points will will/i, 'then the points will')
              .trim(),
          );
          i += 1;
          continue;
        }
        // Split glued "Rules may be changed… Participants are requested…"
        if (/Rules may be changed/i.test(cur) && /Participants are requested to check/i.test(cur)) {
          const parts = cur.split(/(?<=intimation\.)\s+(?=Participants are requested)/i);
          merged.push(...parts.map((p) => p.trim()).filter(Boolean));
          continue;
        }
        merged.push(cur);
      }
      return merged;
    },
  },
  'FUSION ID': {
    rewriteRounds: (rounds) => {
      const FUSION_FALLBACK_ROUNDS = [
        {
          roundNumber: 1,
          title: 'Fusion Fundamentals',
          description:
            'Online Fusion Fundamentals webinar by Autodesk. Attendance is compulsory. Question statement is based on the webinar; basic-level design submission online.',
          rules: [],
          dateTime: "During MindSpark'26 (3–4 Oct 2026)",
          venue: '',
        },
        {
          roundNumber: 2,
          title: 'Design Round',
          description: 'Offline design round. Topic announced 1 hour prior to the round.',
          rules: [],
          dateTime: "During MindSpark'26 (3–4 Oct 2026)",
          venue: '',
        },
      ];
      const cleaned = (rounds || [])
        .filter((r) => !/would be held|must report|failure to/i.test(String(r.title || '')))
        .slice(0, 2)
        .map((r, i) => ({
          ...r,
          roundNumber: i + 1,
          title: i === 0
            ? (r.title && !/^round\s*1$/i.test(r.title) ? r.title : 'Fusion Fundamentals')
            : (r.title && !/^round\s*2$/i.test(r.title) ? r.title : 'Design Round'),
          description: i === 0 && !r.description
            ? FUSION_FALLBACK_ROUNDS[0].description
            : (r.description || (i === 1 ? FUSION_FALLBACK_ROUNDS[1].description : '')),
        }));
      // Never return [] — that would wipe stored rounds in the DB patch
      return cleaned.length > 0 ? cleaned : FUSION_FALLBACK_ROUNDS;
    },
  },
  Utopia: {
    rewriteRules: (rules) => {
      const seen = new Set();
      return (rules || []).filter((r) => {
        const key = String(r).toLowerCase().replace(/\s+/g, ' ').trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  },
  'Game of Innovation': {
    rewriteRules: (rules) => {
      const out = [];
      for (const rule of rules || []) {
        const parts = String(rule).split(/(?<=\.)\s+(?=Participants are requested|In case of any disputes|Decision of)/i);
        out.push(...parts.map((p) => p.trim()).filter(Boolean));
      }
      return out;
    },
    feeAmount: 150,
    registrationFee: '₹150/- for Under 18 students · ₹300/- for UG students · ₹500/- for PG students / PhD Scholars',
    feeTiers: [
      { id: 'under_18', label: 'Under 18 students', amount: 150 },
      { id: 'ug', label: 'UG students', amount: 300 },
      { id: 'pg_phd', label: 'PG students / PhD Scholars', amount: 500 },
    ],
  },
  QuantQuest: {
    description:
      "QuantQuest is a quiz under Quantumania at MindSpark'26 that tests analytical thinking, quantitative aptitude, and problem-solving speed across multiple rounds.",
    teamSize: 'Max 2 participants per team',
    registrationFee: '₹199 per team',
    feeAmount: 199,
    commonRules: [
      'Participants must carry a valid college ID card and registration receipt.',
      'Use of electronic devices during the quiz is strictly prohibited unless announced otherwise.',
      'Teams found using unfair means will be disqualified.',
      'Decision of the quiz masters and organizers will be final and binding.',
      'Rules may be changed without prior intimation.',
      'Participants are requested to check the MindSpark\'26 website (www.mind-spark.org) regularly for updates.',
    ],
    contact: {
      name: '',
      phone: '',
      email: '',
      instagram: '',
    },
  },
  'Robo Falconry': {
    name: 'Robo Falconry',
  },
  'BEYOND SUITS': {
    name: 'Beyond Suits',
    rewriteRules: (rules) =>
      (rules || []).map((r) => String(r).replace(/\s{2,}/g, ' ').trim()),
  },
  'FANDOM.': {
    name: 'FANDOM',
  },
  Assemblix: {
    requireTeamSize: true,
  },
  Edifex: {
    requireTeamSize: true,
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
  // About should be objective only — strip team-size opener and structure dumps
  let body = String(description || '')
    .replace(/^Team size:[^\n]*\n*/i, '')
    .trim();
  body = body.replace(/^Team size:[^.]*\.?\s*/i, '').trim();
  const cut = body.search(
    /\bEVENT\s+ST[RU]*CTURE\b|\bCATEGORIES\s*:|\bRULES\s*:|\bRound\s*\d+\s*:|\bELIMINATION\s+CRITERIA\b|\bWINNING\s+CRITERIA\b|\bTEAM\s+AND\s+FEE\b/i,
  );
  if (cut > 40) body = body.slice(0, cut).trim();
  if (/\bevent\s+st[ru]*cture\b/i.test(body) || (body.match(/\bround\s*\d+\b/gi) || []).length >= 2) {
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [];
    body = sentences.slice(0, 2).join(' ').trim() || body;
  }
  return body;
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
    let commonRules = Array.isArray(override.commonRules)
      ? [...override.commonRules]
      : (Array.isArray(row.commonRules) ? [...row.commonRules] : []);
    if (typeof override.rewriteRules === 'function') {
      commonRules = override.rewriteRules(commonRules);
    }

    let rounds = Array.isArray(row.rounds) && row.rounds.length ? row.rounds : doc.rounds;
    if (typeof override.rewriteRounds === 'function') {
      const rewritten = override.rewriteRounds(rounds);
      // Guard: empty rewrite must not clear previously stored rounds
      if (Array.isArray(rewritten) && rewritten.length > 0) {
        rounds = rewritten;
      }
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

    const description = override.description
      || applyDescriptionTeamSize(row.description, teamSize);

    const patch = {
      name: nextName,
      description,
      commonRules,
      rounds,
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
    if (Array.isArray(override.feeTiers) && override.feeTiers.length) {
      patch.feeTiers = override.feeTiers;
    }

    // Prefer richer contact from parse when available
    if (override.contact && (override.contact.phone || override.contact.name)) {
      patch.contact = {
        name: override.contact.name || '',
        phone: override.contact.phone || '',
        email: override.contact.email || '',
        instagram: override.contact.instagram || '',
      };
    } else if (row.contact?.phone) {
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
      if (patch.feeTiers) doc.markModified('feeTiers');
      await doc.save();
      // refresh map key if renamed
      compsByNorm.delete(normName(doc.name));
      compsByNorm.set(normName(nextName), doc);
    }
    updated += 1;
  }

  // QuantQuest PDF is corrupt in the Drive zip — apply curated override if still placeholder / empty
  {
    const qq = existing.find((c) => /quant\s*quest/i.test(c.name))
      || compsByNorm.get(normName('QuantQuest'));
    const qqOverride = OVERRIDES.QuantQuest;
    if (qq && qqOverride && !dryRun) {
      const needs =
        !qq.description
        || /placeholder|full rulebook details will be updated|Team size:/i.test(qq.description)
        || !(qq.commonRules || []).length;
      if (needs) {
        qq.description = qqOverride.description;
        qq.commonRules = qqOverride.commonRules;
        qq.registrationFee = qqOverride.registrationFee;
        qq.feeAmount = qqOverride.feeAmount;
        qq.markModified('commonRules');
        await qq.save();
        console.log('  UPDATE QuantQuest ← curated override (PDF unreadable)');
        updated += 1;
      }
    } else if (qq && qqOverride && dryRun) {
      console.log('  WOULD UPDATE QuantQuest ← curated override (PDF unreadable)');
    }
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
