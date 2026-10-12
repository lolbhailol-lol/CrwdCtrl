#!/usr/bin/env node
/*
 * October 2026 home + games cleanup. Dry run by default; --apply writes after a backup.
 * - Home "ongoing" heading -> "Upcoming Events"
 * - Halloween Sundowner Rush into that section (first); Ritrovo Rush off the home page
 * - Delete the "kkkk" test game; hide the stray "campus hunt" game (MIT draft event is kept)
 * Undo: node scripts/update-home-upcoming-oct-2026.js --rollback <backup-id>
 */
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

const HALLOWEEN_ID = '6acb3e646d833eb479e3e403';
const RITROVO_ID = '6ab259f0608a9959ded70256';
const KKKK_GAME_ID = '6ac537160dac36170ead4bfc';
const STRAY_GAME_ID = '6ac5347e0dac36170ead4101';

async function main() {
  const [flag, backupId] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const db = mongoose.connection.db;
    const { CatalogImageRecoveryBackup: Backup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const id = (value) => new mongoose.Types.ObjectId(value);

    if (flag === '--rollback') {
      const record = await Backup.findById(backupId).lean();
      if (!record) throw new Error(`No backup ${backupId}`);
      const b = record.backup;
      await db.collection('sitesettings').updateOne({ key: 'home_section_labels' }, { $set: { value: b.labels } });
      for (const row of b.sports) await db.collection('sportsevents').updateOne({ _id: id(row._id) }, { $set: { homeSection: row.homeSection, homePriority: row.homePriority } });
      if (b.kkkkGame) await db.collection('collegegames').replaceOne({ _id: id(b.kkkkGame._id) }, { ...b.kkkkGame, _id: id(b.kkkkGame._id) }, { upsert: true });
      if (b.strayGame) await db.collection('collegegames').updateOne({ _id: id(STRAY_GAME_ID) }, { $set: { status: b.strayGame.status } });
      console.log('Rolled back', backupId);
      return;
    }

    const labelsDoc = await db.collection('sitesettings').findOne({ key: 'home_section_labels' });
    const sports = await db.collection('sportsevents').find({ _id: { $in: [id(HALLOWEEN_ID), id(RITROVO_ID)] } }).project({ title: 1, homeSection: 1, homePriority: 1 }).toArray();
    const kkkkGame = await db.collection('collegegames').findOne({ _id: id(KKKK_GAME_ID) });
    const strayGame = await db.collection('collegegames').findOne({ _id: id(STRAY_GAME_ID) }, { projection: { title: 1, status: 1 } });
    const regs = await db.collection('gameregistrations').countDocuments({ gameId: { $in: [id(KKKK_GAME_ID), id(STRAY_GAME_ID)] } });
    if (regs) throw new Error(`Refusing: ${regs} registrations exist on the games being removed`);

    console.log('Heading:', JSON.stringify(labelsDoc?.value), '-> ongoing = "Upcoming Events"');
    for (const s of sports) console.log(`Sport "${s.title}": homeSection ${s.homeSection} ->`, String(s._id) === HALLOWEEN_ID ? 'trending (priority 1)' : 'none');
    console.log('Delete game:', kkkkGame?.title || '(already gone)');
    console.log('Hide game:', strayGame?.title, `(${strayGame?.status} -> cancelled)`);
    if (flag !== '--apply') { console.log('Dry run. Re-run with --apply.'); return; }

    const record = await Backup.create({ backup: { source: 'update-home-upcoming-oct-2026', labels: labelsDoc?.value || null, sports, kkkkGame, strayGame } });
    await db.collection('sitesettings').updateOne({ key: 'home_section_labels' }, { $set: { 'value.ongoing': 'Upcoming Events', updatedAt: new Date() } }, { upsert: true });
    await db.collection('sportsevents').updateOne({ _id: id(HALLOWEEN_ID) }, { $set: { homeSection: 'trending', homePriority: 1 } });
    await db.collection('sportsevents').updateOne({ _id: id(RITROVO_ID) }, { $set: { homeSection: null } });
    if (kkkkGame) await db.collection('collegegames').deleteOne({ _id: id(KKKK_GAME_ID) });
    await db.collection('collegegames').updateOne({ _id: id(STRAY_GAME_ID) }, { $set: { status: 'cancelled' } });
    console.log(`Applied. Backup id: ${record._id}\nUndo: node scripts/update-home-upcoming-oct-2026.js --rollback ${record._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
