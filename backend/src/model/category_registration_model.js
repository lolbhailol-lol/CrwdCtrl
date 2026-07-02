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
        // QR check-in
        qrCodeData: { type: String, unique: true, sparse: true },
        checkedIn: { type: Boolean, default: false },
        checkedInAt: { type: Date, default: null },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Non-unique index for fast lookups. Repeat registrations are allowed —
// duplicate-payment protection lives in the controllers (payment_order_id
// scoped idempotency), not in a unique index.
categoryRegistrationSchema.index({ category: 1, eventId: 1, user: 1 });

categoryRegistrationSchema.index({ category: 1 });
categoryRegistrationSchema.index({ eventId: 1 });
categoryRegistrationSchema.index({ user: 1 });
categoryRegistrationSchema.index({ status: 1 });

const CategoryRegistration =
    mongoose.models.CategoryRegistration ||
    mongoose.model('CategoryRegistration', categoryRegistrationSchema);

// Drop the legacy unique index if it exists so repeat registrations are
// allowed. Without this a second registration throws E11000 → error → the
// user is bounced back to the form even after a successful payment.
const dropLegacyCategoryUniqueIndex = async () => {
    try {
        const indexes = await CategoryRegistration.collection.indexes();
        const legacy = indexes.find(
            (idx) => idx.unique && idx.key && idx.key.category === 1 && idx.key.eventId === 1 && idx.key.user === 1
        );
        if (legacy) {
            await CategoryRegistration.collection.dropIndex(legacy.name);
            console.log('ℹ️ Dropped legacy unique index on CategoryRegistration:', legacy.name);
        }
    } catch {
        // Index may not exist — nothing to drop
    }
    try {
        await CategoryRegistration.collection.createIndex({ category: 1, eventId: 1, user: 1 });
    } catch {
        /* ignore */
    }
};

if (mongoose.connection.readyState === 1) {
    dropLegacyCategoryUniqueIndex();
} else {
    mongoose.connection.once('open', dropLegacyCategoryUniqueIndex);
}

module.exports = CategoryRegistration;
