'use strict';

/**
 * customerModel.js
 * All SQL queries for the `customers` table.
 */

const { pool } = require('../config/database');

const BASE_SELECT = `
  SELECT
    c.*,
    CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
    u.phone                                AS employee_phone
  FROM customers c
  LEFT JOIN users u ON u.id = c.employee_id
`;

async function findById(id) {
  const [rows] = await pool.execute(`${BASE_SELECT} WHERE c.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function findByUuid(uuid) {
  const [rows] = await pool.execute(`${BASE_SELECT} WHERE c.uuid = ? LIMIT 1`, [uuid]);
  return rows[0] || null;
}

async function findAll({
  status, employee_id, property_type, location, search,
  page = 1, limit = 20, sort = 'created_at', order = 'DESC',
} = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (status)       { conditions.push('c.status = ?');          params.push(status); }
  if (employee_id)  { conditions.push('c.employee_id = ?');     params.push(employee_id); }
  if (property_type){ conditions.push('c.property_type = ?');   params.push(property_type); }
  if (location)     { conditions.push('c.location LIKE ?');     params.push(`%${location}%`); }
  if (search) {
    conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSort  = ['created_at','name','status','budget'].includes(sort) ? sort : 'created_at';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM customers c ${where}`, params
  );

  const [rows] = await pool.execute(
    `${BASE_SELECT} ${where} ORDER BY c.${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total };
}

async function create({
  uuid, name, phone, email, national_id,
  property_type, location, budget, budget_min,
  notes, status, source, employee_id,
}) {
  const [result] = await pool.execute(
    `INSERT INTO customers
       (uuid, name, phone, email, national_id,
        property_type, location, budget, budget_min,
        notes, status, source, employee_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uuid, name, phone, email || null, national_id || null,
      property_type || null, location || null,
      budget || null, budget_min || null,
      notes || null, status || 'new', source || null, employee_id || null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, fields) {
  const allowed = [
    'name','phone','email','national_id',
    'property_type','location','budget','budget_min',
    'notes','status','source','employee_id',
  ];
  const setClauses = [];
  const params = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }
  if (setClauses.length === 0) return findById(id);

  params.push(id);
  await pool.execute(
    `UPDATE customers SET ${setClauses.join(', ')} WHERE id = ?`, params
  );
  return findById(id);
}

async function updateStatus(id, status) {
  await pool.execute('UPDATE customers SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

async function assignEmployee(id, employee_id) {
  await pool.execute('UPDATE customers SET employee_id = ? WHERE id = ?', [employee_id, id]);
  return findById(id);
}

async function remove(id) {
  await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
}

/** Pipeline counts grouped by status. */
async function getPipelineCounts(employee_id) {
  const params = [];
  let where = '';
  if (employee_id) { where = 'WHERE employee_id = ?'; params.push(employee_id); }

  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM customers ${where} GROUP BY status`, params
  );
  return rows;
}

module.exports = {
  findById, findByUuid, findAll,
  create, update, updateStatus, assignEmployee, remove,
  getPipelineCounts,
};
