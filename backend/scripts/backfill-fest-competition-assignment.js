/**
 * Backfill fest registrations that selected a competition in the form
 * but were saved without competitionId (shows as "Other / unassigned").
 *
 * Usage: node scripts/backfill-fest-competition-assignment.js [festIdOrSlug]
 * Default: aarohan-2027
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  resolveFestCompetitionId,
  extractCompetitionChoice,
} = require('../src/utils/festCompetitionAssignment');
const { findByIdOrSlug } = require('../src/utils/slug');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Fest = require('../src/model/fest_organizer_model');
  const Registration = require('../src/model/registration_model');

  const key = process.argv[2] || 'aarohan-2027';
  const fest = await findByIdOrSlug(Fest, key, {
    pickName: (row) => row.festName || row.name || '',
    lean: false,
  });
  if (!fest) {
    console.error('Fest not found:', key);
    process.exit(1);
  }

  const formSchema = fest.registration?.formType === 'MULTI_STEP'
    ? (fest.registration.steps || []).flatMap((s) => s.fields || [])
    : (fest.registration?.formSchema || []);

  const regs = await Registration.find({
    fest: fest._id,
    $or: [{ competitionId: null }, { competitionId: { $exists: false } }],
  });

  let updated = 0;
  let skipped = 0;

  for (const reg of regs) {
    const responses = reg.responses instanceof Map
      ? Object.fromEntries(reg.responses)
      : (reg.responses || {});
    const choice = extractCompetitionChoice(responses, formSchema);
    const competitionId = await resolveFestCompetitionId({
      festId: fest._id,
      responses,
      formSchema,
    });
    if (!competitionId) {
      skipped += 1;
      console.log('SKIP', String(reg._id), choice || '(no choice)');
      continue;
    }
    reg.competitionId = competitionId;
    await reg.save();
    updated += 1;
    console.log('OK', String(reg._id), '→', choice);
  }

  console.log(JSON.stringify({
    fest: fest.festName,
    scanned: regs.length,
    updated,
    skipped,
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
