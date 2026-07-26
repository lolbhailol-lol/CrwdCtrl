import mongoose from 'mongoose'

const CROWD_LEVELS = ['Low', 'Moderate', 'High', 'Very High']

const trekStatusSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    crowdLevel: { type: String, enum: CROWD_LEVELS },
    weather: String,
    trailCondition: String,
    parkingStatus: String,
    forestAdvisory: String,
    entryStatus: String,
    alert: String,
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, enum: ['scout', 'system'], default: 'scout' },
  },
  { collection: 'trek_status' },
)

export const CROWD_LEVEL_VALUES = CROWD_LEVELS
export default mongoose.model('TrekStatus', trekStatusSchema)
