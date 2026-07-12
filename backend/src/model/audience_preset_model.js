const mongoose = require('mongoose');

const audiencePresetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 400 },
    audience: {
      type: { type: String, required: true },
      filters: { type: mongoose.Schema.Types.Mixed, default: {} },
      label: { type: String, default: '' },
    },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true },
);

audiencePresetSchema.index({ name: 1 });

module.exports = mongoose.model('AudiencePreset', audiencePresetSchema);
