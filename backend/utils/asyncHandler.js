/**
 * asyncHandler — wraps async route handlers to catch rejections
 * and pass them to the global error handler automatically.
 * Eliminates try/catch boilerplate in every controller.
 */
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

module.exports = asyncHandler
