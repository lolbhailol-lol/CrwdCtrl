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
        /** Run distance label shown on detail page, e.g. "3k-5k Runs" */
        distance: { type: String, trim: true, default: '' },
        coverImage: { type: String, trim: true, default: '' },
        inclusions: { type: [String], default: [] },
        termsAndConditions: { type: [String], default: [] },
        contactPhone: { type: String, trim: true, default: '' },
        contactInstagram: { type: String, trim: true, default: '' },
        images: { type: [String], default: [] },
        sponsors: { type: [String], default: [] },
        registrationLink: { type: String, trim: true },
        description: { type: String },
        displayType: { type: String, trim: true },
        featuredSection: {
            type: String,
            enum: ['upcoming', 'run_clubs', 'both', null],
            default: null,
        },
        showInUpcoming: { type: Boolean, default: true },
        showInRunClubs: { type: Boolean, default: false },
        upcomingPriority: { type: Number, default: 999, min: 1, max: 999 },
        runClubPriority: { type: Number, default: 999, min: 1, max: 999 },
        priority: { type: Number, default: 999, min: 1, max: 999 },
        showOnSportsPage: { type: Boolean, default: true },
        homeSection: { type: String, enum: ['trending', 'happening', 'slide'], default: null },
        homePriority: { type: Number, default: 999, min: 1, max: 999 },
        runClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'RunClub', default: null },
        /** Matches a label from the parent RunClub.runCategories */
        runCategory: { type: String, trim: true, default: '' },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },

        registration: {
            googleSheetsUrl: { type: String, default: '' },
        },

        /** Volunteer scanner login — event code + password → scan-only access (run clubs & sports events) */
        scannerAccess: {
            enabled: { type: Boolean, default: false },
            code: { type: String, trim: true, uppercase: true },
            passwordHash: { type: String, default: '' },
            // Admin-retrievable copy so the credential can be re-shared with volunteers
            password: { type: String, default: '' },
            label: { type: String, default: '', trim: true },
        },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

sportsEventSchema.index({ 'scannerAccess.code': 1 }, { unique: true, sparse: true });

sportsEventSchema.index({ sportType: 1 });
sportsEventSchema.index({ status: 1 });
sportsEventSchema.index({ eventDate: 1 });
sportsEventSchema.index({ city: 1 });
sportsEventSchema.index({ priority: 1 });
sportsEventSchema.index({ upcomingPriority: 1 });
sportsEventSchema.index({ runClubPriority: 1 });
sportsEventSchema.index({ showOnSportsPage: 1 });
sportsEventSchema.index({ homeSection: 1 });
sportsEventSchema.index({ homePriority: 1 });
sportsEventSchema.index({ runClubId: 1 });

module.exports = mongoose.model('SportsEvent', sportsEventSchema);
