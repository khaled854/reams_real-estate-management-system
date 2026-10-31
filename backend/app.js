'use strict';

/**
 * app.js
 * Express application factory.
 *
 * Development:
 *   NODE_ENV=development  →  API only, no SPA serving.
 *   React runs on Vite dev server (port 3000) which proxies /api → :5000.
 *
 * Production:
 *   NODE_ENV=production   →  Express serves EVERYTHING on one port:
 *     /api/*       — REST API
 *     /uploads/*   — Uploaded images + videos (static)
 *     /*           — React SPA (from backend/public/)
 *     Any unknown path → index.html (React Router catch-all)
 *
 * Client PCs only need ONE URL: http://SERVER_IP:5000
 */

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path        = require('path');

const corsOptions     = require('./src/config/cors');
const rateLimitCfg    = require('./src/config/rateLimit');
const apiRouter       = require('./src/routes');
const errorHandler    = require('./src/middleware/errorHandler');
const notFoundHandler = require('./src/middleware/notFoundHandler');
const logger          = require('./src/utils/logger');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

// Resolve the uploads directory to an absolute path so it works regardless
// of the current working directory when the process starts.
const uploadsDir = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR || 'uploads'
);

// The SPA directory — built by `npm run build` → copied here by scripts/build.js
const spaDir = path.join(__dirname, 'public');

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'", "'unsafe-inline'"],
      styleSrc:                ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:                 ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc:                  ["'self'", 'data:', 'blob:'],
      mediaSrc:                ["'self'"],   // <video src="/uploads/...">
      connectSrc:              ["'self'"],
      // ── Critical for LAN / HTTP deployments ─────────────────
      // Helmet 7 adds upgrade-insecure-requests by default.
      // That directive forces the browser to convert every http://
      // sub-resource request to https://.  On a plain HTTP LAN server
      // there is no HTTPS, so the browser silently fails to load all
      // JS and CSS assets → blank white page on mobile and non-desktop
      // browsers that strictly honour this directive.
      // Setting false removes it from the CSP entirely.
      upgradeInsecureRequests: null,
    },
  } : false,
  // Disable HSTS on a plain HTTP LAN server.
  // HSTS tells browsers to remember "only use HTTPS for this host".
  // Once a mobile browser receives this header it will refuse to load
  // the app over HTTP for the next 180 days, even after the header is removed.
  strictTransportSecurity: false,
}));

// ── CORS ──────────────────────────────────────────────────────
// In production the SPA and API are same-origin, so CORS only matters
// for non-browser clients. The LAN_PATTERN in cors.js also handles dev.
app.use(cors(corsOptions));

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── HTTP request logging ──────────────────────────────────────
app.use(
  morgan(isProd ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Cookie parser (needed for HttpOnly refresh-token cookie) ──
// COOKIE_SECRET hardens the signed-cookie MAC, but we primarily use
// HttpOnly cookies — not signed ones — so any non-empty string works.
// If COOKIE_SECRET is not set we fall back to a derived value so the
// server still starts without crashing, but production SHOULD set it.
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

// ── Rate limiting (API only) ──────────────────────────────────
app.use('/api', rateLimit(rateLimitCfg));

// ── Serve uploaded files (/uploads/...) ──────────────────────
// Works in BOTH dev and prod.
// Files are: uploads/properties/*.jpg, uploads/videos/*.mp4, etc.
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge:         isProd ? '1d' : 0,
    etag:           true,
    fallthrough:    true,
  })
);

// ── In production: serve the React SPA (static assets) ───────
// MUST come before the API router so Vite-built JS/CSS is served quickly.
// The SPA index.html catch-all is registered AFTER /api (see below).
if (isProd) {
  app.use(
    express.static(spaDir, {
      maxAge:   '7d',
      etag:     true,
      // Do NOT send index.html for unknown paths here — let the catch-all do it
      index:    false,
    })
  );
}

// ── Health check (no auth, no rate limiting) ──────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
    uptime:      Math.round(process.uptime()),
    // Never expose absolute filesystem paths in production
    ...(isProd ? {} : { uploadsDir, spaDir }),
  });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── SPA catch-all (production only, MUST be after /api) ───────
// Any GET that didn't match /api/* or a static file gets index.html.
// This is what makes React Router work on browser refresh / deep links.
// IMPORTANT: explicitly exclude /api/* paths so that unknown API routes
// correctly fall through to notFoundHandler and return JSON 404,
// not the SPA HTML (which would confuse API clients).
if (isProd) {
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(spaDir, 'index.html'));
  });
}

// ── 404 & global error handler (last) ────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
