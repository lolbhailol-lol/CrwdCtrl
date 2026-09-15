/**
 * Split renamed AAROHAN 2027 back into:
 *  - AAROHAN 2026 (same _id, lastyearhit) — keeps all Registration data
 *  - AAROHAN 2027 (new _id, upcoming) — cloned fest + competitions, empty regs
 * Then assign both to fest organizer account "aarohan".
 *
 * Usage: node scripts/split_aarohan_2026_2027.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const OLD_ID = '6956905caf14b9da79fef610';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Fest = require('../src/model/fest_organizer_model');
  const Competition = require('../src/model/competition_model');
  const Acc = require('../src/model/fest_organizer_account_model');

  const existing2027 = await Fest.findOne({
    festName: /^AAROHAN\s*2027$/i,
    _id: { $ne: OLD_ID },
  }).select('_id festName').lean();
  if (existing2027) {
    throw new Error(`AAROHAN 2027 already exists as ${existing2027._id} — aborting to avoid dupes`);
  }

  const source = await Fest.findById(OLD_ID);
  if (!source) throw new Error('Source fest not found');

  // 1) Restore historical fest name/status on the original document
  source.festName = 'AAROHAN 2026';
  source.status = 'lastyearhit';
  if (source.slug) {
    source.slug = String(source.slug).replace(/2027/gi, '2026');
  }
  await source.save();
  console.log('OK restored last-year fest:', String(source._id), source.festName, source.status);

  // 2) Clone fest shell for 2027 (no registrations)
  const plain = source.toObject();
  delete plain._id;
  delete plain.__v;
  delete plain.createdAt;
  delete plain.updatedAt;
  // Fresh scanner credentials for the new year (avoid unique code collisions)
  if (plain.scannerAccess) {
    plain.scannerAccess = {
      ...plain.scannerAccess,
      code: undefined,
      passwordHash: undefined,
      enabled: false,
    };
  }

  plain.festName = 'AAROHAN 2027';
  plain.status = 'upcoming';
  plain.isApproved = true;
  plain.slug = plain.slug
    ? String(plain.slug).replace(/2026/gi, '2027')
    : 'aarohan-2027';
  // Ensure slug unique
  const slugTaken = await Fest.findOne({ slug: plain.slug }).select('_id').lean();
  if (slugTaken) plain.slug = `aarohan-2027-${Date.now().toString(36)}`;

  const created = await Fest.create(plain);
  console.log('OK created current fest:', String(created._id), created.festName, created.status, created.slug);

  // 3) Clone competitions onto 2027
  const comps = await Competition.find({ fest: OLD_ID }).lean();
  let clonedComps = 0;
  for (const c of comps) {
    const next = { ...c };
    delete next._id;
    delete next.__v;
    delete next.createdAt;
    delete next.updatedAt;
    next.fest = created._id;
    await Competition.create(next);
    clonedComps += 1;
  }
  console.log('OK cloned competitions:', clonedComps);

  // 4) Assign both fests to aarohan organizer portal account
  const org = await Acc.findOne({ username: 'aarohan' });
  if (!org) throw new Error('Fest organizer account username=aarohan not found');
  const set = new Set((org.assignedFestIds || []).map((id) => String(id)));
  set.add(String(OLD_ID));
  set.add(String(created._id));
  org.assignedFestIds = [...set];
  org.status = 'approved';
  org.isActive = true;
  await org.save();
  console.log('OK assigned fests to aarohan:', org.assignedFestIds.map(String));

  console.log('\nDONE');
  console.log('Public / current year: AAROHAN 2027 →', String(created._id));
  console.log('Portal last-year data: AAROHAN 2026 →', String(OLD_ID));
  console.log('Organizer login: /fest-organizer/login (user: aarohan) — both cards on home');

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FAILED', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
