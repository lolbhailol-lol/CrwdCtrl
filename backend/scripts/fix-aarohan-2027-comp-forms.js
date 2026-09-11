/**
 * One-time repair for AAROHAN 2027 competition registration forms.
 * - Seed missing forms from a clean base schema
 * - Fix duplicate fieldName collisions on existing forms
 *
 * Usage: node backend/scripts/fix-aarohan-2027-comp-forms.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry-run');

function uid() {
  return crypto.randomBytes(4).toString('hex');
}

function baseFieldsForCompetition(competitionName) {
  return [
    { label: 'Name', type: 'text', required: true },
    { label: 'City', type: 'text', required: true },
    { label: 'Instagram ID', type: 'text', required: true },
    { label: 'College / Organization Name', type: 'text', required: true },
    { label: 'Contact Number', type: 'tel', required: true },
    { label: 'Email Id', type: 'email', required: true },
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
      placeholder: '',
      options: Array.isArray(f.options) ? f.options : [],
      ...(f.defaultValue ? { defaultValue: f.defaultValue } : {}),
    };
  });
}

function uniquifyFieldNames(fields = []) {
  const seen = new Set();
  return fields.map((f, idx) => {
    const id = String(f.id || `field_${uid()}`);
    let fieldName = String(f.fieldName || id).trim() || id;
    if (!fieldName || seen.has(fieldName) || fieldName === 'field_field_17') {
      fieldName = `${id}_${idx}`;
    }
    seen.add(fieldName);
    return {
      ...f,
      id,
      fieldName,
      label: f.label || `Field ${idx + 1}`,
      type: f.type || 'text',
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options : [],
      placeholder: f.placeholder || '',
    };
  });
}

function countFields(reg = {}) {
  const schema = Array.isArray(reg.formSchema) ? reg.formSchema.length : 0;
  const steps = Array.isArray(reg.steps)
    ? reg.steps.reduce((n, s) => n + ((s.fields || []).length), 0)
    : 0;
  return schema + steps;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Fest = mongoose.connection.collection('festorganizers');
  const Comp = mongoose.connection.collection('competitions');

  const fest = await Fest.findOne({ slug: 'aarohan-2027' })
    || await Fest.findOne({ festName: /aarohan\s*2027/i });
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const comps = await Comp.find({ fest: fest._id }).toArray();
  console.log(`Fest ${fest.festName} (${fest._id}) — ${comps.length} competitions — dryRun=${DRY}`);

  let seeded = 0;
  let fixed = 0;

  for (const c of comps) {
    const reg = c.registration || {};
    const n = countFields(reg);
    const name = c.name || 'Competition';

    if (n === 0) {
      const fields = baseFieldsForCompetition(name);
      const next = {
        ...reg,
        status: 'internal_form',
        mode: reg.mode || 'internal_form',
        formType: 'SINGLE_STEP',
        formSchema: fields,
        steps: [],
      };
      console.log(`SEED ${name}`);
      if (!DRY) {
        await Comp.updateOne({ _id: c._id }, { $set: { registration: next } });
      }
      seeded += 1;
      continue;
    }

    // Broken MULTI_STEP with duplicated fieldNames across schema+steps → replace
    const flatNames = [];
    for (const f of reg.formSchema || []) flatNames.push(String(f.fieldName || ''));
    for (const s of reg.steps || []) {
      for (const f of s.fields || []) flatNames.push(String(f.fieldName || ''));
    }
    const uniqueCount = new Set(flatNames.filter(Boolean)).size;
    const hasDupes = uniqueCount !== flatNames.filter(Boolean).length
      || flatNames.includes('field_field_17');
    if (hasDupes || (reg.formType === 'MULTI_STEP' && (reg.formSchema || []).length && (reg.steps || []).length)) {
      const fields = baseFieldsForCompetition(name);
      console.log(`RESET broken form ${name}`);
      if (!DRY) {
        await Comp.updateOne(
          { _id: c._id },
          {
            $set: {
              registration: {
                ...reg,
                status: 'internal_form',
                mode: 'internal_form',
                formType: 'SINGLE_STEP',
                formSchema: fields,
                steps: [],
              },
            },
          },
        );
      }
      fixed += 1;
      continue;
    }

    // Fix duplicate / broken fieldNames within a single list
    const schema = uniquifyFieldNames(reg.formSchema || []);
    const steps = (reg.steps || []).map((step, sIdx) => ({
      ...step,
      stepNumber: step.stepNumber || sIdx + 1,
      fields: uniquifyFieldNames(step.fields || []),
    }));
    const before = JSON.stringify({
      schema: (reg.formSchema || []).map((f) => f.fieldName),
      steps: (reg.steps || []).map((s) => (s.fields || []).map((f) => f.fieldName)),
    });
    const after = JSON.stringify({
      schema: schema.map((f) => f.fieldName),
      steps: steps.map((s) => (s.fields || []).map((f) => f.fieldName)),
    });
    if (before !== after) {
      console.log(`FIX fieldNames ${name}`);
      if (!DRY) {
        await Comp.updateOne(
          { _id: c._id },
          {
            $set: {
              'registration.formSchema': schema,
              'registration.steps': steps,
              'registration.status': 'internal_form',
            },
          },
        );
      }
      fixed += 1;
    } else {
      console.log(`OK ${name} (${n} fields)`);
    }
  }

  // Keep fest-level competition select options in sync
  const allNames = comps.map((c) => c.name).filter(Boolean);
  const festSchema = Array.isArray(fest.registration?.formSchema) ? fest.registration.formSchema : [];
  const updatedFestSchema = festSchema.map((f) => {
    if (!/competition/i.test(String(f.label || ''))) return f;
    return { ...f, options: allNames };
  });
  if (JSON.stringify(festSchema) !== JSON.stringify(updatedFestSchema)) {
    console.log('UPDATE fest competition options', allNames.length);
    if (!DRY) {
      await Fest.updateOne(
        { _id: fest._id },
        { $set: { 'registration.formSchema': updatedFestSchema } },
      );
    }
  }

  console.log({ seeded, fixed, total: comps.length });
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
