'use strict';

/**
 * authorize.js
 * Role-based access control middleware.
 * Must be used AFTER authenticate middleware.
 *
 * Usage:
 *   router.delete('/resource/:id', authenticate, authorize('admin'), handler);
 *   router.get('/resource',        authenticate, authorize('admin', 'manager', 'employee'), handler);
 *
 * Role hierarchy (highest → lowest):
 *   admin    — full system access
 *   manager  — all modules, no user management
 *   employee — own records only
 */

const AppError = require('../utils/AppError');

/**
 * @param {...string} roles - Allowed roles (use external labels: admin/manager/employee)
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

module.exports = authorize;
