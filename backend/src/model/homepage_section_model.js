const mongoose = require('mongoose');

const CARD_SIZES = ['trending', 'hero', 'wide', 'explore', 'runclub', 'mini', 'default'];
const TARGET_PAGES = ['home', 'fests', 'cultural-fest', 'tech-fest', 'sports-fest', 'treks', 'sports', 'events'];

const customPageSectionAssignmentSchema = new mongoose.Schema(
    {
        page: { type: String, required: true },
        sectionSlug: { type: String, required: true },
        priority: { type: Number, default: 999, min: 1, max: 999 },
    },
    { _id: false },
);

const featuredItemSchema = new mongoose.Schema(
    {
        entityType: {
            type: String,
            enum: ['fest', 'trek', 'community', 'sport', 'runclub', 'events'],
        },
        entityId: { type: String, trim: true },
    },
    { _id: false },
);

const homepageSectionSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        targetPage: {
            type: String,
            enum: TARGET_PAGES,
            default: 'home',
            required: true,
        },
        cardSize: {
            type: String,
            enum: CARD_SIZES,
            default: 'wide',
        },
        displayOrder: {
            type: Number,
            default: 999,
            min: 1,
            max: 999,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        /** Optional single featured card for this section (hero / featured carousels). */
        featuredItem: {
            type: featuredItemSchema,
            default: null,
        },
    },
    { timestamps: true },
);

homepageSectionSchema.index({ targetPage: 1, slug: 1 }, { unique: true });
homepageSectionSchema.index({ enabled: 1, targetPage: 1, displayOrder: 1 });

module.exports = mongoose.model('HomepageSection', homepageSectionSchema);
module.exports.CARD_SIZES = CARD_SIZES;
module.exports.TARGET_PAGES = TARGET_PAGES;
module.exports.customPageSectionAssignmentSchema = customPageSectionAssignmentSchema;
