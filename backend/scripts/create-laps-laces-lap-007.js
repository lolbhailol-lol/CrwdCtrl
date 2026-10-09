/**
 * Create or update Laps & Laces — LAP #007: Run × Rave (11 Oct 2026).
 *
 * Run: node scripts/create-laps-laces-lap-007.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const RunClub = require('../src/model/run_club_model');
const SportsEvent = require('../src/model/sports_model');
const { resolveCheckoutGateway } = require('../src/utils/paymentGatewayConfig');

const CLUB_SLUG = 'laps-laces';
const EVENT_SLUG = 'lap-007-run-rave-11-oct-2026';

const DESCRIPTION = [
  '🚨 LAP #007 IS GOING CRAZY 🚨',
  '',
  'This time, we’re switching it up. 👀',
  'RUN × RAVE with Interact Club Salisbury Park — come for the miles, stay for the madness. ⚡️',
  '',
  '📍 Hippie at Heart, NIBM',
  '🏃 Distance: 2.5K',
  '💸 ₹200 only — includes rave entry and any 1 beverage option',
  '🥤 Choose your post-run drink: Cold Coffee / Peach Iced Tea / Lemon Iced Tea',
  '⏰ 7:00 AM',
  '📅 Sunday, 11 October 2026',
  '',
  'Run first. Rave next. Repeat. 🔥',
  '',
  'You bring the ENERGY. We’ll bring the rave. ⚡️',
  '‼️ Don’t miss this one',
  'LACE UP. SHOW UP. 👟',
].join('\n');

function imageFromClub(club, key, fallback = '') {
  return String(club?.coverImages?.[key] || fallback || club?.coverImage || '').trim();
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  if (resolveCheckoutGateway({ entityType: 'sports', listingHub: 'sports' }) !== 'razorpay') {
    throw new Error('RUNS_PAYMENT_GATEWAY must be razorpay before publishing LAP #007');
  }

  await mongoose.connect(uri);
  const club = await RunClub.findOne({ slug: CLUB_SLUG });
  if (!club) throw new Error('Laps & Laces run club not found');
  if (club.organizerGatewayFeeRate !== 0) {
    club.organizerGatewayFeeRate = 0;
    await club.save();
  }

  const previousRun = await SportsEvent.findOne({ runClubId: club._id })
    .sort({ eventDate: -1, createdAt: -1 })
    .lean();
  let event = await SportsEvent.findOne({
    $or: [
      { slug: EVENT_SLUG },
      { previousSlugs: EVENT_SLUG },
      { title: /lap\s*#?0*07/i, runClubId: club._id },
    ],
  });

  const portrait = imageFromClub(club, 'portrait');
  const wide = imageFromClub(club, 'wide', portrait);
  const hero = imageFromClub(club, 'hero', wide);
  const square = imageFromClub(club, 'square', portrait);
  const landscape = imageFromClub(club, 'landscape', wide);
  const contactPhones = Array.isArray(previousRun?.contactPhones)
    ? previousRun.contactPhones.filter(Boolean)
    : [];
  const contactPhone = String(previousRun?.contactPhone || contactPhones[0] || '').trim();

  const payload = {
    title: 'LAP #007 — Run × Rave',
    slug: EVENT_SLUG,
    sportType: 'run_club',
    organizer: 'Laps & Laces × Interact Club Salisbury Park',
    venue: 'Hippie at Heart, NIBM',
    city: 'Pune',
    // 11 Oct 2026 07:00 IST = 01:30 UTC
    eventDate: new Date('2026-10-11T01:30:00.000Z'),
    reportingTime: '7:00 AM',
    registrationFee: 200,
    originalFee: 0,
    pricingMode: 'single',
    distance: '2.5 KM',
    runCategory: 'Morning Runs',
    participationType: 'individual',
    skillLevel: 'all',
    dressCode: 'Running gear / activewear',
    meetingPoint: 'Hippie at Heart, NIBM',
    fitnessLevel: 'All levels welcome',
    coverImage: portrait || club.coverImage,
    coverImages: {
      page: hero,
      portrait,
      wide,
      hero,
      square,
      landscape,
      video: imageFromClub(club, 'video'),
    },
    images: [hero, wide, portrait].filter((url, index, all) => url && all.indexOf(url) === index),
    inclusions: [
      '2.5 KM community run',
      'Rave entry',
      'Any 1 beverage: Cold Coffee, Peach Iced Tea, or Lemon Iced Tea',
    ],
    infoSections: [
      {
        title: 'RUN × RAVE',
        details: 'Come for the miles, stay for the madness. Run first. Rave next. Repeat.',
      },
      {
        title: 'IN COLLABORATION',
        details: 'Interact Club Salisbury Park',
      },
      {
        title: 'ENTRY INCLUDES',
        details: 'Rave entry and any 1 post-run beverage.',
      },
    ],
    detailBoxes: [
      { id: 'date', label: 'Date', value: 'Sunday, 11 October 2026', icon: 'calendar', order: 0 },
      { id: 'time', label: 'Time', value: '7:00 AM', icon: 'clock', order: 1 },
      { id: 'venue', label: 'Venue', value: 'Hippie at Heart, NIBM', icon: 'map', order: 2 },
      { id: 'distance', label: 'Distance', value: '2.5 KM', icon: 'default', order: 3 },
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
      maxPeoplePerBooking: 1,
      formInstructions: 'Choose the beverage you want after the run.',
      formSchema: [
        {
          id: 'post_run_beverage',
          label: 'Choose your post-run drink',
          fieldName: 'post_run_beverage',
          type: 'select',
          required: true,
          options: ['Cold Coffee', 'Peach Iced Tea', 'Lemon Iced Tea'],
          placeholder: 'Select one beverage',
          optionCoupons: {},
          bookingStep: 2,
        },
      ],
    },
  };

  if (contactPhone) payload.contactPhone = contactPhone;
  if (contactPhones.length) payload.contactPhones = contactPhones;

  if (event) {
    Object.assign(event, payload);
    for (const field of ['coverImages', 'images', 'inclusions', 'infoSections', 'detailBoxes', 'registration']) {
      event.markModified(field);
    }
    await event.save();
  } else {
    event = await SportsEvent.create(payload);
  }

  console.log(JSON.stringify({
    ok: true,
    eventId: String(event._id),
    title: event.title,
    slug: event.slug,
    path: `/sports/run/${event.slug}`,
    eventDate: event.eventDate,
    fee: event.registrationFee,
    gateway: 'razorpay',
    organizerGatewayFeeRate: club.organizerGatewayFeeRate,
    organizerDashboard: `/run-club-organizer/events/${event._id}`,
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
