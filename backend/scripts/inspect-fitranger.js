require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const { findByIdOrSlug, toSlug, mergePreviousSlugs } = require('../src/utils/slug');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const rows = await SportsEvent.find({
    $or: [
      { title: /fitranger|cafe.?rave|fit.?ranger/i },
      { slug: /fitranger|cafe-rave|fit-ranger/i },
      { previousSlugs: { $in: ['fitranger', 'the-fitranger-experience', 'cafe-rave-event', 'cafe-rave'] } },
    ],
  }).lean();

  console.log('MATCHES', rows.length);
  for (const r of rows) {
    console.log(JSON.stringify({
      id: String(r._id),
      title: r.title,
      slug: r.slug,
      previousSlugs: r.previousSlugs,
      status: r.status,
      showOnSportsPage: r.showOnSportsPage,
      runClubId: r.runClubId ? String(r.runClubId) : null,
      eventDate: r.eventDate,
      registration: r.registration ? {
        status: r.registration.status,
        mode: r.registration.mode,
        requireLogin: r.registration.requireLogin,
      } : null,
    }, null, 2));
  }

  const all = await SportsEvent.find({}).select('title slug previousSlugs status').lean();
  console.log('ALL_RUNS', JSON.stringify(all.map((a) => ({
    title: a.title,
    slug: a.slug,
    prev: a.previousSlugs,
    status: a.status,
    id: String(a._id),
  })), null, 2));

  const candidates = [
    'the-fitranger-experience',
    'fitranger',
    'fit-ranger',
    'the-fitranger',
    'fitranger-experience',
    'cafe-rave-event',
    'cafe-rave',
    'the-fitranger-experience-book',
  ];
  for (const c of candidates) {
    const hit = await findByIdOrSlug(SportsEvent, c, {
      baseFilter: { status: { $in: ['published', 'completed'] } },
      pickName: (row) => row.title,
      lean: true,
    });
    console.log('RESOLVE', c, '->', hit ? `${hit.title}|${hit.slug}|${hit.status}` : 'MISS');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
