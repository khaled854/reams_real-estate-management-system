'use strict';

/**
 * asyncHandler
 * Wraps an async route handler so any rejected promise is forwarded
 * to Express's next(err) — eliminates try/catch boilerplate in controllers.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
