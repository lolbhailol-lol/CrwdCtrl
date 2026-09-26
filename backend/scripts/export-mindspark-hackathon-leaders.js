/**
 * Export MindSpark HACKATHON team leaders (approved/paid) for CodeChef test outreach.
 * Writes CSV + JSON summary. Does not send.
 *
 * Run: node scripts/export-mindspark-hackathon-leaders.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('../src/model/usermodel');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');
const Registration = require('../src/model/registration_model');

function mapToObj(m) {
  if (!m) return {};
  if (m instanceof Map) return Object.fromEntries(m);
  if (typeof m.toObject === 'function') return m.toObject();
  return { ...m };
}

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  if (digits.length < 12 || digits.length > 15) return '';
  return digits;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const fest = await Fest.findOne({ slug: /mindspark/i }).select('_id festName name').lean();
  const hack = await Competition.findOne({ fest: fest._id, name: /hackathon/i }).select('_id name').lean();

  const regs = await Registration.find({
    competitionId: hack._id,
    status: { $in: ['approved', 'pending'] },
    paymentStatus: { $in: ['paid', 'free'] },
  })
    .populate('user', 'name email phoneNumber')
    .lean();

  const byEmail = new Map();
  for (const r of regs) {
    if (String(r.paymentStatus).toLowerCase() === 'pending') continue;
    if (Number(r.amountPaid) <= 0 && String(r.paymentStatus).toLowerCase() !== 'free' && String(r.paymentStatus).toLowerCase() !== 'paid') {
      // keep paid/free only
    }
    if (!['paid', 'free'].includes(String(r.paymentStatus || '').toLowerCase()) && !(Number(r.amountPaid) > 0)) {
      continue;
    }
    if (r.status === 'rejected') continue;

    const responses = mapToObj(r.responses);
    const members = Array.isArray(responses.team_members) ? responses.team_members : [];
    const leaderName = String(responses.full_name || responses.name || members[0]?.name || r.user?.name || '').trim();
    const leaderEmail = String(responses.email || members[0]?.email || r.user?.email || '').trim().toLowerCase();
    const leaderPhone = normalizePhone(
      responses.phone || responses.mobile || responses.contact_no || members[0]?.phone || r.user?.phoneNumber || '',
    );
    if (!leaderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leaderEmail)) continue;

    const first = leaderName.split(/\s+/)[0] || leaderName;
    const last = leaderName.split(/\s+/).slice(1).join(' ') || '';
    const row = {
      email: leaderEmail,
      first_name: first,
      last_name: last,
      full_name: leaderName,
      phone: leaderPhone,
      team_name: String(responses.team_name || r.teamName || '').trim(),
      registration_id: String(r._id),
      amount_paid: Number(r.amountPaid) || 0,
      status: r.status,
      payment_status: r.paymentStatus,
    };
    const prev = byEmail.get(leaderEmail);
    if (!prev || (row.amount_paid > 0 && prev.amount_paid <= 0)) {
      byEmail.set(leaderEmail, row);
    }
  }

  const leaders = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'mindspark-hackathon-leaders.csv');
  const jsonPath = path.join(outDir, 'mindspark-hackathon-leaders.json');

  const csv = [
    'email,first_name,last_name,phone,team_name,registration_id',
    ...leaders.map((l) => [
      csvEscape(l.email),
      csvEscape(l.first_name),
      csvEscape(l.last_name),
      csvEscape(l.phone),
      csvEscape(l.team_name),
      csvEscape(l.registration_id),
    ].join(',')),
  ].join('\n');

  fs.writeFileSync(csvPath, csv, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({
    fest: fest.festName || fest.name,
    competition: hack.name,
    count: leaders.length,
    withPhone: leaders.filter((l) => l.phone).length,
    leaders,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    count: leaders.length,
    withPhone: leaders.filter((l) => l.phone).length,
    csvPath,
    jsonPath,
    sample: leaders.slice(0, 3).map((l) => ({ email: l.email, name: l.full_name, team: l.team_name, hasPhone: !!l.phone })),
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
