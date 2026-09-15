/**
 * Add Dreamy Waterfall & Blue Lagoon as a Trek under the existing
 * Trek community "The Roamer's Cult" (Cashfree via community.paymentGateway).
 *
 * Also retires the mistaken Events-hub RunClub/SportsEvent copies if present.
 *
 * Usage: railway run --service CrwdCtrl -- node scripts/seed-roamers-cult-dreamy-waterfall-trek.js
 */
const mongoose = require('mongoose');
const TrekCommunity = require('../src/model/trek_community_model');
const Trek = require('../src/model/trek_model');
const RunClub = require('../src/model/run_club_model');
const SportsEvent = require('../src/model/sports_model');

const COMMUNITY_ID = '6a8f2075f27ed4d37ae6e104';
const TREK_SLUG = 'dreamy-waterfall-blue-lagoon';

const BATCHES = [
  { date: '2026-09-04', batchSize: 50, timing: 'Fri–Sat · Crowd free', note: '4–5 Sept' },
  { date: '2026-09-05', batchSize: 50, timing: 'Sat–Sun', note: '5–6 Sept' },
  { date: '2026-09-11', batchSize: 50, timing: 'Fri–Sat · Crowd free', note: '11–12 Sept' },
  { date: '2026-09-12', batchSize: 50, timing: 'Sat–Sun', note: '12–13 Sept' },
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGODB_URI');
  await mongoose.connect(uri);

  const community = await TrekCommunity.findById(COMMUNITY_ID);
  if (!community) throw new Error('Roamer trek community not found: ' + COMMUNITY_ID);

  // Ensure Cashfree (platform) — trek checkout uses community.paymentGateway
  if (community.paymentGateway !== 'cashfree') {
    community.paymentGateway = 'cashfree';
  }
  if (!community.trekCategories?.includes('Waterfalls')) {
    community.trekCategories = [...new Set([...(community.trekCategories || []), 'Waterfalls', 'Monsoon', 'Adventure'])];
  }
  community.showOnTreks = true;
  community.status = 'published';
  await community.save();
  console.log('Community OK', community.slug, 'gateway=', community.paymentGateway);

  const description = [
    'Hidden Dreamy Waterfall & Blue Lagoon — a crowd-free monsoon trek by The Roamer\'s Cult.',
    '',
    'Age group: 18 to 35. Ex-Pune ₹1,799 per person (Cashfree checkout).',
    '',
    'Highlights: Dreamy Waterfall · Hidden Blue Lagoon · Breakfast & Lunch · Group experience · Pune & Mumbai pickup & drop · Content creator for photos/video · Scenic monsoon trek.',
  ].join('\n');

  const payload = {
    communityId: community._id,
    trekName: 'Dreamy Waterfall & Blue Lagoon',
    slug: TREK_SLUG,
    description,
    difficultyLevel: 'moderate',
    trekDuration: 'Overnight (Fri–Sat or Sat–Sun)',
    startingPoint: 'Pune / Mumbai pickup points',
    destination: 'Hidden Dreamy Waterfall & Blue Lagoon',
    meetingLocation: 'Pune or Mumbai pickup (shared after booking)',
    departureTime: '9:00 PM (Day 1)',
    returnTime: '~9:00 PM (Day 2)',
    city: 'Pune',
    trekCategory: 'adventure',
    trekFilters: {
      duration: ['1N/2D', 'Overnight'],
      difficulty: ['Moderate'],
      budget: ['1500-2000'],
      experience: ['Monsoon', 'Waterfall'],
      timing: ['Weekend', 'Overnight'],
      terrain: ['Waterfall', 'Forest'],
      style: ['Group', 'Social'],
    },
    registrationFee: 1799,
    platformFeePercent: 0,
    maxParticipants: 50,
    dateLabel: 'Upcoming Sept batches',
    trekBatches: BATCHES,
    trekDate: new Date('2026-09-04T00:00:00.000Z'),
    ageRestrictions: '18 to 35',
    fitnessRequirements: 'Moderate monsoon trek fitness',
    trekLeader: "The Roamer's Cult",
    emergencyContact: '+91-7620697285 / +91-8237670566',
    contactInstagram: '',
    contacts: [
      { name: 'Bookings', role: 'Enquiries', phone: '7620697285' },
      { name: 'Bookings', role: 'Enquiries', phone: '8237670566' },
    ],
    inclusions: [
      'Content creator for your shoot',
      'Pune pickup & drop',
      'Life jacket',
      'Breakfast',
      'Lunch',
      'Trek leader expertise charges',
      'Basic first aid',
      'Forest permission charge',
    ],
    exclusions: [
      'Mineral water / lime water / personal purchases',
      'Extra meals / soft drinks ordered',
      'Personal expenses',
      'Anything not listed in inclusions',
      'Costs from roadblocks / bad weather',
      'Medical / emergency evacuations if required',
    ],
    thingsToCarry: [
      'Trekking shoes',
      'Trek pants',
      'Dry-fit cotton T-shirt',
      'Woolen cap',
      'Water bottles',
      'Extra pair of clothes and towel',
      'Fruits, energy drinks',
      'Power bank',
      'Rain coat',
      'Sunglasses',
    ],
    termsAndConditions: [
      '75% refund if notified via phone 8 or more days prior to the event date.',
      '50% refund if notified via phone 4 to 7 days prior to the event date.',
      'No refund if cancellation is requested less than 3 days prior to the event date.',
      'No show — no refund.',
      'Event tickets cannot be transferred to another date against cancellation.',
      'If the trek is cancelled we refund the trek amount only. Natural calamity / unrest beyond control — same cancellation policy applies.',
      'Age group 18–35 only. Advance booking mandatory.',
    ],
    itinerary: [
      {
        day: 1,
        title: 'Overnight bus · ice-breakers',
        description: 'Report at pickup, dance & fun activities through the night.',
        points: [
          { text: '9:00 PM — Reporting at pickup location', level: 'main', showDot: true },
          { text: 'Pune pickups: Shivaji Nagar Metro ~9:15 · JM Road ~9:20 · JW Marriott ~9:40 · Aundh ~9:50 · Wakad ~10:00 · Pashan ~11:00 · Chandni Chowk ~11:05', level: 'sub', showDot: false },
          { text: 'Mumbai pickups (Sat–Sun only): Dadar TT · Sion · Diamond Garden Chembur · Vashi · Juinagar · Nerul · Kalamboli (≈9:30–10:30 PM)', level: 'sub', showDot: false },
          { text: '10:00 PM – 4:00 AM — Dance, fun activities, making new friends', level: 'main', showDot: true },
          { text: '4:30 AM — Introduction, freshen up & fun games', level: 'main', showDot: true },
        ],
      },
      {
        day: 2,
        title: 'Blue Lagoon + Dreamy Waterfall',
        description: 'Lagoon dip, waterfall trek, lunch, return to Pune.',
        points: [
          { text: '5:30 AM — Breakfast and tea', level: 'main', showDot: true },
          { text: '6:00 AM — Enjoy Blue Lagoon (supervised dip)', level: 'main', showDot: true },
          { text: '8:00 AM — Journey toward Dreamy Waterfall / start trek', level: 'main', showDot: true },
          { text: '9:00–11:00 AM — Enjoy the waterfall', level: 'main', showDot: true },
          { text: '2:00 PM — Lunch at base village', level: 'main', showDot: true },
          { text: '3:30 PM — Departure for Pune', level: 'main', showDot: true },
          { text: '9:00 PM — End of journey / farewell', level: 'main', showDot: true },
        ],
      },
    ],
    detailBoxes: [
      { id: 'price', label: 'Price', value: '₹1,799 / person (Ex-Pune)', icon: 'default', order: 1 },
      { id: 'age', label: 'Age', value: '18 to 35', icon: 'default', order: 2 },
      { id: 'vibe', label: 'Vibe', value: 'Crowd-free monsoon', icon: 'default', order: 3 },
      { id: 'pickup', label: 'Pickup', value: 'Pune & Mumbai', icon: 'default', order: 4 },
    ],
    status: 'published',
    showOnHomeSlide: false,
    communityPriority: 1,
    trekPagePriority: 10,
    registration: {
      status: 'open',
      mode: 'internal_form',
      requireLogin: true,
      maxPeoplePerBooking: 4,
      availableDates: BATCHES.map((b) => b.date),
      timeSlots: [],
      locationOptions: [
        'Pune pickup (all batches)',
        'Mumbai pickup (Sat–Sun batches only)',
      ],
      formInstructions:
        'Age 18–35. Fri–Sat batches are crowd-free. Mumbai pickup is Sat–Sun only. Advance booking mandatory. Email Info@theroamerscult.com',
      formSchema: [
        {
          id: 'gender',
          label: 'Gender',
          fieldName: 'gender',
          type: 'select',
          required: true,
          options: ['Female', 'Male', 'Other'],
          placeholder: '',
        },
        {
          id: 'pickup_city',
          label: 'Pickup city',
          fieldName: 'pickup_city',
          type: 'select',
          required: true,
          options: ['Pune (all batches)', 'Mumbai (Sat–Sun batches only)'],
          placeholder: '',
        },
        {
          id: 'emergency_contact',
          label: 'Emergency contact name & number',
          fieldName: 'emergency_contact',
          type: 'text',
          required: true,
          options: [],
          placeholder: 'Name + phone',
        },
      ],
      genderQuotas: { enabled: false, femaleSeats: 0, maleSeats: 0, othersSeats: 0 },
      genderPhase: 'all',
    },
  };

  let trek = await Trek.findOne({
    $or: [
      { slug: TREK_SLUG },
      { communityId: community._id, trekName: /dreamy\s*waterfall/i },
    ],
  });

  if (trek) {
    Object.assign(trek, payload);
    trek.markModified('registration');
    trek.markModified('trekBatches');
    trek.markModified('itinerary');
    trek.markModified('detailBoxes');
    trek.markModified('trekFilters');
    await trek.save();
    console.log('Updated trek', String(trek._id), trek.slug);
  } else {
    trek = await Trek.create(payload);
    console.log('Created trek', String(trek._id), trek.slug);
  }

  // Retire mistaken Events-hub copies so admin/treks aren't confused
  const badClub = await RunClub.findOne({ slug: 'the-roamers-cult', listingHub: 'events' });
  if (badClub) {
    badClub.status = 'draft';
    badClub.showOnEventsPage = false;
    await badClub.save();
    const badEvents = await SportsEvent.updateMany(
      { runClubId: badClub._id },
      { $set: { status: 'draft', showOnEventsPage: false } },
    );
    console.log('Retired mistaken events-hub club + events', String(badClub._id), badEvents.modifiedCount);
  }

  console.log(
    JSON.stringify(
      {
        communityUrl: `/treks/community/${community.slug}`,
        trekUrl: `/trek/${trek.slug}`,
        bookUrl: `/trek/${trek.slug}/book`,
        fee: trek.registrationFee,
        mode: trek.registration?.mode,
        paymentGateway: community.paymentGateway,
        batches: trek.trekBatches?.map((b) => b.date),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
