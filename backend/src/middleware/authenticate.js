'use strict';

/**
 * authenticate.js
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches the decoded user payload
 * to req.user for downstream handlers.
 *
 * Usage:
 *   router.get('/protected', authenticate, handler);
 */

const jwt      = require('jsonwebtoken');
const AppError = require('../utils/AppError');

function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, iat, exp }
    next();
  } catch (err) {
    next(err); // Handled by errorHandler (JsonWebTokenError / TokenExpiredError)
  }
}

module.exports = authenticate;
