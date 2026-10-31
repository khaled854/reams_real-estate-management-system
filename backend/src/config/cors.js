'use strict';

/**
 * cors.js
 * CORS configuration — supports both development and production LAN deployments.
 *
 * Architecture note:
 *   In production, the React SPA and the API are served from the SAME origin
 *   (same IP, same port 5000). The browser therefore does NOT send CORS
 *   preflight requests for API calls made from the SPA — they are same-origin.
 *
 *   CORS only matters for:
 *     1. Development: Vite dev-server on port 3000 → backend on port 5000
 *     2. Non-browser clients: Postman, mobile apps, curl, etc.
 *     3. Any external origin that should be explicitly allowed
 *
 * LAN deployment strategy:
 *   - The LAN_PATTERN always allows all RFC-1918 private network addresses.
 *   - This means any PC on the office LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 *     can reach the API without needing its IP individually listed.
 *   - This is safe for an INTERNAL office LAN application — it does NOT expose
 *     the server to the public internet.
 *   - CORS_ORIGINS is still honoured and can add any non-LAN origins.
 *
 * Security note:
 *   This is a closed, air-gapped company LAN application with no public internet
 *   exposure. Allowing all private RFC-1918 addresses is the correct configuration
 *   for this deployment model. If the server were internet-facing, the allowlist
 *   approach (CORS_ORIGINS only) should be used.
 */

/** RFC-1918 private network ranges + loopback */
const LAN_PATTERN = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?$/;

/** Any additional origins from the environment (non-LAN, public origins if needed) */
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server, health checks)
    if (!origin) return callback(null, true);

    // Always allow all private LAN addresses (RFC-1918).
    // This covers 192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, 127.0.0.1
    // regardless of environment — necessary for the LAN deployment model.
    if (LAN_PATTERN.test(origin)) {
      return callback(null, true);
    }

    // Also allow any explicitly configured origins (e.g. for external access)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Block everything else
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  methods:              ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:       ['Content-Type', 'Authorization'],
  exposedHeaders:       ['X-Total-Count'],
  credentials:          true,
  optionsSuccessStatus: 204,
};

module.exports = corsOptions;
