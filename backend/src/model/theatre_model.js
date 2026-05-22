const mongoose = require('mongoose');

const theatreSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String },
        theatreType: {
            type: String,
            enum: ['play', 'musical', 'standup', 'improv', 'dance_drama', 'other'],
            required: true,
        },
        organizer: { type: String, trim: true },
        cast: { type: [String], default: [] },
        venue: { type: String, trim: true },
        city: { type: String, trim: true },
        showTimings: [
            {
                date: { type: Date },
                time: { type: String },
            },
        ],
        duration: { type: String, trim: true },
        language: { type: String, trim: true },
        ageRating: { type: String, trim: true },
        ticketPrice: { type: Number, default: 0 },
        seatingCapacity: { type: Number, default: 0 },
        performerDetails: { type: String, trim: true },
        sponsors: { type: [String], default: [] },
        poster: { type: String, trim: true },
        trailerLink: { type: String, trim: true },
        bookingLink: { type: String, trim: true },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

theatreSchema.index({ theatreType: 1 });
theatreSchema.index({ status: 1 });
theatreSchema.index({ city: 1 });

module.exports = mongoose.model('Theatre', theatreSchema);
