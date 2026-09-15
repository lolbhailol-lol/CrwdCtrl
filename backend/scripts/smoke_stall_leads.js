require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Fest = require('../src/model/fest_organizer_model');
  const Acc = require('../src/model/fest_organizer_account_model');
  const Lead = require('../src/model/fest_interest_lead_model');

  const fest = await Fest.findOne({ festName: /aarohan\s*2027/i }).select('_id festName slug isApproved').lean();
  if (!fest) throw new Error('AAROHAN 2027 not found');
  console.log('fest', String(fest._id), fest.festName, fest.slug);

  const API = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8080/api';
  const qrPhone = `9${Date.now().toString().slice(-9)}`;
  const kioskPhone = `8${Date.now().toString().slice(-9)}`;

  // --- QR / public stall submit ---
  const meta = await fetch(`${API}/fests/aarohan-2027/stall`);
  const metaData = await meta.json();
  if (!meta.ok) throw new Error(`stall meta ${meta.status} ${JSON.stringify(metaData)}`);
  console.log('OK public meta', metaData.fest?.festName, 'comps', metaData.competitions?.length);

  const submit = await fetch(`${API}/fests/aarohan-2027/stall-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'QR Smoke Student',
      phone: qrPhone,
      year: '2nd',
      branch: 'Artificial Intelligence',
      interest: 'participate',
      competitionIds: metaData.competitions?.[0]?.id ? [String(metaData.competitions[0].id)] : [],
      source: 'shubharam_stall',
    }),
  });
  const submitData = await submit.json();
  if (!submit.ok) throw new Error(`QR submit ${submit.status} ${JSON.stringify(submitData)}`);
  console.log('OK QR submit', submitData.message, 'branch=', submitData.lead?.branch);

  // --- Organizer login + kiosk ---
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
  const kiosk = await fetch(`${API}/fest-organizer/fests/${festId}/leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Kiosk Smoke Lead',
      phone: kioskPhone,
      year: '3rd',
      branch: 'Mechatronics',
      interest: 'volunteer',
      volunteerTeams: ['pr', 'marathon'],
      source: 'organizer_kiosk',
    }),
  });
  const kioskData = await kiosk.json();
  if (!kiosk.ok) throw new Error(`kiosk ${kiosk.status} ${JSON.stringify(kioskData)}`);
  console.log('OK kiosk submit', kioskData.message, 'teams=', kioskData.lead?.volunteerTeams);

  const list = await fetch(`${API}/fest-organizer/fests/${festId}/leads?today=1`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const listData = await list.json();
  if (!list.ok) throw new Error(JSON.stringify(listData));
  const phones = (listData.leads || []).map((l) => l.phone);
  const foundQr = phones.some((p) => p === qrPhone || p.endsWith(qrPhone.slice(-10)));
  const foundKiosk = phones.some((p) => p === kioskPhone || p.endsWith(kioskPhone.slice(-10)));
  console.log('OK today list', listData.leads?.length, 'qr=', foundQr, 'kiosk=', foundKiosk);
  if (!foundQr || !foundKiosk) {
    throw new Error(`Missing from today list qr=${foundQr} kiosk=${foundKiosk}`);
  }

  const dbQr = await Lead.findOne({ fest: fest._id, phone: qrPhone }).lean();
  const dbKiosk = await Lead.findOne({ fest: fest._id, phone: kioskPhone }).lean();
  if (!dbQr || dbQr.branch !== 'Artificial Intelligence') throw new Error('QR branch not saved');
  if (!dbKiosk || dbKiosk.source !== 'organizer_kiosk') throw new Error('Kiosk source wrong');
  console.log('OK DB rows', { qr: dbQr.source, kiosk: dbKiosk.source });

  await Lead.deleteMany({ phone: { $in: [qrPhone, kioskPhone] } });
  await Acc.deleteOne({ _id: org._id });
  console.log('\nSMOKE PASSED — QR + kiosk both save and show under Today');
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('SMOKE FAILED', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
