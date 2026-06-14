/**
 * One-time migration: rename Theatre → EventShow domain across MongoDB.
 *
 * What this script does (idempotent — safe to re-run):
 *   1. Renames the `theatres` collection to `event_shows`.
 *      - If `event_shows` already exists with data, copies remaining `theatres`
 *        docs into it (using `_id` to avoid duplicates), then drops `theatres`.
 *   2. On `event_shows`: renames the `theatreType` field to `eventType`.
 *   3. On `category_registrations`: updates `category: 'theatre'` → `'events'`.
 *   4. On `homepage_sections`: updates `targetPage: 'theatre'` → `'events'`.
 *   5. On every entity that has `customPageSections[]` (fests, treks,
 *      trek_communities, sports, run_clubs, event_shows): updates any inner
 *      element where `page === 'theatre'` → `'events'`.
 *
 * Run: node scripts/migrate-theatre-to-events.js
 *
 * Pass --dry to preview counts without modifying data:
 *      node scripts/migrate-theatre-to-events.js --dry
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry');
const log = (...args) => console.log(...args);

async function collectionExists(db, name) {
    const list = await db.listCollections({ name }).toArray();
    return list.length > 0;
}

async function renameTheatresCollection(db) {
    const hasOld = await collectionExists(db, 'theatres');
    const hasNew = await collectionExists(db, 'event_shows');

    if (!hasOld && hasNew) {
        log('• `theatres` collection not found — assuming already renamed.');
        return;
    }
    if (!hasOld && !hasNew) {
        log('• Neither `theatres` nor `event_shows` exist — nothing to rename.');
        return;
    }
    if (hasOld && !hasNew) {
        log('• Renaming `theatres` → `event_shows` …');
        if (!DRY_RUN) {
            await db.collection('theatres').rename('event_shows');
        }
        return;
    }
    // Both exist — merge by _id, then drop theatres.
    log('• Both `theatres` and `event_shows` exist. Merging by _id …');
    const theatres = db.collection('theatres');
    const eventShows = db.collection('event_shows');
    const cursor = theatres.find({});
    let copied = 0;
    let skipped = 0;
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const exists = await eventShows.findOne({ _id: doc._id }, { projection: { _id: 1 } });
        if (exists) {
            skipped += 1;
            continue;
        }
        if (!DRY_RUN) {
            await eventShows.insertOne(doc);
        }
        copied += 1;
    }
    log(`  → copied ${copied} doc(s) into event_shows, skipped ${skipped} duplicate(s).`);
    if (!DRY_RUN) {
        await theatres.drop();
        log('  → dropped `theatres` collection.');
    }
}

async function renameTheatreTypeField(db) {
    if (!(await collectionExists(db, 'event_shows'))) {
        log('• `event_shows` missing — skipping field rename.');
        return;
    }
    const filter = { theatreType: { $exists: true } };
    const count = await db.collection('event_shows').countDocuments(filter);
    log(`• event_shows.theatreType → eventType : ${count} doc(s) need rename`);
    if (!DRY_RUN && count > 0) {
        const res = await db.collection('event_shows').updateMany(filter, {
            $rename: { theatreType: 'eventType' },
        });
        log(`  → renamed in ${res.modifiedCount} doc(s).`);
    }
}

async function updateCategoryRegistrations(db) {
    if (!(await collectionExists(db, 'categoryregistrations'))) {
        log('• `categoryregistrations` missing — skipping.');
        return;
    }
    const filter = { category: 'theatre' };
    const count = await db.collection('categoryregistrations').countDocuments(filter);
    log(`• category_registrations.category 'theatre' → 'events' : ${count} doc(s)`);
    if (!DRY_RUN && count > 0) {
        const res = await db.collection('categoryregistrations').updateMany(filter, {
            $set: { category: 'events' },
        });
        log(`  → updated ${res.modifiedCount} doc(s).`);
    }
}

async function updateHomepageSections(db) {
    if (!(await collectionExists(db, 'homepagesections'))) {
        log('• `homepagesections` missing — skipping.');
        return;
    }
    const filter = { targetPage: 'theatre' };
    const count = await db.collection('homepagesections').countDocuments(filter);
    log(`• homepage_sections.targetPage 'theatre' → 'events' : ${count} doc(s)`);
    if (!DRY_RUN && count > 0) {
        const res = await db.collection('homepagesections').updateMany(filter, {
            $set: { targetPage: 'events' },
        });
        log(`  → updated ${res.modifiedCount} doc(s).`);
    }
}

async function updateCustomPageSections(db, collectionName) {
    if (!(await collectionExists(db, collectionName))) {
        log(`• \`${collectionName}\` missing — skipping customPageSections.`);
        return;
    }
    const filter = { 'customPageSections.page': 'theatre' };
    const count = await db.collection(collectionName).countDocuments(filter);
    log(`• ${collectionName}.customPageSections[].page 'theatre' → 'events' : ${count} doc(s)`);
    if (!DRY_RUN && count > 0) {
        const res = await db.collection(collectionName).updateMany(
            filter,
            { $set: { 'customPageSections.$[el].page': 'events' } },
            { arrayFilters: [{ 'el.page': 'theatre' }] },
        );
        log(`  → updated ${res.modifiedCount} doc(s).`);
    }
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI not set');
        process.exit(1);
    }
    log(DRY_RUN ? '🟡 DRY RUN — no writes will happen' : '🟢 LIVE RUN — writing changes');
    log('Connecting to MongoDB…');
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    try {
        log('\n[1/5] Rename theatres collection');
        await renameTheatresCollection(db);

        log('\n[2/5] Rename theatreType field on event_shows');
        await renameTheatreTypeField(db);

        log('\n[3/5] Update category_registrations.category');
        await updateCategoryRegistrations(db);

        log('\n[4/5] Update homepage_sections.targetPage');
        await updateHomepageSections(db);

        log('\n[5/5] Update customPageSections on every entity');
        const ENTITIES_WITH_CUSTOM_SECTIONS = [
            'festorganizers',
            'treks',
            'trekcommunities',
            'sportsevents',
            'runclubs',
            'event_shows',
        ];
        for (const name of ENTITIES_WITH_CUSTOM_SECTIONS) {
            await updateCustomPageSections(db, name);
        }

        log('\n✅ Migration complete.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

main();
