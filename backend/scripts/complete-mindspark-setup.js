/**
 * Fill missing MindSpark fest + competition fields.
 * Usage: node scripts/complete-mindspark-setup.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const VENUE = 'COEP Technological University, Pune';
const FEST_DATE = '3–4 Oct 2026';
const EXTERNAL_REG = 'https://www.mind-spark.org';
const DEFAULT_DATETIME = "During MindSpark'26 (3–4 Oct 2026)";

const NAME_FIXES = {
  'FOX HUNT Rulebook': 'Fox Hunt',
  'Mathletics rulebook': 'Mathletics',
  'ROBORACES rulebook': 'Roboraces',
  'RoboRoyale ^': 'RoboRoyale',
  'Robosoccer f': 'Robosoccer',
  'Robowars neww': 'Robowars',
  'Virtual Robotics ediited': 'Virtual Robotics',
  'ROBO FALCONARY': 'Robo Falconry',
  'Take off 26': 'Take Off',
};

const FEE_FIXES = {
  Assemblix: { registrationFee: '₹99 per team', feeAmount: 99 },
  WORLDWIZE: { registrationFee: '₹199 per team', feeAmount: 199 },
  QuantQuest: { registrationFee: '₹199 per team', feeAmount: 199 },
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const fest = await Fest.findById(FEST_ID);
  if (!fest) throw new Error('MindSpark fest not found');

  fest.festDate = FEST_DATE;
  fest.venue = VENUE;
  fest.subtitle = fest.subtitle || "COEP's Flagship Technical Fest";
  fest.competitionsHeading = fest.competitionsHeading || 'Competitions';
  fest.registrationLink = '';
  fest.platformFeePercent = 0;
  fest.registration = {
    ...fest.registration?.toObject?.() || fest.registration || {},
    mode: 'INTERNAL_FORM',
    externalLink: '',
    formType: 'SINGLE_STEP',
    formSchema: [
      { id: 'full_name', type: 'text', label: 'Full Name', fieldName: 'full_name', required: true, placeholder: 'Your full name' },
      { id: 'email', type: 'email', label: 'Email Address', fieldName: 'email', required: true, placeholder: 'you@email.com' },
      { id: 'mobile', type: 'tel', label: 'Mobile Number', fieldName: 'mobile', required: true, placeholder: '10-digit mobile number' },
      { id: 'college', type: 'text', label: 'College / Institute', fieldName: 'college_name', required: true, placeholder: 'Your college name' },
      { id: 'team_name', type: 'text', label: 'Team Name (if applicable)', fieldName: 'team_name', required: false, placeholder: 'Leave blank for solo events' },
    ],
    formInstructions:
      'Register for MindSpark competitions on CrwdCtrl. Pay the exact event fee via Cashfree — no extra platform charges.',
    organizerEmail: process.env.MINDSPARK_ORGANIZER_EMAIL || 'mindspark@coep.ac.in',
  };
  if (!fest.slug) fest.slug = 'mindspark-2026';

  await fest.save();
  console.log('Updated fest:', fest.festName, fest.festDate);

  const festCover = fest.coverImage || '';
  const competitions = await Competition.find({ fest: FEST_ID });
  let updated = 0;

  for (const comp of competitions) {
    let changed = false;

    if (NAME_FIXES[comp.name]) {
      comp.name = NAME_FIXES[comp.name];
      changed = true;
    }

    if (FEE_FIXES[comp.name]) {
      comp.registrationFee = FEE_FIXES[comp.name].registrationFee;
      comp.feeAmount = FEE_FIXES[comp.name].feeAmount;
      changed = true;
    }

    if (!comp.venue || comp.venue.trim() === '') {
      comp.venue = VENUE;
      changed = true;
    }

    if (!comp.dateTime || /tba/i.test(comp.dateTime)) {
      comp.dateTime = DEFAULT_DATETIME;
      changed = true;
    }

    if (!comp.coverImage && festCover) {
      comp.coverImage = festCover;
      if (!Array.isArray(comp.gallery) || !comp.gallery.length) {
        comp.gallery = [festCover];
      }
      changed = true;
    }

    if (!comp.prizePool || comp.prizePool.trim() === '') {
      comp.prizePool = 'Subject to change';
      changed = true;
    }

    if (comp.name === 'QuantQuest') {
      if (!comp.description || comp.description.includes('placeholder')) {
        comp.description =
          'QuantQuest is a quiz competition under Quantamania at MindSpark\'26, testing analytical and problem-solving skills. Full rulebook details will be updated on the official MindSpark website.';
        changed = true;
      }
      if (!comp.commonRules?.length) {
        comp.commonRules = [
          'Participants must carry valid college ID and registration confirmation.',
          'Rules and marking scheme will be announced at the venue.',
          'Decision of organizers and judges is final.',
          'Check www.mind-spark.org for latest updates.',
        ];
        changed = true;
      }
    }

    if (comp.registrationType !== 'fest') {
      comp.registrationType = 'fest';
      changed = true;
    }

    if (changed) {
      await comp.save();
      updated += 1;
      console.log('Updated competition:', comp.name);
    }
  }

  console.log(`Done. Updated ${updated} competition(s).`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
