#!/usr/bin/env node
// Rename the first home section heading to "Trending". Dry run unless --apply.
'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const settings = mongoose.connection.db.collection('sitesettings');
    const doc = await settings.findOne({ key: 'home_section_labels' });
    console.log('Current:', JSON.stringify(doc?.value), '-> ongoing = "Trending"');
    if (process.argv[2] !== '--apply') { console.log('Dry run. Re-run with --apply.'); return; }
    await settings.updateOne({ key: 'home_section_labels' }, { $set: { 'value.ongoing': 'Trending', updatedAt: new Date() } }, { upsert: true });
    console.log(`Applied. Undo: set value.ongoing back to "${doc?.value?.ongoing || ''}".`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
