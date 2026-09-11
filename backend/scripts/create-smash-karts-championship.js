/**
 * Create Smash Karts Championship 2025 as a Competition under a CrwdCtrl Esports fest.
 * Run: node scripts/create-smash-karts-championship.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FestOrganizer = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');
const Coupon = require('../src/model/coupon_model');

function field(id, type, label, fieldName, opts = {}) {
  return {
    id,
    type,
    label,
    fieldName,
    placeholder: opts.placeholder || '',
    required: opts.required !== false,
    options: opts.options || [],
    validation: opts.validation || {},
  };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const existingComp = await Competition.findOne({
    name: /Smash Karts Championship/i,
  }).lean();
  if (existingComp) {
    console.log('Competition already exists:', existingComp._id.toString());
    console.log('Fest:', existingComp.fest?.toString());
    await mongoose.disconnect();
    return;
  }

  let fest = await FestOrganizer.findOne({
    festName: /CrwdCtrl Esports/i,
  });

  if (!fest) {
    fest = await FestOrganizer.create({
      festName: 'CrwdCtrl Esports',
      subtitle: 'Online esports tournaments by CrwdCtrl',
      collegeName: 'CrwdCtrl',
      festType: 'sports',
      festDate: '22-23 Aug 2026',
      venue: 'Online (Discord)',
      ticketPrice: 'Per competition',
      feeAmount: 0,
      description:
        'CrwdCtrl Esports hosts online competitive gaming tournaments with fair play, Discord lobbies, and verified prize payouts.',
      coverImage: '',
      galleryImages: [],
      status: 'upcoming',
      isApproved: true,
      priority: 10,
      showOnHomeSlide: false,
      homeSection: '',
      homePriority: 1,
      competitionsHeading: 'Tournaments',
      registration: {
        mode: 'NOT_STARTED',
        formType: 'SINGLE_STEP',
        formSchema: [],
        steps: [],
      },
    });
    console.log('Created fest:', fest._id.toString(), fest.festName);
  } else {
    console.log('Using existing fest:', fest._id.toString(), fest.festName);
  }

  const commonRules = [
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
    'CrwdCtrl may modify schedule, replace no-shows, disqualify violators, resolve disputes, or cancel/postpone for unforeseen circumstances. All organizer decisions are final.',
  ];

  const rounds = [
    {
      roundNumber: 1,
      title: 'Stage 1',
      description: '20 Lobbies · 5 Players per Lobby · 3 Matches · Top 2 qualify',
      rules: [
        '20 lobbies with 5 players each',
        '3 matches per lobby',
        'Top 2 from each lobby qualify',
      ],
      roundRulesMessage: 'Stage 1 qualifier format',
      dateTime: '22 Aug 2026',
      venue: 'Discord private lobbies',
    },
    {
      roundNumber: 2,
      title: 'Stage 2',
      description: '8 Lobbies · 5 Players per Lobby · 3 Matches · Top 2 qualify',
      rules: [
        '8 lobbies with 5 players each',
        '3 matches per lobby',
        'Top 2 from each lobby qualify',
      ],
      roundRulesMessage: 'Stage 2 format',
      dateTime: '22-23 Aug 2026',
      venue: 'Discord private lobbies',
    },
    {
      roundNumber: 3,
      title: 'Quarter Finals',
      description: '4 Lobbies · 4 Players · Best of 5 · Top 2 qualify',
      rules: [
        '4 lobbies with 4 players each',
        'Best of 5',
        'Top 2 from each lobby qualify',
      ],
      roundRulesMessage: 'Quarter finals',
      dateTime: '23 Aug 2026',
      venue: 'Discord private lobbies',
    },
    {
      roundNumber: 4,
      title: 'Semi Finals',
      description: '2 Lobbies · 4 Players · Best of 5 · Top 2 qualify',
      rules: [
        '2 lobbies with 4 players each',
        'Best of 5',
        'Top 2 from each lobby qualify',
      ],
      roundRulesMessage: 'Semi finals',
      dateTime: '23 Aug 2026',
      venue: 'Discord private lobbies',
    },
    {
      roundNumber: 5,
      title: 'Grand Finals',
      description: '3 Players · Best of 7 · Highest total points across all seven matches wins',
      rules: [
        '3 players in Grand Finals',
        'Best of 7',
        'Highest total points across all seven matches wins',
      ],
      roundRulesMessage: 'Grand finals — winner takes 1st place',
      dateTime: '23 Aug 2026',
      venue: 'Discord private lobbies',
    },
  ];

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
          validation: { min: 20, message: 'Minimum Level 20 required' },
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

  const competition = await Competition.create({
    fest: fest._id,
    name: 'Smash Karts Championship 2025',
    subtitle: 'CrwdCtrl online Smash Karts tournament · Prize pool ₹9,000+',
    competitionType: 'esports',
    category: 'GAMING',
    description: [
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
    ].join('\n'),
    prizePool: 'Worth ₹9,000+ · 1st ₹5,000 · 2nd ₹2,500 · 3rd ₹1,500',
    dateTime: '22nd & 23rd August 2026 (Saturday & Sunday)',
    venue: 'Online (Discord) — join the official CrwdCtrl Discord before the tournament',
    coverImage: '',
    gallery: [],
    commonRules,
    commonRulesMessage:
      'Official Rules & Regulations. Violations may lead to disqualification without refund. Play fair and enjoy the competition.',
    rounds,
    registrationFee: '₹120',
    feeAmount: 120,
    registrationLink: '',
    registrationType: 'custom',
    registration: {
      status: 'internal_form',
      externalUrl: '',
      whatsappGroupLink: '',
      formType: 'MULTI_STEP',
      formSchema: allFields,
      steps,
      googleSheetsUrl: 'https://docs.google.com/spreadsheets/d/smash-karts-championship-2025-registrations',
      qrCode: '',
      qrCodeMessage: '',
      confirmationEmail: '',
      settings: {
        allowMultipleRegistrations: false,
        requireEmailVerification: false,
        autoConfirmation: true,
        maxRegistrations: 100,
        registrationDeadline: new Date('2026-08-22T03:30:00.000Z'), // 22 Aug IST midnight-ish open day
      },
    },
    legacyRegistration: { status: 'STARTED' },
    registrationFields: [],
    contact: {
      name: 'CrwdCtrl',
      email: '',
      phone: '',
      instagram: '',
    },
    isApproved: true,
  });

  await FestOrganizer.findByIdAndUpdate(fest._id, {
    $addToSet: { competitions: competition._id },
  });

  let coupon = await Coupon.findOne({ code: 'CTRL20' });
  if (!coupon) {
    coupon = await Coupon.create({
      code: 'CTRL20',
      description: '20% OFF Smash Karts / competition entry',
      discountType: 'percent',
      discountPercent: 20,
      maxDiscountAmount: 0,
      flatDiscountAmount: 0,
      active: true,
      startsAt: null,
      expiresAt: new Date('2026-08-23T18:30:00.000Z'),
      maxTotalUses: 0,
      maxUsesPerUser: 1,
      usedCount: 0,
      minPeople: 1,
      maxPeople: 0,
      applicableEntityTypes: ['competition'],
    });
    console.log('Created coupon CTRL20');
  } else {
    const types = new Set(coupon.applicableEntityTypes || []);
    types.add('competition');
    coupon.applicableEntityTypes = [...types];
    coupon.active = true;
    coupon.discountType = 'percent';
    coupon.discountPercent = 20;
    await coupon.save();
    console.log('Updated coupon CTRL20 for competition');
  }

  console.log(
    JSON.stringify(
      {
        festId: fest._id.toString(),
        festName: fest.festName,
        festSlug: fest.slug || null,
        competitionId: competition._id.toString(),
        name: competition.name,
        feeAmount: competition.feeAmount,
        maxRegistrations: competition.registration?.settings?.maxRegistrations,
        formType: competition.registration?.formType,
        rounds: competition.rounds.length,
        coupon: 'CTRL20',
        adminPath: `/admin/competitions`,
        publicPath: `/competitions-view-details/${competition._id}`,
        registerPath: `/competition-registration/${competition._id}`,
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
