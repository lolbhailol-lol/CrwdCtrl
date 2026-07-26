import mongoose from 'mongoose'

const checkInSchema = new mongoose.Schema(
  {
    trekSlug: { type: String, required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD IST
    groupSize: { type: Number, required: true, min: 1, max: 50 },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    source: {
      type: String,
      enum: ['solo', 'friend', 'community'],
      required: true,
    },
    communityName: { type: String, trim: true, maxlength: 80, default: '' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  {
    collection: 'check_ins',
    timestamps: { createdAt: true, updatedAt: false },
  },
)

checkInSchema.index({ trekSlug: 1, date: 1 })

export default mongoose.model('CheckIn', checkInSchema)
