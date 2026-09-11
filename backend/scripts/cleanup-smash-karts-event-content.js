/**
 * Clean Smash Karts event content: stage boxes with details + one general rules section.
 * Run: node scripts/cleanup-smash-karts-event-content.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EventShow = require('../src/model/event_show_model');

const EVENT_ID = '6a75a2fa95aa1e3cd07d316d';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const event = await EventShow.findById(EVENT_ID);
  if (!event) throw new Error('Event not found');

  event.description = [
    'CrwdCtrl Smash Karts Championship — online tournament on Discord.',
    '',
    '22nd & 23rd August · Entry ₹120 · 100 slots · Prize pool ₹9,000+',
    'Use coupon CTRL20 for 20% OFF at checkout.',
  ].join('\n');

  event.rounds = [
    {
      title: 'Stage 1',
      content: [
        '20 lobbies',
        '5 players per lobby',
        '3 matches per lobby',
        'Top 2 from each lobby qualify',
        'Lobby codes shared on Discord',
      ].join('\n'),
    },
    {
      title: 'Stage 2',
      content: [
        '8 lobbies',
        '5 players per lobby',
        '3 matches per lobby',
        'Top 2 from each lobby qualify',
      ].join('\n'),
    },
    {
      title: 'Quarter Finals',
      content: [
        '4 lobbies',
        '4 players per lobby',
        'Best of 5',
        'Top 2 from each lobby qualify',
      ].join('\n'),
    },
    {
      title: 'Semi Finals',
      content: [
        '2 lobbies',
        '4 players per lobby',
        'Best of 5',
        'Top 2 from each lobby qualify',
      ].join('\n'),
    },
    {
      title: 'Grand Finals',
      content: [
        '3 players',
        'Best of 7',
        'Highest total points across all 7 matches wins',
        'Winner takes 1st place',
      ].join('\n'),
    },
  ];

  // Clear process — stages live in Tournament Stages boxes now
  event.process = '';

  event.prizePool = [
    'Prize Pool:',
    'Worth ₹9,000+',
    '1st Place: ₹5,000',
    '2nd Place: ₹2,500',
    '3rd Place: ₹1,500',
    'Paid after winner verification within 7 working days',
  ].join('\n');

  event.whatsIncluded = [
    "What's Included:",
    'Tournament entry',
    'Discord lobby access',
    'Match scheduling',
    'Prize eligibility',
  ].join('\n');

  event.eligibility = '';

  event.generalRules = [
    'Eligibility:',
    'Open to all players',
    'Minimum age: 13+',
    'Only one registration per player',
    'Minimum Smash Karts account level: 20',
    'Same account (IGN + Player ID) must be used throughout — no changes after registration',
    'Smurf, alternate, or shared accounts are strictly prohibited',
    '',
    'Registration:',
    'Entry fee: ₹120 (coupon CTRL20 = 20% OFF)',
    'Confirmed only after successful payment',
    'Non-refundable unless CrwdCtrl cancels the tournament',
    'Closes when 100 slots are filled',
    'Join the official CrwdCtrl Discord before the tournament',
    '',
    'Match Rules:',
    'Platform: Smash Karts · Venue: Online (Discord)',
    'Private lobby codes shared on Discord',
    'Join within 5 minutes of lobby creation or risk forfeit',
    'Be online at least 15 minutes before your scheduled match',
    'Organizers may delay or restart matches only if necessary',
    '',
    'Fair Play:',
    'Hacks, cheats, third-party software — immediate DQ',
    'Scripts, macros, or bug exploits — immediate DQ',
    'Teaming, account sharing, or impersonation — immediate DQ',
    'Offensive / unsportsmanlike behaviour — immediate DQ',
    'No refund on disqualification',
    '',
    'Internet & Technical:',
    'Players are responsible for their own connection and device',
    'Personal disconnects do not guarantee a rematch',
    'Rematch only for verified server-wide issues',
    '',
    'Organizer Rights:',
    'CrwdCtrl may modify schedule if required',
    'No-shows may be replaced',
    'Rule violators may be disqualified',
    'Disputes resolved at organizer sole discretion',
    'Tournament may be cancelled or postponed for unforeseen circumstances',
    'All organizer decisions are final',
  ].join('\n');

  event.registrationProcess =
    'Fill the form → Pay ₹120 → Join Discord → Report 15 minutes before your match.';
  event.slots = '100 slots';

  await event.save();
  console.log(
    JSON.stringify(
      {
        id: event._id.toString(),
        rounds: event.rounds.map((r) => r.title),
        generalRulesLines: event.generalRules.split('\n').length,
        processCleared: !event.process,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
