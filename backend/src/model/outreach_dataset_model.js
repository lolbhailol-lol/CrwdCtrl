const mongoose = require('mongoose');

const outreachContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, required: true, index: true },
    phone: { type: String, trim: true, default: '' },
    instagramId: { type: String, trim: true, default: '' },
    competition: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    college: { type: String, trim: true, default: '' },
    dateOfBirth: { type: String, trim: true, default: '' },
    paymentMode: { type: String, trim: true, default: '' },
    transactionId: { type: String, trim: true, default: '' },
    paymentScreenshot: { type: String, trim: true, default: '' },
    participantsCount: { type: String, trim: true, default: '' },
    submittedAt: { type: String, trim: true, default: '' },
    sourceRow: { type: Number, default: null },
  },
  { _id: true }
);

const outreachDatasetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    contacts: { type: [outreachContactSchema], default: [] },
    contactCount: { type: Number, default: 0 },
    uniqueEmailCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

outreachDatasetSchema.index({ name: 1 });

module.exports = mongoose.model('OutreachDataset', outreachDatasetSchema);
