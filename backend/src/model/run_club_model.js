const mongoose = require('mongoose');

const runClubSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        basedIn: { type: String, trim: true, default: '' },
        organizer: { type: String, trim: true, default: '' },
        aboutUs: { type: String, trim: true, default: '' },
        coverImage: { type: String, trim: true, default: '' },
        galleryImages: { type: [String], default: [] },
        registrationLink: { type: String, trim: true, default: '' },
        contactPhone: { type: String, trim: true, default: '' },
        contactInstagram: { type: String, trim: true, default: '' },
        showOnSportsPage: { type: Boolean, default: true },
        showInRunClubs: { type: Boolean, default: true },
        runClubPriority: { type: Number, default: 999, min: 1, max: 999 },
        status: { type: String, enum: ['published', 'draft'], default: 'published' },
    },
    { timestamps: true }
);

runClubSchema.index({ status: 1 });
runClubSchema.index({ runClubPriority: 1 });
runClubSchema.index({ showOnSportsPage: 1 });

module.exports = mongoose.models.RunClub || mongoose.model('RunClub', runClubSchema);
