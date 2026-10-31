'use strict';

const { Router }   = require('express');
const controller   = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validate     = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require('../validators/authValidator');

const router = Router();

/**
 * @route  POST /api/v1/auth/register
 * @desc   Create a new user account.
 *
 * Bootstrap mode: if NO admin users exist yet, the first registration is
 * allowed without auth (so the very first admin can be created).
 * After that, ADMIN JWT required — employees are created via /users.
 *
 * @access  Public (bootstrap only) | Admin
 */
router.post('/register', validate(registerSchema), controller.register);

/**
 * @route  POST /api/v1/auth/login
 * @desc   Authenticate and receive JWT tokens
 * @access Public
 */
router.post('/login', validate(loginSchema), controller.login);

/**
 * @route  POST /api/v1/auth/refresh
 * @desc   Exchange a refresh token for a new access token
 * @access Public (requires valid refresh token in body)
 */
router.post('/refresh', controller.refresh);

/**
 * @route  GET /api/v1/auth/me
 * @desc   Get the currently authenticated user's profile
 * @access Private
 */
router.get('/me', authenticate, controller.getMe);

/**
 * @route  POST /api/v1/auth/change-password
 * @desc   Change own password (must supply current password)
 * @access Private
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword
);

/**
 * @route  POST /api/v1/auth/logout
 * @desc   Log out (records activity; client must discard tokens)
 * @access Private
 */
router.post('/logout', authenticate, controller.logout);

module.exports = router;
