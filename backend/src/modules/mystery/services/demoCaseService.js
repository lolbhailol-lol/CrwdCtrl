const MysteryCase = require('../models/MysteryCase');
const MysteryEvent = require('../models/MysteryEvent');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { generateRandomCode } = require('../utils/generateCode');

const DEMO_PASSWORD = 'demo1234';
const DEFAULT_TEMPLATE = 'gap';

/**
 * Ready-to-play sample cases. Clues reference each other by `key`:
 * `after` = prerequisite clue keys, `lead` = branch lead that unlocks it, `links` = hidden connections.
 */
const DEMO_TEMPLATES = {
  cashbox: {
    case: {
      title: 'The Fest Cash Box',
      tagline: 'Registration money vanished from a locked box — nobody forced the lock',
      synopsis: 'At 2:30 PM the fest registration cash box was found empty. The lock was never forced. Follow the key, decide who to trust, and name the person who opened it.',
      mysteryIdentityName: 'The key holder',
      mysteryIdentityPrompt: 'Who opened the cash box?',
      difficulty: 'rookie',
      estimatedMinutes: 15,
      correctIdentityTheory: 'The sports captain — he borrowed the key at 2:10 PM and it turned up in the sports room',
    },
    clues: [
      { key: 'box', code: 'PHY-01', world: 'physical', title: 'Empty cash box', description: 'The cash box from the registration desk is empty. The lock isn\'t damaged — it was opened with a key.', timestampLabel: '14:30', reliability: 'reliable', requiresQR: true, points: 10, placementNote: 'Starting point — at the registration desk' },
      { key: 'volunteer', code: 'HUM-01', world: 'human', title: 'Volunteer\'s statement', description: 'Riya: "I locked the box at 2 PM and handed the key to the treasurer."', timestampLabel: '14:00', reliability: 'ambiguous', requiresQR: false, points: 10, after: ['box'] },
      { key: 'upi', code: 'DIG-01', world: 'digital', title: 'UPI screenshot', description: 'A screenshot shows ₹4,000 sent from the treasurer\'s account to an unknown number at 2:20 PM.', timestampLabel: '14:20', reliability: 'unreliable', requiresQR: true, points: 10, after: ['box'], canBeInvalidated: true, placementNote: 'Notice board near the main stage' },
      { key: 'key', code: 'PHY-02', world: 'physical', title: 'The missing key', description: 'The cash box key was found in the sports room, next to the cricket kit.', timestampLabel: '14:25', reliability: 'reliable', requiresQR: true, points: 15, after: ['box'], placementNote: 'Sports room door' },
      { key: 'logic', code: 'LOG-01', world: 'logic', title: 'Who held the key?', description: 'The treasurer lent the key to the sports captain at 2:10 PM to open the kit cupboard. Only one person had it after that.', timestampLabel: '14:10', reliability: 'reliable', requiresQR: false, points: 20, after: ['volunteer', 'key'] },
    ],
    links: { box: ['volunteer', 'key'], key: ['logic'] },
    twists: [
      { after: 3, target: 'upi', message: 'UPDATE: The UPI screenshot was edited. The treasurer\'s bank statement shows no transfer.' },
    ],
  },

  gap: {
    case: {
      title: 'The 17-Minute Gap',
      tagline: 'A prototype vanished from the lab — 17 minutes of footage are missing',
      synopsis: 'The robotics lab prototype disappeared between 17:00 and 17:17. The CCTV has a 17-minute gap. Scan the clues, decide who to trust, and figure out who A-17 is.',
      mysteryIdentityName: 'A-17',
      mysteryIdentityPrompt: 'Who or what is A-17?',
      difficulty: 'detective',
      estimatedMinutes: 20,
      correctIdentityTheory: 'A-17 is the lab assistant\'s keycard — the night guard used it to open the lab',
    },
    branch: {
      prompt: 'Which lead will you follow first?',
      leads: [
        { id: 'server', label: 'Server room logs', description: 'Check the keycard entries' },
        { id: 'canteen', label: 'Canteen witness', description: 'Someone who saw a person that evening' },
      ],
    },
    clues: [
      { key: 'window', code: 'PHY-01', world: 'physical', title: 'Broken lab window', description: 'The window was opened from the inside, not broken in from outside. There is a blue paint mark on the sill.', timestampLabel: '17:00', reliability: 'reliable', requiresQR: true, points: 10, placementNote: 'Starting point — at the registration desk' },
      { key: 'cctv', code: 'DIG-01', world: 'digital', title: 'CCTV still — 17:03', description: 'The still shows a student outside the lab. The timestamp in the corner is slightly blurred.', timestampLabel: '17:03', reliability: 'unreliable', requiresQR: true, points: 10, after: ['window'], canBeInvalidated: true, placementNote: 'Library entrance notice board' },
      { key: 'guard', code: 'HUM-01', world: 'human', title: 'Guard\'s statement', description: '"I was at the gate from 17:00 to 17:20, nobody went in." There is blue paint on his shoes.', timestampLabel: '17:10', reliability: 'ambiguous', requiresQR: false, points: 10, after: ['window'] },
      { key: 'server', code: 'DIG-02', world: 'digital', title: 'Keycard log — A-17', description: 'The lab door was opened at 17:04 with keycard A-17. A-17 is registered to the lab assistant, who was on leave that day.', timestampLabel: '17:04', reliability: 'reliable', requiresQR: false, points: 15, lead: 'server' },
      { key: 'canteen', code: 'HUM-02', world: 'human', title: 'Canteen worker\'s tip', description: '"At 17:15 the guard carried a big box toward the parking lot."', timestampLabel: '17:15', reliability: 'reliable', requiresQR: false, points: 15, lead: 'canteen' },
      { key: 'logic', code: 'LOG-01', world: 'logic', title: 'Timeline math', description: 'If the guard was at the gate, who used the A-17 card? The paint, the keycard and the box all point to the same person.', timestampLabel: '17:17', reliability: 'reliable', requiresQR: false, points: 20, after: ['window', 'guard'] },
    ],
    links: { window: ['guard', 'logic'], server: ['logic'], canteen: ['guard', 'logic'] },
    twists: [
      { after: 3, target: 'cctv', message: 'UPDATE: The timestamp on CCTV still DIG-01 was edited. Do not trust this clue anymore.' },
    ],
  },

  blackout: {
    case: {
      title: 'Blackout at the Hackathon',
      tagline: 'The lights went out for 9 minutes — and the final problem leaked',
      synopsis: 'At 2 AM in a 24-hour hackathon, Hall B lost power for 9 minutes. When the lights came back, the secret final problem statement had been posted by a user called "ghost". Two clues will turn out to be fake. Find out who ghost is.',
      mysteryIdentityName: 'ghost',
      mysteryIdentityPrompt: 'Who is "ghost"?',
      difficulty: 'master',
      estimatedMinutes: 35,
      correctIdentityTheory: 'ghost is a member of team NullPointers — they switched off the breaker, posted from their own hotspot, and left their sticker on the panel',
    },
    branch: {
      prompt: 'Where do you dig next?',
      leads: [
        { id: 'wifi', label: 'Wi-Fi logs', description: 'Who stayed online during the blackout?' },
        { id: 'mentor', label: 'Mentors\' room', description: 'A mentor says they know something' },
        { id: 'bins', label: 'Recycling bins', description: 'Search what was thrown away near Hall B' },
      ],
    },
    clues: [
      { key: 'breaker', code: 'PHY-01', world: 'physical', title: 'Switched-off breaker', description: 'The Hall B breaker was switched off by hand, not tripped by overload. There is fresh sticker residue on the panel.', timestampLabel: '01:55', reliability: 'reliable', requiresQR: true, points: 10, placementNote: 'Starting point — at the help desk' },
      { key: 'post', code: 'DIG-01', world: 'digital', title: 'The leak post', description: 'At 2:04 AM, user "ghost" posted the final problem statement in the public channel — 6 hours early, during the blackout.', timestampLabel: '02:04', reliability: 'reliable', requiresQR: true, points: 10, after: ['breaker'], placementNote: 'Projector screen in Hall B' },
      { key: 'guard', code: 'HUM-01', world: 'human', title: 'Security guard', description: '"Only organisers went near the panel. I saw someone in a black organiser hoodie around 2 AM."', timestampLabel: '01:58', reliability: 'ambiguous', requiresQR: false, points: 10, after: ['breaker'] },
      { key: 'photo', code: 'DIG-02', world: 'digital', title: 'Hoodie photo', description: 'A photo shows an organiser in a black hoodie standing at the breaker panel.', timestampLabel: '01:58', reliability: 'unreliable', requiresQR: true, points: 10, after: ['guard'], canBeInvalidated: true, placementNote: 'Photo booth backdrop' },
      { key: 'wifi', code: 'DIG-03', world: 'digital', title: 'Wi-Fi login log', description: 'During the blackout only one laptop stayed online — on a phone hotspot named "ghost_ap". The laptop is registered to team NullPointers.', timestampLabel: '02:01', reliability: 'reliable', requiresQR: false, points: 20, lead: 'wifi' },
      { key: 'mentor', code: 'HUM-02', world: 'human', title: 'Mentor\'s claim', description: '"Trust me, an organiser leaked it to help a friend\'s team."', timestampLabel: '02:30', reliability: 'unreliable', requiresQR: false, points: 10, lead: 'mentor', canBeInvalidated: true },
      { key: 'stickers', code: 'PHY-02', world: 'physical', title: 'Torn sticker sheet', description: 'A torn sheet of NullPointers team stickers. The missing sticker matches the residue on the breaker panel.', timestampLabel: '02:10', reliability: 'reliable', requiresQR: false, points: 20, lead: 'bins' },
      { key: 'logic', code: 'LOG-01', world: 'logic', title: 'Connect the dots', description: 'Whoever cut the power had to stay online during the blackout to post at 2:04. Who had their own internet when the Wi-Fi went down?', timestampLabel: '02:04', reliability: 'reliable', requiresQR: false, points: 20, after: ['breaker', 'post', 'guard'] },
    ],
    links: { breaker: ['stickers', 'logic'], post: ['wifi', 'logic'], wifi: ['logic'], stickers: ['logic'] },
    twists: [
      { after: 4, target: 'photo', message: 'UPDATE: The hoodie photo is from last year\'s hackathon — the file date gives it away.' },
      { after: 5, target: 'mentor', message: 'UPDATE: The mentor left campus at midnight. Their claim is pure rumour.' },
    ],
  },
};

