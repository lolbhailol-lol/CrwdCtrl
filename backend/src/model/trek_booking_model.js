const mongoose = require('mongoose');
const crypto = require('crypto');

const trekBookingSchema = new mongoose.Schema(
    {
        trekId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Trek', required: true },
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userEmail: { type: String, trim: true, lowercase: true },
        userName:  { type: String, trim: true },
        formData:  { type: mongoose.Schema.Types.Mixed, default: {} },
        // Top-level for idempotency queries (security: one order → one booking)
        payment_order_id: { type: String },
        bookingDetails: {
            date:       { type: String },
            time:       { type: String },
            people:     { type: Number, default: 1 },
            amountPaid: { type: Number, default: 0 },
            paymentId:  { type: String },
            payment_order_id: { type: String },
        },
        status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
        qrCodeData: { type: String, unique: true, sparse: true },
        checkedIn: { type: Boolean, default: false },
        checkedInAt: { type: Date, default: null },
    },
    { timestamps: true }
);

trekBookingSchema.index({ userId: 1 });
trekBookingSchema.index({ trekId: 1 });
trekBookingSchema.index({ payment_order_id: 1 }, { unique: true, sparse: true });

trekBookingSchema.pre('save', function assignQrCodeData(next) {
    if (!this.qrCodeData) {
        this.qrCodeData = crypto.randomBytes(16).toString('hex');
    }
    next();
});

module.exports = mongoose.models.TrekBooking || mongoose.model('TrekBooking', trekBookingSchema);
