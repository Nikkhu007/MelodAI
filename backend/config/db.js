/**
 * MongoDB connection with:
 * - Connection pooling (max 10)
 * - Auto-reconnect
 * - Connection health monitoring
 * - Graceful shutdown handler
 */
const mongoose = require('mongoose')
const logger   = require('../utils/logger')

let isConnected = false

const connect = async () => {
  if (isConnected) return

  const uri = process.env.MONGODB_URI
  if (!uri) {
    logger.error('MONGODB_URI not set in environment')
    process.exit(1)
  }

  // Log URI without credentials for debugging
  const sanitized = uri.replace(/:([^@]+)@/, ':***@')
  logger.debug(`Connecting to MongoDB: ${sanitized}`)

  mongoose.set('strictQuery', false)

  await mongoose.connect(uri, {
    maxPoolSize:            10,   // max 10 concurrent connections
    minPoolSize:             2,   // always keep 2 warm
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS:        45000,
    heartbeatFrequencyMS:   10000,
    connectTimeoutMS:       10000,
  })

  isConnected = true
  logger.info('MongoDB connected successfully')

  // Connection event listeners
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message })
    isConnected = false
  })

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — will auto-reconnect')
    isConnected = false
  })

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected')
    isConnected = true
  })

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — closing MongoDB connection`)
    await mongoose.connection.close()
    logger.info('MongoDB connection closed')
    process.exit(0)
  }
  process.once('SIGINT',  () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

module.exports = connect
