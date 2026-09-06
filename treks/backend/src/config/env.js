import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')
const localEnv = path.resolve(backendRoot, '.env')
const crwdctrlBackendEnv = path.resolve(backendRoot, '../../backend/.env')

/** Read only selected keys from outer CrwdCtrl backend/.env — never load the whole file. */
function readSelectedOuterKeys(filePath, keys) {
  const picked = {}
  if (!fs.existsSync(filePath)) return picked

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!keys.includes(key)) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    picked[key] = value
  }
  return picked
}

// Local Treks env only (PORT, CORS, optional local overrides)
dotenv.config({ path: localEnv })

// ONLY OpenRouter keys from outer CrwdCtrl — for AI bot later
const OUTER_AI_KEYS = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL']
const outerAi = readSelectedOuterKeys(crwdctrlBackendEnv, OUTER_AI_KEYS)

// Local treks/.env can still override OpenRouter if set explicitly
export const env = {
  port: Number(process.env.PORT) || 5055,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin:
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://localhost:5174,http://localhost:5175',

  mongoUri: (process.env.TREKS_MONGODB_URI || '').trim(),
  mongoDbName: (process.env.TREKS_MONGODB_DB || 'crwdctrl_treks').trim(),
  scoutToken: (process.env.SCOUT_TOKEN || '').trim(),
  /** Salt for hashing anonymous device ids — set in prod so hashes are not portable */
  deviceSalt: (process.env.DEVICE_HASH_SALT || 'treks-device-dedupe').trim(),

  openRouterApiKey: process.env.OPENROUTER_API_KEY || outerAi.OPENROUTER_API_KEY || '',
  openRouterModel:
    process.env.OPENROUTER_MODEL || outerAi.OPENROUTER_MODEL || 'openrouter/auto',

  envFiles: {
    local: localEnv,
    crwdctrlBackend: crwdctrlBackendEnv,
  },
}

export function logEnvStatus() {
  const has = (v) => Boolean(v && String(v).trim())
  console.log('[treks-api] env:')
  console.log(`  local:  ${localEnv}`)
  console.log(`  outer:  ${crwdctrlBackendEnv} (OpenRouter only)`)
  console.log(`  TREKS_MONGODB_URI  ${has(env.mongoUri) ? '✓' : '✗'}`)
  console.log(`  SCOUT_TOKEN         ${has(env.scoutToken) ? '✓' : '✗'}`)
  console.log(
    `  DEVICE_HASH_SALT    ${process.env.DEVICE_HASH_SALT ? '✓' : '✗ (using default — set in production)'}`,
  )
  console.log(`  OPENROUTER_API_KEY  ${has(env.openRouterApiKey) ? '✓' : '✗'}`)
  console.log(`  OPENROUTER_MODEL    ${env.openRouterModel || '—'}`)
  console.log('  (Main CrwdCtrl Mongo/JWT/Resend/Cloudinary are not loaded here)')
}
