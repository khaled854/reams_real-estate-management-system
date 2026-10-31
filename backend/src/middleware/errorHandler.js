'use strict';

/**
 * errorHandler.js
 * Global Express error-handling middleware.
 * Must be registered LAST in app.js (after all routes).
 */

const logger   = require('../utils/logger');
const AppError = require('../utils/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Default to 500 if no status is set
  const status  = err.status || err.statusCode || 500;
  const isProd  = process.env.NODE_ENV === 'production';

  // Log all errors server-side
  if (status >= 500) {
    logger.error(err);
  } else {
    logger.warn(`${status} — ${err.message}`);
  }

  // Operational errors (AppError): safe to expose message
  if (err instanceof AppError && err.isOperational) {
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }

  // CORS errors (thrown by cors() middleware when origin is not allowed)
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // JSON body parse errors (thrown by express.json() middleware)
  // e.g. malformed JSON in request body → should be 400, not 500
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
  }

  // Multer file filter errors (plain Error thrown by fileFilter callbacks)
  // These are not LIMIT_* codes but are user-facing validation errors
  if (err.name === 'Error' || err instanceof Error) {
    const uploadErrors = [
      'Only JPEG, PNG, and WebP images are allowed',
      'Only MP4 and WebM videos are allowed',
      'Only PDF, DOC, and DOCX files are allowed',
    ];
    if (uploadErrors.includes(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    // Report the actual limit that applies — video uploads have a separate (larger) limit
    const imgMB   = process.env.MAX_FILE_SIZE_MB  || 10;
    const vidMB   = process.env.MAX_VIDEO_SIZE_MB || 1024;
    // Heuristic: if the route contains /videos, report the video limit; otherwise image limit
    const isVideo = err?.field === 'videos' || req?.originalUrl?.includes('/videos');
    const limitMB = isVideo ? vidMB : imgMB;
    return res.status(400).json({
      success: false,
      message: `File size exceeds the ${limitMB} MB limit`,
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: 'Too many files uploaded at once' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected upload field name' });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Record already exists' });
  }

  // Unknown / programming errors — hide details in production
  return res.status(500).json({
    success: false,
    message: isProd ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = errorHandler;
