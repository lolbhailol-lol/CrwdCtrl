/**
 * Make Smash Karts a standalone Event (not under CrwdCtrl Esports fest)
 * with a competition-style multi-step registration form + Cashfree payment.
 *
 * Also removes the fest-linked competition created earlier.
 *
 * Run: node scripts/convert-smash-karts-to-standalone-event.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EventShow = require('../src/model/event_show_model');
const Competition = require('../src/model/competition_model');
const FestOrganizer = require('../src/model/fest_organizer_model');
const Coupon = require('../src/model/coupon_model');

const EVENT_ID = '6a75a2fa95aa1e3cd07d316d';
const COMPETITION_ID = '6a75a1a30de24715e0e0a03d';
const FEST_ID = '6a75a18e26da9b960fd625e0';

function field(id, type, label, fieldName, opts = {}) {
  return {
    id,
    type,
    label,
    fieldName,
    placeholder: opts.placeholder || '',
    required: opts.required !== false,
    options: opts.options || [],
  };
}

const GENERAL_RULES = [
  'Open to all players. Minimum age: 13+.',
  'Only one registration per player is allowed.',
  'Players must participate using the same Smash Karts account submitted during registration.',
  'Registered Player ID and Username (IGN) cannot be changed after registration.',
  'Minimum account level required: Level 20.',
  'Smurf, alternate, or shared accounts are strictly prohibited.',
  'Entry Fee: ₹120. Apply coupon CTRL20 for 20% OFF.',
  'Registration is confirmed only after successful payment.',
  'Entries are non-refundable unless the tournament is cancelled by CrwdCtrl.',
  'Registration closes once 100 slots are filled.',
  'Platform: Smash Karts | Venue: Online (Discord).',
  'Players must join the official CrwdCtrl Discord server before the tournament begins.',
  'Private lobby codes will be shared through Discord.',
  'Players must join within 5 minutes of lobby creation or risk forfeit.',
  'Hacks, cheats, scripts, macros, bug exploits, teaming, account sharing, impersonation, or abusive behaviour = immediate disqualification.',
  'Players are responsible for their own internet connection; personal disconnects do not guarantee a rematch.',
  'Prizes distributed after winner verification within 7 working days.',
  'CrwdCtrl may modify schedule, replace no-shows, disqualify violators, resolve disputes, or cancel/postpone. All organizer decisions are final.',
].join('\n');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const steps = [
    {
      stepNumber: 1,
      stepTitle: 'Personal Details',
      stepDescription: 'Tell us how to contact you',
      fields: [
        field('full_name', 'text', 'Full Name', 'full_name', { placeholder: 'Your full name' }),
        field('email', 'email', 'Email Address', 'email', { placeholder: 'you@email.com' }),
        field('mobile', 'tel', 'Mobile Number', 'mobile', { placeholder: '10-digit mobile number' }),
        field('country', 'text', 'Country', 'country', { placeholder: 'India' }),
      ],
    },
    {
      stepNumber: 2,
      stepTitle: 'Game Details',
      stepDescription: 'Smash Karts account information (cannot be changed later)',
      fields: [
        field('ign', 'text', 'Smash Karts Username (IGN)', 'smash_karts_ign', {
          placeholder: 'In-game username',
        }),
        field('player_id', 'text', 'Smash Karts Player ID', 'smash_karts_player_id', {
          placeholder: 'Player ID',
        }),
        field('account_level', 'number', 'Current Account Level', 'account_level', {
          placeholder: 'Must be 20+',
        }),
        field('discord', 'text', 'Discord Username', 'discord_username', {
          placeholder: 'username#0000 or username',
        }),
      ],
    },
    {
      stepNumber: 3,
      stepTitle: 'Availability & Rules',
      stepDescription: 'Confirm you can play and have read the rules',
      fields: [
        field('avail_aug', 'checkbox', 'I am available on 22nd & 23rd August', 'available_aug_22_23', {
          options: ['Yes'],
        }),
        field('joined_discord', 'checkbox', 'I have joined the official CrwdCtrl Discord server', 'joined_discord', {
          options: ['Yes'],
        }),
        field('read_rules', 'checkbox', 'I have read the Rules & Regulations', 'read_rules', {
          options: ['Yes'],
        }),
      ],
    },
    {
      stepNumber: 4,
      stepTitle: 'Before Payment (Mandatory)',
      stepDescription: 'Final confirmations before paying the entry fee',
      fields: [
        field('same_account', 'checkbox', 'I will use the same Smash Karts account throughout the tournament', 'confirm_same_account', { options: ['I confirm'] }),
        field('level_20', 'checkbox', 'My account is Level 20 or above', 'confirm_level_20', { options: ['I confirm'] }),
        field('id_correct', 'checkbox', 'The Player ID and Username submitted are correct', 'confirm_id_correct', { options: ['I confirm'] }),
        field('no_account_change', 'checkbox', 'I understand changing my account after registration is not allowed', 'confirm_no_account_change', { options: ['I understand'] }),
        field('fair_play', 'checkbox', 'I understand cheating / teaming / hacks / exploits = DQ without refund', 'confirm_fair_play', { options: ['I understand'] }),
        field('non_refundable', 'checkbox', 'I understand the entry fee is non-refundable unless CrwdCtrl cancels', 'confirm_non_refundable', { options: ['I understand'] }),
        field('report_early', 'checkbox', 'I will report on Discord at least 15 minutes before my match', 'confirm_report_early', { options: ['I confirm'] }),
        field('organizer_final', 'checkbox', 'I agree that all organizer decisions are final', 'confirm_organizer_final', { options: ['I agree'] }),
      ],
    },
  ];
  const allFields = steps.flatMap((s) => s.fields);

  let event = await EventShow.findById(EVENT_ID);
  if (!event) {
    event = await EventShow.findOne({ title: /Smash Karts Championship/i });
  }
  if (!event) {
    throw new Error('Smash Karts event listing not found');
  }

  event.title = 'Smash Karts Championship 2025';
  event.displayName = 'Smash Karts Championship';
  event.description = [
    'Welcome to the CrwdCtrl Smash Karts Championship.',
    '',
    'Date: 22nd & 23rd August (Saturday & Sunday)',
    'Platform: Smash Karts',
    'Venue: Online (Discord)',
    'Entry Fee: ₹120 (use coupon CTRL20 for 20% OFF)',
    'Slots: 100',
    '',
    'Prize Pool Worth ₹9,000+',
    '1st Place: ₹5,000',
    '2nd Place: ₹2,500',
    '3rd Place: ₹1,500',
    '',
    'By registering, you agree to follow all Official Rules & Regulations.',
    'Match schedules and lobby codes will be announced on Discord.',
    'Stay online at least 15 minutes before your match.',
  ].join('\n');
  event.eventType = 'other';
  event.eventHeading = 'Esports Tournament';
  event.organizer = 'CrwdCtrl';
  event.venue = 'Online (Discord)';
  event.city = 'Online';
  event.showTimings = [
    { date: new Date('2026-08-22T10:00:00.000Z'), time: 'Day 1' },
    { date: new Date('2026-08-23T10:00:00.000Z'), time: 'Day 2' },
  ];
  event.duration = '2 days';
  event.ageRating = '13+';
  event.ticketPrice = 120;
  event.pricingMode = 'single';
  event.platformFeePercent = 2.5;
  event.seatingCapacity = 100;
  event.priceLabel = '₹120';
  event.generalRules = GENERAL_RULES;
  event.process = [
    'Stage 1: 20 lobbies · 5 players · 3 matches · Top 2 qualify',
    'Stage 2: 8 lobbies · 5 players · 3 matches · Top 2 qualify',
    'Quarter Finals: 4 lobbies · 4 players · Best of 5 · Top 2 qualify',
    'Semi Finals: 2 lobbies · 4 players · Best of 5 · Top 2 qualify',
    'Grand Finals: 3 players · Best of 7 · Highest total points wins',
  ].join('\n');
  event.prizePool = 'Worth ₹9,000+ · 1st ₹5,000 · 2nd ₹2,500 · 3rd ₹1,500';
  event.whatsIncluded = 'Tournament entry, Discord lobby access, match scheduling, prize eligibility';
  event.eligibility =
    'Open to all players 13+. Smash Karts Level 20+. One registration per player. Same account for the full tournament.';
  event.slots = '100 slots';
  event.registrationProcess =
    'Fill the multi-step form (Personal → Game → Availability → Confirmations), pay ₹120 (CTRL20 = 20% OFF), join CrwdCtrl Discord, report 15 minutes before your match.';
  event.registrationLink = '';
  event.bookingLink = '';
  event.rounds = [
    { title: 'Stage 1', content: '20 Lobbies · 5 Players · 3 Matches · Top 2 qualify' },
    { title: 'Stage 2', content: '8 Lobbies · 5 Players · 3 Matches · Top 2 qualify' },
    { title: 'Quarter Finals', content: '4 Lobbies · 4 Players · Best of 5 · Top 2 qualify' },
    { title: 'Semi Finals', content: '2 Lobbies · 4 Players · Best of 5 · Top 2 qualify' },
    { title: 'Grand Finals', content: '3 Players · Best of 7 · Highest total points wins' },
  ];
  event.contacts = [{ name: 'CrwdCtrl', role: 'Organizer' }];
  event.registration = {
    status: 'open',
    mode: 'internal_form',
    formType: 'MULTI_STEP',
    formSchema: allFields,
    steps,
    googleSheetsUrl: '',
    paymentQR: '',
    paymentQRMessage: '',
    paymentUpiId: '',
    qrAutoConfirm: false,
  };
  event.pageSection = 'upcoming';
  event.pagePriority = 1;
  event.status = 'published';
  await event.save();
  console.log('Updated standalone event:', event._id.toString());

  // Remove fest-linked competition
  const deletedComp = await Competition.findByIdAndDelete(COMPETITION_ID);
  console.log('Deleted fest competition:', deletedComp ? COMPETITION_ID : 'not found');

  const fest = await FestOrganizer.findById(FEST_ID);
  if (fest) {
    fest.competitions = (fest.competitions || []).filter(
      (id) => String(id) !== COMPETITION_ID,
    );
    if (!fest.competitions.length && /CrwdCtrl Esports/i.test(fest.festName || '')) {
      await FestOrganizer.findByIdAndDelete(FEST_ID);
      console.log('Deleted empty CrwdCtrl Esports fest:', FEST_ID);
    } else {
      await fest.save();
      console.log('Updated fest competitions list');
    }
  }

  // Coupon for event checkout
  let coupon = await Coupon.findOne({ code: 'CTRL20' });
  if (!coupon) {
    coupon = await Coupon.create({
      code: 'CTRL20',
      description: '20% OFF Smash Karts Championship entry',
      discountType: 'percent',
      discountPercent: 20,
      active: true,
      expiresAt: new Date('2026-08-23T18:30:00.000Z'),
      maxUsesPerUser: 1,
      applicableEntityTypes: ['event_show'],
    });
    console.log('Created CTRL20 for event_show');
  } else {
    const types = new Set(coupon.applicableEntityTypes || []);
    types.add('event_show');
    types.delete('competition'); // no longer fest competition
    coupon.applicableEntityTypes = [...types];
    coupon.active = true;
    coupon.discountType = 'percent';
    coupon.discountPercent = 20;
    await coupon.save();
    console.log('CTRL20 types:', coupon.applicableEntityTypes);
  }

  console.log(
    JSON.stringify(
      {
        eventId: event._id.toString(),
        title: event.title,
        mode: event.registration.mode,
        formType: event.registration.formType,
        steps: event.registration.steps.length,
        fields: event.registration.formSchema.length,
        fee: event.ticketPrice,
        pageSection: event.pageSection,
        status: event.status,
        publicPath: `/events/${event._id}`,
        registerPath: `/events/${event._id}/register`,
        adminPath: '/admin/events',
        festCompetitionRemoved: true,
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
