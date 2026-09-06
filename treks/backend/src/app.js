import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import apiRoutes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

// Railway/Vercel terminate TLS upstream: without this every visitor shares one
// rate-limit bucket, so real users get blocked while abuse goes uncounted.
app.set('trust proxy', 1)

const isProd = env.nodeEnv === 'production'

const allowedOrigins =
  env.corsOrigin === '*'
    ? true
    : env.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser / same-origin tools (curl, health checks)
      if (!origin) return callback(null, true)
      if (allowedOrigins === true) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Local Vite on any port, development only
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Device-Id'],
  }),
)
app.use(express.json({ limit: '16kb' }))

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'CrwdCtrl Treks API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      treks: '/api/treks',
      trekBySlug: '/api/treks/:slug',
      checkIns: 'POST /api/treks/:slug/check-ins',
      todayCheckIns: 'GET /api/treks/:slug/check-ins/today',
      scoutStatus: 'PATCH /api/treks/:slug/status',
      alerts: '/api/alerts',
    },
  })
})

app.use('/api', apiRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
