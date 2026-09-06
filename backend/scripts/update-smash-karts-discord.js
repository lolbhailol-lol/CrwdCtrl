/**
 * Add Discord invite + slim Smash Karts registration form.
 * Run: node scripts/update-smash-karts-discord.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DISCORD = 'https://discord.gg/uk5AjcGEF';
const ID = new mongoose.Types.ObjectId('6a75a2fa95aa1e3cd07d316d');

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

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('event_shows');

  const formSchema = [
    field('full_name', 'text', 'Full Name', 'full_name', { placeholder: 'Your full name' }),
    field('email', 'email', 'Email Address', 'email', { placeholder: 'you@email.com' }),
    field('mobile', 'tel', 'Mobile Number', 'mobile', { placeholder: '10-digit mobile number' }),
    field('country', 'text', 'Country', 'country', { placeholder: 'India' }),
    field('ign', 'text', 'Smash Karts Username (IGN)', 'smash_karts_ign', { placeholder: 'In-game username' }),
    field('player_id', 'text', 'Smash Karts Player ID', 'smash_karts_player_id', { placeholder: 'Player ID' }),
    field('account_level', 'number', 'Current Account Level', 'account_level', { placeholder: 'Must be 20+' }),
    field('discord', 'text', 'Discord Username', 'discord_username', { placeholder: 'username' }),
    field('avail_aug', 'checkbox', 'I am available on 22nd & 23rd August', 'available_aug_22_23', { options: ['Yes'] }),
    field('joined_discord', 'checkbox', 'I have joined the official CrwdCtrl Discord server', 'joined_discord', { options: ['Yes'] }),
    field('read_rules', 'checkbox', 'I have read the Rules & Regulations', 'read_rules', { options: ['Yes'] }),
    field('fair_play', 'checkbox', 'I understand cheating / teaming / hacks = DQ without refund', 'confirm_fair_play', { options: ['I understand'] }),
    field('non_refundable', 'checkbox', 'I understand the entry fee is non-refundable unless CrwdCtrl cancels', 'confirm_non_refundable', { options: ['I understand'] }),
  ];

  const steps = [
    {
      stepNumber: 1,
      stepTitle: 'Personal Details',
      stepDescription: 'How we can reach you',
      fields: formSchema.slice(0, 4),
    },
    {
      stepNumber: 2,
      stepTitle: 'Game Details',
      stepDescription: 'Smash Karts account (cannot be changed later)',
      fields: formSchema.slice(4, 8),
    },
    {
      stepNumber: 3,
      stepTitle: 'Confirm & Join Discord',
      stepDescription: `Join Discord first: ${DISCORD}`,
      fields: formSchema.slice(8),
    },
  ];

  const generalRules = [
    'Eligibility:',
    'Open to all · Age 13+',
    'One entry per player',
    'Same Smash Karts account throughout',
    'No smurf / alternate accounts',
    '',
    'Registration:',
    'Confirmed after payment',
    `Join Discord: ${DISCORD}`,
    'Limited to 100 slots',
    '',
    'Match Rules:',
    'Lobby codes on Discord',
    'Join within 5 minutes or forfeit',
    'Be online 15 minutes early',
    '',
    'Fair Play:',
    'No hacks, macros, or scripts',
    'No teaming or account sharing',
    'Respect players and organizers',
    'Organizer decisions are final',
  ].join('\n');

  const result = await col.updateOne(
    { _id: ID },
    {
      $set: {
        venue: 'Online · Discord',
        meetingPoints: [{ label: 'CrwdCtrl Discord', mapUrl: DISCORD }],
        bookingLink: '',
        registrationLink: '',
        eventHeading: 'Online Tournament',
        generalRules,
        'registration.formSchema': formSchema,
        'registration.steps': steps,
        'registration.formType': 'MULTI_STEP',
        registrationProcess: '',
        description: `Online Smash Karts tournament. Entry ₹120 · 100 slots · Prize pool ₹9,000+. Join Discord: ${DISCORD}`,
      },
    },
  );

  console.log(JSON.stringify({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    discord: DISCORD,
    fields: formSchema.length,
    steps: steps.length,
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
