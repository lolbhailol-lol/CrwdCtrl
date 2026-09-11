const mongoose = require('mongoose');

/** Per-layout cover URLs — keys match frontend COVER_IMAGE_SLOTS */
const coverImagesSchema = new mongoose.Schema(
    {
        page:       { type: String, trim: true, default: '' },
        portrait:   { type: String, trim: true, default: '' },
        wide:       { type: String, trim: true, default: '' },
        hero:       { type: String, trim: true, default: '' },
        square:     { type: String, trim: true, default: '' },
        landscape:  { type: String, trim: true, default: '' },
        video:      { type: String, trim: true, default: '' },
    },
    { _id: false },
);

module.exports = coverImagesSchema;
