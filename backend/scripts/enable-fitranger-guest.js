require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const id = '6a679c6ff59968ec249ee072';
  const ev = await SportsEvent.findById(id);
  if (!ev) throw new Error('missing');
  if (!ev.registration) ev.registration = {};
  ev.registration.requireLogin = false;
  ev.markModified('registration');
  await ev.save();
  console.log('Fitranger requireLogin set to', ev.registration.requireLogin);
  console.log('slug', ev.slug, 'previousSlugs', ev.previousSlugs);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
