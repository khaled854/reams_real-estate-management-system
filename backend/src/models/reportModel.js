'use strict';

/**
 * reportModel.js
 * Read-only aggregate queries powering the reports module.
 */

const { pool } = require('../config/database');

/* ── Dashboard KPIs ───────────────────────────────────────── */
async function getDashboardStats() {
  const [[stats]] = await pool.execute('SELECT * FROM v_dashboard_stats');
  return stats;
}

/* ── Properties summary ───────────────────────────────────── */
async function getPropertiesSummary({ from_date, to_date, agent_id } = {}) {
  const conditions = [];
  const params = [];

  if (from_date) { conditions.push('p.created_at >= ?'); params.push(from_date); }
  if (to_date)   { conditions.push('p.created_at <= ?'); params.push(to_date); }
  if (agent_id)  { conditions.push('p.agent_id = ?');    params.push(agent_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total + by status
  const [byStatus] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM properties p ${where}
     GROUP BY status`,
    params
  );

  // Total + by type
  const [byType] = await pool.execute(
    `SELECT pt.name AS type, COUNT(*) AS count
     FROM properties p
     LEFT JOIN property_types pt ON pt.id = p.type_id
     ${where}
     GROUP BY pt.name`,
    params
  );

  // By listing_type
  const [byListingType] = await pool.execute(
    `SELECT listing_type, COUNT(*) AS count
     FROM properties p ${where}
     GROUP BY listing_type`,
    params
  );

  // Monthly trend (last 12 months)
  const [monthly] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM properties
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month ASC`
  );

  return { byStatus, byType, byListingType, monthly };
}

/* ── Customers summary ────────────────────────────────────── */
async function getCustomersSummary({ from_date, to_date, employee_id } = {}) {
  const conditions = [];
  const params = [];

  if (from_date)   { conditions.push('c.created_at >= ?');  params.push(from_date); }
  if (to_date)     { conditions.push('c.created_at <= ?');  params.push(to_date); }
  if (employee_id) { conditions.push('c.employee_id = ?');  params.push(employee_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [byStatus] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM customers c ${where} GROUP BY status`, params
  );

  const [byEmployee] = await pool.execute(
    `SELECT CONCAT_WS(' ', u.first_name, u.last_name) AS employee, COUNT(*) AS count
     FROM customers c
     LEFT JOIN users u ON u.id = c.employee_id
     ${where}
     GROUP BY c.employee_id`,
    params
  );

  const [monthly] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM customers
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month ASC`
  );

  return { byStatus, byEmployee, monthly };
}

/* ── Financial summary ────────────────────────────────────── */
async function getFinancialSummary({ from_date, to_date } = {}) {
  const conditions = [];
  const params = [];

  if (from_date) { conditions.push('f.created_at >= ?'); params.push(from_date); }
  if (to_date)   { conditions.push('f.created_at <= ?'); params.push(to_date); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [byType] = await pool.execute(
    `SELECT type, status, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM financials f ${where}
     GROUP BY type, status`,
    params
  );

  const [monthly] = await pool.execute(
    `SELECT DATE_FORMAT(paid_date, '%Y-%m') AS month,
            COALESCE(SUM(amount), 0) AS revenue
     FROM financials
     WHERE status = 'paid'
       AND paid_date IS NOT NULL
       AND paid_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month ASC`
  );

  const [[totals]] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'paid'    THEN amount ELSE 0 END), 0) AS total_paid,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending,
       COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) AS total_overdue
     FROM financials`
  );

  return { byType, monthly, totals };
}

/* ── Agent performance ────────────────────────────────────── */
async function getAgentPerformance({ from_date, to_date } = {}) {
  const params = [];
  const dateFilter = [];

  if (from_date) { dateFilter.push('p.created_at >= ?'); params.push(from_date); }
  if (to_date)   { dateFilter.push('p.created_at <= ?'); params.push(to_date); }
  const df = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT
       u.id, CONCAT_WS(' ', u.first_name, u.last_name) AS agent_name,
       COUNT(DISTINCT p.id)                          AS total_properties,
       COALESCE(SUM(p.status = 'available'), 0)      AS available,
       COALESCE(SUM(p.status = 'sold'), 0)           AS sold,
       COALESCE(SUM(p.status = 'rented'), 0)         AS rented,
       COUNT(DISTINCT ct.id)                         AS completed_contracts,
       COALESCE(SUM(f.amount), 0)                    AS total_revenue
     FROM users u
     LEFT JOIN properties p
            ON p.agent_id = u.id ${df}
     LEFT JOIN contracts ct
            ON ct.agent_id = u.id AND ct.status = 'completed'
     LEFT JOIN financials f
            ON f.contract_id = ct.id AND f.status = 'paid'
     WHERE u.role = 'agent' AND u.is_active = 1
     GROUP BY u.id
     ORDER BY total_revenue DESC`,
    params
  );
  return rows;
}

module.exports = {
  getDashboardStats,
  getPropertiesSummary,
  getCustomersSummary,
  getFinancialSummary,
  getAgentPerformance,
};
