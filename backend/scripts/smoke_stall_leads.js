require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Fest = require('../src/model/fest_organizer_model');
  const Acc = require('../src/model/fest_organizer_account_model');
  const Lead = require('../src/model/fest_interest_lead_model');

  const fest = await Fest.findOne({ festName: /aarohan\s*2027/i }).select('_id festName slug isApproved').lean();
  if (!fest) throw new Error('AAROHAN 2027 not found');
  await Fest.updateOne({ _id: fest._id }, { $set: { slug: 'aarohan-2027' } });
  fest.slug = 'aarohan-2027';
  console.log('OK slug aarohan-2027');
  console.log('fest', String(fest._id), fest.festName, fest.slug);

  const API = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8080/api';
  const phone = `9${Date.now().toString().slice(-9)}`;

  const meta = await fetch(`${API}/fests/aarohan-2027/stall`);
  const metaData = await meta.json();
  if (!meta.ok) throw new Error(`stall meta ${meta.status} ${JSON.stringify(metaData)}`);
  console.log('OK public meta', metaData.fest?.festName);

  const submit = await fetch(`${API}/fests/aarohan-2027/stall-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Fresher',
      phone,
      year: '1st',
      branch: 'CSE',
      interest: 'both',
      source: 'shubharam_stall',
    }),
  });
  const submitData = await submit.json();
  if (!submit.ok) throw new Error(`submit ${submit.status} ${JSON.stringify(submitData)}`);
  console.log('OK public submit', submitData.message);

  const stamp = Date.now().toString(36);
  const username = `stallsmoke_${stamp}`;
  const password = 'SmokeTest1!';
  const org = await Acc.create({
    name: 'Stall Smoke',
    username,
    passwordHash: await Acc.hashPassword(password),
    phone: '1',
    assignedFestIds: [fest._id],
    status: 'approved',
    isActive: true,
    approvedAt: new Date(),
  });

  const login = await fetch(`${API}/fest-organizer/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const auth = await login.json();
  if (!auth.token) throw new Error(JSON.stringify(auth));

  const festId = String(fest._id);
  const list = await fetch(`${API}/fest-organizer/fests/${festId}/leads?today=1`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const listData = await list.json();
  if (!list.ok) throw new Error(JSON.stringify(listData));
  const found = (listData.leads || []).some((l) => l.phone === phone || l.phone.endsWith(phone.slice(-10)));
  console.log('OK portal list', listData.leads?.length, 'found=', found);

  const stats = await fetch(`${API}/fest-organizer/fests/${festId}/leads/stats`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const statsData = await stats.json();
  console.log('OK stats', statsData.stats);

  const csv = await fetch(`${API}/fest-organizer/fests/${festId}/leads/export?today=1`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const csvText = await csv.text();
  if (!csv.ok || !csvText.includes('Smoke Fresher')) {
    throw new Error(`export failed ${csv.status}`);
  }
  console.log('OK export bytes', csvText.length);

  await Lead.deleteMany({ phone });
  await Acc.deleteOne({ _id: org._id });
  console.log('\nSMOKE PASSED');
  console.log('Public URL: /stall/aarohan-2027');
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('SMOKE FAILED', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