const DEMO_TEMPLATE_LIST = Object.entries(DEMO_TEMPLATES).map(([id, t]) => ({
  id,
  title: t.case.title,
  tagline: t.case.tagline,
  difficulty: t.case.difficulty,
  estimatedMinutes: t.case.estimatedMinutes,
  clueCount: t.clues.length,
  branchCount: t.branch ? 1 : 0,
  twistCount: t.twists.length,
}));

async function createDemoCase({ createdByEmail = '', template = DEFAULT_TEMPLATE } = {}) {
  const spec = DEMO_TEMPLATES[template] || DEMO_TEMPLATES[DEFAULT_TEMPLATE];
  const mysteryCase = await MysteryCase.create({
    ...spec.case,
    title: `${spec.case.title} (demo ${generateRandomCode(4)})`,
    createdByEmail,
    createdByRole: 'admin',
  });
  const caseId = mysteryCase._id;

  const branch = spec.branch
    ? await InvestigationBranch.create({ caseId, order: 1, ...spec.branch })
    : null;

  const ids = {};
  for (const [index, clue] of spec.clues.entries()) {
    const { key, after = [], lead, ...fields } = clue;
    // eslint-disable-next-line no-await-in-loop
    const node = await EvidenceNode.create({
      caseId,
      ...fields,
      canonicalOrder: index + 1,
      unlockedByEvidenceIds: after.map((k) => ids[k]),
      ...(lead && branch ? { unlockedByBranchId: branch._id, unlockedByLeadId: lead } : {}),
      qrSecret: fields.requiresQR ? generateRandomCode(10) : undefined,
    });
    ids[key] = node._id;
  }

  await Promise.all(Object.entries(spec.links || {}).map(([from, to]) => EvidenceNode.updateOne(
    { _id: ids[from] },
    { $set: { connectsToEvidenceIds: to.map((k) => ids[k]) } },
  )));

  await FightsBackEvent.insertMany(spec.twists.map((t) => ({
    caseId,
    triggerAfterEvidenceCount: t.after,
    invalidatedEvidenceId: ids[t.target],
    systemMessage: t.message,
  })));

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

module.exports = {
  createDemoCase, createDemoEvent, DEMO_PASSWORD, DEMO_TEMPLATES, DEMO_TEMPLATE_LIST,
};
