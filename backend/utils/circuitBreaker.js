/**
 * Circuit Breaker — wraps external service calls (AI service, Cloudinary)
 *
 * States:
 *   CLOSED  — normal operation, requests pass through
 *   OPEN    — too many failures, requests rejected immediately (fast fail)
 *   HALF    — testing recovery, 1 trial request allowed
 *
 * Config:
 *   threshold  — failures before opening (default 5)
 *   timeout    — ms to wait before half-open (default 30s)
 *   resetTime  — ms to clear failure count (default 60s)
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name       = name
    this.threshold  = options.threshold  || 5
    this.timeout    = options.timeout    || 30000
    this.resetTime  = options.resetTime  || 60000

    this.state      = 'CLOSED'
    this.failures   = 0
    this.lastFail   = null
    this.nextTest   = null
  }

  async call(fn, fallback) {
    if (this.state === 'OPEN') {
      // Check if timeout has passed → try HALF state
      if (Date.now() > this.nextTest) {
        this.state = 'HALF'
      } else {
        if (fallback) return fallback()
        throw new Error(`Circuit ${this.name} is OPEN — service unavailable`)
      }
    }

    try {
      const result = await fn()
      this._onSuccess()
      return result
    } catch (err) {
      this._onFailure()
      if (fallback) return fallback()
      throw err
    }
  }

  _onSuccess() {
    this.failures = 0
    if (this.state === 'HALF') {
      this.state = 'CLOSED'
      console.log(`[Circuit:${this.name}] CLOSED — service recovered`)
    }
  }

  _onFailure() {
    this.failures++
    this.lastFail = Date.now()

    if (this.state === 'HALF' || this.failures >= this.threshold) {
      this.state    = 'OPEN'
      this.nextTest = Date.now() + this.timeout
      console.log(`[Circuit:${this.name}] OPEN — ${this.failures} failures`)
    }

    // Reset failure count after resetTime
    setTimeout(() => {
      if (this.state === 'CLOSED') this.failures = 0
    }, this.resetTime)
  }

  getStatus() {
    return {
      name:     this.name,
      state:    this.state,
      failures: this.failures,
      lastFail: this.lastFail,
    }
  }
}

// Singleton breakers for each external service
const breakers = {
  ai:         new CircuitBreaker('ai-service',  { threshold: 3, timeout: 20000 }),
  cloudinary: new CircuitBreaker('cloudinary',  { threshold: 5, timeout: 60000 }),
}

module.exports = breakers
