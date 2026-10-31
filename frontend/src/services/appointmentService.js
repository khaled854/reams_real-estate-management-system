/**
 * appointmentService.js
 * All appointment API calls — uses the shared Axios instance with
 * automatic JWT injection and silent token-refresh.
 */

import api from './api';

const BASE = '/v1/appointments';

/* ── Public (no auth) ─────────────────────────────────────── */

/**
 * Submit a property-viewing request from the public website.
 * No JWT required.
 */
export async function createPublicBooking(data) {
  const res = await api.post(`${BASE}/public`, data);
  return res.data;
}

/* ── Admin / authenticated ────────────────────────────────── */

/** GET /appointments — paginated list with optional filters */
export async function getAppointments(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

/** GET /appointments/stats — KPI snapshot */
export async function getAppointmentStats() {
  const res = await api.get(`${BASE}/stats`);
  return res.data;
}

/** GET /appointments/:id */
export async function getAppointment(id) {
  const res = await api.get(`${BASE}/${id}`);
  return res.data.data;
}

/** GET /appointments/property/:propertyId */
export async function getAppointmentsByProperty(propertyId, limit = 10) {
  const res = await api.get(`${BASE}/property/${propertyId}`, { params: { limit } });
  return res.data.data;
}

/** GET /appointments/customer/:customerId */
export async function getAppointmentsByCustomer(customerId) {
  const res = await api.get(`${BASE}/customer/${customerId}`);
  return res.data.data;
}

/** POST /appointments — admin create */
export async function createAppointment(data) {
  const res = await api.post(BASE, data);
  return res.data.data;
}

/** PUT /appointments/:id — full update */
export async function updateAppointment(id, data) {
  const res = await api.put(`${BASE}/${id}`, data);
  return res.data.data;
}

/** PATCH /appointments/:id/status */
export async function updateAppointmentStatus(id, status, adminNotes) {
  const res = await api.patch(`${BASE}/${id}/status`, {
    status,
    admin_notes: adminNotes,
  });
  return res.data.data;
}

/** PATCH /appointments/:id/reschedule */
export async function rescheduleAppointment(id, { appointment_date, appointment_time, admin_notes }) {
  const res = await api.patch(`${BASE}/${id}/reschedule`, {
    appointment_date,
    appointment_time,
    admin_notes,
  });
  return res.data.data;
}

/** PATCH /appointments/:id/assign */
export async function assignAppointment(id, assignedTo) {
  const res = await api.patch(`${BASE}/${id}/assign`, { assigned_to: assignedTo });
  return res.data.data;
}

/** DELETE /appointments/:id */
export async function deleteAppointment(id) {
  const res = await api.delete(`${BASE}/${id}`);
  return res.data;
}

/* ── Status helpers ───────────────────────────────────────── */

/** All valid status values (used for option arrays) */
export const APPOINTMENT_STATUSES = [
  'pending', 'confirmed', 'rescheduled', 'cancelled', 'rejected', 'completed', 'no_show',
];

/** All valid type values */
export const APPOINTMENT_TYPES = ['viewing', 'meeting', 'call', 'other'];

/**
 * STATUS_LABELS / TYPE_LABELS remain as English fallbacks only.
 * Components that render visible text should use the i18n hook:
 *   t(`appointments.status.${status}`)
 *   t(`appointments.type.${type}`)
 * These objects are kept for backward compatibility with code that
 * calls them directly (e.g. ActionMenu inside AppointmentsPage).
 */
export const STATUS_LABELS = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled:   'Cancelled',
  rejected:    'Rejected',
  completed:   'Completed',
  no_show:     'No Show',
};

export const TYPE_LABELS = {
  viewing: 'Property Viewing',
  meeting: 'Meeting',
  call:    'Call',
  other:   'Other',
};

/** Status → Tailwind colour variant for Badge */
export const STATUS_VARIANT = {
  pending:     'warning',
  confirmed:   'success',
  rescheduled: 'info',
  cancelled:   'secondary',
  rejected:    'danger',
  completed:   'primary',
  no_show:     'secondary',
};

/** Which statuses can be transitioned TO from a given status */
export const VALID_NEXT_STATUSES = {
  pending:     ['confirmed', 'rejected', 'cancelled'],
  confirmed:   ['completed', 'rescheduled', 'no_show', 'cancelled'],
  rescheduled: ['confirmed', 'cancelled', 'rejected'],
  cancelled:   [],
  rejected:    [],
  completed:   [],
  no_show:     [],
};
