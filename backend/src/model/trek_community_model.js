const mongoose = require('mongoose');

const trekCommunitySchema = new mongoose.Schema(
    {
        name:              { type: String, required: true, trim: true },
        basedIn:           { type: String, trim: true, default: '' },
        aboutUs:           { type: String, trim: true, default: '' },
        trekCategories:    { type: [String], default: [] },
        coverImage:        { type: String, trim: true, default: '' },
        galleryImages:     { type: [String], default: [] },
        contactPhone:      { type: String, trim: true, default: '' },
        contactInstagram:  { type: String, trim: true, default: '' },
        status:            { type: String, enum: ['published', 'draft'], default: 'published' },
        homeSection:       { type: String, enum: ['trending', 'happening', 'slide'], default: null },
        priority:          { type: Number, default: 999, min: 1, max: 999 },
        showOnTreks:       { type: Boolean, default: true },
        trekPageSection:   { type: String, enum: ['communities', 'comingSoon', 'both'], default: 'communities' },
        trekPagePriority:  { type: Number, default: 999, min: 1, max: 999 },
    },
    { timestamps: true }
);

module.exports = mongoose.models.TrekCommunity
    || mongoose.model('TrekCommunity', trekCommunitySchema);
