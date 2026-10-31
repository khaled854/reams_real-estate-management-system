'use strict';

/**
 * AppError
 * Custom error class for operational errors (expected, handled errors).
 * The global error handler checks `isOperational` to decide whether
 * to expose the message to the client.
 */
class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error message
   * @param {number} status   - HTTP status code (default 400)
   */
  constructor(message, status = 400) {
    super(message);
    this.status        = status;
    this.isOperational = true;

    // Capture clean stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
