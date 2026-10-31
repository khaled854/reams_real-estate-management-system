'use strict';

/**
 * notFoundHandler.js
 * Catches any request that didn't match a registered route.
 */

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = notFoundHandler;
