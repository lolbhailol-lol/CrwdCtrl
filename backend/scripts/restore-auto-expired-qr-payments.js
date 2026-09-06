/**
 * Restore organizer-QR payments that were auto-expired by the old TTL cron.
 * Puts them back to pending so they appear in the organizer dashboard for approval.
 *
 * Usage (from backend/):
 *   node scripts/restore-auto-expired-qr-payments.js
 *   node scripts/restore-auto-expired-qr-payments.js --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CategoryRegistration = require('../src/model/category_registration_model');

const APPLY = process.argv.includes('--apply');
const DAYS = Math.max(1, Number(process.env.RESTORE_AUTO_EXPIRED_DAYS) || 30);

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('Missing MONGODB_URI');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

    // Match any auto-expired hold — status may be cancelled OR left inconsistent (confirmed + failed).
    const filter = {
        category: 'sports',
        payment_gateway: 'organizer_qr',
        paymentReviewNote: { $regex: /Auto-expired/i },
        $or: [
            { paymentReviewedAt: { $gte: since } },
            { updatedAt: { $gte: since } },
            { createdAt: { $gte: since } },
        ],
        // Don't touch fully paid confirmed tickets
        paymentStatus: { $ne: 'paid' },
    };

    const matches = await CategoryRegistration.find(filter)
        .select('_id eventId user amountPaid status paymentStatus createdAt paymentReviewedAt paymentReviewNote paymentScreenshotUrl paymentScreenshotCipher')
        .lean();

    console.log(`Found ${matches.length} auto-expired QR payment(s) in the last ${DAYS} day(s).`);
    for (const row of matches) {
        console.log(
            ` - ${row._id} event=${row.eventId} status=${row.status}/${row.paymentStatus} amount=${row.amountPaid} note=${row.paymentReviewNote}`,
        );
    }

    if (!APPLY) {
        console.log('\nDry run only. Re-run with --apply to restore to pending.');
        await mongoose.disconnect();
        return;
    }

    if (!matches.length) {
        console.log('Nothing to restore.');
        await mongoose.disconnect();
        return;
    }

    const ids = matches.map((r) => r._id);
    const result = await CategoryRegistration.updateMany(
        { _id: { $in: ids } },
        {
            $set: {
                status: 'pending',
                paymentStatus: 'pending',
                paymentReviewNote: 'Restored after auto-expiry was disabled — awaiting organizer review',
            },
            $unset: {
                paymentReviewedAt: 1,
                paymentReviewedBy: 1,
            },
        },
    );

    console.log(`\nRestored ${result.modifiedCount} registration(s) to pending.`);
    console.log('They should now show under Needs review / pending payment in the run club organizer dashboard.');
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
