/**
 * Enable MindSpark internal Cashfree registration with 0% CrwdCtrl platform fee.
 * Customers pay the exact competition fee only.
 *
 * Usage: node scripts/enable-mindspark-cashfree-registration.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const FEST_ID = '6a7f1010ed26d983b34e55c2';

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

const FORM_SCHEMA = [
  field('full_name', 'text', 'Full Name', 'full_name', { placeholder: 'Your full name' }),
  field('email', 'email', 'Email Address', 'email', { placeholder: 'you@email.com' }),
  field('mobile', 'tel', 'Mobile Number', 'mobile', { placeholder: '10-digit mobile number' }),
  field('college', 'text', 'College / Institute', 'college_name', { placeholder: 'Your college name' }),
  field('team_name', 'text', 'Team Name (if applicable)', 'team_name', {
    placeholder: 'Leave blank for solo events',
    required: false,
  }),
];

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const fest = await Fest.findById(FEST_ID);
  if (!fest) throw new Error('MindSpark fest not found');

  fest.platformFeePercent = 0;
  fest.feeAmount = fest.feeAmount || 0;
  fest.ticketPrice = fest.ticketPrice || 'Per competition';
  fest.registrationLink = '';

  fest.registration = {
    ...(fest.registration?.toObject?.() || fest.registration || {}),
    mode: 'INTERNAL_FORM',
    externalLink: '',
    formType: 'SINGLE_STEP',
    formSchema: FORM_SCHEMA,
    formInstructions:
      'Register for MindSpark competitions on CrwdCtrl. Pay the exact event fee via Cashfree — no extra platform charges.',
    organizerEmail: process.env.MINDSPARK_ORGANIZER_EMAIL || fest.registration?.organizerEmail || 'mindspark@coep.ac.in',
    googleSheetsUrl: fest.registration?.googleSheetsUrl || '',
  };

  await fest.save();
  console.log('✅ MindSpark fest updated:');
  console.log('   registration.mode:', fest.registration.mode);
  console.log('   platformFeePercent:', fest.platformFeePercent);
  console.log('   form fields:', fest.registration.formSchema.length);

  const comps = await Competition.find({ fest: FEST_ID });
  let updated = 0;
  for (const comp of comps) {
    if (comp.registrationType !== 'fest') {
      comp.registrationType = 'fest';
      await comp.save();
      updated += 1;
    }
  }

  console.log(`✅ Competitions checked: ${comps.length}, registrationType fixed: ${updated}`);
  await mongoose.disconnect();
})();
