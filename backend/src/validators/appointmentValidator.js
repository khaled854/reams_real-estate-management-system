'use strict';

const Joi = require('joi');

const APPT_TYPES    = ['viewing', 'meeting', 'call', 'other'];
const APPT_STATUSES = ['pending', 'confirmed', 'rescheduled', 'cancelled', 'rejected', 'completed', 'no_show'];

/* ── Phone: allow international + local Egyptian formats ── */
const phoneSchema = Joi.string()
  .trim()
  .pattern(/^\+?[0-9\s\-().]{7,20}$/)
  .messages({ 'string.pattern.base': 'Phone number is not valid' });

/* ── Date: YYYY-MM-DD, not in the past ───────────────────── */
const dateSchema = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    // Validate calendar date by parsing the parts directly (avoids timezone shifts)
    const [year, month, day] = value.split('-').map(Number);
    const d = new Date(year, month - 1, day); // local midnight, no UTC shift
    if (
      isNaN(d.getTime()) ||
      d.getFullYear() !== year ||
      d.getMonth() + 1 !== month ||
      d.getDate() !== day
    ) {
      return helpers.error('date.invalid');
    }
    // Compare as date strings (YYYY-MM-DD) to be fully timezone-independent
    const todayStr = new Date().toLocaleDateString('en-CA'); // returns YYYY-MM-DD in local TZ
    if (value < todayStr) return helpers.error('date.past');
    return value;
  })
  .messages({
    'string.pattern.base': 'Date must be in YYYY-MM-DD format',
    'date.invalid': 'Date is not a valid calendar date',
    'date.past':    'Appointment date cannot be in the past',
  });

/* ── Time: HH:MM (24-hour) ───────────────────────────────── */
const timeSchema = Joi.string()
  .trim()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
  .messages({ 'string.pattern.base': 'Time must be in HH:MM format (24-hour)' });

/* ── Public booking (from website visitors — no auth) ─────── */
const createPublicSchema = Joi.object({
  property_id:      Joi.number().integer().positive().required(),
  customer_name:    Joi.string().trim().min(2).max(150).required(),
  customer_phone:   phoneSchema.required(),
  customer_email:   Joi.string().trim().email().allow('', null).optional(),
  appointment_date: dateSchema.required(),
  appointment_time: timeSchema.required(),
  type:             Joi.string().valid(...APPT_TYPES).default('viewing'),
  customer_notes:   Joi.string().trim().max(1000).allow('', null).optional(),
});

/* ── Admin create (all fields, can set status + assigned) ─── */
const createAdminSchema = Joi.object({
  property_id:      Joi.number().integer().positive().required(),
  customer_id:      Joi.number().integer().positive().allow(null).optional(),
  customer_name:    Joi.string().trim().min(2).max(150).required(),
  customer_phone:   phoneSchema.required(),
  customer_email:   Joi.string().trim().email().allow('', null).optional(),
  appointment_date: dateSchema.required(),
  appointment_time: timeSchema.required(),
  duration_minutes: Joi.number().integer().min(15).max(480).default(60),
  type:             Joi.string().valid(...APPT_TYPES).default('viewing'),
  status:           Joi.string().valid(...APPT_STATUSES).default('pending'),
  assigned_to:      Joi.number().integer().positive().allow(null).optional(),
  customer_notes:   Joi.string().trim().max(1000).allow('', null).optional(),
  admin_notes:      Joi.string().trim().max(2000).allow('', null).optional(),
  source:           Joi.string().valid('public_website', 'admin', 'phone', 'walk_in', 'other').default('admin'),
});

/* ── Update (partial — only provided fields are updated) ──── */
const updateSchema = Joi.object({
  customer_name:    Joi.string().trim().min(2).max(150).optional(),
  customer_phone:   phoneSchema.optional(),
  customer_email:   Joi.string().trim().email().allow('', null).optional(),
  appointment_date: dateSchema.optional(),
  appointment_time: timeSchema.optional(),
  duration_minutes: Joi.number().integer().min(15).max(480).optional(),
  type:             Joi.string().valid(...APPT_TYPES).optional(),
  assigned_to:      Joi.number().integer().positive().allow(null).optional(),
  customer_notes:   Joi.string().trim().max(1000).allow('', null).optional(),
  admin_notes:      Joi.string().trim().max(2000).allow('', null).optional(),
}).min(1);

/* ── Status update ───────────────────────────────────────── */
const updateStatusSchema = Joi.object({
  status:      Joi.string().valid(...APPT_STATUSES).required(),
  admin_notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

/* ── Reschedule ──────────────────────────────────────────── */
const rescheduleSchema = Joi.object({
  appointment_date: dateSchema.required(),
  appointment_time: timeSchema.required(),
  admin_notes:      Joi.string().trim().max(2000).allow('', null).optional(),
});

/* ── Assign ──────────────────────────────────────────────── */
const assignSchema = Joi.object({
  assigned_to: Joi.number().integer().positive().allow(null).required(),
});

module.exports = {
  createPublicSchema,
  createAdminSchema,
  updateSchema,
  updateStatusSchema,
  rescheduleSchema,
  assignSchema,
};
