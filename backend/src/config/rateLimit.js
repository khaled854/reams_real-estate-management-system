'use strict';

/**
 * rateLimit.js
 * Configuration for express-rate-limit.
 * Protects the API from brute-force and abuse on the LAN.
 */

module.exports = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max:       parseInt(process.env.RATE_LIMIT_MAX)       || 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests — please try again later.',
  },
};
