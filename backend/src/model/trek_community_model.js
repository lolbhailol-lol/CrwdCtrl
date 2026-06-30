const mongoose = require('mongoose');
const coverImagesSchema = require('./coverImagesSchema');

const communityContactSchema = new mongoose.Schema(
    {
        name:  { type: String, trim: true, default: '' },
        role:  { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
    },
    { _id: false },
);

const trekCommunitySchema = new mongoose.Schema(
    {
        name:              { type: String, required: true, trim: true },
        basedIn:           { type: String, trim: true, default: '' },
        aboutUs:           { type: String, trim: true, default: '' },
        trekCategories:    { type: [String], default: [] },
        coverImage:        { type: String, trim: true, default: '' },
        coverImages:       { type: coverImagesSchema, default: () => ({}) },
        galleryImages:     { type: [String], default: [] },
        contactPhone:      { type: String, trim: true, default: '' },
        contactInstagram:  { type: String, trim: true, default: '' },
        /** Repeatable point-of-contact list (name + role + phone) */
        contacts:          { type: [communityContactSchema], default: [] },
        status:            { type: String, enum: ['published', 'draft'], default: 'published' },
        homeSection:       { type: String, default: null },
        customPageSections: [{
            page: { type: String, required: true },
            sectionSlug: { type: String, required: true },
            priority: { type: Number, default: 999, min: 1, max: 999 },
        }],
        priority:          { type: Number, default: 999, min: 1, max: 999 },
        showOnTreks:       { type: Boolean, default: true },
        trekPageSection:   { type: String, enum: ['communities', 'comingSoon', 'both'], default: 'communities' },
        trekPagePriority:  { type: Number, default: 999, min: 1, max: 999 },
    },
    { timestamps: true }
);

module.exports = mongoose.models.TrekCommunity
    || mongoose.model('TrekCommunity', trekCommunitySchema);
