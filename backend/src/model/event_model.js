const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        eventType: {
            type: String,
            enum: ['workshop', 'seminar', 'performance', 'exhibition', 'networking', 'other'],
            required: true,
        },
        fest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizer',
            required: true,
        },
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        venue: {
            type: String,
            required: true,
        },
        maxParticipants: {
            type: Number,
            default: 0, // 0 means unlimited
        },
        registrationFee: {
            type: Number,
            default: 0, // Free by default
        },
        requirements: [
            {
                type: String, // e.g., "Laptop required", "Prior knowledge of JavaScript"
            },
        ],
        speakers: [
            {
                name: {
                    type: String,
                    required: true,
                },
                designation: String,
                company: String,
                bio: String,
                profileImage: String,
            },
        ],
        registeredParticipants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        status: {
            type: String,
            enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
            default: 'draft',
        },
        coverImage: String,
        gallery: [String],
        registrationDeadline: Date,
        isApproved: {
            type: Boolean,
            default: true, // Events are auto-approved by default
        },
        tags: [String],
        resources: [
            {
                title: String,
                url: String,
                type: {
                    type: String,
                    enum: ['document', 'video', 'website', 'other'],
                },
            },
        ],
    },
    { timestamps: true }
);

// Indexes for better performance
eventSchema.index({ fest: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ startTime: 1 });

module.exports = mongoose.model('Event', eventSchema);