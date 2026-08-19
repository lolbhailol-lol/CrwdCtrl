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
            default: null,
            required: false,
        },
        /** Guest checkout email (when user is null / requireLogin=false) */
        guestEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
        },
        guestName: {
            type: String,
            trim: true,
            default: '',
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
        /** Coupon applied on booking (Cashfree or organizer UPI/SS) */
        couponCode: { type: String, default: '', trim: true, uppercase: true },
        couponDiscount: { type: Number, default: 0 },
        amountBeforeDiscount: { type: Number, default: 0 },
        couponConsumedAt: { type: Date, default: null },
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
        /** Operational gender for seat quotas (Female | Male | Others) */
        participantGender: {
            type: String,
            enum: ['Female', 'Male', 'Others', ''],
            default: '',
        },
        /** Selected registration tier (when event.pricingMode === 'tiers') */
        tierId: { type: String, default: '', trim: true },
        tierName: { type: String, default: '', trim: true },
        tierFee: { type: Number, default: 0 },
        /** Optional booking add-on (per person) chosen on the book page */
        addOnSelected: { type: Boolean, default: false },
        addOnLabel: { type: String, default: '', trim: true },
        addOnFee: { type: Number, default: 0 },
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

// At most one active (pending|confirmed) registration per logged-in user per event.
categoryRegistrationSchema.index(
    { category: 1, eventId: 1, user: 1 },
    {
        unique: true,
        name: 'unique_active_category_registration',
        partialFilterExpression: {
            status: { $in: ['pending', 'confirmed'] },
            user: { $type: 'objectId' },
        },
    },
);

// Guest: one active registration per email per event
categoryRegistrationSchema.index(
    { category: 1, eventId: 1, guestEmail: 1 },
    {
        unique: true,
        name: 'unique_active_guest_category_registration',
        partialFilterExpression: {
            status: { $in: ['pending', 'confirmed'] },
            user: null,
            guestEmail: { $type: 'string' },
        },
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
            const isLegacyFullUnique = isCatEventUser && !idx.partialFilterExpression;
            const isStaleUserPartial = idx.name === 'unique_active_category_registration'
                && idx.partialFilterExpression
                && !idx.partialFilterExpression.user;
            if (isLegacyFullUnique || isStaleUserPartial) {
                await CategoryRegistration.collection.dropIndex(idx.name);
                console.log('ℹ️ Dropped legacy CategoryRegistration index:', idx.name);
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
                partialFilterExpression: {
                    status: { $in: ['pending', 'confirmed'] },
                    user: { $type: 'objectId' },
                },
            },
        );
    } catch (err) {
        if (err?.code !== 85 && err?.code !== 86) {
            console.warn('⚠️ Could not ensure unique_active_category_registration:', err.message);
        }
    }
    try {
        await CategoryRegistration.collection.createIndex(
            { category: 1, eventId: 1, guestEmail: 1 },
            {
                unique: true,
                name: 'unique_active_guest_category_registration',
                partialFilterExpression: {
                    status: { $in: ['pending', 'confirmed'] },
                    user: null,
                    guestEmail: { $type: 'string' },
                },
            },
        );
    } catch (err) {
        if (err?.code !== 85 && err?.code !== 86) {
            console.warn('⚠️ Could not ensure unique_active_guest_category_registration:', err.message);
        }
    }
};

if (mongoose.connection.readyState === 1) {
    ensureCategoryRegistrationIndexes();
} else {
    mongoose.connection.once('open', ensureCategoryRegistrationIndexes);
}

module.exports = CategoryRegistration;
