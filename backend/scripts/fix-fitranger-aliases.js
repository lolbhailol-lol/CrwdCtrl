require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const RunClub = require('../src/model/run_club_model');
const { mergePreviousSlugs, findByIdOrSlug } = require('../src/utils/slug');

const FITRANGER_ID = '6a679c6ff59968ec249ee072';
const ALIASES = [
  'fitranger',
  'fit-ranger',
  'the-fitranger',
  'fitranger-experience',
  'the-fitranger-experience', // harmless if same as primary
  'fitranger-event',
  'the-fitranger-event',
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const ev = await SportsEvent.findById(FITRANGER_ID);
  if (!ev) {
    console.error('Fitranger event not found');
    process.exit(1);
  }

  const primary = String(ev.slug || '').toLowerCase();
  const next = mergePreviousSlugs(ev.previousSlugs, ...ALIASES).filter((s) => s && s !== primary);
  ev.previousSlugs = next;
  await ev.save();
  console.log('Updated Fitranger aliases:', next);

  // Cafe rave: keep as completed past event, but add short cafe-rave alias for shares
  const cafe = await SportsEvent.findById('6a57758a6364f675d5e5c840');
  if (cafe) {
    const cafePrimary = String(cafe.slug || '').toLowerCase();
    const cafeNext = mergePreviousSlugs(cafe.previousSlugs, 'cafe-rave', 'caferave').filter((s) => s !== cafePrimary);
    cafe.previousSlugs = cafeNext;
    await cafe.save();
    console.log('Updated Cafe Rave aliases:', cafeNext);
  }

  const club = await RunClub.findById(ev.runClubId).select('name slug groupLink').lean();
  console.log('Club:', club);

  const tests = [
    'the-fitranger-experience',
    'fitranger',
    'fit-ranger',
    'the-fitranger',
    'fitranger-experience',
    'fitranger-event',
    'cafe-rave-event',
    'cafe-rave',
    String(FITRANGER_ID),
  ];
  for (const t of tests) {
    const hit = await findByIdOrSlug(SportsEvent, t, {
      baseFilter: { status: { $in: ['published', 'completed'] } },
      pickName: (row) => row.title,
      lean: true,
    });
    console.log('RESOLVE', t, '->', hit ? `${hit.title} | ${hit.slug} | ${hit.status}` : 'MISS');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
