import mongoose from 'mongoose'

const CROWD_LEVELS = ['Low', 'Moderate', 'High', 'Very High']
const TRAIL_CONDITIONS = ['Open', 'Caution', 'Slippery', 'Closed']
const ENTRY_STATUSES = ['Open', 'Restricted', 'Closed']

const trekStatusSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    crowdLevel: { type: String, enum: CROWD_LEVELS },
    weather: { type: String, maxlength: 160 },
    trailCondition: { type: String, enum: TRAIL_CONDITIONS },
    parkingStatus: { type: String, maxlength: 160 },
    forestAdvisory: { type: String, maxlength: 240 },
    entryStatus: { type: String, enum: ENTRY_STATUSES },
    alert: { type: String, maxlength: 240 },
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, enum: ['scout', 'system'], default: 'scout' },
  },
  { collection: 'trek_status' },
)

export const CROWD_LEVEL_VALUES = CROWD_LEVELS
export const TRAIL_CONDITION_VALUES = TRAIL_CONDITIONS
export const ENTRY_STATUS_VALUES = ENTRY_STATUSES
export default mongoose.model('TrekStatus', trekStatusSchema)
