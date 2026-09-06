require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const { toSlug, mergePreviousSlugs, findByIdOrSlug } = require('../src/utils/slug');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const rows = await SportsEvent.find({}).select('title slug previousSlugs status');
  for (const ev of rows) {
    const titleSlug = toSlug(ev.title);
    const primary = toSlug(ev.slug);
    if (titleSlug && primary && titleSlug !== primary) {
      const next = mergePreviousSlugs(ev.previousSlugs, titleSlug);
      const prevLen = (ev.previousSlugs || []).length;
      if (next.length !== prevLen) {
        await SportsEvent.updateOne({ _id: ev._id }, { $set: { previousSlugs: next } });
        console.log('alias', ev.title, '+=', titleSlug);
      }
    }
  }
  const tests = [
    'kova-force',
    'self-defence-workshop-run',
    'the-fitranger-experience',
    'cafe-rave-event',
    'verve-s-first-run',
    '6a60e51d5e383ea86de97f16',
  ];
  for (const t of tests) {
    const hit = await findByIdOrSlug(SportsEvent, t, {
      baseFilter: { status: { $in: ['published', 'completed'] } },
      pickName: (r) => r.title,
      lean: true,
    });
    console.log(t, '→', hit ? `${hit.title} [${hit.status}]` : 'MISS');
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
