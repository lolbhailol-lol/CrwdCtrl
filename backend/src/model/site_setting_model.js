const mongoose = require('mongoose');

/**
 * Generic key/value store for small pieces of editable site configuration
 * (e.g. customisable home section headings). One document per `key`.
 */
const siteSettingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

module.exports = mongoose.models.SiteSetting
    || mongoose.model('SiteSetting', siteSettingSchema);
