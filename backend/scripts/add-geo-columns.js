'use strict';

/**
 * add-geo-columns.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Applies migration 009 — adds lat, lng, show_exact_location to the
 * `properties` table so the server stops throwing:
 *   ER_BAD_FIELD_ERROR: Unknown column 'lat' in 'field list'
 *
 * WHY THIS SCRIPT EXISTS:
 * migration 009 was added after some databases were already created.
 * propertyModel.create() and update() now degrade gracefully if these
 * columns are absent, but you lose GPS / map functionality until the
 * migration is applied.  Running this script once restores full support.
 *
 * SAFE TO RUN MULTIPLE TIMES — each ALTER TABLE checks before acting.
 *
 * Usage (run from the backend/ directory):
 *   node scripts/add-geo-columns.js
 *
 * Or from the project root:
 *   node backend/scripts/add-geo-columns.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

/* ── ANSI colour helpers ─────────────────────────────────────── */
const G = '\x1b[32m'; const Y = '\x1b[33m';
const R = '\x1b[31m'; const X = '\x1b[0m';
const ok   = (msg) => console.log(`${G}  ✓  ${X}${msg}`);
const skip = (msg) => console.log(`${Y}  –  ${X}${msg} (already exists)`);
const fail = (msg) => console.error(`${R}  ✗  ${X}${msg}`);

/* ── Column-existence helper ─────────────────────────────────── */
async function has(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, table, column]
  );
  return rows[0].n > 0;
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  /* ── Connect ─────────────────────────────────────────────── */
  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || '127.0.0.1',
      port:     parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME     || 'real_estate_db',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
    });
  } catch (e) {
    fail(`Cannot connect to MySQL: ${e.message}`);
    fail('Make sure MySQL (XAMPP) is running and backend/.env has the correct DB_* values.');
    process.exit(1);
  }

  const db = `${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`;
  console.log(`\n${G}Migration 009 — add geo columns to properties${X}`);
  console.log(`Database: ${db}\n`);

  let changed = 0;

  try {
    /* ── lat ─────────────────────────────────────────────────── */
    if (await has(conn, 'properties', 'lat')) {
      skip('properties.lat');
    } else {
      await conn.execute(`
        ALTER TABLE \`properties\`
          ADD COLUMN \`lat\` DECIMAL(10, 7) DEFAULT NULL
            COMMENT 'Latitude (WGS 84, e.g. 24.6877)'
            AFTER \`is_featured\`
      `);
      ok('properties.lat added');
      changed++;
    }

    /* ── lng ─────────────────────────────────────────────────── */
    if (await has(conn, 'properties', 'lng')) {
      skip('properties.lng');
    } else {
      await conn.execute(`
        ALTER TABLE \`properties\`
          ADD COLUMN \`lng\` DECIMAL(10, 7) DEFAULT NULL
            COMMENT 'Longitude (WGS 84, e.g. 46.7219)'
            AFTER \`lat\`
      `);
      ok('properties.lng added');
      changed++;
    }

    /* ── show_exact_location ─────────────────────────────────── */
    if (await has(conn, 'properties', 'show_exact_location')) {
      skip('properties.show_exact_location');
    } else {
      await conn.execute(`
        ALTER TABLE \`properties\`
          ADD COLUMN \`show_exact_location\` TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '0 = show approximate circle on public map, 1 = exact pin'
            AFTER \`lng\`
      `);
      ok('properties.show_exact_location added');
      changed++;
    }

    /* ── Spatial index ───────────────────────────────────────── */
    // Use information_schema to check before creating — CREATE INDEX IF NOT EXISTS
    // is MySQL 8.0+ only; this approach also works on 5.7.
    const [idxRows] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'properties'
         AND INDEX_NAME   = 'idx_properties_lat_lng'`,
      [process.env.DB_NAME]
    );
    if (idxRows[0].n > 0) {
      skip('idx_properties_lat_lng index');
    } else {
      await conn.execute(
        'CREATE INDEX `idx_properties_lat_lng` ON `properties` (`lat`, `lng`)'
      );
      ok('idx_properties_lat_lng index created');
      changed++;
    }

    /* ── Summary ─────────────────────────────────────────────── */
    console.log('');
    if (changed === 0) {
      console.log(`${Y}Nothing to do — migration 009 was already applied.${X}`);
    } else {
      console.log(`${G}✅  Migration 009 applied — ${changed} change(s) made.${X}`);
      console.log(`\n${Y}Next step:${X} restart the backend server so it detects the new columns:`);
      console.log('  cd backend && npm start\n');
    }

  } catch (e) {
    fail(`Migration failed: ${e.message}`);
    console.error(e.stack);
    process.exitCode = 1;

  } finally {
    await conn.end();
  }
}

main();
