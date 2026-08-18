const mongoose = require('mongoose');
const coverImagesSchema = require('./coverImagesSchema');
const { toSlug } = require('../utils/slug');

const runClubSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, lowercase: true, index: true },
        basedIn: { type: String, trim: true, default: '' },
        /** Short line under the name, e.g. Sports & Social Community */
        tagline: { type: String, trim: true, default: '' },
        organizer: { type: String, trim: true, default: '' },
        aboutUs: { type: String, trim: true, default: '' },
        /** Filter chips on run club detail page — runs use matching runCategory */
        runCategories: { type: [String], default: [] },
        coverImage: { type: String, trim: true, default: '' },
        coverImages: { type: coverImagesSchema, default: () => ({}) },
        galleryImages: { type: [String], default: [] },
        registrationLink: { type: String, trim: true, default: '' },
        registration: {
            /** Whether registration is currently accepting members */
            status: { type: String, enum: ['open', 'closed'], default: 'open' },
            /** How users join: in-app form (browse runs), or an external link */
            mode: { type: String, enum: ['internal_form', 'external_link'], default: 'internal_form' },
        },
        contactPhone: { type: String, trim: true, default: '' },
        contactInstagram: { type: String, trim: true, default: '' },
        /** WhatsApp / community invite — sent after payment approval */
        groupLink: { type: String, trim: true, default: '' },
        showOnSportsPage: { type: Boolean, default: true },
        showInRunClubs: { type: Boolean, default: true },
        /**
         * sports = Explore Run Clubs on /sports
         * events = community on /events (not a run club)
         */
        listingHub: { type: String, enum: ['sports', 'events'], default: 'sports', index: true },
        /** Events-page Community Events carousel (event-hub clubs only). Missing = shown. */
        showOnEventsPage: { type: Boolean, default: true },
        runClubPriority: { type: Number, default: 999, min: 1, max: 999 },
        homeSection: { type: String, default: null },
        /** Home page hero / moving banner (preferred over legacy homeSection:'slide') */
        showOnHomeSlide: { type: Boolean, default: false },
        customPageSections: [{
            page: { type: String, required: true },
            sectionSlug: { type: String, required: true },
            priority: { type: Number, default: 999, min: 1, max: 999 },
        }],
        priority: { type: Number, default: 999, min: 1, max: 999 },
        status: { type: String, enum: ['published', 'draft'], default: 'published' },
    },
    { timestamps: true }
);

runClubSchema.pre('save', function ensureSlug(next) {
    if (this.isModified('name') || !this.slug) {
        const nextSlug = toSlug(this.name);
        if (nextSlug) this.slug = nextSlug;
    }
    next();
});

runClubSchema.index({ status: 1 });
runClubSchema.index({ runClubPriority: 1 });
runClubSchema.index({ showOnSportsPage: 1 });

module.exports = mongoose.models.RunClub || mongoose.model('RunClub', runClubSchema);
