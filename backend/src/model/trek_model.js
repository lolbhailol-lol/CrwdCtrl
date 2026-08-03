const mongoose = require('mongoose');
const coverImagesSchema = require('./coverImagesSchema');
const { sanitizeTrekFilters } = require('../constants/trekFilterOptions');
const { normalizeAvailableDates, parseTrekDateForIndex } = require('../utils/trekDateNormalize');
const { sanitizeTrekBatches } = require('../utils/sanitizeTrekBatches');
const { ensureUniqueSlug, toSlug, mergePreviousSlugs } = require('../utils/slug');

const trekContactSchema = new mongoose.Schema(
    {
        name:  { type: String, trim: true, default: '' },
        role:  { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
    },
    { _id: false },
);

const trekSchema = new mongoose.Schema(
    {
        communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrekCommunity', default: null },
        trekName: { type: String, required: true, trim: true },
        /**
         * Stable URL slug for /trek/:slug deep links.
         * Set once on create — never rewritten on title rename (shared links stay valid).
         */
        slug: { type: String, trim: true, lowercase: true },
        /** Former primary slugs after any intentional slug change — kept for shared-link resolution */
        previousSlugs: { type: [{ type: String, trim: true, lowercase: true }], default: [] },
        description: { type: String },
        difficultyLevel: {
            type: String,
            enum: ['easy', 'moderate', 'difficult', 'extreme'],
            required: true,
        },
        trekDuration: { type: String, trim: true },
        startingPoint: { type: String, trim: true },
        destination: { type: String, trim: true },
        meetingLocation: { type: String, trim: true },
        departureTime: { type: String, trim: true },
        returnTime: { type: String, trim: true },
        inclusions: { type: [String], default: [] },
        exclusions: { type: [String], default: [] },
        fitnessRequirements: { type: String, trim: true },
        ageRestrictions: { type: String, trim: true },
        trekLeader: { type: String, trim: true },
        emergencyContact: { type: String, trim: true },
        contactInstagram: { type: String, trim: true },
        /** WhatsApp / Telegram group for this trek — overrides community groupLink in emails & booking UI */
        groupLink: { type: String, trim: true, default: '' },
        /** Repeatable point-of-contact list (name + role + phone) */
        contacts: { type: [trekContactSchema], default: [] },
        termsAndConditions: { type: [String], default: [] },
        thingsToCarry: { type: [String], default: [] },
        itinerary: [
            {
                day: { type: Number },
                title: { type: String },
                description: { type: String },
                points: [{
                    text: { type: String, trim: true, default: '' },
                    level: { type: String, enum: ['main', 'sub'], default: 'main' },
                    showDot: { type: Boolean, default: true },
                }],
            },
        ],
        coverImage: { type: String, default: null },
        coverImages: { type: coverImagesSchema, default: () => ({}) },
        /** Detail page top slider (4–5 cropped hero slides) — separate from listing covers & gallery */
        heroImages: { type: [String], default: [] },
        /** Gallery section on trek detail — not mixed into the hero slider when heroImages is set */
        images: { type: [String], default: [] },
        registrationFee: { type: Number, default: 0, min: 0 },
        /** Platform fee % added at checkout on top of registration fee (e.g. 3 = 3%) */
        platformFeePercent: { type: Number, default: 3 },
        /** External registration link (WhatsApp / website / form) used when registration.mode === 'external_link' */
        registrationLink: { type: String, trim: true },
        /** 0 = no trek-level cap (use trekBatches batchSize totals, or treat as unlimited) */
        maxParticipants: { type: Number, default: 0, min: 0 },
        /** Primary sortable date — synced from first trekBatches[].date when parseable */
        trekDate: { type: Date },
        /** Card subtitle only — e.g. "Weekend", "Weekday" (not shown in Details tab) */
        dateLabel: { type: String, trim: true, default: '' },
        /** Departure batches — date is ISO YYYY-MM-DD for single dates, or free-text for ranges */
        trekBatches: [{
            date:      { type: String, trim: true, default: '' },
            batchSize: { type: Number, default: 0 },
            timing:    { type: String, trim: true, default: '' },
            note:      { type: String, trim: true, default: '' },
        }],
        /** Custom white detail cards on trek Details tab (label + value + icon) */
        detailBoxes: [{
            id:    { type: String, trim: true, default: '' },
            label: { type: String, trim: true, default: '' },
            value: { type: String, trim: true, default: '' },
            icon:  { type: String, trim: true, default: 'default' },
            order: { type: Number, default: 0 },
        }],
        city: { type: String, trim: true },
        trekCategory: {
            type: String,
            enum: ['hiking', 'trail', 'backpacking', 'camping', 'adventure', 'nature'],
            default: null,
        },
        trekFilters: {
            duration: { type: [String], default: [] },
            difficulty: { type: [String], default: [] },
            budget: { type: [String], default: [] },
            experience: { type: [String], default: [] },
            timing: { type: [String], default: [] },
            terrain: { type: [String], default: [] },
            style: { type: [String], default: [] },
        },
        featuredSection: {
            type: String,
            enum: ['hero', 'weekend', 'both', 'beginner'],
            default: null,
        },
        homeSection:      { type: String, default: null },
        /** Home page hero / moving banner */
        showOnHomeSlide:  { type: Boolean, default: false },
        customPageSections: [{
            page: { type: String, required: true },
            sectionSlug: { type: String, required: true },
            priority: { type: Number, default: 999, min: 1, max: 999 },
        }],

        registration: {
            /** Whether registration is currently accepting bookings */
            status:            { type: String, enum: ['open', 'closed', 'not_open_yet'], default: 'open' },
            /**
             * How users register:
             * - internal_form: in-app form + Cashfree
             * - external_link: Book Now opens registrationLink
             * - organizer_qr: in-app form + organizer UPI QR + screenshot (organizer approves)
             */
            mode:              { type: String, enum: ['internal_form', 'external_link', 'organizer_qr'], default: 'internal_form' },
            googleSheetsUrl:   { type: String, default: '' },
            organizerEmail:    { type: String, default: '' },
            formInstructions:  { type: String, default: '' },
            availableDates:    { type: [String], default: [] },   // ISO YYYY-MM-DD or display strings
            timeSlots:         { type: [String], default: [] },   // ["6:00 AM", "8:30 AM", …]
            locationOptions:   { type: [String], default: [] },   // Meeting points shown on booking step 1
            maxPeoplePerBooking: { type: Number, default: 0 },
            /** Organizer UPI / payment QR image URL (organizer_qr mode) */
            paymentQR: { type: String, default: '' },
            paymentQRMessage: { type: String, default: '' },
            paymentUpiId: { type: String, default: '' },
            /**
             * organizer_qr + paid only: when true, screenshot submit auto-confirms.
             * When false (default), stays pending until organizer approves.
             */
            qrAutoConfirm: { type: Boolean, default: false },
            /**
             * When true (default), booking requires a logged-in account.
             * When false, guests can book with name/email/phone (no account).
             */
            requireLogin: { type: Boolean, default: true },
            /** Gender-based seat caps + phased registration (women first, etc.) */
            genderQuotas: {
                enabled: { type: Boolean, default: false },
                femaleSeats: { type: Number, default: 0, min: 0 },
                maleSeats: { type: Number, default: 0, min: 0 },
                othersSeats: { type: Number, default: 0, min: 0 },
            },
            /** closed | women_only | men_only | all — used when genderQuotas.enabled */
            genderPhase: {
                type: String,
                enum: ['closed', 'women_only', 'men_only', 'all'],
                default: 'all',
            },
            formSchema: [{
                id:          String,
                label:       String,
                fieldName:   String,
                type:        { type: String, enum: ['text','email','tel','number','textarea','select','radio','checkbox','agree','file','image','date','time','url'], default: 'text' },
                required:    { type: Boolean, default: false },
                options:     [String],
                placeholder: String,
            }],
        },
        priority:         { type: Number, default: 999, min: 1, max: 999 },
        trekPagePriority: { type: Number, default: 999, min: 1, max: 999 },
        /** Order on community detail page (1 = first). Independent of home /treks carousels. */
        communityPriority: { type: Number, default: 999, min: 1, max: 999 },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },

        /** Volunteer trek leader scanner login — trek code + password → scan-only access */
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

trekSchema.index({ 'scannerAccess.code': 1 }, { unique: true, sparse: true });
trekSchema.index({ slug: 1 }, { unique: true, sparse: true });
trekSchema.index({ previousSlugs: 1 });
trekSchema.index({ difficultyLevel: 1 });
trekSchema.index({ status: 1 });
trekSchema.index({ trekDate: 1 });
trekSchema.index({ city: 1 });

trekSchema.pre('save', async function normalizeTrekDocument() {
    if (this.trekBatches?.length) {
        this.trekBatches = sanitizeTrekBatches(this.trekBatches);
        const firstDated = this.trekBatches.find((b) => b.date);
        if (firstDated?.date) {
            const parsed = parseTrekDateForIndex(firstDated.date);
            if (parsed) this.trekDate = parsed;
        }
    }

    if (this.registration?.availableDates?.length) {
        this.registration.availableDates = normalizeAvailableDates(this.registration.availableDates);
    }

    if (this.trekFilters) {
        this.trekFilters = sanitizeTrekFilters(this.trekFilters);
    }

    // Strip legacy plaintext passwords from older documents
    if (this.scannerAccess?.password) {
        this.scannerAccess.password = undefined;
        this.markModified('scannerAccess');
        this.$unset('scannerAccess.password');
    }

    // Immutable once set — title renames must not break shared /trek/:slug links
    if (!this.slug) {
        const titleSlug = toSlug(this.trekName);
        const nextSlug = await ensureUniqueSlug(this.constructor, this.trekName, {
            excludeId: this._id,
        });
        if (nextSlug) {
            this.slug = nextSlug;
            if (titleSlug && titleSlug !== nextSlug) {
                this.previousSlugs = mergePreviousSlugs(this.previousSlugs, titleSlug);
                this.markModified('previousSlugs');
            }
        }
    }
});

module.exports = mongoose.models.Trek || mongoose.model('Trek', trekSchema);
