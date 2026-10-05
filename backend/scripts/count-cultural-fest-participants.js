/**
 * Audience dry-run: cultural fest participants eligible for Kshitij outreach.
 * Run: node scripts/count-cultural-fest-participants.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Registration = require('../src/model/registration_model');
const CompetitionRegistration = require('../src/model/competition_registration_model');
require('../src/model/usermodel');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function responsesToObject(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses === 'object') return responses;
  return {};
}

function pickEmail(user, responses = {}) {
  const members = responses.team_members;
  const leadEmail = Array.isArray(members) && members[0] && typeof members[0] === 'object'
    ? String(members[0].email || '').trim().toLowerCase()
    : '';
  const email = String(user?.email || responses.email || leadEmail || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const fests = await Fest.find({ festType: 'cultural' }).select('_id festName slug status').lean();
  const festIds = fests.map((f) => f._id);
  const byFest = [];

  for (const fest of fests) {
    const regs = await Registration.find({
      fest: fest._id,
      isProShow: { $ne: true },
      status: { $in: ['pending', 'approved'] },
    }).populate('user', 'email').select('responses user').lean();

    const emails = new Set();
    for (const reg of regs) {
      const email = pickEmail(reg.user, responsesToObject(reg.responses));
      if (email) emails.add(email);
    }
    byFest.push({
      festName: fest.festName,
      slug: fest.slug || null,
      status: fest.status,
      registrations: regs.length,
      uniqueEmails: emails.size,
    });
  }

  // Legacy CompetitionRegistration (Instagram/manual form) — no festType link; skip unless email-only dump needed
  const legacyCount = await CompetitionRegistration.countDocuments({});

  const allRegs = await Registration.find({
    fest: { $in: festIds },
    isProShow: { $ne: true },
    status: { $in: ['pending', 'approved'] },
  }).populate('user', 'email').select('responses user fest').lean();

  const allEmails = new Set();
  for (const reg of allRegs) {
    const email = pickEmail(reg.user, responsesToObject(reg.responses));
    if (email) allEmails.add(email);
  }

  console.log(JSON.stringify({
    culturalFests: byFest,
    totalRegistrations: allRegs.length,
    uniqueEmailsAcrossCulturalFests: allEmails.size,
    legacyCompetitionRegistrations: legacyCount,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
