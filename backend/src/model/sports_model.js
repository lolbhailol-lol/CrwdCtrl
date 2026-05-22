const mongoose = require('mongoose');

const sportsEventSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        sportType: {
            type: String,
            enum: ['run_club', 'football', 'cricket', 'badminton', 'marathon', 'gymkhana', 'other'],
            required: true,
        },
        organizer: { type: String, trim: true },
        venue: { type: String, trim: true },
        city: { type: String, trim: true },
        eventDate: { type: Date },
        reportingTime: { type: String, trim: true },
        registrationFee: { type: Number, default: 0 },
        dressCode: { type: String, trim: true },
        participationType: {
            type: String,
            enum: ['individual', 'team', 'both'],
            default: 'individual',
        },
        maxParticipants: { type: Number, default: 0 },
        skillLevel: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced', 'all'],
            default: 'all',
        },
        prizes: { type: String, trim: true },
        routeMap: { type: String, trim: true },
        images: { type: [String], default: [] },
        sponsors: { type: [String], default: [] },
        registrationLink: { type: String, trim: true },
        description: { type: String },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

sportsEventSchema.index({ sportType: 1 });
sportsEventSchema.index({ status: 1 });
sportsEventSchema.index({ eventDate: 1 });
sportsEventSchema.index({ city: 1 });

module.exports = mongoose.model('SportsEvent', sportsEventSchema);
