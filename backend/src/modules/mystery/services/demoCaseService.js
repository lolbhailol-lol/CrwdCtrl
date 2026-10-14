const MysteryCase = require('../models/MysteryCase');
const MysteryEvent = require('../models/MysteryEvent');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { generateRandomCode } = require('../utils/generateCode');

const DEMO_PASSWORD = 'demo1234';

/** Ready-to-play sample case — har mechanic (QR, auto-unlock, branch, fights back) ek baar dikhata hai. */
async function createDemoCase({ createdByEmail = '' } = {}) {
  const suffix = generateRandomCode(4);
  const mysteryCase = await MysteryCase.create({
    title: `The 17-Minute Gap (demo ${suffix})`,
    tagline: 'Lab se prototype gayab — 17 minute ka record missing',
    synopsis: 'Robotics lab ka prototype raat 17:00 se 17:17 ke beech gayab ho gaya. CCTV me 17 minute ka gap hai. Clues scan karo, kis pe trust karna hai decide karo, aur batao A-17 kaun hai.',
    mysteryIdentityName: 'A-17',
    mysteryIdentityPrompt: 'A-17 kaun ya kya hai?',
    difficulty: 'rookie',
    estimatedMinutes: 20,
    correctIdentityTheory: 'A-17 lab assistant ka keycard hai — night guard ne usi se lab khola',
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
    code: 'PHY-01', world: 'physical', title: 'Toota hua lab window',
    description: 'Window andar ki taraf se khula hai, bahar se nahi toda gaya. Sill pe blue paint ka nishaan.',
    timestampLabel: '17:00', canonicalOrder: 1, reliability: 'reliable', requiresQR: true, points: 10,
    placementNote: 'Start point — registration desk pe',
  });
  const cctv = await make({
    code: 'DIG-01', world: 'digital', title: 'CCTV still — 17:03',
    description: 'Still me ek student lab ke bahar dikh raha hai. Timestamp corner me thoda blur hai.',
    timestampLabel: '17:03', canonicalOrder: 2, reliability: 'unreliable', requiresQR: true, points: 10,
    unlockedByEvidenceIds: [window._id], canBeInvalidated: true,
    placementNote: 'Library entrance notice board',
  });
  const guard = await make({
    code: 'HUM-01', world: 'human', title: 'Guard ka statement',
    description: '"Main 17:00 se 17:20 tak gate pe tha, koi andar nahi gaya." Uski shoes pe blue paint hai.',
    timestampLabel: '17:10', canonicalOrder: 3, reliability: 'ambiguous', requiresQR: false, points: 10,
    unlockedByEvidenceIds: [window._id],
  });

  const branch = await InvestigationBranch.create({
    caseId,
    order: 1,
    prompt: 'Pehle kaunsa lead follow karoge?',
    leads: [
      { id: 'server', label: 'Server room logs', description: 'Keycard entries check karo' },
      { id: 'canteen', label: 'Canteen witness', description: 'Jisne raat ko kisi ko dekha' },
    ],
  });

  const serverLog = await make({
    code: 'DIG-02', world: 'digital', title: 'Keycard log — A-17',
    description: 'Lab door 17:04 pe keycard A-17 se khula. A-17 lab assistant ke naam pe registered hai, jo us din chutti pe tha.',
    timestampLabel: '17:04', canonicalOrder: 4, reliability: 'reliable', requiresQR: true, points: 15,
    unlockedByBranchId: branch._id, unlockedByLeadId: 'server',
    placementNote: 'Computer lab, door ke andar',
  });
  const canteen = await make({
    code: 'HUM-02', world: 'human', title: 'Canteen worker ka tip',
    description: '"17:15 pe guard bhaiya ek bada box le ke parking ki taraf gaye the."',
    timestampLabel: '17:15', canonicalOrder: 5, reliability: 'reliable', requiresQR: true, points: 15,
    unlockedByBranchId: branch._id, unlockedByLeadId: 'canteen',
    placementNote: 'Canteen counter',
  });
  const logic = await make({
    code: 'LOG-01', world: 'logic', title: 'Timeline math',
    description: 'Agar guard gate pe tha to A-17 card kisne use kiya? Paint, keycard aur box — teeno ek hi insaan ki taraf point karte hain.',
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
    systemMessage: 'UPDATE: CCTV still DIG-01 ka timestamp edit kiya gaya tha. Is clue pe ab trust mat karo.',
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
