/**
 * Repair AAROHAN 2027 competition metadata + fest date copy.
 * Usage: node scripts/repair-aarohan-2027-metadata.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry-run');
const crypto = require('crypto');

function uid() {
  return crypto.randomBytes(4).toString('hex');
}

function baseFieldsForCompetition(competitionName) {
  return [
    { label: 'Name', type: 'text', required: true, placeholder: 'Enter Your Full Name' },
    { label: 'City', type: 'text', required: true, placeholder: 'Enter Your City' },
    { label: 'Instagram ID', type: 'text', required: true, placeholder: '@your_instagram_id' },
    { label: 'College / Organization Name', type: 'text', required: true, placeholder: 'Enter College or Organization Name' },
    { label: 'Contact Number', type: 'tel', required: true, placeholder: '+91 9873899423' },
    { label: 'Email Id', type: 'email', required: true, placeholder: 'your.mail@example.com' },
    { label: 'Date of Birth', type: 'date', required: true },
    {
      label: 'Competition',
      type: 'select',
      required: true,
      options: [competitionName],
      defaultValue: competitionName,
    },
  ].map((f) => {
    const id = `field_${uid()}`;
    return {
      id,
      fieldName: id,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      placeholder: f.placeholder || '',
      options: Array.isArray(f.options) ? f.options : [],
      ...(f.defaultValue ? { defaultValue: f.defaultValue } : {}),
    };
  });
}

/** Source of truth from aarohan-fest-data.json + live type tags */
const FIXES = {
  InSync: {
    competitionType: 'dance',
    category: 'Dance',
    subtitle: 'Group Dance Competition',
    teamSizeMin: 6,
    teamSizeMax: 16,
    teamSizeLabel: 'Team of 6–16',
    feeAmount: 2500,
    registrationStatus: 'internal_form',
  },
  'Inner Flame': {
    competitionType: 'dance',
    category: 'Dance',
    subtitle: 'Solo Dance Competition',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 500,
    registrationStatus: 'internal_form',
  },
  'Head Bang': {
    competitionType: 'music',
    category: 'Music',
    subtitle: 'Band Wars Competition',
    teamSizeMin: 4,
    teamSizeMax: 16,
    teamSizeLabel: 'Team of 4–16',
    feeAmount: 2500,
    registrationStatus: 'internal_form',
  },
  Humming: {
    competitionType: 'music',
    category: 'Music',
    subtitle: 'Solo Singing Competition',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 500,
    registrationStatus: 'internal_form',
  },
  Dastak: {
    competitionType: 'theater',
    category: 'Theater',
    subtitle: 'Street Play Competition',
    teamSizeMin: 4,
    teamSizeMax: 20,
    teamSizeLabel: 'Team of 4–20',
    feeAmount: 2500,
    registrationStatus: 'internal_form',
  },
  Platform: {
    competitionType: 'theater',
    category: 'Theater',
    subtitle: 'Open Mic Competition',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 500,
    registrationStatus: 'internal_form',
  },
  'Art Maestro': {
    competitionType: 'art',
    category: 'Art',
    subtitle: 'Fine Arts Competition',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 500,
    registrationStatus: 'internal_form',
  },
  'Glamour Nova': {
    competitionType: 'fashion',
    category: 'Fashion',
    subtitle: 'Fashion Show / Pageant',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 600,
    registrationStatus: 'internal_form',
  },
  'Box Football': {
    competitionType: 'sports',
    category: 'Sports',
    subtitle: 'Box Football',
    teamSizeMin: 8,
    teamSizeMax: 8,
    teamSizeLabel: 'Team of 8',
    feeAmount: 1000,
    registrationStatus: 'internal_form',
  },
  'Box Cricket': {
    competitionType: 'sports',
    category: 'Sports',
    subtitle: 'Box Cricket',
    teamSizeMin: 7,
    teamSizeMax: 7,
    teamSizeLabel: 'Team of 7',
    feeAmount: 1000,
    registrationStatus: 'internal_form',
  },
  BGMI: {
    competitionType: 'esports',
    category: 'Esports',
    subtitle: 'BGMI',
    teamSizeMin: 4,
    teamSizeMax: 4,
    teamSizeLabel: 'Squad of 4',
    feeAmount: null,
    registrationStatus: 'internal_form',
  },
  'REAL CRICKET 24': {
    competitionType: 'esports',
    category: 'Esports',
    subtitle: 'Real Cricket 24',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: null,
    registrationStatus: 'internal_form',
  },
  VALORANT: {
    competitionType: 'esports',
    category: 'Esports',
    subtitle: 'Valorant',
    teamSizeMin: 5,
    teamSizeMax: 5,
    teamSizeLabel: 'Team of 5',
    feeAmount: 999,
    registrationStatus: 'internal_form',
  },
  FIFA: {
    competitionType: 'esports',
    category: 'Esports',
    subtitle: 'FIFA',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: null,
    registrationStatus: 'internal_form',
  },
  'Solo Smash': {
    competitionType: 'sports',
    category: 'Sports',
    subtitle: 'Badminton Solo',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 300,
    registrationStatus: 'internal_form',
  },
  'Shuttle Synergy': {
    competitionType: 'sports',
    category: 'Sports',
    subtitle: 'Badminton Duo',
    teamSizeMin: 2,
    teamSizeMax: 2,
    teamSizeLabel: 'Duo',
    feeAmount: 500,
    registrationStatus: 'internal_form',
  },
  'Velocity Table': {
    competitionType: 'sports',
    category: 'Sports',
    subtitle: 'Table Tennis',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 250,
    registrationStatus: 'internal_form',
  },
  Euphony: {
    competitionType: 'music',
    category: 'Music',
    subtitle: 'Instrumental',
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    feeAmount: 600,
    registrationStatus: 'internal_form',
  },
};

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);

  const fests = mongoose.connection.collection('festorganizers');
  const comps = mongoose.connection.collection('competitions');

  const fest =
    (await fests.findOne({ slug: 'aarohan-2027' })) ||
    (await fests.findOne({ festName: /aarohan\s*2027/i }));
  if (!fest) throw new Error('AAROHAN 2027 not found');

  console.log(`Fest ${fest.festName} (${fest._id}) dryRun=${DRY}`);

  // Fix fest date spacing + Instagram placeholder typo in fest form
  const festSet = {};
  if (String(fest.festDate || '').includes('( Tentative )')) {
    festSet.festDate = String(fest.festDate).replace(/\(\s*Tentative\s*\)/i, '(Tentative)');
  }
  const schema = Array.isArray(fest.registration?.formSchema)
    ? fest.registration.formSchema.map((f) => {
        const next = { ...f };
        if (/instagram/i.test(String(f.label || ''))) {
          next.placeholder = '@your_instagram_id';
        }
        if (/^Competition\s*$/i.test(String(f.label || '').trim())) {
          next.label = 'Competition';
        }
        if (/Email Id\s*$/i.test(String(f.label || ''))) {
          next.label = 'Email Id';
        }
        return next;
      })
    : null;
  if (schema) {
    festSet['registration.formSchema'] = schema;
  }
  if (Object.keys(festSet).length) {
    console.log('FEST patch', festSet);
    if (!DRY) await fests.updateOne({ _id: fest._id }, { $set: festSet });
  }

  const rows = await comps.find({ fest: fest._id }).toArray();
  const musicCover =
    rows.find((c) => c.name === 'Humming' && c.coverImage)?.coverImage ||
    rows.find((c) => c.name === 'Head Bang' && c.coverImage)?.coverImage ||
    '';

  let updated = 0;
  for (const c of rows) {
    const fix = FIXES[c.name];
    if (!fix) {
      console.log(`SKIP unknown competition: ${c.name}`);
      continue;
    }

    const set = {
      competitionType: fix.competitionType,
      category: fix.category,
      subtitle: fix.subtitle,
      teamSizeMin: fix.teamSizeMin,
      teamSizeMax: fix.teamSizeMax,
      teamSizeLabel: fix.teamSizeLabel,
      'registration.status': fix.registrationStatus,
    };
    if (fix.feeAmount != null) {
      set.feeAmount = fix.feeAmount;
      set.registrationFee = `₹${fix.feeAmount}`;
    }

    let schema = Array.isArray(c.registration?.formSchema) ? [...c.registration.formSchema] : [];
    if (!schema.length) {
      schema = baseFieldsForCompetition(c.name);
      console.log(`  seed form for ${c.name}`);
    }

    set.registrationType = 'custom';
    set['registration.mode'] = 'internal_form';
    set['registration.status'] = 'internal_form';
    set['registration.formType'] = c.registration?.formType || 'SINGLE_STEP';
    set['registration.formSchema'] = schema.map((f) => {
      let next = { ...f };
      if (/instagram/i.test(String(f.label || ''))) {
        next = { ...next, placeholder: '@your_instagram_id' };
      }
      if (/competition/i.test(String(f.label || ''))) {
        next = {
          ...next,
          label: 'Competition',
          options: [c.name],
          defaultValue: c.name,
        };
      }
      if (/^Email Id\s*$/i.test(String(f.label || ''))) {
        next = { ...next, label: 'Email Id' };
      }
      return next;
    });

    if (c.name === 'Euphony' && !c.coverImage && musicCover) {
      set.coverImage = musicCover;
    }

    console.log(`UPDATE ${c.name}`, {
      team: `${fix.teamSizeMin}-${fix.teamSizeMax}`,
      fee: fix.feeAmount != null ? fix.feeAmount : c.feeAmount,
      cat: fix.category,
      rtype: set.registrationType,
    });
    if (!DRY) {
      await comps.updateOne({ _id: c._id }, { $set: set });
    }
    updated += 1;
  }

  console.log(`Done. updated=${updated}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
