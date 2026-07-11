const mongoose = require('mongoose');

// Unified registration model for Sports, Trek, and Events (cultural shows).
// Fest registrations continue using the existing Registration model unchanged.
const categoryRegistrationSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            enum: ['sports', 'trek', 'events'],
            required: true,
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Dynamic form responses stored as key-value map
        responses: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled'],
            default: 'pending',
        },
        paymentStatus: {
            type: String,
            enum: ['free', 'pending', 'paid', 'failed'],
            default: 'free',
        },
        amountPaid: {
            type: Number,
            default: 0,
        },
        payment_order_id: { type: String, default: null },
        payment_id: { type: String, default: null },
        payment_gateway: { type: String, default: null },
        /** Organizer QR / screenshot payment proof */
        paymentScreenshotUrl: { type: String, default: '' },
        transactionId: { type: String, default: '' },
        paymentReviewNote: { type: String, default: '' },
        paymentReviewedAt: { type: Date, default: null },
        paymentReviewedBy: { type: String, default: '' },
        /** Persisted booking slot (sports / run club) */
        bookingDate: { type: String, default: '' },
        bookingTime: { type: String, default: '' },
        bookingPeople: { type: Number, default: 1 },
        /**
         * Run-club organizer-only PII encryption (AES-GCM).
         * Sensitive form/payment fields live in *Cipher; plaintext responses
         * keep only operational keys (people/date/time).
         */
        piiEncrypted: { type: Boolean, default: false },
        runClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'RunClub', default: null },
        responsesCipher: { type: String, default: '' },
        paymentScreenshotCipher: { type: String, default: '' },
        transactionIdCipher: { type: String, default: '' },
        piiSearchTokens: { type: [String], default: [] },
        // QR check-in
        qrCodeData: { type: String, unique: true, sparse: true },
        checkedIn: { type: Boolean, default: false },
        checkedInAt: { type: Date, default: null },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Non-unique index for fast lookups.
categoryRegistrationSchema.index({ category: 1, eventId: 1, user: 1 });

// At most one active (pending|confirmed) registration per user per event.
// Cancelled/failed rows are excluded so re-register after reject still works.
categoryRegistrationSchema.index(
    { category: 1, eventId: 1, user: 1 },
    {
        unique: true,
        name: 'unique_active_category_registration',
        partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } },
    },
);

categoryRegistrationSchema.index({ category: 1 });
categoryRegistrationSchema.index({ eventId: 1 });
categoryRegistrationSchema.index({ user: 1 });
categoryRegistrationSchema.index({ status: 1 });
categoryRegistrationSchema.index({ category: 1, eventId: 1, status: 1, paymentStatus: 1, createdAt: 1 });
categoryRegistrationSchema.index({ runClubId: 1, piiEncrypted: 1 });
categoryRegistrationSchema.index({ eventId: 1, piiSearchTokens: 1 });

const CategoryRegistration =
    mongoose.models.CategoryRegistration ||
    mongoose.model('CategoryRegistration', categoryRegistrationSchema);

// Drop the legacy *full* unique index (blocked all re-registers including after
// cancel). Keep the partial unique index for active pending|confirmed only.
const ensureCategoryRegistrationIndexes = async () => {
    try {
        const indexes = await CategoryRegistration.collection.indexes();
        for (const idx of indexes) {
            const isCatEventUser =
                idx.unique &&
                idx.key &&
                idx.key.category === 1 &&
                idx.key.eventId === 1 &&
                idx.key.user === 1;
            const isPartialActive = idx.name === 'unique_active_category_registration'
                || idx.partialFilterExpression;
            if (isCatEventUser && !isPartialActive) {
                await CategoryRegistration.collection.dropIndex(idx.name);
                console.log('ℹ️ Dropped legacy full unique index on CategoryRegistration:', idx.name);
            }
        }
    } catch {
        /* ignore */
    }
    try {
        await CategoryRegistration.collection.createIndex({ category: 1, eventId: 1, user: 1 });
    } catch {
        /* ignore */
    }
    try {
        await CategoryRegistration.collection.createIndex(
            { category: 1, eventId: 1, user: 1 },
            {
                unique: true,
                name: 'unique_active_category_registration',
                partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } },
            },
        );
    } catch (err) {
        if (err?.code !== 85 && err?.code !== 86) {
            console.warn('⚠️ Could not ensure unique_active_category_registration:', err.message);
        }
    }
};

if (mongoose.connection.readyState === 1) {
    ensureCategoryRegistrationIndexes();
} else {
    mongoose.connection.once('open', ensureCategoryRegistrationIndexes);
}

module.exports = CategoryRegistration;
