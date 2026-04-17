/**
 * Structured error class — replaces generic Error throws across the app.
 * Allows the global error handler to distinguish operational errors
 * (like 404, validation) from programming bugs.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message)
    this.statusCode  = statusCode
    this.status      = statusCode >= 500 ? 'error' : 'fail'
    this.code        = code           // e.g. 'DUPLICATE_EMAIL', 'INVALID_TOKEN'
    this.isOperational = true         // vs programming errors
    Error.captureStackTrace(this, this.constructor)
  }
}

// Shorthand factories
AppError.notFound    = (msg = 'Not found')    => new AppError(msg, 404, 'NOT_FOUND')
AppError.unauthorized= (msg = 'Unauthorized') => new AppError(msg, 401, 'UNAUTHORIZED')
AppError.forbidden   = (msg = 'Forbidden')    => new AppError(msg, 403, 'FORBIDDEN')
AppError.badRequest  = (msg = 'Bad request')  => new AppError(msg, 400, 'BAD_REQUEST')
AppError.conflict    = (msg = 'Conflict')     => new AppError(msg, 409, 'CONFLICT')
AppError.tooMany     = (msg = 'Too many requests') => new AppError(msg, 429, 'TOO_MANY')

module.exports = AppError
