require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const { College, CollegeGame } = require('../src/modules/college-platform/models');

const COMPLETED_EVENT_SLUGS = new Set(['coep-campus-hunt']);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  await mongoose.connect(uri);
  const slugIndex = process.argv.indexOf('--slug');
  const requestedSlug = slugIndex >= 0 ? String(process.argv[slugIndex + 1] || '').trim().toLowerCase() : '';
  const events = await CampusHuntEvent.find(requestedSlug ? { slug: requestedSlug } : {}).sort({ createdAt: 1 }).lean();
  if (requestedSlug && events.length === 0) throw new Error(`Campus Hunt event not found: ${requestedSlug}`);
  let created = 0;
  let updated = 0;
  for (const event of events) {
    const eventSlug = String(event.slug || '').trim().toLowerCase();
    const isCompleted = COMPLETED_EVENT_SLUGS.has(eventSlug);
    const collegeName = String(event.college || 'Campus').trim();
    const collegeSlug = slugify(collegeName) || `college-${String(event._id).slice(-6)}`;
    const college = await College.findOneAndUpdate(
      { slug: collegeSlug },
      { $setOnInsert: { name: collegeName, shortName: collegeName, slug: collegeSlug, status: 'active' } },
      { new: true, upsert: true },
    );
    const existing = await CollegeGame.findOne({ 'engine.eventId': event._id }).lean();
    const setFields = {
      'engine.eventId': event._id,
      'engine.eventSlug': event.slug,
      'engine.type': 'campus_hunt',
    };
    if (!existing || isCompleted) setFields.status = isCompleted ? 'completed' : event.publicLoginLive ? 'published' : 'draft';
    const game = await CollegeGame.findOneAndUpdate(
      { 'engine.eventId': event._id },
      {
        $setOnInsert: {
          title: isCompleted ? `${collegeName} Campus Hunt` : event.name,
          slug: slugify(event.slug || `${collegeName}-${event.name}`),
          tagline: 'A clue hunt. A campus. Your crew.',
          description: event.featureNotes || '',
          coverImage: isCompleted ? '/campus-hunt/v2/hunt-hero.png' : '',
          hostCollegeId: college._id,
          city: '',
          venue: collegeName,
          startsAt: event.date || null,
          teamSize: event.teamSize || 4,
          capacity: event.teamCapacity || 20,
          offlineEnabled: true,
          platformFeePercent: 0,
        },
        $set: setFields,
      },
      { new: true, upsert: true },
    );
    if (existing) updated += 1;
    else if (game) created += 1;
  }
  console.log(JSON.stringify({ success: true, events: events.length, created, updated }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
