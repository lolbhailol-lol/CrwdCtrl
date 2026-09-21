/**
 * Align FLASH / FANDOM subcategory options for MindSpark bundle + solo registration.
 * Usage: node scripts/update-flash-fandom-subcategories.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const FEST = '6a7f1010ed26d983b34e55c2';
const UPDATES = {
  FLASH: ['PHOTOGRAPHY', 'VIDEOGRAPHY'],
  FANDOM: ['ATTACK ON TITAN', 'BROOKLYN NINE-NINE', 'FIFA FEVER'],
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Competition = require('../src/model/competition_model');

  for (const [name, options] of Object.entries(UPDATES)) {
    const comp = await Competition.findOne({ fest: FEST, name: new RegExp(`^${name}$`, 'i') });
    if (!comp) {
      console.log(JSON.stringify({ name, error: 'not found' }));
      continue;
    }
    const fields = Array.isArray(comp.registration?.personFields)
      ? comp.registration.personFields
      : [];
    let field = fields.find((f) => String(f.key || '') === 'subcategory');
    if (!field) {
      field = {
        id: `pf_subcategory_${Date.now()}`,
        key: 'subcategory',
        label: 'Subcategory',
        type: 'select',
        scope: 'team',
        options,
        placeholder: 'Select subcategory',
        required: true,
      };
      fields.push(field);
    } else {
      field.label = 'Subcategory';
      field.type = 'select';
      field.scope = 'team';
      field.options = options;
      field.placeholder = 'Select subcategory';
      field.required = true;
    }
    comp.registration.personFields = fields;
    comp.markModified('registration.personFields');
    await comp.save();
    console.log(JSON.stringify({ name, id: String(comp._id), options }, null, 2));
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
