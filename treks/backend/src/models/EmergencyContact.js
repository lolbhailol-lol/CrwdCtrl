import mongoose from 'mongoose'

/**
 * Help numbers trekkers add for a trail — forest offices, guides, local jeeps.
 * Unverified by design, so the UI says so and the index below stops the same
 * number being listed twice on one trail.
 */
const emergencyContactSchema = new mongoose.Schema(
  {
    trekSlug: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    addedBy: { type: String, trim: true, maxlength: 60, default: '' },
    deviceHash: { type: String, default: '' },
  },
  {
    collection: 'emergency_contacts',
    timestamps: { createdAt: true, updatedAt: false },
  },
)

emergencyContactSchema.index({ trekSlug: 1, createdAt: 1 })
emergencyContactSchema.index({ trekSlug: 1, phone: 1 }, { unique: true })

export default mongoose.model('EmergencyContact', emergencyContactSchema)
