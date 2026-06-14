const mongoose = require('mongoose');

const platformEventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            enum: ['fest', 'trek', 'sports', 'events', 'workshop'],
            required: true,
        },
        venue: {
            type: String,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
        organizer: {
            type: String,
            trim: true,
        },
        images: {
            type: [String],
            default: [],
        },
        registrationLink: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['draft', 'published'],
            default: 'published',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

platformEventSchema.index({ category: 1 });
platformEventSchema.index({ status: 1 });
platformEventSchema.index({ startDate: 1 });

module.exports = mongoose.model('PlatformEvent', platformEventSchema);
