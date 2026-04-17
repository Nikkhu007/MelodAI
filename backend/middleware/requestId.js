/**
 * Request ID middleware
 * Attaches a unique ID to every request for log tracing.
 * ID is returned in X-Request-Id response header.
 */
const { v4: uuidv4 } = require('uuid')

module.exports = (req, res, next) => {
  const id = req.headers['x-request-id'] || uuidv4()
  req.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}
