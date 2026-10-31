'use strict';

/**
 * response.js
 * Standardised API response helpers.
 * All controllers should use these to ensure a consistent response envelope.
 *
 * Success envelope:
 *   { success: true, message, data, meta }
 *
 * Error envelope:
 *   { success: false, message, errors }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {*}      options.data    - Response payload
 * @param {string} [options.message]
 * @param {number} [options.status]  - HTTP status (default 200)
 * @param {object} [options.meta]    - Pagination or extra metadata
 */
function sendSuccess(res, { data = null, message = 'Success', status = 200, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/**
 * Send a created (201) response.
 */
function sendCreated(res, { data = null, message = 'Resource created' } = {}) {
  return sendSuccess(res, { data, message, status: 201 });
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {string} options.message
 * @param {number} [options.status]  - HTTP status (default 400)
 * @param {Array}  [options.errors]  - Field-level validation errors
 */
function sendError(res, { message = 'An error occurred', status = 400, errors } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

/**
 * Build a pagination meta object for list responses.
 * @param {number} total   - Total records in DB
 * @param {number} page    - Current page (1-indexed)
 * @param {number} limit   - Records per page
 */
function buildPaginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { sendSuccess, sendCreated, sendError, buildPaginationMeta };
