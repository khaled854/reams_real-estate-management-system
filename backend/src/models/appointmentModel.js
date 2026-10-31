'use strict';

/**
 * appointmentModel.js
 * All SQL queries for the `appointments` table.
 *
 * Status lifecycle:
 *   pending → confirmed | rejected | cancelled
 *   confirmed → completed | rescheduled | no_show | cancelled
 *   rescheduled → confirmed | cancelled | rejected
 *
 * Valid terminal states (no further transitions): completed, no_show, rejected
 */

const { pool } = require('../config/database');

/* ── Allowed status transitions ──────────────────────────── */
const STATUS_TRANSITIONS = {
  pending:     ['confirmed', 'rejected', 'cancelled'],
  confirmed:   ['completed', 'rescheduled', 'no_show', 'cancelled'],
  rescheduled: ['confirmed', 'cancelled', 'rejected'],
  cancelled:   [],   // terminal
  rejected:    [],   // terminal
  completed:   [],   // terminal
  no_show:     [],   // terminal
};

function isValidTransition(from, to) {
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/* ── Column SELECT ────────────────────────────────────────── */
const BASE_SELECT = `
  SELECT
    a.*,
    -- property snapshot
    p.title           AS property_title,
    p.location        AS property_location,
    p.listing_type    AS property_listing_type,
    p.status          AS property_status,
    -- assigned agent
    CONCAT(u.first_name, ' ', u.last_name) AS agent_name,
    u.phone                                AS agent_phone,
    -- linked customer (if any)
    c.status          AS customer_status
  FROM appointments a
  LEFT JOIN properties  p ON p.id = a.property_id
  LEFT JOIN users       u ON u.id = a.assigned_to
  LEFT JOIN customers   c ON c.id = a.customer_id
`;

/* ── findById ─────────────────────────────────────────────── */
async function findById(id) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE a.id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
}

/* ── findByUuid ───────────────────────────────────────────── */
async function findByUuid(uuid) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE a.uuid = ? LIMIT 1`, [uuid]
  );
  return rows[0] || null;
}

/* ── findAll ──────────────────────────────────────────────── */
async function findAll({
  status, type, property_id, customer_id, assigned_to,
  date_from, date_to, search,
  page = 1, limit = 20, sort = 'appointment_date', order = 'ASC',
} = {}) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (status)      { conditions.push('a.status = ?');                   params.push(status); }
  if (type)        { conditions.push('a.type = ?');                     params.push(type); }
  if (property_id) { conditions.push('a.property_id = ?');              params.push(property_id); }
  if (customer_id) { conditions.push('a.customer_id = ?');              params.push(customer_id); }
  if (assigned_to) { conditions.push('a.assigned_to = ?');              params.push(assigned_to); }
  if (date_from)   { conditions.push('a.appointment_date >= ?');        params.push(date_from); }
  if (date_to)     { conditions.push('a.appointment_date <= ?');        params.push(date_to); }
  if (search) {
    conditions.push(
      '(a.customer_name LIKE ? OR a.customer_phone LIKE ? OR a.customer_email LIKE ? OR p.title LIKE ?)'
    );
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const where     = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const SAFE_SORT = ['appointment_date', 'appointment_time', 'created_at', 'status', 'customer_name'].includes(sort)
    ? `a.${sort}` : 'a.appointment_date';
  const SAFE_ORD  = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN properties p ON p.id = a.property_id
     ${where}`,
    params
  );

  const [rows] = await pool.execute(
    `${BASE_SELECT} ${where}
     ORDER BY ${SAFE_SORT} ${SAFE_ORD}, a.appointment_time ${SAFE_ORD}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total };
}

/* ── findByProperty ───────────────────────────────────────── */
async function findByProperty(propertyId, limit = 10) {
  const [rows] = await pool.execute(
    `${BASE_SELECT}
     WHERE a.property_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC
     LIMIT ?`,
    [propertyId, limit]
  );
  return rows;
}

/* ── findByCustomer ───────────────────────────────────────── */
async function findByCustomer(customerId) {
  const [rows] = await pool.execute(
    `${BASE_SELECT}
     WHERE a.customer_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [customerId]
  );
  return rows;
}

/* ── todayCount ───────────────────────────────────────────── */
async function todayCount() {
  const today = new Date().toISOString().split('T')[0];
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM appointments
     WHERE appointment_date = ? AND status NOT IN ('cancelled','rejected')`,
    [today]
  );
  return Number(count);
}

/* ── upcomingCount ────────────────────────────────────────── */
async function upcomingCount() {
  const today = new Date().toISOString().split('T')[0];
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM appointments
     WHERE appointment_date >= ? AND status IN ('pending','confirmed','rescheduled')`,
    [today]
  );
  return Number(count);
}

