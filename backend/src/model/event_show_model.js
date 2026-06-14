const mongoose = require('mongoose');

const customPageSectionAssignmentSchema = new mongoose.Schema(
    {
        page: { type: String, required: true },
        sectionSlug: { type: String, required: true },
        priority: { type: Number, default: 999, min: 1, max: 999 },
    },
    { _id: false },
);

const eventShowSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String },
        eventType: {
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
        /** Which fixed block on /events this show appears in */
        pageSection: {
            type: String,
            enum: ['hero', 'spotlight', 'upcoming', 'community'],
            default: null,
        },
        pagePriority: { type: Number, default: 999, min: 1, max: 999 },
        homeSection: { type: String, default: null },
        homePriority: { type: Number, default: 999, min: 1, max: 999 },
        customPageSections: {
            type: [customPageSectionAssignmentSchema],
            default: [],
        },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

eventShowSchema.index({ eventType: 1 });
eventShowSchema.index({ status: 1 });
eventShowSchema.index({ city: 1 });
eventShowSchema.index({ status: 1, pageSection: 1, pagePriority: 1 });

// Explicit collection so the rename doesn't migrate to a new Mongo collection.
// Migration script renames `theatres` → `event_shows` separately.
module.exports = mongoose.model('EventShow', eventShowSchema, 'event_shows');
