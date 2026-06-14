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

// Prevent duplicate registration: one user per event per category
categoryRegistrationSchema.index(
    { category: 1, eventId: 1, user: 1 },
    { unique: true }
);

categoryRegistrationSchema.index({ category: 1 });
categoryRegistrationSchema.index({ eventId: 1 });
categoryRegistrationSchema.index({ user: 1 });
categoryRegistrationSchema.index({ status: 1 });

module.exports = mongoose.model('CategoryRegistration', categoryRegistrationSchema);
