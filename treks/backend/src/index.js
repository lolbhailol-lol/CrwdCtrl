import app from './app.js'
import { connectDb } from './config/db.js'
import { env, logEnvStatus } from './config/env.js'

logEnvStatus()

await connectDb()

const server = app.listen(env.port, () => {
  console.log(`CrwdCtrl Treks API → http://localhost:${env.port}`)
  console.log(`Health             → http://localhost:${env.port}/api/health`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${env.port} is already in use.`)
    console.error('Stop the other process, or change PORT in treks/backend/.env\n')
    process.exit(1)
  }
  throw err
})
