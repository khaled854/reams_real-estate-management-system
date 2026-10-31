'use strict';

const bcrypt         = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userModel    = require('../models/userModel');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../utils/activityLogger');
const {
  sendSuccess,
  sendCreated,
  buildPaginationMeta,
} = require('../utils/response');

/* ── GET /api/v1/users ────────────────────────────────────── */
const getAll = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);

  const { rows, total } = await userModel.findAll({
    role:      req.query.role      || undefined,
    is_active: req.query.is_active !== undefined
                 ? req.query.is_active === 'true'
                 : undefined,
    search:    req.query.search    || undefined,
    page,
    limit,
  });

  sendSuccess(res, {
    data: rows,
    meta: buildPaginationMeta(total, page, limit),
  });
});

/* ── GET /api/v1/users/:id ────────────────────────────────── */
const getOne = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  sendSuccess(res, { data: user });
});

/* ── POST /api/v1/users ───────────────────────────────────── */
const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) throw new AppError('Email address is already registered', 409);

  // Split the single "name" field into first_name / last_name for the DB
  const parts      = String(name || '').trim().split(/\s+/);
  const first_name = parts[0]               || '';
  const last_name  = parts.slice(1).join(' ') || '';

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userModel.create({
    uuid: uuidv4(),
    first_name,
    last_name,
    email,
    passwordHash,         // maps to password_hash column in DB
    role: role || 'employee',
    phone,
  });

  await logActivity(req, {
    action:      'user.created',
    description: `Admin created user: ${user.name} (${user.role})`,
    entity_type: 'users',
    entity_id:   user.id,
    new_values:  { name: user.name, email, role: user.role },
  });

  sendCreated(res, { message: 'User created successfully', data: user });
});

/* ── PUT /api/v1/users/:id ────────────────────────────────── */
const update = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  // Prevent non-admin from changing roles
  if (req.body.role && req.user.role !== 'admin') {
    throw new AppError('Only administrators can change user roles', 403);
  }

  // Prevent email duplication
  if (req.body.email && req.body.email !== existing.email) {
    const dupe = await userModel.findByEmail(req.body.email);
    if (dupe) throw new AppError('Email address is already in use', 409);
  }

  const updated = await userModel.update(req.params.id, req.body);

  await logActivity(req, {
    action:      'user.updated',
    description: `User updated: ${updated.name}`,
    entity_type: 'users',
    entity_id:   updated.id,
    old_values:  existing,
    new_values:  updated,
  });

  sendSuccess(res, { message: 'User updated successfully', data: updated });
});

/* ── PATCH /api/v1/users/:id/password ────────────────────── */
const resetPassword = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  const hash = await bcrypt.hash(req.body.password, 12);
  await userModel.updatePassword(req.params.id, hash);

  await logActivity(req, {
    action:      'user.password_reset',
    description: `Admin reset password for: ${existing.name}`,
    entity_type: 'users',
    entity_id:   existing.id,
  });

  sendSuccess(res, { message: 'Password reset successfully' });
});

/* ── PATCH /api/v1/users/:id/deactivate ──────────────────── */
const deactivate = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  // Cannot deactivate own account
  if (existing.id === req.user.id) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  await userModel.deactivate(req.params.id);
  const updated = await userModel.findById(req.params.id);

  await logActivity(req, {
    action:      'user.deactivated',
    description: `User deactivated: ${existing.name}`,
    entity_type: 'users',
    entity_id:   existing.id,
  });

  sendSuccess(res, { message: 'User deactivated successfully', data: updated });
});

/* ── PATCH /api/v1/users/:id/activate ────────────────────── */
const activate = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  await userModel.update(req.params.id, { is_active: 1 });
  const updated = await userModel.findById(req.params.id);

  await logActivity(req, {
    action:      'user.activated',
    description: `User activated: ${existing.name}`,
    entity_type: 'users',
    entity_id:   existing.id,
  });

  sendSuccess(res, { message: 'User activated successfully', data: updated });
});

/* ── DELETE /api/v1/users/:id ─────────────────────────────── */
const remove = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  if (existing.id === req.user.id) {
    throw new AppError('You cannot delete your own account', 400);
  }

  // Prevent deleting the last admin — system would be permanently locked out
  if (existing.role === 'admin') {
    const adminCount = await userModel.countByRole('admin');
    if (adminCount <= 1) {
      throw new AppError(
        'Cannot delete the last administrator account. Create another admin first.',
        400
      );
    }
  }

  await userModel.remove(req.params.id);

  await logActivity(req, {
    action:      'user.deleted',
    description: `User deleted: ${existing.name}`,
    entity_type: 'users',
    entity_id:   existing.id,
    old_values:  existing,
  });

  sendSuccess(res, { message: 'User deleted successfully' });
});

module.exports = { getAll, getOne, create, update, resetPassword, deactivate, activate, remove };
