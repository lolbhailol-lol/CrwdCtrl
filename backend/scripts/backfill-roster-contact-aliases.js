/**
 * Backfill top-level phone/mobile/contact_no from team_members[0] for roster registrations.
 *
 * Usage: node scripts/backfill-roster-contact-aliases.js [--dry-run] [--fest-id=...]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('../src/model/registration_model');
const { normalizeLeadIdentityFromRoster } = require('../src/utils/rosterResponses');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const festArg = args.find((a) => a.startsWith('--fest-id='));
const festFilter = festArg ? festArg.split('=')[1] : null;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL);

  const query = {
    'responses.team_members.0.phone': { $exists: true, $ne: '' },
  };
  if (festFilter) query.fest = festFilter;

  const regs = await Registration.find(query).select('_id responses').lean();
  let updated = 0;

  for (const reg of regs) {
    const current = reg.responses instanceof Map
      ? Object.fromEntries(reg.responses)
      : { ...(reg.responses || {}) };
    const next = normalizeLeadIdentityFromRoster(current);
    const changed = ['phone', 'mobile', 'contact_no', 'full_name', 'name', 'email', 'college', 'college_name']
      .some((key) => String(next[key] || '') !== String(current[key] || ''));
    if (!changed) continue;
    updated += 1;
    if (dryRun) {
      console.log(reg._id, {
        before: {
          phone: current.phone,
          mobile: current.mobile,
          contact_no: current.contact_no,
        },
        after: {
          phone: next.phone,
          mobile: next.mobile,
          contact_no: next.contact_no,
        },
      });
      continue;
    }
    await Registration.updateOne({ _id: reg._id }, { $set: { responses: next } });
  }

  console.log(JSON.stringify({ dryRun, scanned: regs.length, updated }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
