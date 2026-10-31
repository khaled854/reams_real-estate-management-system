'use strict';

const { v4: uuidv4 }   = require('uuid');
const appointmentModel = require('../models/appointmentModel');
const propertyModel    = require('../models/propertyModel');
const AppError         = require('../utils/AppError');
const asyncHandler     = require('../utils/asyncHandler');
const { logActivity }  = require('../utils/activityLogger');
const {
  sendSuccess,
  sendCreated,
  buildPaginationMeta,
} = require('../utils/response');

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */

/** Employees only see appointments for their assigned properties / themselves */
function applyRoleFilter(req, filters) {
  if (req.user?.role === 'employee') {
    // Employee sees only appointments assigned to them
    filters.assigned_to = req.user.id;
  }
  return filters;
}

/* ─────────────────────────────────────────────────────────────
   PUBLIC — POST /api/v1/appointments/public
   No authentication required.
   Throttled by the global API rate limiter in app.js.
   ───────────────────────────────────────────────────────────── */
const createPublic = asyncHandler(async (req, res) => {
  const {
    property_id, customer_name, customer_phone, customer_email,
    appointment_date, appointment_time, type, customer_notes,
  } = req.body;

  // Verify property exists and is available
  const property = await propertyModel.findById(property_id);
  if (!property) throw new AppError('Property not found', 404);
  if (property.status === 'sold' || property.status === 'rented') {
    throw new AppError('This property is no longer available for viewing', 422);
  }

  const appt = await appointmentModel.create({
    uuid:             uuidv4(),
    property_id,
    customer_id:      null,   // no CRM record created automatically
    customer_name:    customer_name.trim(),
    customer_phone:   customer_phone.trim(),
    customer_email:   customer_email?.trim() || null,
    appointment_date,
    appointment_time,
    duration_minutes: 60,
    type:             type || 'viewing',
    status:           'pending',
    assigned_to:      null,
    customer_notes:   customer_notes?.trim() || null,
    admin_notes:      null,
    source:           'public_website',
  });

  // Activity log (no req.user in public endpoint)
  await logActivity(req, {
    user_id:     null,
    action:      'appointment.created_public',
    description: `Public booking: "${customer_name}" for "${property.title}" on ${appointment_date}`,
    entity_type: 'appointments',
    entity_id:   appt.id,
    new_values:  { property_id, appointment_date, appointment_time, type },
  });

  sendCreated(res, {
    message: 'Appointment request submitted successfully',
    data: {
      id:               appt.id,
      uuid:             appt.uuid,
      property_title:   appt.property_title,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type:             appt.type,
      status:           appt.status,
    },
  });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/appointments
   ───────────────────────────────────────────────────────────── */
const getAll = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);

  const filters = applyRoleFilter(req, {
    status:      req.query.status      || undefined,
    type:        req.query.type        || undefined,
    property_id: req.query.property_id ? parseInt(req.query.property_id) : undefined,
    customer_id: req.query.customer_id ? parseInt(req.query.customer_id) : undefined,
    assigned_to: req.query.assigned_to ? parseInt(req.query.assigned_to) : undefined,
    date_from:   req.query.date_from   || undefined,
    date_to:     req.query.date_to     || undefined,
    search:      req.query.search      || undefined,
    sort:        req.query.sort        || 'appointment_date',
    order:       req.query.order       || 'ASC',
    page,
    limit,
  });

  const { rows, total } = await appointmentModel.findAll(filters);

  sendSuccess(res, {
    data: rows,
    meta: buildPaginationMeta(total, page, limit),
  });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/appointments/stats
   ───────────────────────────────────────────────────────────── */
const getStats = asyncHandler(async (_req, res) => {
  const stats = await appointmentModel.getDashboardStats();
  sendSuccess(res, { data: stats });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/appointments/:id
   ───────────────────────────────────────────────────────────── */
const getOne = asyncHandler(async (req, res) => {
  const appt = await appointmentModel.findById(req.params.id);
  if (!appt) throw new AppError('Appointment not found', 404);

  // Employee can only see appointments assigned to them
  if (req.user.role === 'employee' && appt.assigned_to !== req.user.id) {
    throw new AppError('Access denied', 403);
  }

  sendSuccess(res, { data: appt });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/v1/appointments  (admin / manager / employee)
   ───────────────────────────────────────────────────────────── */
const create = asyncHandler(async (req, res) => {
  const b = req.body;

  const property = await propertyModel.findById(b.property_id);
  if (!property) throw new AppError('Property not found', 404);

  // Conflict check if assigning an agent
  if (b.assigned_to) {
    const conflict = await appointmentModel.checkConflict({
      assigned_to:      b.assigned_to,
      appointment_date: b.appointment_date,
      appointment_time: b.appointment_time,
    });
    if (conflict) throw new AppError(
      'The selected agent already has an appointment within 60 minutes of this time slot', 409
    );
  }

  // Employees are auto-assigned to themselves
  let assignedTo = b.assigned_to || null;
  if (req.user.role === 'employee') assignedTo = req.user.id;

  const appt = await appointmentModel.create({
    uuid:             uuidv4(),
    property_id:      b.property_id,
    customer_id:      b.customer_id || null,
    customer_name:    b.customer_name,
    customer_phone:   b.customer_phone,
    customer_email:   b.customer_email || null,
    appointment_date: b.appointment_date,
    appointment_time: b.appointment_time,
    duration_minutes: b.duration_minutes || 60,
    type:             b.type || 'viewing',
    status:           b.status || 'pending',
    assigned_to:      assignedTo,
    customer_notes:   b.customer_notes || null,
    admin_notes:      b.admin_notes || null,
    source:           b.source || 'admin',
  });

  await logActivity(req, {
    action:      'appointment.created',
    description: `Appointment created: "${b.customer_name}" for "${property.title}" on ${b.appointment_date}`,
    entity_type: 'appointments',
    entity_id:   appt.id,
    new_values:  appt,
  });

  sendCreated(res, { message: 'Appointment created', data: appt });
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/v1/appointments/:id
   ───────────────────────────────────────────────────────────── */
const update = asyncHandler(async (req, res) => {
  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  if (req.user.role === 'employee' && existing.assigned_to !== req.user.id) {
    throw new AppError('You can only edit appointments assigned to you', 403);
  }

  // Check conflict if changing agent or slot
  const newAgent = req.body.assigned_to !== undefined ? req.body.assigned_to : existing.assigned_to;
  const newDate  = req.body.appointment_date || existing.appointment_date;
  const newTime  = req.body.appointment_time || existing.appointment_time;

  if (newAgent && (req.body.assigned_to || req.body.appointment_date || req.body.appointment_time)) {
    const conflict = await appointmentModel.checkConflict({
      assigned_to:      newAgent,
      appointment_date: newDate,
      appointment_time: newTime,
      excludeId:        existing.id,
    });
    if (conflict) throw new AppError(
      'The selected agent already has an appointment within 60 minutes of this time slot', 409
    );
  }

  const updated = await appointmentModel.update(req.params.id, req.body);

  await logActivity(req, {
    action:      'appointment.updated',
    description: `Appointment updated: id=${existing.id}`,
    entity_type: 'appointments',
    entity_id:   existing.id,
    old_values:  existing,
    new_values:  updated,
  });

  sendSuccess(res, { message: 'Appointment updated', data: updated });
});

/* ─────────────────────────────────────────────────────────────
   PATCH /api/v1/appointments/:id/status
   ───────────────────────────────────────────────────────────── */
const updateStatus = asyncHandler(async (req, res) => {
  const { status, admin_notes } = req.body;

  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  if (req.user.role === 'employee' && existing.assigned_to !== req.user.id) {
    throw new AppError('You can only update appointments assigned to you', 403);
  }

  if (!appointmentModel.isValidTransition(existing.status, status)) {
    throw new AppError(
      `Cannot transition from "${existing.status}" to "${status}"`, 422
    );
  }

  const updated = await appointmentModel.updateStatus(
    req.params.id, status, admin_notes
  );

  await logActivity(req, {
    action:      `appointment.${status}`,
    description: `Appointment status changed: ${existing.status} → ${status}`,
    entity_type: 'appointments',
    entity_id:   existing.id,
    old_values:  { status: existing.status },
    new_values:  { status },
  });

  sendSuccess(res, { message: `Appointment ${status}`, data: updated });
});

/* ─────────────────────────────────────────────────────────────
   PATCH /api/v1/appointments/:id/reschedule
   ───────────────────────────────────────────────────────────── */
const reschedule = asyncHandler(async (req, res) => {
  const { appointment_date, appointment_time, admin_notes } = req.body;

  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  if (req.user.role === 'employee' && existing.assigned_to !== req.user.id) {
    throw new AppError('You can only reschedule appointments assigned to you', 403);
  }

  // Only active appointments can be rescheduled
  if (['cancelled', 'rejected', 'completed', 'no_show'].includes(existing.status)) {
    throw new AppError(`Cannot reschedule a ${existing.status} appointment`, 422);
  }

  // Conflict check
  if (existing.assigned_to) {
    const conflict = await appointmentModel.checkConflict({
      assigned_to:      existing.assigned_to,
      appointment_date: appointment_date,
      appointment_time: appointment_time,
      excludeId:        existing.id,
    });
    if (conflict) throw new AppError(
      'The agent already has an appointment within 60 minutes of the new time slot', 409
    );
  }

  const updated = await appointmentModel.reschedule(req.params.id, {
    appointment_date,
    appointment_time,
    admin_notes,
  });

  await logActivity(req, {
    action:      'appointment.rescheduled',
    description: `Appointment rescheduled from ${existing.appointment_date} ${existing.appointment_time} to ${appointment_date} ${appointment_time}`,
    entity_type: 'appointments',
    entity_id:   existing.id,
    old_values:  { appointment_date: existing.appointment_date, appointment_time: existing.appointment_time },
    new_values:  { appointment_date, appointment_time },
  });

  sendSuccess(res, { message: 'Appointment rescheduled', data: updated });
});

/* ─────────────────────────────────────────────────────────────
   PATCH /api/v1/appointments/:id/assign
   ───────────────────────────────────────────────────────────── */
const assign = asyncHandler(async (req, res) => {
  const { assigned_to } = req.body;

  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  if (assigned_to) {
    const conflict = await appointmentModel.checkConflict({
      assigned_to,
      appointment_date: existing.appointment_date,
      appointment_time: existing.appointment_time,
      excludeId:        existing.id,
    });
    if (conflict) throw new AppError(
      'The selected agent already has an appointment within 60 minutes of this time slot', 409
    );
  }

  await appointmentModel.update(existing.id, { assigned_to: assigned_to ?? null });
  const updated = await appointmentModel.findById(existing.id);

  await logActivity(req, {
    action:      'appointment.assigned',
    description: `Appointment assigned: id=${existing.id} → agent_id=${assigned_to ?? 'none'}`,
    entity_type: 'appointments',
    entity_id:   existing.id,
    old_values:  { assigned_to: existing.assigned_to },
    new_values:  { assigned_to: assigned_to ?? null },
  });

  sendSuccess(res, { message: 'Appointment assigned', data: updated });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/appointments/property/:propertyId
   ───────────────────────────────────────────────────────────── */
const getByProperty = asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const rows  = await appointmentModel.findByProperty(req.params.propertyId, limit);
  sendSuccess(res, { data: rows });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/appointments/customer/:customerId
   ───────────────────────────────────────────────────────────── */
const getByCustomer = asyncHandler(async (req, res) => {
  if (req.user.role === 'employee') {
    // Employees can only see customer appointments for their assigned entries
    const rows = await appointmentModel.findByCustomer(req.params.customerId);
    const filtered = rows.filter(a => a.assigned_to === req.user.id);
    return sendSuccess(res, { data: filtered });
  }
  const rows = await appointmentModel.findByCustomer(req.params.customerId);
  sendSuccess(res, { data: rows });
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/v1/appointments/:id  (admin / manager only)
   ───────────────────────────────────────────────────────────── */
const remove = asyncHandler(async (req, res) => {
  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  await appointmentModel.remove(req.params.id);

  await logActivity(req, {
    action:      'appointment.deleted',
    description: `Appointment deleted: id=${existing.id} customer=${existing.customer_name}`,
    entity_type: 'appointments',
    entity_id:   existing.id,
    old_values:  existing,
  });

  sendSuccess(res, { message: 'Appointment deleted' });
});

module.exports = {
  createPublic,
  getAll, getStats, getOne,
  create, update, updateStatus,
  reschedule, assign,
  getByProperty, getByCustomer,
  remove,
};
