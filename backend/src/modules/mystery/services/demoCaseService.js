const MysteryCase = require('../models/MysteryCase');
const MysteryEvent = require('../models/MysteryEvent');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { generateRandomCode } = require('../utils/generateCode');

const DEMO_PASSWORD = 'demo1234';

/** Ready-to-play sample case — shows every mechanic (QR, auto-unlock, branch, fights back) once. */
async function createDemoCase({ createdByEmail = '' } = {}) {
  const suffix = generateRandomCode(4);
  const mysteryCase = await MysteryCase.create({
    title: `The 17-Minute Gap (demo ${suffix})`,
    tagline: 'A prototype vanished from the lab — 17 minutes of footage are missing',
    synopsis: 'The robotics lab prototype disappeared between 17:00 and 17:17. The CCTV has a 17-minute gap. Scan the clues, decide who to trust, and figure out who A-17 is.',
    mysteryIdentityName: 'A-17',
    mysteryIdentityPrompt: 'Who or what is A-17?',
    difficulty: 'rookie',
    estimatedMinutes: 20,
    correctIdentityTheory: 'A-17 is the lab assistant\'s keycard — the night guard used it to open the lab',
    createdByEmail,
    createdByRole: 'admin',
  });
  const caseId = mysteryCase._id;

  const make = (fields) => EvidenceNode.create({
    caseId,
    ...fields,
    qrSecret: fields.requiresQR ? generateRandomCode(10) : undefined,
  });

  const window = await make({
    code: 'PHY-01', world: 'physical', title: 'Broken lab window',
    description: 'The window was opened from the inside, not broken in from outside. There is a blue paint mark on the sill.',
    timestampLabel: '17:00', canonicalOrder: 1, reliability: 'reliable', requiresQR: true, points: 10,
    placementNote: 'Starting point — at the registration desk',
  });
  const cctv = await make({
    code: 'DIG-01', world: 'digital', title: 'CCTV still — 17:03',
    description: 'The still shows a student outside the lab. The timestamp in the corner is slightly blurred.',
    timestampLabel: '17:03', canonicalOrder: 2, reliability: 'unreliable', requiresQR: true, points: 10,
    unlockedByEvidenceIds: [window._id], canBeInvalidated: true,
    placementNote: 'Library entrance notice board',
  });
  const guard = await make({
    code: 'HUM-01', world: 'human', title: 'Guard\'s statement',
    description: '"I was at the gate from 17:00 to 17:20, nobody went in." There is blue paint on his shoes.',
    timestampLabel: '17:10', canonicalOrder: 3, reliability: 'ambiguous', requiresQR: false, points: 10,
    unlockedByEvidenceIds: [window._id],
  });

  const branch = await InvestigationBranch.create({
    caseId,
    order: 1,
    prompt: 'Which lead will you follow first?',
    leads: [
      { id: 'server', label: 'Server room logs', description: 'Check the keycard entries' },
      { id: 'canteen', label: 'Canteen witness', description: 'Someone who saw a person that evening' },
    ],
  });

  const serverLog = await make({
    code: 'DIG-02', world: 'digital', title: 'Keycard log — A-17',
    description: 'The lab door was opened at 17:04 with keycard A-17. A-17 is registered to the lab assistant, who was on leave that day.',
    timestampLabel: '17:04', canonicalOrder: 4, reliability: 'reliable', requiresQR: true, points: 15,
    unlockedByBranchId: branch._id, unlockedByLeadId: 'server',
    placementNote: 'Computer lab, just inside the door',
  });
  const canteen = await make({
    code: 'HUM-02', world: 'human', title: 'Canteen worker\'s tip',
    description: '"At 17:15 the guard carried a big box toward the parking lot."',
    timestampLabel: '17:15', canonicalOrder: 5, reliability: 'reliable', requiresQR: true, points: 15,
    unlockedByBranchId: branch._id, unlockedByLeadId: 'canteen',
    placementNote: 'Canteen counter',
  });
  const logic = await make({
    code: 'LOG-01', world: 'logic', title: 'Timeline math',
    description: 'If the guard was at the gate, who used the A-17 card? The paint, the keycard and the box all point to the same person.',
    timestampLabel: '17:17', canonicalOrder: 6, reliability: 'reliable', requiresQR: false, points: 20,
    unlockedByEvidenceIds: [window._id, guard._id],
  });

  await EvidenceNode.updateOne({ _id: window._id }, { $set: { connectsToEvidenceIds: [guard._id, logic._id] } });
  await EvidenceNode.updateOne({ _id: serverLog._id }, { $set: { connectsToEvidenceIds: [logic._id] } });
  await EvidenceNode.updateOne({ _id: canteen._id }, { $set: { connectsToEvidenceIds: [guard._id, logic._id] } });

  await FightsBackEvent.create({
    caseId,
    triggerAfterEvidenceCount: 3,
    invalidatedEvidenceId: cctv._id,
    systemMessage: 'UPDATE: The timestamp on CCTV still DIG-01 was edited. Do not trust this clue anymore.',
  });

  mysteryCase.status = 'published';
  await mysteryCase.save();
  return mysteryCase;
}

async function createDemoEvent(mysteryCase, { createdByEmail = '' } = {}) {
  const now = new Date();
  return MysteryEvent.create({
    caseId: mysteryCase._id,
    name: `Demo — ${mysteryCase.title}`,
    college: 'CrwdCtrl Demo',
    venue: 'Anywhere',
    slug: `demo-${generateRandomCode(6).toLowerCase()}`,
    date: now,
    teamCapacity: 10,
    teamSize: 4,
    status: 'live',
    startedAt: now,
    isDemo: true,
    createdByEmail,
    createdByRole: 'admin',
  });
}

module.exports = { createDemoCase, createDemoEvent, DEMO_PASSWORD };
