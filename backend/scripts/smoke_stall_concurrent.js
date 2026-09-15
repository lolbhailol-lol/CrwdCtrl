require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const API = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8080/api';
  const meta = await fetch(`${API}/fests/aarohan-2027/stall`);
  const md = await meta.json();
  if (!meta.ok) throw new Error(JSON.stringify(md));

  const phone = `7${Date.now().toString().slice(-9)}`;
  const body = {
    name: 'Concurrent Crowd Test',
    phone,
    year: '1st',
    branch: 'CSE',
    interest: 'volunteer',
    volunteerTeams: ['pr'],
    source: 'shubharam_stall',
  };

  const posts = await Promise.all(
    Array.from({ length: 8 }, () =>
      fetch(`${API}/fests/aarohan-2027/stall-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, data: await r.json() })),
    ),
  );

  console.log('concurrent statuses', posts.map((p) => p.status).join(','));
  const fails = posts.filter((p) => p.status >= 400);
  if (fails.length) {
    console.error('FAILS', JSON.stringify(fails, null, 2));
    process.exit(1);
  }
  console.log('OK concurrent upserts', posts.map((p) => p.data.message).join(' | '));

  await mongoose.connect(process.env.MONGODB_URI);
  const Lead = require('../src/model/fest_interest_lead_model');
  const del = await Lead.deleteMany({ phone, name: /Concurrent Crowd/i });
  console.log('cleaned', del.deletedCount);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
