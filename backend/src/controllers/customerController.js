'use strict';

const { v4: uuidv4 } = require('uuid');

const customerModel = require('../models/customerModel');
const userModel     = require('../models/userModel');
const AppError      = require('../utils/AppError');
const asyncHandler  = require('../utils/asyncHandler');
const { logActivity } = require('../utils/activityLogger');
const {
  sendSuccess,
  sendCreated,
  buildPaginationMeta,
} = require('../utils/response');

/* ── GET /api/v1/customers ────────────────────────────────── */
const getAll = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);

  // Employees only see their own customers; admins and managers see all
  const employeeId = req.user.role === 'employee'
    ? req.user.id
    : (req.query.employee_id ? parseInt(req.query.employee_id) : undefined);

  const { rows, total } = await customerModel.findAll({
    status:        req.query.status        || undefined,
    employee_id:   employeeId,
    property_type: req.query.property_type || undefined,
    location:      req.query.location      || undefined,
    search:        req.query.search        || undefined,
    sort:          req.query.sort          || 'created_at',
    order:         req.query.order         || 'DESC',
    page,
    limit,
  });

  sendSuccess(res, {
    data: rows,
    meta: buildPaginationMeta(total, page, limit),
  });
});

/* ── GET /api/v1/customers/pipeline ──────────────────────── */
const getPipeline = asyncHandler(async (req, res) => {
  // Employees see only their own pipeline; admins and managers see all
  const employeeId = req.user.role === 'employee' ? req.user.id : undefined;
  const counts = await customerModel.getPipelineCounts(employeeId);
  sendSuccess(res, { data: counts });
});

/* ── GET /api/v1/customers/:id ────────────────────────────── */
const getOne = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);
  if (!customer) throw new AppError('Customer not found', 404);

  // Employees can only view their own customers; admins and managers see all
  if (req.user.role === 'employee' && customer.employee_id !== req.user.id) {
    throw new AppError('Access denied', 403);
  }

  sendSuccess(res, { data: customer });
});

/* ── POST /api/v1/customers ───────────────────────────────── */
const create = asyncHandler(async (req, res) => {
  // Employees are auto-assigned; admins and managers can specify employee_id
  let employeeId = req.body.employee_id || null;
  if (req.user.role === 'employee') employeeId = req.user.id;

  const customer = await customerModel.create({
    ...req.body,
    uuid:        uuidv4(),
    employee_id: employeeId,
  });

  await logActivity(req, {
    action:      'customer.created',
    description: `Customer created: ${customer.name}`,
    entity_type: 'customers',
    entity_id:   customer.id,
    new_values:  customer,
  });

  sendCreated(res, { message: 'Customer created successfully', data: customer });
});

/* ── PUT /api/v1/customers/:id ────────────────────────────── */
const update = asyncHandler(async (req, res) => {
  const existing = await customerModel.findById(req.params.id);
  if (!existing) throw new AppError('Customer not found', 404);

  if (req.user.role === 'employee' && existing.employee_id !== req.user.id) {
    throw new AppError('You can only edit your own customers', 403);
  }

  const updated = await customerModel.update(req.params.id, req.body);

  await logActivity(req, {
    action:      'customer.updated',
    description: `Customer updated: ${updated.name}`,
    entity_type: 'customers',
    entity_id:   updated.id,
    old_values:  existing,
    new_values:  updated,
  });

  sendSuccess(res, { message: 'Customer updated successfully', data: updated });
});

/* ── PATCH /api/v1/customers/:id/status ──────────────────── */
const updateStatus = asyncHandler(async (req, res) => {
  const existing = await customerModel.findById(req.params.id);
  if (!existing) throw new AppError('Customer not found', 404);

  if (req.user.role === 'employee' && existing.employee_id !== req.user.id) {
    throw new AppError('Access denied', 403);
  }

  const updated = await customerModel.updateStatus(req.params.id, req.body.status);

  await logActivity(req, {
    action:      'customer.status_changed',
    description: `Customer "${existing.name}" status: ${existing.status} → ${req.body.status}`,
    entity_type: 'customers',
    entity_id:   existing.id,
    old_values:  { status: existing.status },
    new_values:  { status: req.body.status },
  });

  sendSuccess(res, { message: 'Status updated successfully', data: updated });
});

/* ── PATCH /api/v1/customers/:id/assign ──────────────────── */
const assign = asyncHandler(async (req, res) => {
  const existing = await customerModel.findById(req.params.id);
  if (!existing) throw new AppError('Customer not found', 404);

  const employee = await userModel.findById(req.body.employee_id);
  if (!employee || !['employee', 'manager'].includes(employee.role)) {
    throw new AppError('User not found or cannot be assigned as agent', 404);
  }

  const updated = await customerModel.assignEmployee(req.params.id, req.body.employee_id);

  await logActivity(req, {
    action:      'customer.assigned',
    description: `Customer "${existing.name}" assigned to ${employee.name}`,
    entity_type: 'customers',
    entity_id:   existing.id,
    old_values:  { employee_id: existing.employee_id },
    new_values:  { employee_id: req.body.employee_id },
  });

  sendSuccess(res, { message: 'Customer assigned successfully', data: updated });
});

/* ── DELETE /api/v1/customers/:id ────────────────────────── */
const remove = asyncHandler(async (req, res) => {
  const existing = await customerModel.findById(req.params.id);
  if (!existing) throw new AppError('Customer not found', 404);

  if (req.user.role === 'employee' && existing.employee_id !== req.user.id) {
    throw new AppError('You can only delete your own customers', 403);
  }

  await customerModel.remove(req.params.id);

  await logActivity(req, {
    action:      'customer.deleted',
    description: `Customer deleted: ${existing.name}`,
    entity_type: 'customers',
    entity_id:   existing.id,
    old_values:  existing,
  });

  sendSuccess(res, { message: 'Customer deleted successfully' });
});

module.exports = { getAll, getPipeline, getOne, create, update, updateStatus, assign, remove };
