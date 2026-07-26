import mongoose from 'mongoose'
import { env } from './env.js'

let connected = false

export function isDbReady() {
  return connected && mongoose.connection.readyState === 1
}

export async function connectDb() {
  if (!env.mongoUri) {
    console.warn('[treks-api] TREKS_MONGODB_URI not set — catalog only; writes return 503')
    return false
  }

  if (connected) return true

  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
    })
    connected = true
    console.log(`[treks-api] MongoDB connected → ${env.mongoDbName}`)
    return true
  } catch (err) {
    connected = false
    console.error('[treks-api] MongoDB connection failed:', err.message)
    return false
  }
}

export function requireDb(req, res, next) {
  if (!isDbReady()) {
    return res.status(503).json({
      success: false,
      message:
        'Live writes need MongoDB. Set TREKS_MONGODB_URI in treks/backend/.env and restart the API.',
    })
  }
  return next()
}
