'use strict';

const { Router }   = require('express');
const controller   = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');

const router = Router();

// All report routes require authentication
router.use(authenticate);

/**
 * @route  GET /api/v1/reports/dashboard
 * @desc   Single-row KPI snapshot (available_properties, active_contracts,
 *         revenue_this_month, overdue_amount, …)
 * @access Admin | Employee
 */
router.get('/dashboard', controller.getDashboard);

/**
 * @route  GET /api/v1/reports/properties
 * @desc   Properties grouped by status, type, listing_type + monthly trend
 * @query  from_date, to_date, agent_id
 * @access Admin | Employee
 */
router.get('/properties', controller.getPropertiesReport);

/**
 * @route  GET /api/v1/reports/customers
 * @desc   Customers grouped by status + by employee + monthly trend
 * @query  from_date, to_date, employee_id
 * @access Admin | Employee
 */
router.get('/customers', controller.getCustomersReport);

/**
 * @route  GET /api/v1/reports/financials
 * @desc   Financials by type/status + monthly revenue trend + totals
 * @query  from_date, to_date
 * @access Admin only
 */
router.get('/financials', authorize('admin'), controller.getFinancialsReport);

/**
 * @route  GET /api/v1/reports/agents
 * @desc   Per-agent performance: properties, contracts, revenue
 * @query  from_date, to_date
 * @access Admin only
 */
router.get('/agents', authorize('admin'), controller.getAgentPerformance);

module.exports = router;
