'use strict';

const { Router }   = require('express');
const controller   = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const {
  createUserSchema,
  updateUserSchema,
  updatePasswordSchema,
} = require('../validators/userValidator');

const router = Router();

// All user management routes require authentication + admin role
router.use(authenticate, authorize('admin'));

/**
 * @route  GET /api/v1/users
 * @desc   List all users (paginated, filterable by role/status/search)
 * @access Admin
 */
router.get('/', controller.getAll);

/**
 * @route  POST /api/v1/users
 * @desc   Create a new user account
 * @access Admin
 */
router.post('/', validate(createUserSchema), controller.create);

/**
 * @route  GET /api/v1/users/:id
 * @desc   Get a single user by ID
 * @access Admin
 */
router.get('/:id', controller.getOne);

/**
 * @route  PUT /api/v1/users/:id
 * @desc   Update user profile / role
 * @access Admin
 */
router.put('/:id', validate(updateUserSchema), controller.update);

/**
 * @route  PATCH /api/v1/users/:id/password
 * @desc   Admin reset of any user's password
 * @access Admin
 */
router.patch('/:id/password', validate(updatePasswordSchema), controller.resetPassword);

/**
 * @route  PATCH /api/v1/users/:id/deactivate
 * @desc   Soft-disable a user account
 * @access Admin
 */
router.patch('/:id/deactivate', controller.deactivate);

/**
 * @route  PATCH /api/v1/users/:id/activate
 * @desc   Re-enable a deactivated account
 * @access Admin
 */
router.patch('/:id/activate', controller.activate);

/**
 * @route  DELETE /api/v1/users/:id
 * @desc   Permanently delete a user
 * @access Admin
 */
router.delete('/:id', controller.remove);

module.exports = router;