/* ── pendingCount ─────────────────────────────────────────── */
async function pendingCount() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM appointments WHERE status = 'pending'`
  );
  return Number(count);
}

/* ── getDashboardStats ────────────────────────────────────── */
async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const [rows] = await pool.execute(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(status = 'pending')                               AS pending,
      SUM(status = 'confirmed')                             AS confirmed,
      SUM(status = 'completed')                             AS completed,
      SUM(status = 'cancelled' OR status = 'rejected')      AS cancelled,
      SUM(status = 'no_show')                               AS no_show,
      SUM(appointment_date = ?)                             AS today,
      SUM(appointment_date >= ? AND status IN ('pending','confirmed','rescheduled')) AS upcoming
    FROM appointments
  `, [today, today]);
  const r = rows[0] || {};
  return {
    total:     Number(r.total     ?? 0),
    pending:   Number(r.pending   ?? 0),
    confirmed: Number(r.confirmed ?? 0),
    completed: Number(r.completed ?? 0),
    cancelled: Number(r.cancelled ?? 0),
    no_show:   Number(r.no_show   ?? 0),
    today:     Number(r.today     ?? 0),
    upcoming:  Number(r.upcoming  ?? 0),
  };
}

/* ── checkConflict ────────────────────────────────────────── */
/**
 * Returns true when the given agent already has an appointment
 * within `buffer` minutes of the requested slot (default 60 min).
 * Excludes the given appointment ID (for reschedule checks).
 */
async function checkConflict({ assigned_to, appointment_date, appointment_time, excludeId, buffer = 60 }) {
  if (!assigned_to) return false;

  const [rows] = await pool.execute(
    `SELECT id FROM appointments
     WHERE assigned_to = ?
       AND appointment_date = ?
       AND status NOT IN ('cancelled','rejected','completed','no_show')
       AND id != ?
       AND ABS(TIMESTAMPDIFF(MINUTE,
             CONCAT(appointment_date, ' ', appointment_time),
             CONCAT(?, ' ', ?))) < ?
     LIMIT 1`,
    [
      assigned_to, appointment_date,
      excludeId || 0,
      appointment_date, appointment_time,
      buffer,
    ]
  );
  return rows.length > 0;
}

/* ── create ───────────────────────────────────────────────── */
async function create({
  uuid, property_id, customer_id,
  customer_name, customer_phone, customer_email,
  appointment_date, appointment_time, duration_minutes,
  type, status, assigned_to,
  customer_notes, admin_notes, source,
}) {
  const [result] = await pool.execute(
    `INSERT INTO appointments
       (uuid, property_id, customer_id,
        customer_name, customer_phone, customer_email,
        appointment_date, appointment_time, duration_minutes,
        type, status, assigned_to,
        customer_notes, admin_notes, source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uuid,
      property_id,
      customer_id     || null,
      customer_name,
      customer_phone,
      customer_email  || null,
      appointment_date,
      appointment_time,
      duration_minutes ?? 60,
      type             || 'viewing',
      status           || 'pending',
      assigned_to      || null,
      customer_notes   || null,
      admin_notes      || null,
      source           || 'public_website',
    ]
  );
  return findById(result.insertId);
}

/* ── update ───────────────────────────────────────────────── */
async function update(id, fields) {
  const allowed = [
    'customer_name', 'customer_phone', 'customer_email',
    'appointment_date', 'appointment_time', 'duration_minutes',
    'type', 'assigned_to', 'customer_notes', 'admin_notes',
  ];
  const setClauses = [];
  const params     = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  if (setClauses.length === 0) return findById(id);

  params.push(id);
  await pool.execute(
    `UPDATE appointments SET ${setClauses.join(', ')} WHERE id = ?`, params
  );
  return findById(id);
}

/* ── updateStatus ─────────────────────────────────────────── */
async function updateStatus(id, newStatus, adminNotes) {
  const params = [newStatus];
  const extra  = adminNotes !== undefined ? ', admin_notes = ?' : '';
  if (adminNotes !== undefined) params.push(adminNotes);
  params.push(id);

  await pool.execute(
    `UPDATE appointments SET status = ?${extra} WHERE id = ?`, params
  );
  return findById(id);
}

/* ── reschedule ───────────────────────────────────────────── */
async function reschedule(id, { appointment_date, appointment_time, admin_notes }) {
  // Preserve original date/time on first reschedule only
  const current = await findById(id);
  if (!current) return null;

  const saveOriginal = !current.original_date;

  await pool.execute(
    `UPDATE appointments
     SET status           = 'rescheduled',
         appointment_date = ?,
         appointment_time = ?,
         ${saveOriginal ? 'original_date = ?, original_time = ?,' : ''}
         admin_notes      = COALESCE(?, admin_notes)
     WHERE id = ?`,
    saveOriginal
      ? [appointment_date, appointment_time, current.appointment_date, current.appointment_time, admin_notes || null, id]
      : [appointment_date, appointment_time, admin_notes || null, id]
  );
  return findById(id);
}

/* ── remove ───────────────────────────────────────────────── */
async function remove(id) {
  await pool.execute('DELETE FROM appointments WHERE id = ?', [id]);
}

module.exports = {
  findById, findByUuid, findAll,
  findByProperty, findByCustomer,
  todayCount, upcomingCount, pendingCount, getDashboardStats,
  checkConflict,
  create, update, updateStatus, reschedule, remove,
  isValidTransition,
  STATUS_TRANSITIONS,
};
