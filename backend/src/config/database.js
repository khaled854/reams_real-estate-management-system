'use strict';

/**
 * database.js
 * MySQL connection pool using mysql2/promise.
 * Import `pool` anywhere in the app to run queries.
 */

const mysql  = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host:              process.env.DB_HOST            || 'localhost',
  port:              parseInt(process.env.DB_PORT)  || 3306,
  database:          process.env.DB_NAME            || 'real_estate_db',
  user:              process.env.DB_USER            || 'rems_user',
  password:          process.env.DB_PASSWORD        || '',
  connectionLimit:   parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  waitForConnections: true,
  queueLimit:        50,    // cap pending requests to prevent memory exhaustion under load
  timezone:          'Z',             // store all timestamps as UTC
  decimalNumbers:    true,
});

/**
 * Verify the pool can reach MySQL at startup.
 * Called once from server.js (optional but recommended).
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.info(`MySQL connected — database: ${process.env.DB_NAME}`);
    conn.release();
  } catch (err) {
    logger.error('MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { pool, testConnection };
