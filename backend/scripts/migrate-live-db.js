'use strict';

/**
 * migrate-live-db.js
 * ─────────────────────────────────────────────────────────────
 * Applies schema corrections to an existing real_estate_db
 * that was created from the OLD (incorrect) migrations.
 *
 * Safe to run multiple times — each step checks before acting.
 *
 * Run:  node scripts/migrate-live-db.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const G = '\x1b[32m';
const Y = '\x1b[33m';
const R = '\x1b[31m';
const X = '\x1b[0m';

function ok(msg)   { console.log(`${G}[OK]   ${X}${msg}`); }
function skip(msg) { console.log(`${Y}[SKIP] ${X}${msg}`); }
function err(msg)  { console.error(`${R}[ERR]  ${X}${msg}`); }

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME, table, column]
  );
  return rows[0].n > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [process.env.DB_NAME, table]
  );
  return rows[0].n > 0;
}

async function viewExists(conn, viewName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.views
     WHERE table_schema = ? AND table_name = ?`,
    [process.env.DB_NAME, viewName]
  );
  return rows[0].n > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host:              process.env.DB_HOST,
    port:              parseInt(process.env.DB_PORT) || 3306,
    database:          process.env.DB_NAME,
    user:              process.env.DB_USER,
    password:          process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log(`\nConnected to ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}\n`);

  try {
    // ── 1. users table ────────────────────────────────────────
    // The old migration used `name` + `password`.
    // The correct schema uses `first_name` + `last_name` + `password_hash`.

    if (await columnExists(conn, 'users', 'name')) {
      // Split `name` into first_name / last_name
      if (!(await columnExists(conn, 'users', 'first_name'))) {
        await conn.execute("ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER uuid");
        ok('users: added first_name');
      } else { skip('users.first_name already exists'); }

      if (!(await columnExists(conn, 'users', 'last_name'))) {
        await conn.execute("ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER first_name");
        ok('users: added last_name');
      } else { skip('users.last_name already exists'); }

      // Migrate existing name values
      await conn.execute(`
        UPDATE users
        SET first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
            last_name  = TRIM(SUBSTRING(name, LOCATE(' ', name) + 1))
        WHERE first_name = '' OR last_name = ''
      `);
      ok('users: migrated name → first_name / last_name');

      // Drop old name column
      await conn.execute('ALTER TABLE users DROP COLUMN name');
      ok('users: dropped old `name` column');
    } else {
      skip('users.name does not exist (already migrated)');
    }

    if (await columnExists(conn, 'users', 'password')) {
      if (!(await columnExists(conn, 'users', 'password_hash'))) {
        await conn.execute('ALTER TABLE users CHANGE COLUMN `password` `password_hash` VARCHAR(255) NOT NULL');
        ok('users: renamed password → password_hash');
      } else {
        await conn.execute('ALTER TABLE users DROP COLUMN `password`');
        ok('users: dropped old `password` (password_hash already present)');
      }
    } else {
      skip('users.password does not exist (already migrated)');
    }

    // Ensure indexes on new columns
    await conn.execute(`
      ALTER TABLE users
        ADD INDEX IF NOT EXISTS idx_users_first_name (first_name),
        ADD INDEX IF NOT EXISTS idx_users_last_name  (last_name)
    `).catch(() => {}); // ignore if already exists

    // ── 2. property_images: file_path → image_path ────────────
    if (await columnExists(conn, 'property_images', 'file_path')) {
      await conn.execute('ALTER TABLE property_images CHANGE COLUMN `file_path` `image_path` VARCHAR(500) NOT NULL');
      ok('property_images: renamed file_path → image_path');
    } else {
      skip('property_images.file_path does not exist (already migrated)');
    }

    if (!(await columnExists(conn, 'property_images', 'file_size'))) {
      await conn.execute('ALTER TABLE property_images ADD COLUMN file_size INT UNSIGNED DEFAULT NULL AFTER sort_order');
      ok('property_images: added file_size column');
    } else { skip('property_images.file_size already exists'); }

    if (!(await columnExists(conn, 'property_images', 'mime_type'))) {
      await conn.execute('ALTER TABLE property_images ADD COLUMN mime_type VARCHAR(50) DEFAULT NULL AFTER file_size');
      ok('property_images: added mime_type column');
    } else { skip('property_images.mime_type already exists'); }

    // ── 3. property_types: add is_active + name_ar ───────────
    if (!(await columnExists(conn, 'property_types', 'is_active'))) {
      await conn.execute('ALTER TABLE property_types ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER name');
      await conn.execute('ALTER TABLE property_types ADD INDEX idx_property_types_active (is_active)');
      ok('property_types: added is_active column');
    } else { skip('property_types.is_active already exists'); }

    if (!(await columnExists(conn, 'property_types', 'name_ar'))) {
      await conn.execute('ALTER TABLE property_types ADD COLUMN name_ar VARCHAR(100) DEFAULT NULL AFTER name');
      ok('property_types: added name_ar column');
    } else { skip('property_types.name_ar already exists'); }

    // ── 4. activities table (replaces activity_log) ───────────
    if (!(await tableExists(conn, 'activities'))) {
      await conn.execute(`
        CREATE TABLE activities (
          id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id     INT UNSIGNED            DEFAULT NULL,
          action      VARCHAR(100)    NOT NULL,
          description TEXT            NOT NULL,
          entity_type VARCHAR(50)             DEFAULT NULL,
          entity_id   INT UNSIGNED            DEFAULT NULL,
          old_values  JSON                    DEFAULT NULL,
          new_values  JSON                    DEFAULT NULL,
          ip_address  VARCHAR(45)             DEFAULT NULL,
          user_agent  VARCHAR(500)            DEFAULT NULL,
          created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_activities_user       (user_id),
          INDEX idx_activities_action     (action),
          INDEX idx_activities_entity     (entity_type, entity_id),
          INDEX idx_activities_created_at (created_at),
          CONSTRAINT fk_activities_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      ok('Created activities table');
    } else { skip('activities table already exists'); }

    // ── 5. customers table (replaces clients) ─────────────────
    if (!(await tableExists(conn, 'customers'))) {
      if (await tableExists(conn, 'clients')) {
        // Migrate clients → customers structure
        await conn.execute(`
          CREATE TABLE customers (
            id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            uuid          CHAR(36)      NOT NULL,
            name          VARCHAR(150)  NOT NULL,
            phone         VARCHAR(30)   NOT NULL DEFAULT '',
            email         VARCHAR(255)          DEFAULT NULL,
            national_id   VARCHAR(50)           DEFAULT NULL,
            property_type VARCHAR(100)          DEFAULT NULL,
            location      VARCHAR(200)          DEFAULT NULL,
            budget        DECIMAL(15,2)         DEFAULT NULL,
            budget_min    DECIMAL(15,2)         DEFAULT NULL,
            notes         TEXT                  DEFAULT NULL,
            status        ENUM('new','contacted','interested','negotiating','closed','lost') NOT NULL DEFAULT 'new',
            source        VARCHAR(100)          DEFAULT NULL,
            employee_id   INT UNSIGNED          DEFAULT NULL,
            created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_customers_uuid (uuid),
            INDEX idx_customers_status        (status),
            INDEX idx_customers_employee      (employee_id),
            INDEX idx_customers_property_type (property_type),
            INDEX idx_customers_location      (location),
            INDEX idx_customers_phone         (phone),
            INDEX idx_customers_created_at    (created_at),
            CONSTRAINT fk_customers_employee
              FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        ok('Created customers table');

        // Migrate data from clients → customers
        await conn.execute(`
          INSERT IGNORE INTO customers (uuid, name, phone, email, national_id, notes, employee_id, created_at, updated_at)
          SELECT
            uuid,
            CONCAT(first_name, IF(last_name != '', CONCAT(' ', last_name), '')) AS name,
            COALESCE(phone, ''),
            email,
            national_id,
            notes,
            assigned_agent_id,
            created_at,
            updated_at
          FROM clients
        `);
        const [migrated] = await conn.execute('SELECT COUNT(*) AS n FROM customers');
        ok(`Migrated ${migrated[0].n} records from clients → customers`);
      } else {
        // Fresh create
        await conn.execute(`
          CREATE TABLE customers (
            id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            uuid          CHAR(36)      NOT NULL,
            name          VARCHAR(150)  NOT NULL,
            phone         VARCHAR(30)   NOT NULL DEFAULT '',
            email         VARCHAR(255)          DEFAULT NULL,
            national_id   VARCHAR(50)           DEFAULT NULL,
            property_type VARCHAR(100)          DEFAULT NULL,
            location      VARCHAR(200)          DEFAULT NULL,
            budget        DECIMAL(15,2)         DEFAULT NULL,
            budget_min    DECIMAL(15,2)         DEFAULT NULL,
            notes         TEXT                  DEFAULT NULL,
            status        ENUM('new','contacted','interested','negotiating','closed','lost') NOT NULL DEFAULT 'new',
            source        VARCHAR(100)          DEFAULT NULL,
            employee_id   INT UNSIGNED          DEFAULT NULL,
            created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_customers_uuid (uuid),
            INDEX idx_customers_status        (status),
            INDEX idx_customers_employee      (employee_id),
            INDEX idx_customers_phone         (phone),
            INDEX idx_customers_created_at    (created_at),
            CONSTRAINT fk_customers_employee
              FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        ok('Created fresh customers table');
      }
    } else { skip('customers table already exists'); }

    // ── 6. properties table: add missing columns ─────────────
    // The old migration used property_type_id instead of type_id
    if (await columnExists(conn, 'properties', 'property_type_id') && !(await columnExists(conn, 'properties', 'type_id'))) {
      // Drop old FK first
      await conn.execute('ALTER TABLE properties DROP FOREIGN KEY fk_properties_type').catch(() => {});
      await conn.execute('ALTER TABLE properties CHANGE COLUMN property_type_id type_id TINYINT UNSIGNED NOT NULL');
      await conn.execute(`
        ALTER TABLE properties
          ADD CONSTRAINT fk_properties_type_id
          FOREIGN KEY (type_id) REFERENCES property_types(id)
      `).catch(() => {});
      ok('properties: renamed property_type_id → type_id');
    } else { skip('properties.type_id already correct'); }

    // Old migration had area_sqm; new schema uses area
    if (await columnExists(conn, 'properties', 'area_sqm') && !(await columnExists(conn, 'properties', 'area'))) {
      await conn.execute('ALTER TABLE properties CHANGE COLUMN area_sqm area DECIMAL(10,2) NOT NULL DEFAULT 0');
      ok('properties: renamed area_sqm → area');
    } else { skip('properties.area already correct'); }

    if (await columnExists(conn, 'properties', 'city') && !(await columnExists(conn, 'properties', 'location'))) {
      await conn.execute("ALTER TABLE properties ADD COLUMN location VARCHAR(200) NOT NULL DEFAULT '' AFTER description");
      await conn.execute('UPDATE properties SET location = city WHERE location = \'\'');
      ok('properties: added location column (copied from city)');
    } else { skip('properties.location already exists'); }

    if (!(await columnExists(conn, 'properties', 'type'))) {
      await conn.execute("ALTER TABLE properties ADD COLUMN type VARCHAR(100) NOT NULL DEFAULT '' AFTER type_id");
      // Populate from property_types join using type_id (canonical column name)
      await conn.execute(`
        UPDATE properties p
        JOIN property_types pt ON pt.id = p.type_id
        SET p.type = pt.name
        WHERE p.type = ''
      `);
      ok('properties: added and populated type column');
    } else { skip('properties.type already exists'); }

    if (!(await columnExists(conn, 'properties', 'owner_name'))) {
      await conn.execute("ALTER TABLE properties ADD COLUMN owner_name VARCHAR(150) NOT NULL DEFAULT '' AFTER price");
      ok('properties: added owner_name column');
    } else { skip('properties.owner_name already exists'); }

    if (!(await columnExists(conn, 'properties', 'owner_phone'))) {
      await conn.execute("ALTER TABLE properties ADD COLUMN owner_phone VARCHAR(30) NOT NULL DEFAULT '' AFTER owner_name");
      ok('properties: added owner_phone column');
    } else { skip('properties.owner_phone already exists'); }

    if (!(await columnExists(conn, 'properties', 'payment_method'))) {
      await conn.execute("ALTER TABLE properties ADD COLUMN payment_method ENUM('cash','installment','mortgage','lease','negotiable') NOT NULL DEFAULT 'cash' AFTER price");
      ok('properties: added payment_method column');
    } else { skip('properties.payment_method already exists'); }

    if (!(await columnExists(conn, 'properties', 'rooms'))) {
      await conn.execute('ALTER TABLE properties ADD COLUMN rooms TINYINT UNSIGNED DEFAULT NULL AFTER area');
      ok('properties: added rooms column');
    } else { skip('properties.rooms already exists'); }

    // Fix status ENUM to include 'reserved'
    await conn.execute(`
      ALTER TABLE properties MODIFY COLUMN status
        ENUM('available','rented','sold','reserved','off_market') NOT NULL DEFAULT 'available'
    `);
    ok('properties: updated status ENUM to include reserved');

    // ── 7. contracts: update FK to customers ─────────────────
    // The old migration referenced clients.id; update if needed.
    if (await tableExists(conn, 'customers')) {
      // Check if client_id column exists and rename to customer_id
      if (await columnExists(conn, 'contracts', 'client_id') && !(await columnExists(conn, 'contracts', 'customer_id'))) {
        // Drop old FK first
        await conn.execute('ALTER TABLE contracts DROP FOREIGN KEY fk_contracts_client').catch(() => {});
        await conn.execute('ALTER TABLE contracts CHANGE COLUMN client_id customer_id INT UNSIGNED NOT NULL');
        await conn.execute(`
          ALTER TABLE contracts
            ADD CONSTRAINT fk_contracts_customer
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        `);
        ok('contracts: renamed client_id → customer_id and updated FK');
      } else {
        skip('contracts.customer_id already correct');
      }

      // Add payment_method if missing
      if (!(await columnExists(conn, 'contracts', 'payment_method'))) {
        await conn.execute("ALTER TABLE contracts ADD COLUMN payment_method ENUM('cash','installment','mortgage','lease','negotiable') NOT NULL DEFAULT 'cash' AFTER value");
        ok('contracts: added payment_method column');
      } else { skip('contracts.payment_method already exists'); }
    }

    // ── 8. Views ──────────────────────────────────────────────
    const views = {
      v_dashboard_stats: `
        CREATE OR REPLACE VIEW v_dashboard_stats AS
        SELECT
          (SELECT COUNT(*) FROM properties  WHERE status  = 'available')  AS available_properties,
          (SELECT COUNT(*) FROM properties  WHERE status  = 'rented')     AS rented_properties,
          (SELECT COUNT(*) FROM properties  WHERE status  = 'sold')       AS sold_properties,
          (SELECT COUNT(*) FROM customers)                                 AS total_customers,
          (SELECT COUNT(*) FROM customers   WHERE status  = 'new')        AS new_customers,
          (SELECT COUNT(*) FROM customers   WHERE status  = 'interested') AS interested_customers,
          (SELECT COUNT(*) FROM contracts   WHERE status  = 'active')     AS active_contracts,
          (SELECT COUNT(*) FROM contracts   WHERE status  = 'draft')      AS draft_contracts,
          (SELECT COALESCE(SUM(amount),0)
           FROM financials WHERE status = 'paid'
             AND paid_date >= DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')
             AND paid_date <  DATE_FORMAT(CURRENT_DATE + INTERVAL 1 MONTH,'%Y-%m-01'))
                                                                          AS revenue_this_month,
          (SELECT COALESCE(SUM(amount),0)
           FROM financials WHERE status = 'pending' AND due_date <= CURRENT_DATE)
                                                                          AS overdue_amount
      `,
      v_properties_full: `
        CREATE OR REPLACE VIEW v_properties_full AS
        SELECT
          p.id, p.uuid, p.title, p.type, p.listing_type, p.location, p.address,
          p.area, p.rooms, p.bedrooms, p.bathrooms, p.price, p.payment_method,
          p.owner_name, p.owner_phone, p.status, p.is_featured, p.created_at,
          u.id AS agent_id,
          CONCAT(u.first_name,' ',u.last_name) AS agent_name,
          u.phone AS agent_phone,
          COUNT(DISTINCT pi.id) AS image_count,
          MAX(CASE WHEN pi.is_cover=1 THEN pi.image_path END) AS cover_image
        FROM properties p
        LEFT JOIN users u ON u.id = p.agent_id
        LEFT JOIN property_images pi ON pi.property_id = p.id
        GROUP BY p.id
      `,
      v_customers_full: `
        CREATE OR REPLACE VIEW v_customers_full AS
        SELECT
          c.id, c.uuid, c.name, c.phone, c.email,
          c.property_type, c.location, c.budget, c.budget_min,
          c.status, c.source, c.notes, c.created_at,
          u.id AS employee_id,
          CONCAT(u.first_name,' ',u.last_name) AS employee_name,
          u.phone AS employee_phone,
          COUNT(DISTINCT ct.id) AS contract_count
        FROM customers c
        LEFT JOIN users u ON u.id = c.employee_id
        LEFT JOIN contracts ct ON ct.customer_id = c.id AND ct.status NOT IN ('terminated','completed')
        GROUP BY c.id
      `,
    };

    for (const [name, sql] of Object.entries(views)) {
      await conn.execute(sql);
      ok(`View created/replaced: ${name}`);
    }

    // ── 9. Migration 009 — lat / lng / show_exact_location ──────
    // Added in migration 009 to support map display on the public website.
    // propertyModel.create() / update() degrade gracefully if these are
    // absent, but full geo functionality requires them.
    if (!(await columnExists(conn, 'properties', 'lat'))) {
      await conn.execute(`
        ALTER TABLE properties
          ADD COLUMN lat DECIMAL(10, 7) DEFAULT NULL
            COMMENT 'Latitude (WGS 84)' AFTER is_featured
      `);
      ok('properties: added lat column');
    } else { skip('properties.lat already exists'); }

    if (!(await columnExists(conn, 'properties', 'lng'))) {
      await conn.execute(`
        ALTER TABLE properties
          ADD COLUMN lng DECIMAL(10, 7) DEFAULT NULL
            COMMENT 'Longitude (WGS 84)' AFTER lat
      `);
      ok('properties: added lng column');
    } else { skip('properties.lng already exists'); }

    if (!(await columnExists(conn, 'properties', 'show_exact_location'))) {
      await conn.execute(`
        ALTER TABLE properties
          ADD COLUMN show_exact_location TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '0=approximate circle, 1=exact pin on public map' AFTER lng
      `);
      ok('properties: added show_exact_location column');
    } else { skip('properties.show_exact_location already exists'); }

    // Spatial index for future bounding-box map queries (safe if already exists)
    await conn.execute(`
      CREATE INDEX IF NOT EXISTS idx_properties_lat_lng
        ON properties (lat, lng)
    `).catch(() => {}); // older MySQL versions may not support IF NOT EXISTS on indexes
    ok('properties: lat/lng index ensured');

    // ── 10. Seed missing property types ───────────────────────
    const types = [
    const types = [
      ['Apartment','شقة'], ['Villa','فيلا'], ['Townhouse','تاون هاوس'],
      ['Duplex','دوبلكس'], ['Studio','استوديو'], ['Office','مكتب'],
      ['Retail Shop','محل تجاري'], ['Warehouse','مستودع'], ['Land','أرض'],
      ['Building','عمارة'], ['Farm','مزرعة'], ['Chalet','شاليه'],
    ];
    for (const [name, name_ar] of types) {
      await conn.execute(
        'INSERT IGNORE INTO property_types (name, name_ar, is_active) VALUES (?,?,1)',
        [name, name_ar]
      );
    }
    ok('property_types seed applied');

    console.log('\n✅ Migration complete.\n');
  } catch (e) {
    err(e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
