'use strict';

/**
 * activityLogger.js
 * Helper that inserts a row into the `activities` table.
 * All controllers call this after every mutating action.
 */

const { pool } = require('../config/database');
const logger   = require('./logger');

/**
 * @param {import('express').Request} req  - Express request (for ip/user-agent/user)
 * @param {object} opts
 * @param {number}  [opts.user_id]       - Defaults to req.user?.id
 * @param {string}  opts.action          - e.g. 'property.created'
 * @param {string}  opts.description     - Human-readable sentence
 * @param {string}  [opts.entity_type]   - Table name
 * @param {number}  [opts.entity_id]     - Affected row id
 * @param {object}  [opts.old_values]    - Snapshot before change
 * @param {object}  [opts.new_values]    - Snapshot after change
 */
async function logActivity(req, opts) {
  try {
    const userId     = opts.user_id ?? req.user?.id ?? null;
    const ipAddress  = req.ip || req.connection?.remoteAddress || null;
    const userAgent  = req.headers?.['user-agent']?.slice(0, 500) || null;

    await pool.execute(
      `INSERT INTO activities
         (user_id, action, description, entity_type, entity_id,
          old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        opts.action,
        opts.description,
        opts.entity_type  || null,
        opts.entity_id    ?? null,
        opts.old_values   ? JSON.stringify(opts.old_values)  : null,
        opts.new_values   ? JSON.stringify(opts.new_values)  : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    // Never crash the request because of a logging failure
    logger.error('activityLogger failed:', err.message);
  }
}

module.exports = { logActivity };
