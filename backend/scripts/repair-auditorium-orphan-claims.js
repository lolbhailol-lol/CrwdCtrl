/** Remove stale Auditorium identity claims left by generic participant deletion. */
require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('../src/model/registration_model');
const Competition = require('../src/model/competition_model');
const TicketClaim = require('../src/model/mindspark_auditorium_ticket_claim_model');
const { sanitizeCategories } = require('../src/modules/fest/plugins/mindsparkAuditorium');
const { syncCategoryCounter } = require('../src/utils/auditoriumQuota');

async function main() {
  const fix = process.argv.includes('--fix');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing Mongo URI');
  await mongoose.connect(uri);

  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const claims = await TicketClaim.find({ createdAt: { $lt: cutoff } }).select('_id competitionId registrationId kind').lean();
  const registrationIds = [...new Set(claims.map((claim) => String(claim.registrationId || '')).filter(Boolean))];
  const existing = registrationIds.length
    ? await Registration.find({ _id: { $in: registrationIds } }).select('_id').lean()
    : [];
  const existingIds = new Set(existing.map((registration) => String(registration._id)));
  const orphaned = claims.filter((claim) => !claim.registrationId || !existingIds.has(String(claim.registrationId)));
  const competitionIds = [...new Set(orphaned.map((claim) => String(claim.competitionId)))];

  console.log(JSON.stringify({
    mode: fix ? 'fix' : 'dry-run',
    staleClaimsScanned: claims.length,
    orphanClaims: orphaned.length,
    affectedCompetitions: competitionIds.length,
    orphanKinds: orphaned.reduce((counts, claim) => ({
      ...counts,
      [claim.kind]: (counts[claim.kind] || 0) + 1,
    }), {}),
  }, null, 2));

  if (fix && orphaned.length) {
    await TicketClaim.deleteMany({ _id: { $in: orphaned.map((claim) => claim._id) } });
    const competitions = await Competition.find({ _id: { $in: competitionIds } }).select('_id auditorium.categories').lean();
    for (const competition of competitions) {
      for (const category of sanitizeCategories(competition.auditorium?.categories || [])) {
        await syncCategoryCounter(competition._id, category.id);
      }
    }
    console.log(JSON.stringify({ repairedClaims: orphaned.length, countersSynced: competitions.length }, null, 2));
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
