/**
 * AAROHAN Multicity 2026 (Mithibai College, Mumbai): group dance, band wars, solo singing, solo dance.
 * Mumbai hosts the offline elimination rounds; competitions, fees and prize pools
 * are copied from AAROHAN 2027 and the date stays TBA.
 *
 * Usage: node scripts/seed-aarohan-multicity-2026.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE_SLUG = 'aarohan-2027';
const SLUG = 'aarohan-multicity-2026';
const LEGACY_SLUGS = ['aarohan-mumbai-multicity-2027'];
const VENUE = 'Mithibai College, Vile Parle (W), Mumbai';
const TBA = 'To Be Announced';
const TEAM_LIST_EMAIL = 'aarohan.competitions2027@gmail.com';
const PERKS_LINE = 'Qualifiers get travel to the AAROHAN finale, accommodation assistance and free entry passes to the Pronite artist concert.';
const LEADER_ONLY_NOTE = `Only the team leader registers here. After registering, email your full team list (each member's name and phone number) with your team name to ${TEAM_LIST_EMAIL}.`;

const COMPETITIONS = [
  {
    source: 'InSync',
    leaderOnly: true,
    description: 'A group dance competition for crews of 6–20. Clear the offline elimination round at Mithibai College, Mumbai, and earn your place in the AAROHAN finale.',
  },
  {
    source: 'Head Bang',
    leaderOnly: true,
    description: 'Band wars for bands of 4–16 musicians. Play the offline elimination round at Mithibai College, Mumbai, and battle it out live in the AAROHAN finale.',
  },
  {
    source: 'Humming',
    description: 'A solo singing competition for vocalists of every genre. Impress the judges in the offline elimination round at Mithibai College, Mumbai, and sing your way to the AAROHAN finale.',
  },
  {
    source: 'Inner Flame',
    description: 'A solo dance competition open to every style. Clear the offline elimination round at Mithibai College, Mumbai, and light up the AAROHAN finale stage.',
  },
];

const COPY_FIELDS = [
  'name', 'subtitle', 'competitionType', 'category', 'coverImage', 'gallery',
  'commonRules', 'commonRulesMessage', 'judgingCriteria', 'contact',
  'teamSizeMin', 'teamSizeMax', 'teamSizeLabel', 'eventCategory', 'eventFormat', 'module',
];

function buildRounds(rounds = [], { leaderOnly = false } = {}) {
  return rounds.map((round) => {
    const { _id, ...rest } = round;
    if (round.roundNumber !== 1) return { ...rest, dateTime: TBA };
    const rules = (round.rules || []).filter(Boolean);
    if (leaderOnly) rules.unshift(LEADER_ONLY_NOTE);
    return {
      ...rest,
      title: 'Offline Elimination Round – Mumbai',
      rules,
      online: { rules: [] },
      dateTime: TBA,
      venue: VENUE,
    };
  });
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  await mongoose.connect(uri);

  const source = await Fest.findOne({ slug: SOURCE_SLUG }).lean();
  if (!source) throw new Error(`${SOURCE_SLUG} not found`);
  const sourceComps = await Competition.find({
    fest: source._id,
    name: { $in: COMPETITIONS.map((c) => c.source) },
  }).lean();
  const byName = new Map(sourceComps.map((c) => [c.name, c]));
  const missing = COMPETITIONS.filter((c) => !byName.has(c.source)).map((c) => c.source);
  if (missing.length) throw new Error(`Source competitions not found: ${missing.join(', ')}`);

  const festPayload = {
    festName: 'AAROHAN Multicity',
    subtitle: 'AAROHAN comes to Mumbai',
    collegeName: 'Mithibai College',
    festType: 'cultural',
    festDate: TBA,
    venue: VENUE,
    ticketPrice: TBA,
    feeAmount: 0,
    platformFeePercent: 0,
    description: 'AAROHAN is coming to Mumbai!\n\nThe cultural fest of MIT World Peace University brings its multicity edition to Mithibai College, Mumbai, with offline elimination rounds for four flagship performing-arts competitions: group dance, band wars, solo singing and solo dance. Qualifiers move on to the AAROHAN finale and compete for the full prize pool.\n\nPerks for qualifiers:\n• Travel to the AAROHAN finale will be provided\n• Assistance with accommodation\n• Free entry passes to the Pronite artist concert',
    coverImage: source.coverImage,
    coverImages: source.coverImages,
    contacts: source.contacts,
    registration: {
      mode: 'INTERNAL_FORM',
      formType: 'SINGLE_STEP',
      formSchema: source.registration?.formSchema || [],
    },
    status: 'upcoming',
    slug: SLUG,
    isApproved: true,
    competitionsHeading: 'Multicity Events',
    relatedFestIds: [source._id],
  };

  let fest = await Fest.findOne({ slug: { $in: [SLUG, ...LEGACY_SLUGS] } });
  console.log(`${DRY_RUN ? 'WOULD ' : ''}${fest ? 'UPDATE' : 'CREATE'} fest ${festPayload.festName} (${SLUG})`);
  if (!DRY_RUN) {
    if (fest) {
      Object.assign(fest, festPayload);
      await fest.save();
    } else {
      fest = await Fest.create(festPayload);
    }
  }

  const ids = [];
  for (const item of COMPETITIONS) {
    const src = byName.get(item.source);
    const doc = {
      ...Object.fromEntries(COPY_FIELDS.filter((k) => src[k] !== undefined).map((k) => [k, src[k]])),
      category: String(src.category || '').toUpperCase(),
      description: `${item.description}\n\n${PERKS_LINE}`,
      dateTime: TBA,
      venue: VENUE,
      rounds: buildRounds(src.rounds, { leaderOnly: Boolean(item.leaderOnly) }),
      prizePool: src.prizePool || '',
      registrationFee: src.registrationFee || '',
      feeAmount: src.feeAmount || 0,
      feeTiers: (src.feeTiers || []).map(({ _id, ...tier }) => tier),
      slotsAllotted: 0,
      showSlotsPublic: false,
      registrationType: 'fest',
      registration: {
        status: 'internal_form',
        formType: 'SINGLE_STEP',
        formSchema: [],
        personFields: src.registration?.personFields || [],
        leaderOnly: Boolean(item.leaderOnly),
        leaderOnlyNote: item.leaderOnly ? LEADER_ONLY_NOTE : '',
      },
      isApproved: true,
    };
    console.log(`${DRY_RUN ? 'WOULD UPSERT' : 'UPSERT'} ${doc.name} (${doc.subtitle}) team ${doc.teamSizeMin}-${doc.teamSizeMax}, ${doc.rounds.length} rounds`);
    if (DRY_RUN) continue;
    const existing = await Competition.findOne({ fest: fest._id, name: doc.name });
    const comp = existing
      ? await Competition.findByIdAndUpdate(existing._id, { $set: { ...doc, fest: fest._id } }, { new: true, runValidators: true })
      : await Competition.create({ ...doc, fest: fest._id });
    ids.push(comp._id);
  }

  if (!DRY_RUN) {
    fest.competitions = ids;
    await fest.save();
    console.log(JSON.stringify({ festId: String(fest._id), slug: fest.slug, competitions: ids.length }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
