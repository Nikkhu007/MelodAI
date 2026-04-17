/**
 * Production-grade structured logger
 * - JSON format in production, colorized in dev
 * - Daily rotating log files
 * - Request ID tracing support
 */
const { createLogger, format, transports } = require('winston')
require('winston-daily-rotate-file')
const path = require('path')
const fs   = require('fs')

const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

const { combine, timestamp, errors, json, colorize, printf } = format

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, requestId, ...meta }) => {
    const rid = requestId ? ` [${requestId}]` : ''
    const m   = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}${rid}: ${message}${m}`
  })
)

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
)

const logger = createLogger({
  level:  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'melodai-backend' },
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename:    path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level:       'error',
      maxFiles:    '14d',
      maxSize:     '20m',
      zippedArchive: true,
    }),
    new transports.DailyRotateFile({
      filename:    path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '7d',
      maxSize:     '50m',
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ],
})

module.exports = logger
