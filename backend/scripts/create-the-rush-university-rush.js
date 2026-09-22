/**
 * Create / update THE RUSH — Ritrovo Rush (27 Sep 2026).
 * Café Ritrovo, Kothrud · ₹98 · DJ KIRLO collab.
 *
 * Run: node scripts/create-the-rush-university-rush.js
 * Skip poster: SKIP_POSTER=1 node scripts/create-the-rush-university-rush.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const RunClub = require('../src/model/run_club_model');
const SportsEvent = require('../src/model/sports_model');
const Coupon = require('../src/model/coupon_model');

const SLUG = 'ritrovo-rush-27-sep-2026';
const LEGACY_SLUG = 'university-rush-sppu-27-sep-2026';
const CLUB_SLUG = 'the-rush';
const ENTRY_FEE = 98;
const POSTER = path.join(__dirname, 'assets', 'ritrovo-rush-poster.png');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DESCRIPTION = [
  '⚡ RITROVO RUSH',
  '',
  'Sunday, 27 September | 6:30 AM onwards',
  '📍 Café Ritrovo, Kothrud',
  '',
  'We’re bringing The Rush to Café Ritrovo for a Sunday morning built around movement, connection, good food and a whole lot of energy. 🏃‍♂️☕️',
  '',
  'THE EXPERIENCE',
  '',
  '🏃 Community Run',
  '🎯 Fun Games & Challenges',
  '🤝 Meet New People',
  '☕ Italian Café Experience at Café Ritrovo',
  '🎧 Rave with DJ KIRLO',
  '🏆 Prizes & surprises',
  '',
  'In collaboration with:',
  '☕ Café Ritrovo',
  '🎧 DJ KIRLO',
  '',
  'One morning. One community. One hell of a Rush. ⚡',
  '',
  'RITROVO RUSH - 27.09.26',
  'Move. Connect. Belong.',
].join('\n');

function mergePreviousSlugs(existing = [], ...extra) {
  const out = [];
  for (const s of [...(existing || []), ...extra]) {
    const v = String(s || '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

async function disableRushCoupon() {
  const coupon = await Coupon.findOne({ code: 'RUSH' });
  if (!coupon) return null;
  coupon.active = false;
  await coupon.save();
  return coupon;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const club = await RunClub.findOne({ slug: CLUB_SLUG });
  if (!club) throw new Error('THE RUSH club not found');

  let event = await SportsEvent.findOne({
    $or: [
      { slug: SLUG },
      { slug: LEGACY_SLUG },
      { previousSlugs: SLUG },
      { previousSlugs: LEGACY_SLUG },
      { title: /ritrovo\s*rush/i, runClubId: club._id },
      { title: 'University Rush', runClubId: club._id },
    ],
  });

  let coverUrl = event?.coverImage || '';
  const skipPoster = process.env.SKIP_POSTER === '1' && coverUrl;
  if (!skipPoster) {
    if (!fs.existsSync(POSTER)) throw new Error(`Poster missing: ${POSTER}`);
    if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary config required');
    const uploaded = await cloudinary.uploader.upload(POSTER, {
      public_id: 'crwdctrl/sports/the-rush/ritrovo-rush-sppu-2026',
      overwrite: true,
      resource_type: 'image',
    });
    coverUrl = uploaded.secure_url;
  }

  const existingCovers = event?.coverImages && typeof event.coverImages === 'object'
    ? (event.coverImages.toObject?.() || event.coverImages)
    : {};
  const existingImages = Array.isArray(event?.images) ? event.images.filter(Boolean) : [];
  const existingSchema = Array.isArray(event?.registration?.formSchema)
    ? event.registration.formSchema
    : [];
  const formSchema = existingSchema.length
    ? existingSchema
    : [
      {
        id: 'instagram_id',
        label: 'Instagram ID',
        fieldName: 'instagram_id',
        type: 'text',
        required: true,
        placeholder: '@your_instagram_id',
        options: [],
        optionCoupons: {},
        bookingStep: 2,
      },
    ];

  const previousSlugs = mergePreviousSlugs(
    event?.previousSlugs,
    event?.slug && event.slug !== SLUG ? event.slug : '',
    LEGACY_SLUG,
    'university-rush',
  ).filter((s) => s !== SLUG);

  // 27 Sep 2026 06:30 IST = 01:00 UTC
  const eventDate = new Date('2026-09-27T01:00:00.000Z');

  const payload = {
    title: 'Ritrovo Rush',
    slug: SLUG,
    previousSlugs,
    sportType: 'run_club',
    organizer: 'THE RUSH',
    venue: 'Café Ritrovo, Kothrud',
    city: 'Pune',
    eventDate,
    reportingTime: '6:30 AM onwards',
    registrationFee: ENTRY_FEE,
    originalFee: 0,
    pricingMode: 'single',
    distance: '3 KM',
    runCategory: 'Community Runs',
    participationType: 'individual',
    skillLevel: 'all',
    dressCode: 'Activewear / running gear',
    meetingPoint: 'Café Ritrovo, Kothrud',
    fitnessLevel: 'All levels welcome',
    coverImage: coverUrl,
    coverImages: {
      ...existingCovers,
      page: coverUrl,
      portrait: coverUrl,
      square: coverUrl,
      hero: coverUrl,
      // Upcoming / wide cards keep community shots when already set
      wide: existingCovers.wide && existingCovers.wide !== existingCovers.portrait
        ? existingCovers.wide
        : (existingImages.find((u) => /group-banner|upcoming-wide|group-cheer/i.test(u)) || coverUrl),
      landscape: existingCovers.landscape || existingCovers.wide || coverUrl,
      video: existingCovers.video || existingCovers.wide || coverUrl,
    },
    images: existingImages.length ? existingImages : [coverUrl],
    inclusions: [
      'Community Run (3 KM)',
      'Fun Games & Challenges',
      'Meet New People',
      'Italian Café Experience at Café Ritrovo',
      'Rave with DJ KIRLO',
      'Prizes & surprises',
    ],
    infoSections: [
      {
        title: 'THE EXPERIENCE',
        details: 'We’re bringing The Rush to Café Ritrovo for a Sunday morning built around movement, connection, good food and a whole lot of energy.',
      },
      {
        title: 'IN COLLABORATION',
        details: 'Café Ritrovo · DJ KIRLO',
      },
      {
        title: 'ENTRY',
        details: `Entry ₹${ENTRY_FEE}.`,
      },
    ],
    detailBoxes: [
      { id: 'date', label: 'Date', value: 'Sunday, 27 September 2026', icon: 'calendar', order: 0 },
      { id: 'time', label: 'Time', value: '6:30 AM onwards', icon: 'clock', order: 1 },
      { id: 'venue', label: 'Venue', value: 'Café Ritrovo, Kothrud', icon: 'map', order: 2 },
      { id: 'distance', label: 'Distance', value: '3 KM Run · Fun Games · Prizes', icon: 'default', order: 3 },
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
      allowCoupons: true,
      maxPeoplePerBooking: 10,
      formInstructions: 'Spots fill fast — book your Rush.',
      formSchema,
    },
  };

  // Keep phones if already set on the event
  if (Array.isArray(event?.contactPhones) && event.contactPhones.length) {
    payload.contactPhones = event.contactPhones;
    payload.contactPhone = event.contactPhone || event.contactPhones[0];
  }

  if (event) {
    Object.assign(event, payload);
    event.markModified('coverImages');
    event.markModified('previousSlugs');
    event.markModified('registration');
    event.markModified('infoSections');
    event.markModified('detailBoxes');
    event.markModified('inclusions');
    await event.save();
  } else {
    event = await SportsEvent.create(payload);
  }

  const coupon = await disableRushCoupon();

  console.log(JSON.stringify({
    ok: true,
    eventId: String(event._id),
    slug: event.slug,
    previousSlugs: event.previousSlugs,
    title: event.title,
    venue: event.venue,
    fee: event.registrationFee,
    rushCouponActive: coupon ? coupon.active : null,
    path: `/sports/run/${event.slug}`,
    legacyPath: `/sports/run/${LEGACY_SLUG}`,
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
