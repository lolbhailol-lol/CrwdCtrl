/**
 * Create or reset the MindSpark payments organizer account.
 * Prints the one-time password to stdout — do not commit that output.
 *
 * Usage: node scripts/ensure-mindspark-payments-account.js
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const FestOrganizer = require('../src/model/fest_organizer_model');
const FestOrganizerAccount = require('../src/model/fest_organizer_account_model');
const { MINDSPARK_FEST_ID } = require('../src/modules/fest/plugins/mindspark');

const USERNAME = 'mindspark';

function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let out = '';
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return `Ms-${out.slice(0, 5)}-${out.slice(5, 10)}`;
}

(async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI missing');

    await mongoose.connect(uri);

    const fest = await FestOrganizer.findById(MINDSPARK_FEST_ID).select('_id festName').lean();
    if (!fest) {
        throw new Error(`MindSpark fest ${MINDSPARK_FEST_ID} not found`);
    }

    const password = generatePassword();
    const passwordHash = await FestOrganizerAccount.hashPassword(password);
    const now = new Date();

    const existing = await FestOrganizerAccount.findOne({ username: USERNAME });
    let created = false;

    if (existing) {
        existing.passwordHash = passwordHash;
        existing.assignedFestIds = [fest._id];
        existing.status = 'approved';
        existing.isActive = true;
        existing.approvedAt = existing.approvedAt || now;
        existing.rejectedReason = '';
        if (!existing.name) existing.name = 'MindSpark';
        await existing.save();
    } else {
        await FestOrganizerAccount.create({
            name: 'MindSpark',
            username: USERNAME,
            passwordHash,
            assignedFestIds: [fest._id],
            status: 'approved',
            isActive: true,
            approvedAt: now,
        });
        created = true;
    }

    console.log('--- MindSpark payments login (share once, then delete this output) ---');
    console.log(`Fest: ${fest.festName} (${fest._id})`);
    console.log(`Account: ${created ? 'created' : 'reset'}`);
    console.log('URL: https://www.crwdctrl.in/mindspark-payments/login');
    console.log(`Username: ${USERNAME}`);
    console.log(`Password: ${password}`);
    console.log('This is MindSpark payments only. Monday-clear tracking. Not the CrwdCtrl admin panel.');
    console.log('---------------------------------------------------------------------');

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error(err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
