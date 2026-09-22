/**
 * Create / update THE RUSH — University Rush (27 Sep 2026) as a live published run.
 * Early bird: ₹98 (was ₹149 · ~34% off).
 *
 * Run: node scripts/create-the-rush-university-rush.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const RunClub = require('../src/model/run_club_model');
const SportsEvent = require('../src/model/sports_model');

const SLUG = 'university-rush-sppu-27-sep-2026';
const CLUB_SLUG = 'the-rush';
const POSTER = path.join(__dirname, 'assets', 'university-rush-poster.png');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DESCRIPTION = [
  '⚡ THE RUSH — UNIVERSITY RUSH',
  '',
  'A high-energy Sunday morning with The Rush community — built around movement, connection, challenges and good vibes.',
  '',
  'Your experience includes:',
  '• Community Run (3 KM)',
  '• Fun challenges & games',
  '• Meet new people & make new friends',
  '• Content-worthy moments',
  '• The Rush community experience',
  '',
  'This isn’t just a run.',
  'It’s your next Rush. ⚡',
  '',
  'UNIVERSITY RUSH',
  'Run. Connect. Experience.',
].join('\n');

async function main() {
  if (!fs.existsSync(POSTER)) throw new Error(`Poster missing: ${POSTER}`);
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary config required');

  const uploaded = await cloudinary.uploader.upload(POSTER, {
    public_id: 'crwdctrl/sports/the-rush/university-rush-sppu-2026',
    overwrite: true,
    resource_type: 'image',
  });
  const coverUrl = uploaded.secure_url;

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const club = await RunClub.findOne({ slug: CLUB_SLUG });
  if (!club) throw new Error('THE RUSH club not found');

  // 27 Sep 2026 06:30 IST = 01:00 UTC
  const eventDate = new Date('2026-09-27T01:00:00.000Z');

  const payload = {
    title: 'University Rush',
    slug: SLUG,
    sportType: 'run_club',
    organizer: 'THE RUSH',
    venue: 'SPPU Main Building, Savitribai Phule Pune University',
    city: 'Pune',
    eventDate,
    reportingTime: '6:30 AM onwards',
    registrationFee: 98,
    originalFee: 149,
    pricingMode: 'single',
    distance: '3 KM',
    runCategory: 'Community Runs',
    participationType: 'individual',
    skillLevel: 'all',
    dressCode: 'Activewear / running gear',
    meetingPoint: 'SPPU Main Building',
    fitnessLevel: 'All levels welcome',
    coverImage: coverUrl,
    coverImages: {
      page: coverUrl,
      wide: coverUrl,
      landscape: coverUrl,
      hero: coverUrl,
      portrait: coverUrl,
    },
    images: [coverUrl],
    inclusions: [
      'Community Run (3 KM)',
      'Fun challenges & games',
      'Meet new people & make new friends',
      'Content-worthy moments',
      'The Rush community experience',
    ],
    infoSections: [
      {
        title: 'THE EXPERIENCE',
        details: 'A high-energy Sunday morning with The Rush community, built around movement, connection, challenges and good vibes.',
      },
      {
        title: 'ENTRY',
        details: 'Early bird ₹98 (was ₹149 · ~34% off). Limited early-bird pricing.',
      },
    ],
    detailBoxes: [
      { id: 'date', label: 'Date', value: 'Sunday, 27 September 2026', icon: 'calendar', order: 0 },
      { id: 'time', label: 'Time', value: '6:30 AM onwards', icon: 'clock', order: 1 },
      { id: 'venue', label: 'Venue', value: 'SPPU Main Building', icon: 'map', order: 2 },
      { id: 'distance', label: 'Distance', value: '3 KM Run · Fun Games · Challenges', icon: 'default', order: 3 },
    ],
    description: DESCRIPTION,
    runClubId: club._id,
    status: 'published',
    showInUpcoming: true,
    showInRunClubs: true,
    showOnSportsPage: true,
    featuredSection: 'both',
    upcomingPriority: 1,
    runClubPriority: 1,
    priority: 1,
    registration: {
      status: 'open',
      mode: 'internal_form',
      requireLogin: true,
      maxPeoplePerBooking: 10,
      formInstructions: 'Early bird ₹98 (was ₹149). Spots fill fast — book your Rush.',
      formSchema: [],
    },
  };

  let event = await SportsEvent.findOne({
    $or: [{ slug: SLUG }, { title: 'University Rush', runClubId: club._id }],
  });

  if (event) {
    Object.assign(event, payload);
    await event.save();
  } else {
    event = await SportsEvent.create(payload);
  }

  console.log(JSON.stringify({
    ok: true,
    eventId: String(event._id),
    slug: event.slug,
    title: event.title,
    club: club.name,
    fee: event.registrationFee,
    originalFee: event.originalFee,
    discountPercent: Math.round(((149 - 98) / 149) * 100),
    eventDate: event.eventDate,
    status: event.status,
    coverImage: event.coverImage,
    path: `/sports/run/${event.slug}`,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
