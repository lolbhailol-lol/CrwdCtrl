const mongoose = require('mongoose');
const coverImagesSchema = require('./coverImagesSchema');

const customPageSectionAssignmentSchema = new mongoose.Schema(
    {
        page: { type: String, required: true },
        sectionSlug: { type: String, required: true },
        priority: { type: Number, default: 999, min: 1, max: 999 },
    },
    { _id: false },
);

const eventRoundSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true },
        content: { type: String, trim: true },
    },
    { _id: false },
);

const eventContactSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        role: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true },
        instagramId: { type: String, trim: true },
    },
    { _id: false },
);

const eventFormFieldSchema = new mongoose.Schema(
    {
        id: { type: String },
        label: { type: String, trim: true },
        fieldName: { type: String, trim: true },
        type: { type: String, default: 'text' },
        required: { type: Boolean, default: false },
        placeholder: { type: String, trim: true },
        options: { type: [String], default: [] },
    },
    { _id: false },
);

const eventFormStepSchema = new mongoose.Schema(
    {
        stepNumber: { type: Number },
        stepTitle: { type: String, trim: true },
        stepDescription: { type: String, trim: true },
        fields: { type: [eventFormFieldSchema], default: [] },
    },
    { _id: false },
);

const eventRegistrationSchema = new mongoose.Schema(
    {
        /** Whether registrations are currently being accepted */
        status: { type: String, enum: ['open', 'closed'], default: 'closed' },
        /** internal_form = built-in multi-step form + payment; external_link = redirect to a URL */
        mode: { type: String, enum: ['internal_form', 'external_link'], default: 'external_link' },
        formType: { type: String, enum: ['SINGLE_STEP', 'MULTI_STEP'], default: 'SINGLE_STEP' },
        formSchema: { type: [eventFormFieldSchema], default: [] },
        steps: { type: [eventFormStepSchema], default: [] },
        /** Organiser's Google Sheet — registrations auto-append here after payment */
        googleSheetsUrl: { type: String, trim: true, default: '' },
    },
    { _id: false },
);

const eventShowSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        /** Short display name shown on the detail page (e.g. "MAGNIFICENT MAHARASHTRA 2026") */
        displayName: { type: String, trim: true },
        description: { type: String },
        eventType: {
            type: String,
            enum: ['play', 'musical', 'standup', 'improv', 'dance_drama', 'fashion', 'other'],
            required: true,
        },
        /** Free-text type/heading shown on the detail page (e.g. "Beauty Pageant / Fashion") */
        eventHeading: { type: String, trim: true },
        organizer: { type: String, trim: true },
        cast: { type: [String], default: [] },
        venue: { type: String, trim: true },
        /** Google Maps pin / share link for venue directions */
        mapUrl: { type: String, trim: true },
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
        /**
         * Pricing style:
         * - single: use ticketPrice only
         * - tiers: custom tiers[] each with its own fee (e.g. Trackday lap packages)
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
        /** Platform fee % added on top of ticket price at checkout (e.g. 2.5 = ₹25 on ₹1000). */
        platformFeePercent: { type: Number, default: 2.5 },
        seatingCapacity: { type: Number, default: 0 },
        performerDetails: { type: String, trim: true },
        sponsors: { type: [String], default: [] },
        poster: { type: String, trim: true },
        /** Per-layout cover URLs — portrait, wide, hero, etc. */
        coverImages: { type: coverImagesSchema, default: () => ({}) },
        banner: { type: String, trim: true },
        trailerLink: { type: String, trim: true },
        bookingLink: { type: String, trim: true },
        /** Rich detail-page content (event details view) */
        priceLabel: { type: String, trim: true },
        generalRules: { type: String, trim: true },
        process: { type: String, trim: true },
        prizePool: { type: String, trim: true },
        whatsIncluded: { type: String, trim: true },
        benefits: { type: String, trim: true },
        eligibility: { type: String, trim: true },
        slots: { type: String, trim: true },
        registrationProcess: { type: String, trim: true },
        registrationLink: { type: String, trim: true },
        rounds: { type: [eventRoundSchema], default: [] },
        contacts: { type: [eventContactSchema], default: [] },
        galleryImages: { type: [String], default: [] },
        /** Internal/external registration configuration */
        registration: { type: eventRegistrationSchema, default: () => ({}) },
        /** Which fixed block on /events this show appears in */
        pageSection: {
            type: String,
            enum: ['hero', 'spotlight', 'upcoming', 'community'],
            default: null,
        },
        pagePriority: { type: Number, default: 999, min: 1, max: 999 },
        /** Home page moving hero banner (same slot as fest showOnHomeSlide) */
        showOnHomeSlide: { type: Boolean, default: false },
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
