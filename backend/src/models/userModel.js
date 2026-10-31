'use strict';

/**
 * userModel.js
 * All SQL queries for the `users` table.
 *
 * DB column reference (real_estate_db.users):
 *   id, uuid, email, password_hash, first_name, last_name,
 *   phone, role, avatar_path, is_active, last_login_at,
 *   created_at, updated_at
 *
 * Role storage:
 *   External label  |  DB ENUM value
 *   ─────────────────────────────────
 *   'admin'         |  'admin'
 *   'employee'      |  'agent'
 *
 * Every query that returns a row runs it through normaliseRow(),
 * which:
 *   • Aliases first_name + last_name → a virtual `name` field
 *     used throughout the app (controllers, JWT payload, frontend).
 *   • Translates DB role 'agent' → external label 'employee'.
 *   • Never exposes password_hash to callers (except findByEmail,
 *     which intentionally returns it for bcrypt comparison).
 */

const { pool } = require('../config/database');

/* ─────────────────────────────────────────────────────────────
   Column helpers
   ───────────────────────────────────────────────────────────── */

/**
 * Safe SELECT list — everything except password_hash.
 * The CONCAT alias creates the virtual `name` field the app uses.
 */
const BASE_SELECT = `
  SELECT
    id,
    uuid,
    email,
    first_name,
    last_name,
    CONCAT(first_name, ' ', last_name) AS name,
    role,
    phone,
    avatar_path,
    is_active,
    last_login_at,
    created_at,
    updated_at
  FROM users
`;

/** Map external role label → DB ENUM value */
const toDbRole = (role) => (role === 'employee' ? 'agent' : role);

/**
 * Normalise a raw DB row:
 *   1. role: 'agent' → 'employee'
 *   2. Ensure the virtual `name` field is always present
 *      (SELECT * queries won't have the CONCAT alias).
 */
function normaliseRow(row) {
  if (!row) return null;
  const normalised = { ...row };

  // Role translation
  if (normalised.role === 'agent') normalised.role = 'employee';

  // Build virtual `name` if it wasn't produced by a CONCAT alias
  if (!normalised.name) {
    normalised.name = [normalised.first_name, normalised.last_name]
      .filter(Boolean)
      .join(' ') || '';
  }

  return normalised;
}

const normaliseRows = (rows) => rows.map(normaliseRow);

/* ─────────────────────────────────────────────────────────────
   Queries
   ───────────────────────────────────────────────────────────── */

/**
 * findByEmail — includes password_hash for bcrypt comparison.
 * ONLY used by login and changePassword flows.
 */
async function findByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT
       id, uuid, email, password_hash, first_name, last_name,
       CONCAT(first_name, ' ', last_name) AS name,
       role, phone, avatar_path, is_active, last_login_at,
       created_at, updated_at
     FROM users
     WHERE email = ? LIMIT 1`,
    [email]
  );
  return normaliseRow(rows[0] ?? null);
}

/** Find a user by primary key — no password_hash. */
async function findById(id) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE id = ? LIMIT 1`,
    [id]
  );
  return normaliseRow(rows[0] ?? null);
}

/** Find a user by uuid — no password_hash. */
async function findByUuid(uuid) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE uuid = ? LIMIT 1`,
    [uuid]
  );
  return normaliseRow(rows[0] ?? null);
}

/**
 * List all users with optional filters and pagination.
 * Search runs against first_name, last_name, and email.
 */
async function findAll({ role, is_active, search, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('role = ?');
    params.push(toDbRole(role));
  }
  if (is_active !== undefined) {
    conditions.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  if (search) {
    conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    params
  );

  const [rows] = await pool.execute(
    `${BASE_SELECT} ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows: normaliseRows(rows), total };
}

/**
 * Create a new user.
 *
 * @param {object} opts
 * @param {string} opts.uuid
 * @param {string} opts.first_name
 * @param {string} opts.last_name
 * @param {string} opts.email
 * @param {string} opts.passwordHash  — pre-hashed value
 * @param {string} opts.role          — external label (admin | employee)
 * @param {string} [opts.phone]
 */
async function create({ uuid, first_name, last_name, email, passwordHash, role, phone }) {
  const dbRole = toDbRole(role);
  const [result] = await pool.execute(
    `INSERT INTO users
       (uuid, first_name, last_name, email, password_hash, role, phone, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [uuid, first_name, last_name, email, passwordHash, dbRole, phone || null]
  );
  return findById(result.insertId);
}

/**
 * Update user fields (partial update — only provided keys are changed).
 * Accepts external field names; maps role and name internally.
 */
async function update(id, fields) {
  // Allowed DB columns (not password_hash — use updatePassword for that)
  const directColumns = ['email', 'phone', 'avatar_path', 'is_active'];
  const setClauses = [];
  const params = [];

  for (const col of directColumns) {
    if (fields[col] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(fields[col]);
    }
  }

  // Role: map external → DB value
  if (fields.role !== undefined) {
    setClauses.push('role = ?');
    params.push(toDbRole(fields.role));
  }

  // name convenience: accept either a combined "name" or separate parts
  if (fields.first_name !== undefined) {
    setClauses.push('first_name = ?');
    params.push(fields.first_name);
  }
  if (fields.last_name !== undefined) {
    setClauses.push('last_name = ?');
    params.push(fields.last_name);
  }
  // Support passing a single `name` string (split on first space)
  if (fields.name !== undefined && fields.first_name === undefined) {
    const parts = String(fields.name).trim().split(/\s+/);
    setClauses.push('first_name = ?', 'last_name = ?');
    params.push(parts[0] || '', parts.slice(1).join(' ') || '');
  }

  if (setClauses.length === 0) return findById(id);

  params.push(id);
  await pool.execute(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );
  return findById(id);
}

/**
 * Update a user's password hash.
 * @param {number} id
 * @param {string} passwordHash — bcrypt hash
 */
async function updatePassword(id, passwordHash) {
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, id]
  );
}

/** Record a successful login timestamp. */
async function recordLogin(id) {
  await pool.execute(
    'UPDATE users SET last_login_at = NOW() WHERE id = ?',
    [id]
  );
}

/** Soft-delete (deactivate) a user. */
async function deactivate(id) {
  await pool.execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
}

/** Hard-delete a user (admin only). */
async function remove(id) {
  await pool.execute('DELETE FROM users WHERE id = ?', [id]);
}

/**
 * Count users by role — used by the bootstrap check in authController.
 * @param {string} role — external label (admin | employee)
 */
async function countByRole(role) {
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM users WHERE role = ?',
    [toDbRole(role)]
  );
  return Number(count);
}

module.exports = {
  findByEmail,
  findById,
  findByUuid,
  findAll,
  create,
  update,
  updatePassword,
  recordLogin,
  deactivate,
  remove,
  countByRole,
};
