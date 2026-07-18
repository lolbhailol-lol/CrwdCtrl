const mongoose = require('mongoose');
const coverImagesSchema = require('./coverImagesSchema');
const { toSlug } = require('../utils/slug');

const sportsEventSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        /** Stable URL slug derived from title — used by /sports/run/:slug deep links */
        slug: { type: String, trim: true, lowercase: true, index: true },
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
        /**
         * Pricing style:
         * - single: use registrationFee only
         * - tiers: custom tiers[] each with its own fee + inclusions
         */
        pricingMode: {
            type: String,
            enum: ['single', 'tiers'],
            default: 'single',
        },
        tiers: [{
            id: { type: String, trim: true, default: '' },
            name: { type: String, trim: true, default: '' },
            description: { type: String, trim: true, default: '' },
            fee: { type: Number, default: 0 },
            inclusions: { type: [String], default: [] },
            order: { type: Number, default: 0 },
        }],
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
        coverImages: { type: coverImagesSchema, default: () => ({}) },
        inclusions: { type: [String], default: [] },
        /** Event-detail cards shown in the "Details" tab of the Run Info widget */
        returnTime: { type: String, trim: true, default: '' },
        fitnessLevel: { type: String, trim: true, default: '' },
        meetingPoint: { type: String, trim: true, default: '' },
        ageLimit: { type: String, trim: true, default: '' },
        /** Custom white detail cards on run Details tab (label + value + icon) — trek-style */
        detailBoxes: [{
            id:    { type: String, trim: true, default: '' },
            label: { type: String, trim: true, default: '' },
            value: { type: String, trim: true, default: '' },
            icon:  { type: String, trim: true, default: 'default' },
            order: { type: Number, default: 0 },
        }],
        /** Repeatable info cards (title + details) shown in the Run Info widget */
        infoSections: {
            type: [{
                title:   { type: String, trim: true, default: '' },
                details: { type: String, trim: true, default: '' },
            }],
            default: [],
        },
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
        homeSection: { type: String, default: null },
        homePriority: { type: Number, default: 999, min: 1, max: 999 },
        /** Home page hero / moving banner */
        showOnHomeSlide: { type: Boolean, default: false },
        customPageSections: [{
            page: { type: String, required: true },
            sectionSlug: { type: String, required: true },
            priority: { type: Number, default: 999, min: 1, max: 999 },
        }],
        runClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'RunClub', default: null },
        /** Matches a label from the parent RunClub.runCategories */
        runCategory: { type: String, trim: true, default: '' },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },

        registration: {
            /** Whether registration is currently accepting bookings */
            status: { type: String, enum: ['open', 'closed'], default: 'open' },
            /**
             * How users register:
             * - internal_form: in-app form + Cashfree when fee > 0
             * - external_link: open registrationLink
             * - organizer_qr: in-app form + organizer UPI QR + screenshot upload
             */
            mode: {
                type: String,
                enum: ['internal_form', 'external_link', 'organizer_qr'],
                default: 'internal_form',
            },
            googleSheetsUrl: { type: String, default: '' },
            organizerEmail: { type: String, default: '' },
            formInstructions: { type: String, default: '' },
            availableDates: { type: [String], default: [] },
            timeSlots: { type: [String], default: [] },
            locationOptions: { type: [String], default: [] },
            maxPeoplePerBooking: { type: Number, default: 10 },
            /** Organizer UPI / payment QR image URL (organizer_qr mode) */
            paymentQR: { type: String, default: '' },
            paymentQRMessage: { type: String, default: '' },
            /** Structured UPI ID for copy-to-clipboard on booking */
            paymentUpiId: { type: String, default: '' },
            formSchema: [{
                id:          String,
                label:       String,
                fieldName:   String,
                type:        { type: String, enum: ['text','email','tel','number','textarea','select','file','date'], default: 'text' },
                required:    { type: Boolean, default: false },
                options:     [String],
                placeholder: String,
            }],
        },

        /** Volunteer scanner login — event code + password → scan-only access (run clubs & sports events) */
        scannerAccess: {
            enabled: { type: Boolean, default: false },
            code: { type: String, trim: true, uppercase: true },
            passwordHash: { type: String, default: '' },
            label: { type: String, default: '', trim: true },
        },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

sportsEventSchema.index({ 'scannerAccess.code': 1 }, { unique: true, sparse: true });

sportsEventSchema.pre('save', function stripLegacyScannerPassword(next) {
    if (this.scannerAccess?.password) {
        this.scannerAccess.password = undefined;
        this.markModified('scannerAccess');
        this.$unset('scannerAccess.password');
    }
    if (this.isModified('title') || !this.slug) {
        const nextSlug = toSlug(this.title);
        if (nextSlug) this.slug = nextSlug;
    }
    next();
});

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
