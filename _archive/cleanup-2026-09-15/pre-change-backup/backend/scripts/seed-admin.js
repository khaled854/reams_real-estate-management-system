'use strict';

/**
 * scripts/seed-admin.js
 * ─────────────────────────────────────────────────────────────
 * Creates the default admin user if it does not already exist.
 *
 * Reads DB credentials from the .env file in the backend root.
 * Uses the same bcryptjs + mysql2 packages the application uses,
 * so the hash is 100% compatible with the login flow.
 *
 * Usage (run from the backend directory):
 *   node scripts/seed-admin.js
 *   npm run seed
 *
 * !! IMPORTANT FOR PRODUCTION !!
 * The credentials below are DEFAULT values for first-time setup only.
 * You MUST change the email and password immediately after first login,
 * or edit ADMIN.email / ADMIN.password in this file before running it
 * on the production server.
 *
 * Default credentials (CHANGE BEFORE DELIVERY):
 *   Email    : admin@test.com
 *   Password : Admin@123456
 *   Role     : admin
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();          // load .env from backend root

const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Credentials to seed ──────────────────────────────────────
const ADMIN = {
  first_name: 'Admin',
  last_name:  'User',
  email:      'admin@test.com',
  password:   'Admin@123456',
  role:       'admin',            // stored as 'admin' in DB ENUM
  phone:      null,
};

// ── Helpers ──────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

function log(colour, prefix, msg) {
  console.log(`${colour}[seed] ${prefix}${RESET} ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  // Validate required env vars before trying to connect
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
  const missing  = required.filter((k) => !process.env[k]);
  if (missing.length) {
    log(RED, 'ERROR', `Missing env vars: ${missing.join(', ')}`);
    log(RED, 'ERROR', 'Make sure you are running this script from the backend directory');
    log(RED, 'ERROR', 'and that the .env file exists.');
    process.exit(1);
  }

  const pool = mysql.createPool({
    host:              process.env.DB_HOST,
    port:              parseInt(process.env.DB_PORT) || 3306,
    database:          process.env.DB_NAME,
    user:              process.env.DB_USER,
    password:          process.env.DB_PASSWORD || '',
    connectionLimit:   3,
    waitForConnections: true,
  });

  let conn;
  try {
    // ── 1. Test the connection ────────────────────────────────
    conn = await pool.getConnection();
    log(GREEN, 'DB', `Connected to ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);

    // ── 2. Check if admin already exists ─────────────────────
    const [existing] = await conn.execute(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [ADMIN.email]
    );

    if (existing.length > 0) {
      log(YELLOW, 'SKIP', `User '${ADMIN.email}' already exists (id=${existing[0].id}). No changes made.`);
      log(YELLOW, 'SKIP', 'If you need to reset the password, run: npm run seed:reset');
      return;
    }

    // ── 3. Hash the password (cost=12, same as application) ──
    log(GREEN, 'HASH', 'Hashing password with bcrypt (cost=12)…');
    const passwordHash = await bcrypt.hash(ADMIN.password, 12);

    // ── 4. Insert the admin user ──────────────────────────────
    const uuid = uuidv4();
    const [result] = await conn.execute(
      `INSERT INTO users
         (uuid, first_name, last_name, email, password_hash, role, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        uuid,
        ADMIN.first_name,
        ADMIN.last_name,
        ADMIN.email,
        passwordHash,
        ADMIN.role,
        ADMIN.phone,
      ]
    );

    log(GREEN, 'INSERT', `Admin user created successfully (id=${result.insertId}, uuid=${uuid})`);

    // ── 5. Verify the insert ──────────────────────────────────
    const [verify] = await conn.execute(
      `SELECT id, uuid, email, first_name, last_name, role, is_active, created_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    if (verify.length > 0) {
      const u = verify[0];
      log(GREEN, 'VERIFY', 'Row confirmed in database:');
      console.log(`
  ┌──────────────────────────────────────────────┐
  │  id          : ${String(u.id).padEnd(29)}│
  │  uuid        : ${u.uuid}  │
  │  email       : ${String(u.email).padEnd(29)}│
  │  name        : ${String(`${u.first_name} ${u.last_name}`).padEnd(29)}│
  │  role        : ${String(u.role).padEnd(29)}│
  │  is_active   : ${String(u.is_active).padEnd(29)}│
  │  created_at  : ${String(u.created_at).padEnd(29)}│
  └──────────────────────────────────────────────┘`);
    }

    // ── 6. Summary ───────────────────────────────────────────
    console.log(`
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
${GREEN} Admin credentials ready — use these to log in:${RESET}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
  Email    : ${ADMIN.email}
  Password : ${ADMIN.password}
  Role     : ${ADMIN.role}
  URL      : http://localhost:5000/login
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
`);

  } catch (err) {
    log(RED, 'ERROR', err.message);

    // Friendly hints for common errors
    if (err.code === 'ECONNREFUSED') {
      log(RED, 'HINT', `MySQL is not running or not reachable on port ${process.env.DB_PORT}.`);
      log(RED, 'HINT', 'Make sure MySQL / XAMPP is started before running this script.');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      log(RED, 'HINT', 'Wrong DB_USER or DB_PASSWORD in .env');
    }
    if (err.code === 'ER_BAD_DB_ERROR') {
      log(RED, 'HINT', `Database '${process.env.DB_NAME}' does not exist. Create it first.`);
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      log(RED, 'HINT', "Table 'users' does not exist. Run your schema SQL file first.");
    }
    if (err.code === 'ER_DUP_ENTRY') {
      log(RED, 'HINT', `A user with email '${ADMIN.email}' already exists (duplicate key).`);
    }

    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
