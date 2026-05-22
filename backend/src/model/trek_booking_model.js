const mongoose = require('mongoose');

const trekBookingSchema = new mongoose.Schema(
    {
        trekId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Trek', required: true },
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userEmail: { type: String, trim: true, lowercase: true },
        userName:  { type: String, trim: true },
        formData:  { type: mongoose.Schema.Types.Mixed, default: {} },
        bookingDetails: {
            date:       { type: String },
            time:       { type: String },
            people:     { type: Number, default: 1 },
            amountPaid: { type: Number, default: 0 },
            paymentId:  { type: String },
        },
        status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    },
    { timestamps: true }
);

trekBookingSchema.index({ userId: 1 });
trekBookingSchema.index({ trekId: 1 });

module.exports = mongoose.models.TrekBooking || mongoose.model('TrekBooking', trekBookingSchema);
