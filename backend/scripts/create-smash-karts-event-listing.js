/**
 * List Smash Karts Championship on /events while keeping Competition as the register source.
 * Run: node scripts/create-smash-karts-event-listing.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EventShow = require('../src/model/event_show_model');
const Coupon = require('../src/model/coupon_model');

const COMPETITION_ID = '6a75a1a30de24715e0e0a03d';
const COMPETITION_DETAIL_PATH = `/competitions-view-details/${COMPETITION_ID}`;
const COMPETITION_REGISTER_PATH = `/competition-registration/${COMPETITION_ID}`;

const GENERAL_RULES = [
  'Open to all players. Minimum age: 13+.',
  'Only one registration per player is allowed.',
  'Players must use the same Smash Karts account submitted during registration.',
  'Registered Player ID and Username (IGN) cannot be changed after registration.',
  'Minimum account level required: Level 20.',
  'Smurf, alternate, or shared accounts are strictly prohibited.',
  'Entry Fee: ₹120. Apply coupon CTRL20 for 20% OFF (on competition checkout when available).',
  'Registration is confirmed only after successful payment.',
  'Entries are non-refundable unless the tournament is cancelled by CrwdCtrl.',
  'Registration closes once 100 slots are filled.',
  'Players must join the official CrwdCtrl Discord server before the tournament begins.',
  'Private lobby codes will be shared through Discord. Join within 5 minutes of lobby creation.',
  'Hacks, cheats, scripts, macros, bug exploits, teaming, account sharing, impersonation, or abusive behaviour = immediate disqualification.',
  'Players are responsible for their own internet connection.',
  'Prizes are distributed after winner verification within 7 working days.',
  'All CrwdCtrl organizer decisions are final.',
].join('\n');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const existing = await EventShow.findOne({
    title: /Smash Karts Championship/i,
  });
  if (existing) {
    existing.pageSection = 'upcoming';
    existing.pagePriority = 1;
    existing.status = 'published';
    existing.registration = {
      ...(existing.registration?.toObject?.() || existing.registration || {}),
      status: 'open',
      mode: 'external_link',
    };
    existing.registrationLink = COMPETITION_REGISTER_PATH;
    existing.bookingLink = COMPETITION_DETAIL_PATH;
    existing.ticketPrice = 120;
    existing.seatingCapacity = 100;
    existing.slots = '100 slots';
    existing.prizePool = 'Worth ₹9,000+ · 1st ₹5,000 · 2nd ₹2,500 · 3rd ₹1,500';
    existing.generalRules = GENERAL_RULES;
    await existing.save();
    console.log('Updated existing event listing:', existing._id.toString());
  } else {
    const show = await EventShow.create({
      title: 'Smash Karts Championship 2025',
      displayName: 'Smash Karts Championship',
      description: [
        'Welcome to the CrwdCtrl Smash Karts Championship.',
        '',
        'Date: 22nd & 23rd August (Saturday & Sunday)',
        'Platform: Smash Karts',
        'Venue: Online (Discord)',
        'Entry Fee: ₹120',
        'Slots: 100',
        '',
        'Prize Pool Worth ₹9,000+',
        '1st Place: ₹5,000 · 2nd Place: ₹2,500 · 3rd Place: ₹1,500',
        '',
        'Tap Register to complete competition registration with your Smash Karts IGN, Player ID, Discord, and Level.',
      ].join('\n'),
      eventType: 'other',
      eventHeading: 'Esports Tournament',
      organizer: 'CrwdCtrl',
      cast: [],
      venue: 'Online (Discord)',
      city: 'Online',
      showTimings: [
        { date: new Date('2026-08-22T10:00:00.000Z'), time: 'Tournament Day 1' },
        { date: new Date('2026-08-23T10:00:00.000Z'), time: 'Tournament Day 2' },
      ],
      duration: '2 days',
      language: 'English',
      ageRating: '13+',
      ticketPrice: 120,
      pricingMode: 'single',
      platformFeePercent: 2.5,
      seatingCapacity: 100,
      priceLabel: '₹120',
      generalRules: GENERAL_RULES,
      process: [
        'Stage 1: 20 lobbies · 5 players · 3 matches · Top 2 qualify',
        'Stage 2: 8 lobbies · 5 players · 3 matches · Top 2 qualify',
        'Quarter Finals: 4 lobbies · 4 players · Best of 5 · Top 2 qualify',
        'Semi Finals: 2 lobbies · 4 players · Best of 5 · Top 2 qualify',
        'Grand Finals: 3 players · Best of 7 · Highest total points wins',
      ].join('\n'),
      prizePool: 'Worth ₹9,000+ · 1st ₹5,000 · 2nd ₹2,500 · 3rd ₹1,500',
      whatsIncluded: 'Tournament entry, Discord lobby access, match scheduling, prize eligibility',
      eligibility:
        'Open to all players 13+. Smash Karts Level 20+. One registration per player. Same account for the full tournament.',
      slots: '100 slots',
      registrationProcess:
        'Register via the competition form (IGN, Player ID, Level, Discord), pay ₹120, join CrwdCtrl Discord, and report 15 minutes before your match.',
      registrationLink: COMPETITION_REGISTER_PATH,
      bookingLink: COMPETITION_DETAIL_PATH,
      rounds: [
        { title: 'Stage 1', content: '20 Lobbies · 5 Players · 3 Matches · Top 2 qualify' },
        { title: 'Stage 2', content: '8 Lobbies · 5 Players · 3 Matches · Top 2 qualify' },
        { title: 'Quarter Finals', content: '4 Lobbies · 4 Players · Best of 5 · Top 2 qualify' },
        { title: 'Semi Finals', content: '2 Lobbies · 4 Players · Best of 5 · Top 2 qualify' },
        { title: 'Grand Finals', content: '3 Players · Best of 7 · Highest total points wins' },
      ],
      contacts: [{ name: 'CrwdCtrl', role: 'Organizer' }],
      galleryImages: [],
      registration: {
        status: 'open',
        mode: 'external_link',
        formType: 'SINGLE_STEP',
        formSchema: [],
        steps: [],
        googleSheetsUrl: '',
      },
      pageSection: 'upcoming',
      pagePriority: 1,
      showOnHomeSlide: false,
      homeSection: null,
      homePriority: 999,
      customPageSections: [],
      status: 'published',
    });
    console.log('Created event listing:', show._id.toString());
  }

  const coupon = await Coupon.findOne({ code: 'CTRL20' });
  if (coupon) {
    const types = new Set(coupon.applicableEntityTypes || []);
    types.add('competition');
    types.add('event_show');
    coupon.applicableEntityTypes = [...types];
    coupon.active = true;
    await coupon.save();
    console.log('CTRL20 applicable types:', coupon.applicableEntityTypes);
  }

  const listed = await EventShow.findOne({ title: /Smash Karts Championship/i }).lean();
  console.log(
    JSON.stringify(
      {
        eventId: listed._id.toString(),
        title: listed.title,
        pageSection: listed.pageSection,
        status: listed.status,
        registrationMode: listed.registration?.mode,
        registrationLink: listed.registrationLink,
        competitionId: COMPETITION_ID,
        eventsPath: `/events/${listed._id}`,
        adminEvents: '/admin/events',
        adminCompetitions: '/admin/competitions (fest: CrwdCtrl Esports)',
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
