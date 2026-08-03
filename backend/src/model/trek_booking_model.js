const mongoose = require('mongoose');
const crypto = require('crypto');

const trekBookingSchema = new mongoose.Schema(
    {
        trekId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Trek', required: true },
        /** Optional for guest checkout (registration.requireLogin === false) */
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        userEmail: { type: String, trim: true, lowercase: true },
        userName:  { type: String, trim: true },
        /** Female | Male | Others — for gender quota counting */
        participantGender: {
            type: String,
            enum: ['Female', 'Male', 'Others'],
            default: null,
        },
        formData:  { type: mongoose.Schema.Types.Mixed, default: {} },
        // Top-level for idempotency queries (security: one order → one booking)
        payment_order_id: { type: String },
        /** cashfree | organizer_qr | null (free) */
        payment_gateway: { type: String, default: null },
        paymentScreenshotUrl: { type: String, default: '' },
        transactionId: { type: String, default: '' },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'free', 'failed', null],
            default: null,
        },
        paymentReviewNote: { type: String, default: '' },
        paymentReviewedAt: { type: Date, default: null },
        paymentReviewedBy: { type: String, default: '' },
        bookingDetails: {
            date:       { type: String },
            time:       { type: String },
            people:     { type: Number, default: 1 },
            amountPaid: { type: Number, default: 0 },
            paymentId:  { type: String },
            payment_order_id: { type: String },
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled'],
            default: 'confirmed',
        },
        qrCodeData: { type: String, unique: true, sparse: true },
        checkedIn: { type: Boolean, default: false },
        checkedInAt: { type: Date, default: null },
    },
    { timestamps: true }
);

trekBookingSchema.index({ userId: 1 });
trekBookingSchema.index({ trekId: 1 });
trekBookingSchema.index({ trekId: 1, status: 1 });
trekBookingSchema.index({ trekId: 1, userId: 1, createdAt: -1 });
trekBookingSchema.index({ userEmail: 1 });
trekBookingSchema.index({ payment_order_id: 1 }, { unique: true, sparse: true });

trekBookingSchema.pre('validate', function enforcePaidBookingPaymentOrder(next) {
    const amountPaid = Number(this.bookingDetails?.amountPaid) || 0;
    const isOrganizerQr = this.payment_gateway === 'organizer_qr';
    // Cashfree paid bookings need an order id; UPI/QR pending bookings use screenshot instead
    if (amountPaid > 0 && !isOrganizerQr && !this.payment_order_id) {
        this.invalidate('payment_order_id', 'payment_order_id is required for paid bookings');
    }
    next();
});

trekBookingSchema.pre('save', function assignQrCodeData(next) {
    if (!this.qrCodeData) {
        this.qrCodeData = crypto.randomBytes(16).toString('hex');
    }
    next();
});

const TrekBooking = mongoose.models.TrekBooking || mongoose.model('TrekBooking', trekBookingSchema);

const ensureTrekBookingIndexes = async () => {
    try {
        const indexes = await TrekBooking.collection.indexes();
        for (const idx of indexes) {
            // Drop one-booking-per-user/email uniques — users may book the same trek again
            if (
                idx.name === 'trek_user_active_booking_unique'
                || idx.name === 'trek_guest_email_active_booking_unique'
            ) {
                try {
                    await TrekBooking.collection.dropIndex(idx.name);
                    console.log(`ℹ️ Dropped ${idx.name} (multi-booking enabled)`);
                } catch (_) { /* ignore */ }
            }
        }
    } catch (_) { /* ignore */ }

    try {
        await TrekBooking.syncIndexes();
    } catch (err) {
        if (err?.code !== 85 && err?.code !== 86) {
            console.warn('⚠️ Could not sync TrekBooking indexes:', err.message);
        }
    }
};

if (mongoose.connection.readyState === 1) {
    ensureTrekBookingIndexes();
} else {
    mongoose.connection.once('open', ensureTrekBookingIndexes);
}

module.exports = TrekBooking;
