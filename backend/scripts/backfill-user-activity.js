#!/usr/bin/env node
/**
 * One-time import of legacy Analytics + user login snapshots since December 1.
 * Usage: node scripts/backfill-user-activity.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { backfillUserActivitySinceDecember } = require('../src/services/userActivityBackfillService');

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('Connected. Running backfill…');
    const result = await backfillUserActivitySinceDecember({ force: true });
    console.log(JSON.stringify(result, null, 2));
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
