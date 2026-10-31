'use strict';

/**
 * server.js
 * HTTP server entry point.
 * Loads environment variables, tests the DB connection,
 * then starts listening.
 */

require('dotenv').config();

const app                   = require('./app');
const logger                = require('./src/utils/logger');
const { testConnection }    = require('./src/config/database');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
// Startup sequence: verify DB, then bind the HTTP server
// ---------------------------------------------------------------------------
async function start() {
  // 1. Verify MySQL connection before accepting any traffic
  await testConnection();

  // 2. Start listening
  const server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on http://${HOST}:${PORT} [${process.env.NODE_ENV}]`);
    logger.info(`Health check: http://${HOST}:${PORT}/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────
  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit if connections don't drain within 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// ── Unhandled errors ──────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  logger.error('Fatal startup error:', err.message);
  process.exit(1);
});
