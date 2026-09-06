/**
 * Seed MindSpark competition teamSizeMin/Max/Label from RULEBOOK FINAL docx.
 *
 * Usage:
 *   node scripts/seed-mindspark-team-sizes.js
 *   node scripts/seed-mindspark-team-sizes.js --dry-run
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');
const { parseTeamSizeStructured } = require('../src/utils/teamSize');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const DEFAULT_DOCX = path.resolve(__dirname, '../../RULEBOOK FINAL_ (1).docx');

const NAME_ALIASES = {
  flash: 'FLASH',
  'take off': 'Take Off',
  takeoff: 'Take Off',
  torquest: 'TORQUEST',
  'code junkie': 'Code Junkie',
  'neural nexus': 'Neural Nexus',
  webscape: 'Webscape',
  'fusion id': 'FUSION ID',
  'revit rush': 'REVIT RUSH',
  'beyond suits': 'Beyond Suits',
  fandom: 'FANDOM',
  'game of innovation': 'Game of Innovation',
  'the game of innovations': 'Game of Innovation',
  'game of innovations': 'Game of Innovation',
  hackathon: 'Hackathon',
  mathletics: 'Mathletics',
  assemblix: 'Assemblix',
  sherlocked: 'SHERLOCKED',
  'bot wrestling': 'Bot Wrestling',
  'robo falconry': 'Robo Falconry',
  'drone races': 'Robo Falconry',
  roboraces: 'Roboraces',
  'virtual robotics': 'Virtual Robotics',
  edifex: 'Edifex',
  utopia: 'Utopia',
  'on the etch': 'ON THE ETCH',
  'circuit fixer': 'CIRCUIT FIXER',
  'fox hunt': 'Fox Hunt',
  microapps: 'MICROAPPS',
  ideathon: 'Ideathon',
  worldwize: 'WORLDWIZE',
  'world-wize': 'WORLDWIZE',
  googler: 'Googler',
  robosoccer: 'Robosoccer',
  roboroyale: 'RoboRoyale',
  robowars: 'Robowars',
  'search n destroy': 'SEARCH N DESTROY',
  "search n' destroy": 'SEARCH N DESTROY',
  quantquest: 'QuantQuest',
};

/** Curated from RULEBOOK FINAL when auto name-detection fails */
const MANUAL_TEAM_BY_COMP = {
  'Code Junkie': 'Max 2 participants per team',
  'Beyond Suits': 'Max 2 participants per team',
  FANDOM: 'Max 2 participants per team',
  'Bot Wrestling': 'Max 4 participants per team',
  'Robo Falconry': 'Max 5 participants per team',
  Roboraces: 'Minimum 2 to Maximum 4 participants per team',
  Utopia: 'Max 5 participants per team',
  WORLDWIZE: 'Max 2 participants per team',
  Robosoccer: 'Maximum 4 participants per team',
  RoboRoyale: 'Max 5 participants per team',
  Robowars: 'Maximum of 5 participants per team',
  'SEARCH N DESTROY': 'Max 4 participants per team',
  QuantQuest: 'Max 2 participants per team',
};

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractDocxText(docxPath) {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml missing in docx');
  return entry.getData().toString('utf8')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseTeamBlocks(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^TEAM AND FEE STRUCTURE|^TEAM FEE AND STRUCTURE/i.test(lines[i])) continue;
    let teamRaw = '';
    for (let j = i; j < Math.min(i + 15, lines.length); j += 1) {
      const m = lines[j].match(/team\s*size\s*:?\s*(.+)$/i);
      if (m) {
        teamRaw = m[1].trim();
        break;
      }
    }
    if (!teamRaw) continue;

    let name = '';
    for (let k = i - 1; k >= Math.max(0, i - 50); k -= 1) {
      const p = lines[k];
      if (/^(EVENT OBJECTIVE|EVENT STUCTURE|EVENT STRUCTURE|RULES|CATEGORIES|ELIMINATION|WINNING|ROUND|NOTE|FAQ)/i.test(p)) {
        continue;
      }
      if (p.length >= 3 && p.length <= 45) {
        const key = normalizeKey(p);
        if (NAME_ALIASES[key] || /^[A-Z0-9][A-Za-z0-9 &'’\-]{1,40}$/.test(p)) {
          name = NAME_ALIASES[key] || p;
          break;
        }
      }
    }
    blocks.push({
      detectedName: name,
      teamRaw,
      structured: parseTeamSizeStructured(teamRaw),
    });
  }
  return blocks;
}

