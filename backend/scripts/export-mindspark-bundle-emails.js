/**
 * Export MindSpark bundle participant emails for organizers.
 * Usage: node scripts/export-mindspark-bundle-emails.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const FEST = '6a7f1010ed26d983b34e55c2';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function pushEmail(set, value) {
  const email = String(value || '').trim().toLowerCase();
  if (email && EMAIL_RE.test(email) && !email.endsWith('@crwdctrl.local')) set.add(email);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection;
  const festOid = new mongoose.Types.ObjectId(FEST);

  const bundles = await db.collection('mindsparkbundles').find({
    fest: festOid,
    status: { $in: ['paid', 'paid_review'] },
  }).toArray();

  const emails = new Set();
  const rows = [];

  for (const bundle of bundles) {
    const user = bundle.user
      ? await db.collection('users').findOne({ _id: bundle.user }, { projection: { name: 1, email: 1, phoneNumber: 1 } })
      : null;
    pushEmail(emails, user?.email);

    const comps = (bundle.items || []).map((i) => i.competitionName).join(' + ');
    for (const item of bundle.items || []) {
      const roster = item.roster || {};
      pushEmail(emails, roster.email);
      pushEmail(emails, roster.full_name_email);
      const members = Array.isArray(roster.team_members) ? roster.team_members : [];
      for (const m of members) {
        if (m && typeof m === 'object') pushEmail(emails, m.email);
      }
      rows.push({
        bundleId: String(bundle._id),
        status: bundle.status,
        payerName: user?.name || roster.full_name || '',
        payerEmail: user?.email || roster.email || '',
        competition: item.competitionName,
        team: roster.team_name || '',
        memberEmails: members
          .map((m) => (typeof m === 'object' ? m.email : ''))
          .filter(Boolean)
          .join('; '),
        competitionsInBundle: comps,
        paidAt: bundle.updatedAt || bundle.createdAt,
      });
    }
  }

  const sorted = [...emails].sort();
  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const txtPath = path.join(outDir, 'mindspark-bundle-emails.txt');
  const csvPath = path.join(outDir, 'mindspark-bundle-participants.csv');
  fs.writeFileSync(txtPath, `${sorted.join('\n')}\n`, 'utf8');

  const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const header = ['bundleId', 'status', 'payerName', 'payerEmail', 'competition', 'team', 'memberEmails', 'competitionsInBundle', 'paidAt'];
  const csv = [
    header.join(','),
    ...rows.map((r) => header.map((k) => csvEscape(r[k])).join(',')),
  ].join('\n');
  fs.writeFileSync(csvPath, `${csv}\n`, 'utf8');

  console.log(JSON.stringify({
    paidBundles: bundles.length,
    uniqueEmails: sorted.length,
    emails: sorted,
    files: { txtPath, csvPath },
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
