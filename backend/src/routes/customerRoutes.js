'use strict';

const { Router }   = require('express');
const controller   = require('../controllers/customerController');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const {
  createCustomerSchema,
  updateCustomerSchema,
  updateStatusSchema,
  assignEmployeeSchema,
} = require('../validators/customerValidator');

const router = Router();

// All customer routes require authentication
router.use(authenticate);

/**
 * @route  GET /api/v1/customers/pipeline
 * @desc   Get lead counts grouped by status (CRM funnel)
 * @access Admin | Employee (own)
 */
router.get('/pipeline', controller.getPipeline);

/**
 * @route  GET /api/v1/customers
 * @desc   List customers (employees see only their own)
 * @query  status, employee_id, property_type, location, search, page, limit, sort, order
 * @access Admin | Employee
 */
router.get('/', controller.getAll);

/**
 * @route  POST /api/v1/customers
 * @desc   Create a new customer / lead
 * @access Admin | Employee
 */
router.post(
  '/',
  authorize('admin', 'manager', 'employee'),
  validate(createCustomerSchema),
  controller.create
);

/**
 * @route  GET /api/v1/customers/:id
 * @desc   Get a single customer (employees: own only)
 * @access Admin | Employee
 */
router.get('/:id', controller.getOne);

/**
 * @route  PUT /api/v1/customers/:id
 * @desc   Update a customer (employees: own only)
 * @access Admin | Employee
 */
router.put(
  '/:id',
  authorize('admin', 'manager', 'employee'),
  validate(updateCustomerSchema),
  controller.update
);

/**
 * @route  PATCH /api/v1/customers/:id/status
 * @desc   Update CRM pipeline status
 * @access Admin | Manager | Employee
 */
router.patch(
  '/:id/status',
  authorize('admin', 'manager', 'employee'),
  validate(updateStatusSchema),
  controller.updateStatus
);

/**
 * @route  PATCH /api/v1/customers/:id/assign
 * @desc   Reassign customer to a different employee
 * @access Admin | Manager
 */
router.patch(
  '/:id/assign',
  authorize('admin', 'manager'),
  validate(assignEmployeeSchema),
  controller.assign
);

/**
 * @route  DELETE /api/v1/customers/:id
 * @desc   Delete a customer record
 * @access Admin | Manager | Employee (own only)
 */
router.delete(
  '/:id',
  authorize('admin', 'manager', 'employee'),
  controller.remove
);

module.exports = router;
