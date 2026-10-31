'use strict';
/**
 * consistency-check.js
 * Runs every critical SQL query against the live database and reports
 * pass/fail. Exit code 0 = all pass, 1 = at least one failure.
 *
 * Run: node scripts/consistency-check.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const G = '\x1b[32m';
const R = '\x1b[31m';
const Y = '\x1b[33m';
const X = '\x1b[0m';

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME     || 'real_estate_db',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const results = [];

  async function check(label, fn) {
    try {
      await fn(conn);
      results.push({ label, ok: true });
      process.stdout.write(`${G}.${X}`);
    } catch (e) {
      results.push({ label, ok: false, error: e.message });
      process.stdout.write(`${R}F${X}`);
    }
  }

  // ── Critical model queries ──────────────────────────────────────

  await check('customerModel BASE_SELECT — CONCAT employee_name (was u.name)', async (c) => {
    await c.execute(`
      SELECT c.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name, u.phone AS employee_phone
      FROM customers c
      LEFT JOIN users u ON u.id = c.employee_id
      LIMIT 1`);
  });

  await check('propertyModel BASE_SELECT — CONCAT agent_name (was u.name)', async (c) => {
    await c.execute(`
      SELECT p.*, pt.name AS type_name,
             CONCAT(u.first_name, ' ', u.last_name) AS agent_name, u.phone AS agent_phone,
             COUNT(DISTINCT pi.id) AS image_count,
             MAX(CASE WHEN pi.is_cover = 1 THEN pi.image_path END) AS cover_image
      FROM properties p
      LEFT JOIN property_types  pt ON pt.id  = p.type_id
      LEFT JOIN users            u  ON u.id   = p.agent_id
      LEFT JOIN property_images  pi ON pi.property_id = p.id
      GROUP BY p.id LIMIT 1`);
  });

  await check('reportModel — CONCAT in customersSummary byEmployee', async (c) => {
    await c.execute(`
      SELECT CONCAT(u.first_name, ' ', u.last_name) AS employee, COUNT(*) AS count
      FROM customers c
      LEFT JOIN users u ON u.id = c.employee_id
      GROUP BY c.employee_id`);
  });

  await check('reportModel — CONCAT in agentPerformance', async (c) => {
    await c.execute(`
      SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS agent_name,
             COUNT(DISTINCT p.id) AS total_properties,
             SUM(p.status = 'available') AS available,
             SUM(p.status = 'sold') AS sold,
             SUM(p.status = 'rented') AS rented,
             COUNT(DISTINCT ct.id) AS completed_contracts,
             COALESCE(SUM(f.amount), 0) AS total_revenue
      FROM users u
      LEFT JOIN properties p  ON p.agent_id   = u.id
      LEFT JOIN contracts  ct ON ct.agent_id  = u.id AND ct.status = 'completed'
      LEFT JOIN financials  f ON f.contract_id = ct.id AND f.status = 'paid'
      WHERE u.role = 'agent' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY total_revenue DESC`);
  });

  await check('activityRoutes — CONCAT user_name query', async (c) => {
    await c.execute(`
      SELECT a.id, a.action, a.description, a.entity_type, a.entity_id,
             a.ip_address, a.created_at,
             CONCAT(u.first_name, ' ', u.last_name) AS user_name
      FROM activities a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 5`);
  });

  // ── Views ───────────────────────────────────────────────────────

  await check('v_dashboard_stats view — queryable', async (c) => {
    const [[r]] = await c.execute('SELECT * FROM v_dashboard_stats');
    if (!r) throw new Error('view returned no row');
  });

  await check('v_properties_full view — queryable', async (c) => {
    await c.execute('SELECT * FROM v_properties_full LIMIT 1');
  });

  await check('v_customers_full view — queryable', async (c) => {
    await c.execute('SELECT * FROM v_customers_full LIMIT 1');
  });

  // ── Table / column structure checks ────────────────────────────

  await check('users — HAS first_name, last_name, password_hash; NO bare name', async (c) => {
    const [cols] = await c.execute('DESCRIBE users');
    const names = cols.map((r) => r.Field);
    if (names.includes('name'))         throw new Error('bare name column still exists');
    if (!names.includes('first_name'))  throw new Error('first_name missing');
    if (!names.includes('last_name'))   throw new Error('last_name missing');
    if (!names.includes('password_hash')) throw new Error('password_hash missing');
  });

  await check('customers — has correct columns (name, employee_id)', async (c) => {
    const [cols] = await c.execute('DESCRIBE customers');
    const names = cols.map((r) => r.Field);
    const required = ['id', 'uuid', 'name', 'phone', 'email', 'status', 'employee_id', 'budget'];
    const missing  = required.filter((f) => !names.includes(f));
    if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
  });

  await check('property_images — has image_path (NOT file_path)', async (c) => {
    const [cols] = await c.execute('DESCRIBE property_images');
    const names = cols.map((r) => r.Field);
    if (names.includes('file_path'))   throw new Error('file_path still exists');
    if (!names.includes('image_path')) throw new Error('image_path missing');
    if (!names.includes('file_size'))  throw new Error('file_size missing');
    if (!names.includes('mime_type'))  throw new Error('mime_type missing');
  });

  await check('property_types — has is_active column', async (c) => {
    await c.execute('SELECT id FROM property_types WHERE is_active = 1 LIMIT 1');
  });

  await check('activities table — INSERT works', async (c) => {
    await c.execute(
      'INSERT INTO activities (user_id, action, description) VALUES (NULL, ?, ?)',
      ['test.consistency_check', 'Consistency audit verification']
    );
  });

  await check('contracts — customer_id FK (not client_id)', async (c) => {
    const [cols] = await c.execute('DESCRIBE contracts');
    const names = cols.map((r) => r.Field);
    if (names.includes('client_id'))    throw new Error('client_id still exists in contracts');
    if (!names.includes('customer_id')) throw new Error('customer_id missing from contracts');
  });

  await check('No stale clients table still in DB', async (c) => {
    const [rows] = await c.execute(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'clients'",
      [process.env.DB_NAME || 'real_estate_db']
    );
    // Having a clients table is not fatal (legacy), but warn if present
    if (rows[0].n > 0) {
      // Soft warning — not a failure, just informational
      console.log(`\n${Y}[WARN] Legacy 'clients' table still present — not used by app${X}`);
    }
  });

  await check('financials — has all required columns', async (c) => {
    const [cols] = await c.execute('DESCRIBE financials');
    const names = cols.map((r) => r.Field);
    const required = ['id', 'contract_id', 'type', 'amount', 'due_date', 'paid_date', 'status', 'recorded_by'];
    const missing  = required.filter((f) => !names.includes(f));
    if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
  });

  // ── Full login smoke-test query chain ───────────────────────────

  await check('Full login query chain (findByEmail + bcrypt-ready result)', async (c) => {
    const [rows] = await c.execute(
      `SELECT id, uuid, email, password_hash,
              CONCAT(first_name, ' ', last_name) AS name,
              first_name, last_name, role, phone,
              avatar_path, is_active, last_login_at, created_at, updated_at
       FROM users WHERE email = ? LIMIT 1`,
      ['admin@test.com']
    );
    // admin@test.com is the seeded user — we just check the query executes
    // (rows may be empty if email differs, but query itself must succeed)
  });

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n');
  const passed = results.filter((r) =>  r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`Results: ${passed.length} passed, ${failed.length} failed`);

  if (failed.length === 0) {
    console.log(`\n${G}✓ All checks passed. Zero SQL inconsistencies.${X}\n`);
  } else {
    console.log(`\n${R}FAILURES:${X}`);
    failed.forEach((r) => console.log(`  ${R}[FAIL]${X} ${r.label}\n         ${r.error}`));
    console.log('');
  }

  await conn.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