function scoreMatch(compName, detected) {
  const a = normalizeKey(compName);
  const b = normalizeKey(detected);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (NAME_ALIASES[b] && normalizeKey(NAME_ALIASES[b]) === a) return 95;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const docxPath = process.argv.find((a) => a.endsWith('.docx')) || DEFAULT_DOCX;
  if (!fs.existsSync(docxPath)) {
    console.error('Docx not found:', docxPath);
    process.exit(1);
  }

  const text = extractDocxText(docxPath);
  const blocks = parseTeamBlocks(text);
  console.log(`Parsed ${blocks.length} TEAM AND FEE blocks from ${path.basename(docxPath)}`);

  await mongoose.connect(process.env.MONGODB_URI);
  const comps = await Competition.find({ fest: FEST_ID }).select('name teamSizeMin teamSizeMax teamSizeLabel');
  console.log(`MindSpark competitions in DB: ${comps.length}`);

  const report = { matched: [], unmatched: [], ambiguous: [] };

  for (const comp of comps) {
    const scored = blocks
      .map((b, idx) => ({ idx, b, score: scoreMatch(comp.name, b.detectedName) }))
      .filter((x) => x.score >= 70)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      const manual = MANUAL_TEAM_BY_COMP[comp.name];
      if (manual) {
        const patch = parseTeamSizeStructured(manual);
        report.matched.push({
          name: comp.name,
          from: 'manual-override',
          team: `${patch.teamSizeMin}-${patch.teamSizeMax}`,
          label: patch.teamSizeLabel,
        });
        if (!dryRun) {
          await Competition.updateOne({ _id: comp._id }, { $set: patch });
        }
        console.log(`  ✓ ${comp.name} ← manual → ${patch.teamSizeLabel} (${patch.teamSizeMin}-${patch.teamSizeMax})`);
        continue;
      }
      report.unmatched.push(comp.name);
      const fallback = parseTeamSizeStructured('Solo');
      if (!dryRun) {
        await Competition.updateOne({ _id: comp._id }, { $set: fallback });
      }
      console.log(`  ? ${comp.name} → Solo (unmatched, default)`);
      continue;
    }

    if (scored.length > 1 && scored[0].score === scored[1].score) {
      report.ambiguous.push({ name: comp.name, options: scored.slice(0, 3).map((s) => s.b.detectedName) });
    }

    const best = scored[0];
    const patch = best.b.structured;
    report.matched.push({
      name: comp.name,
      from: best.b.detectedName,
      team: `${patch.teamSizeMin}-${patch.teamSizeMax}`,
      label: patch.teamSizeLabel,
    });
    if (!dryRun) {
      await Competition.updateOne({ _id: comp._id }, { $set: patch });
    }
    console.log(`  ✓ ${comp.name} ← ${best.b.detectedName || '?'} → ${patch.teamSizeLabel} (${patch.teamSizeMin}-${patch.teamSizeMax})`);
  }

  console.log('\nCoverage:', {
    matched: report.matched.length,
    unmatched: report.unmatched.length,
    ambiguous: report.ambiguous.length,
    dryRun,
  });
  if (report.unmatched.length) console.log('Unmatched:', report.unmatched);
  if (report.ambiguous.length) console.log('Ambiguous:', report.ambiguous);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
