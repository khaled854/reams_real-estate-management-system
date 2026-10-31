-- =============================================================================
-- Real Estate Management System — database.sql
-- Single-file complete schema  ·  MySQL 8.x
-- =============================================================================
-- Run order (all in this file, top-to-bottom):
--   1. Database & user bootstrap
--   2. Tables (dependency order)
--   3. Views
--   4. Stored procedures & functions
--   5. Triggers
--   6. Seed data
--
-- Usage:
--   mysql -u root -p < database/database.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Safety settings for import
-- ---------------------------------------------------------------------------
SET NAMES utf8mb4;
SET @OLD_UNIQUE_CHECKS    = @@UNIQUE_CHECKS,    UNIQUE_CHECKS    = 0;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_MODE = @@SQL_MODE,
    SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =============================================================================
-- SECTION 1 — DATABASE & USER BOOTSTRAP
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `real_estate_db`
  CHARACTER SET  utf8mb4
  COLLATE        utf8mb4_unicode_ci;

-- Application user (change the password before running in production)
CREATE USER IF NOT EXISTS 'rems_user'@'localhost'
  IDENTIFIED BY 'Change_Me_Str0ng!';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON `real_estate_db`.* TO 'rems_user'@'localhost';

FLUSH PRIVILEGES;

USE `real_estate_db`;

-- =============================================================================
-- SECTION 2 — TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: roles  (lookup — admin | manager | agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)      NOT NULL,
  `label`       VARCHAR(100)     NOT NULL,
  `description` VARCHAR(255)     DEFAULT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='User role lookup table';

-- ---------------------------------------------------------------------------
-- TABLE: users
--
-- Column decisions (CANONICAL — all models/controllers must match this):
--   · first_name / last_name  — split fields, NOT a single `name` column
--   · password_hash           — bcrypt hash, NOT `password`
--   · role ENUM               — 'admin' | 'manager' | 'agent'
--     The backend normalises 'agent' → 'employee' for the API layer.
--   · uuid                    — URL-safe public identifier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `uuid`          CHAR(36)        NOT NULL,
  `email`         VARCHAR(255)    NOT NULL,
  `password_hash` VARCHAR(255)    NOT NULL            COMMENT 'bcrypt hash (cost ≥ 12)',
  `first_name`    VARCHAR(100)    NOT NULL,
  `last_name`     VARCHAR(100)    NOT NULL            DEFAULT '',
  `phone`         VARCHAR(30)             DEFAULT NULL,
  `role`          ENUM('admin','manager','agent')
                                  NOT NULL DEFAULT 'agent',
  `avatar_path`   VARCHAR(500)            DEFAULT NULL,
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `last_login_at` DATETIME                DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_uuid`  (`uuid`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_role`      (`role`),
  INDEX `idx_users_active`    (`is_active`),
  INDEX `idx_users_first_name`(`first_name`),
  INDEX `idx_users_last_name` (`last_name`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='System users — admins, managers, agents';

-- ---------------------------------------------------------------------------
-- TABLE: property_types
--
-- Separate lookup table (not ENUM) so new types can be added without ALTER.
-- is_active column required — backend filters WHERE is_active = 1.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `property_types` (
  `id`         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)     NOT NULL,
  `name_ar`    VARCHAR(100)             DEFAULT NULL,
  `is_active`  TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_property_types_name` (`name`),
  INDEX `idx_property_types_active`   (`is_active`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Property category lookup';

-- ---------------------------------------------------------------------------
-- TABLE: properties
--
-- Key design decisions (must match propertyModel.js):
--   · type_id         — FK to property_types
--   · type            — denormalised type name (fast reads, no JOIN needed)
--   · location        — free-text city/district (indexed for LIKE search)
--   · area            — surface area in m² (NOT area_sqm)
--   · rooms           — total room count
--   · payment_method  — transaction type
--   · owner_name / owner_phone — direct owner contact
--   · status ENUM includes 'reserved' (required by propertyValidator.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `properties` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `uuid`           CHAR(36)         NOT NULL,
  `type_id`        TINYINT UNSIGNED NOT NULL,
  `type`           VARCHAR(100)     NOT NULL,
  `title`          VARCHAR(255)     NOT NULL,
  `description`    TEXT                     DEFAULT NULL,
  `location`       VARCHAR(200)     NOT NULL,
  `address`        VARCHAR(500)     NOT NULL,
  `area`           DECIMAL(10,2)    NOT NULL,
  `rooms`          TINYINT UNSIGNED         DEFAULT NULL,
  `bedrooms`       TINYINT UNSIGNED         DEFAULT NULL,
  `bathrooms`      TINYINT UNSIGNED         DEFAULT NULL,
  `floor`          SMALLINT                 DEFAULT NULL,
  `price`          DECIMAL(15,2)    NOT NULL,
  `payment_method` ENUM('cash','installment','mortgage','lease','negotiable')
                                   NOT NULL DEFAULT 'cash',
  `owner_name`     VARCHAR(150)     NOT NULL,
  `owner_phone`    VARCHAR(30)      NOT NULL,
  `listing_type`   ENUM('sale','rent','both') NOT NULL DEFAULT 'sale',
  `status`         ENUM('available','rented','sold','reserved','off_market')
                                   NOT NULL DEFAULT 'available',
  `is_featured`    TINYINT(1)       NOT NULL DEFAULT 0,
  `agent_id`       INT UNSIGNED             DEFAULT NULL,
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY  `uq_properties_uuid`       (`uuid`),
  INDEX `idx_properties_type_id`         (`type_id`),
  INDEX `idx_properties_status`          (`status`),
  INDEX `idx_properties_listing_type`    (`listing_type`),
  INDEX `idx_properties_location`        (`location`),
  INDEX `idx_properties_price`           (`price`),
  INDEX `idx_properties_agent`           (`agent_id`),
  INDEX `idx_properties_is_featured`     (`is_featured`),
  INDEX `idx_properties_created_at`      (`created_at`),
  INDEX `idx_properties_status_type`     (`status`, `type_id`),
  CONSTRAINT `fk_properties_type_id`
    FOREIGN KEY (`type_id`) REFERENCES `property_types`(`id`),
  CONSTRAINT `fk_properties_agent`
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Core property listings';

-- ---------------------------------------------------------------------------
-- TABLE: property_images
--
-- Column: image_path  (NOT file_path — must match propertyModel.js addImage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `property_images` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `image_path`  VARCHAR(500) NOT NULL            COMMENT 'Relative path under uploads/properties/',
  `is_cover`    TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`  SMALLINT     NOT NULL DEFAULT 0,
  `file_size`   INT UNSIGNED         DEFAULT NULL,
  `mime_type`   VARCHAR(50)          DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_images_property_id` (`property_id`),
  INDEX `idx_images_is_cover`    (`property_id`, `is_cover`),
  CONSTRAINT `fk_images_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Property photo gallery';

-- ---------------------------------------------------------------------------
-- TABLE: customers  (CRM leads — distinct from system users)
--
-- Key design decisions (must match customerModel.js):
--   · name         — single full-name field (NOT first_name/last_name)
--   · employee_id  — FK to users (assigned agent)
--   · status ENUM  — matches customerValidator.js exactly
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `uuid`          CHAR(36)      NOT NULL,
  `name`          VARCHAR(150)  NOT NULL,
  `phone`         VARCHAR(30)   NOT NULL,
  `email`         VARCHAR(255)          DEFAULT NULL,
  `national_id`   VARCHAR(50)           DEFAULT NULL,
  `property_type` VARCHAR(100)          DEFAULT NULL,
  `location`      VARCHAR(200)          DEFAULT NULL,
  `budget`        DECIMAL(15,2)         DEFAULT NULL,
  `budget_min`    DECIMAL(15,2)         DEFAULT NULL,
  `notes`         TEXT                  DEFAULT NULL,
  `status`        ENUM('new','contacted','interested','negotiating','closed','lost')
                                NOT NULL DEFAULT 'new',
  `source`        VARCHAR(100)          DEFAULT NULL,
  `employee_id`   INT UNSIGNED          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY  `uq_customers_uuid`     (`uuid`),
  INDEX `idx_customers_status`        (`status`),
  INDEX `idx_customers_employee`      (`employee_id`),
  INDEX `idx_customers_property_type` (`property_type`),
  INDEX `idx_customers_location`      (`location`),
  INDEX `idx_customers_phone`         (`phone`),
  INDEX `idx_customers_created_at`    (`created_at`),
  CONSTRAINT `fk_customers_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='CRM customer / lead records';

-- ---------------------------------------------------------------------------
-- TABLE: contracts
--
-- Key design decisions (must match future contractModel.js):
--   · customer_id  — FK to customers (NOT clients)
--   · payment_method column — consistent with properties table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contracts` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `uuid`            CHAR(36)      NOT NULL,
  `contract_number` VARCHAR(50)   NOT NULL,
  `property_id`     INT UNSIGNED  NOT NULL,
  `customer_id`     INT UNSIGNED  NOT NULL,
  `agent_id`        INT UNSIGNED          DEFAULT NULL,
  `type`            ENUM('sale','lease')  NOT NULL,
  `start_date`      DATE          NOT NULL,
  `end_date`        DATE                  DEFAULT NULL,
  `value`           DECIMAL(15,2) NOT NULL,
  `payment_method`  ENUM('cash','installment','mortgage','lease','negotiable')
                                  NOT NULL DEFAULT 'cash',
  `payment_terms`   TEXT                  DEFAULT NULL,
  `status`          ENUM('draft','active','expired','terminated','completed')
                                  NOT NULL DEFAULT 'draft',
  `document_path`   VARCHAR(500)          DEFAULT NULL,
  `notes`           TEXT                  DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY  `uq_contracts_uuid`    (`uuid`),
  UNIQUE KEY  `uq_contracts_number`  (`contract_number`),
  INDEX `idx_contracts_property`     (`property_id`),
  INDEX `idx_contracts_customer`     (`customer_id`),
  INDEX `idx_contracts_agent`        (`agent_id`),
  INDEX `idx_contracts_status`       (`status`),
  INDEX `idx_contracts_type`         (`type`),
  INDEX `idx_contracts_start_date`   (`start_date`),
  CONSTRAINT `fk_contracts_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`),
  CONSTRAINT `fk_contracts_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_contracts_agent`
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Sale and lease contract agreements';

-- ---------------------------------------------------------------------------
-- TABLE: financials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `financials` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `contract_id`  INT UNSIGNED  NOT NULL,
  `type`         ENUM('payment','refund','commission','expense','deposit')
                               NOT NULL,
  `amount`       DECIMAL(15,2) NOT NULL,
  `due_date`     DATE                  DEFAULT NULL,
  `paid_date`    DATE                  DEFAULT NULL,
  `status`       ENUM('pending','paid','overdue','cancelled')
                               NOT NULL DEFAULT 'pending',
  `reference`    VARCHAR(100)          DEFAULT NULL,
  `notes`        TEXT                  DEFAULT NULL,
  `recorded_by`  INT UNSIGNED          DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_financials_contract`         (`contract_id`),
  INDEX `idx_financials_status`           (`status`),
  INDEX `idx_financials_due_date`         (`due_date`),
  INDEX `idx_financials_status_paid_date` (`status`, `paid_date`),
  INDEX `idx_financials_type`             (`type`),
  INDEX `idx_financials_recorded`         (`recorded_by`),
  CONSTRAINT `fk_financials_contract`
    FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`),
  CONSTRAINT `fk_financials_user`
    FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Financial transactions linked to contracts';

-- ---------------------------------------------------------------------------
-- TABLE: activities  (audit trail — append-only)
--
-- This is the canonical name used by activityLogger.js.
-- Columns must match the INSERT in activityLogger.js exactly:
--   user_id, action, description, entity_type, entity_id,
--   old_values, new_values, ip_address, user_agent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activities` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED            DEFAULT NULL,
  `action`      VARCHAR(100)    NOT NULL,
  `description` TEXT            NOT NULL,
  `entity_type` VARCHAR(50)             DEFAULT NULL,
  `entity_id`   INT UNSIGNED            DEFAULT NULL,
  `old_values`  JSON                    DEFAULT NULL,
  `new_values`  JSON                    DEFAULT NULL,
  `ip_address`  VARCHAR(45)             DEFAULT NULL,
  `user_agent`  VARCHAR(500)            DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_activities_user`       (`user_id`),
  INDEX `idx_activities_action`     (`action`),
  INDEX `idx_activities_entity`     (`entity_type`, `entity_id`),
  INDEX `idx_activities_created_at` (`created_at`),
  CONSTRAINT `fk_activities_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable audit trail — append only, never update or delete';

-- =============================================================================
-- SECTION 3 — VIEWS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- VIEW: v_properties_full
-- Properties with type name, agent full name, image count, and cover image.
-- Uses CONCAT(first_name,' ',last_name) to build agent display name.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_properties_full` AS
SELECT
  p.id,
  p.uuid,
  p.title,
  p.type,
  p.listing_type,
  p.location,
  p.address,
  p.area,
  p.rooms,
  p.bedrooms,
  p.bathrooms,
  p.price,
  p.payment_method,
  p.owner_name,
  p.owner_phone,
  p.status,
  p.is_featured,
  p.created_at,
  -- Agent details (built from split name columns)
  u.id                                                      AS agent_id,
  CONCAT(u.first_name, ' ', u.last_name)                   AS agent_name,
  u.phone                                                   AS agent_phone,
  -- Gallery
  COUNT(DISTINCT pi.id)                                     AS image_count,
  MAX(CASE WHEN pi.is_cover = 1 THEN pi.image_path END)    AS cover_image
FROM      `properties`      p
LEFT JOIN `users`           u  ON u.id  = p.agent_id
LEFT JOIN `property_images` pi ON pi.property_id = p.id
GROUP BY  p.id;

-- ---------------------------------------------------------------------------
-- VIEW: v_customers_full
-- Customers with assigned employee full name and open contract count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_customers_full` AS
SELECT
  c.id,
  c.uuid,
  c.name,
  c.phone,
  c.email,
  c.property_type,
  c.location,
  c.budget,
  c.budget_min,
  c.status,
  c.source,
  c.notes,
  c.created_at,
  u.id                                    AS employee_id,
  CONCAT(u.first_name, ' ', u.last_name)  AS employee_name,
  u.phone                                 AS employee_phone,
  COUNT(DISTINCT ct.id)                   AS contract_count
FROM      `customers` c
LEFT JOIN `users`     u  ON u.id  = c.employee_id
LEFT JOIN `contracts` ct ON ct.customer_id = c.id
                         AND ct.status NOT IN ('terminated','completed')
GROUP BY  c.id;

-- ---------------------------------------------------------------------------
-- VIEW: v_dashboard_stats
-- Single-row KPI snapshot used by reportModel.getDashboardStats().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_dashboard_stats` AS
SELECT
  (SELECT COUNT(*) FROM `properties` WHERE status = 'available')  AS available_properties,
  (SELECT COUNT(*) FROM `properties` WHERE status = 'rented')     AS rented_properties,
  (SELECT COUNT(*) FROM `properties` WHERE status = 'sold')       AS sold_properties,
  (SELECT COUNT(*) FROM `customers`)                              AS total_customers,
  (SELECT COUNT(*) FROM `customers`  WHERE status = 'new')        AS new_customers,
  (SELECT COUNT(*) FROM `customers`  WHERE status = 'interested') AS interested_customers,
  (SELECT COUNT(*) FROM `contracts`  WHERE status = 'active')     AS active_contracts,
  (SELECT COUNT(*) FROM `contracts`  WHERE status = 'draft')      AS draft_contracts,
  /* Sargable range predicate — uses idx_financials_status_paid_date */
  (SELECT COALESCE(SUM(amount), 0)
   FROM `financials`
   WHERE status    = 'paid'
     AND paid_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
     AND paid_date <  DATE_FORMAT(CURRENT_DATE + INTERVAL 1 MONTH, '%Y-%m-01'))
                                                                  AS revenue_this_month,
  (SELECT COALESCE(SUM(amount), 0)
   FROM `financials`
   WHERE status   = 'pending'
     AND due_date <= CURRENT_DATE)                                 AS overdue_amount;

-- =============================================================================
-- SECTION 4 — STORED PROCEDURES & FUNCTIONS
-- =============================================================================

DELIMITER $$

-- ---------------------------------------------------------------------------
-- FUNCTION: fn_next_contract_number
-- Generates the next contract number:  CNT-YYYY-NNNN
-- ---------------------------------------------------------------------------
CREATE FUNCTION IF NOT EXISTS `fn_next_contract_number`()
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE v_year  CHAR(4);
  DECLARE v_count INT;
  SET v_year  = YEAR(CURRENT_DATE);
  SELECT COUNT(*) + 1
    INTO v_count
    FROM `contracts`
   WHERE YEAR(created_at) = v_year;
  RETURN CONCAT('CNT-', v_year, '-', LPAD(v_count, 4, '0'));
END$$

-- ---------------------------------------------------------------------------
-- PROCEDURE: sp_get_agent_performance
-- ---------------------------------------------------------------------------
CREATE PROCEDURE IF NOT EXISTS `sp_get_agent_performance`(
  IN p_agent_id  INT UNSIGNED,
  IN p_from_date DATE,
  IN p_to_date   DATE
)
BEGIN
  SELECT
    u.id,
    CONCAT(u.first_name, ' ', u.last_name)  AS agent_name,
    COUNT(DISTINCT p.id)                    AS total_properties,
    SUM(p.status = 'available')             AS available,
    SUM(p.status = 'sold')                  AS sold,
    SUM(p.status = 'rented')                AS rented,
    COUNT(DISTINCT ct.id)                   AS total_contracts,
    COALESCE(SUM(f.amount), 0)              AS total_revenue
  FROM            `users`       u
  LEFT JOIN       `properties`  p
               ON p.agent_id   = u.id
              AND p.created_at BETWEEN p_from_date AND p_to_date
  LEFT JOIN       `contracts`   ct
               ON ct.agent_id  = u.id
              AND ct.status    = 'completed'
              AND ct.created_at BETWEEN p_from_date AND p_to_date
  LEFT JOIN       `financials`  f
               ON f.contract_id = ct.id
              AND f.status      = 'paid'
  WHERE u.id   = p_agent_id
    AND u.role = 'agent'
  GROUP BY u.id;
END$$

DELIMITER ;

-- =============================================================================
-- SECTION 5 — TRIGGERS
-- =============================================================================

DELIMITER $$

-- Auto-assign uuid on properties if not provided
CREATE TRIGGER IF NOT EXISTS `trg_properties_before_insert`
BEFORE INSERT ON `properties`
FOR EACH ROW
BEGIN
  IF NEW.uuid IS NULL OR NEW.uuid = '' THEN
    SET NEW.uuid = UUID();
  END IF;
END$$

-- Auto-assign uuid on customers if not provided
CREATE TRIGGER IF NOT EXISTS `trg_customers_before_insert`
BEFORE INSERT ON `customers`
FOR EACH ROW
BEGIN
  IF NEW.uuid IS NULL OR NEW.uuid = '' THEN
    SET NEW.uuid = UUID();
  END IF;
END$$

-- Auto-assign uuid and contract_number on contracts
CREATE TRIGGER IF NOT EXISTS `trg_contracts_before_insert`
BEFORE INSERT ON `contracts`
FOR EACH ROW
BEGIN
  IF NEW.uuid IS NULL OR NEW.uuid = '' THEN
    SET NEW.uuid = UUID();
  END IF;
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    SET NEW.contract_number = fn_next_contract_number();
  END IF;
END$$

-- Enforce one cover image per property
CREATE TRIGGER IF NOT EXISTS `trg_property_images_one_cover`
BEFORE INSERT ON `property_images`
FOR EACH ROW
BEGIN
  IF NEW.is_cover = 1 THEN
    UPDATE `property_images`
       SET `is_cover` = 0
     WHERE `property_id` = NEW.property_id;
  END IF;
END$$

-- Auto-mark overdue financials
CREATE TRIGGER IF NOT EXISTS `trg_financials_before_update`
BEFORE UPDATE ON `financials`
FOR EACH ROW
BEGIN
  IF NEW.status   = 'pending'
     AND NEW.due_date IS NOT NULL
     AND NEW.due_date < CURRENT_DATE THEN
    SET NEW.status = 'overdue';
  END IF;
END$$

DELIMITER ;

-- =============================================================================
-- SECTION 6 — SEED DATA
-- =============================================================================

-- Roles lookup
INSERT IGNORE INTO `roles` (`name`, `label`, `description`) VALUES
  ('admin',   'Administrator', 'Full system access including user management'),
  ('manager', 'Manager',       'All modules except user management'),
  ('agent',   'Agent',         'Own records plus read access to shared data');

-- Property types
INSERT IGNORE INTO `property_types` (`name`, `name_ar`, `is_active`) VALUES
  ('Apartment',   'شقة',              1),
  ('Villa',       'فيلا',             1),
  ('Townhouse',   'تاون هاوس',        1),
  ('Duplex',      'دوبلكس',           1),
  ('Studio',      'استوديو',          1),
  ('Office',      'مكتب',             1),
  ('Retail Shop', 'محل تجاري',        1),
  ('Warehouse',   'مستودع',           1),
  ('Land',        'أرض',              1),
  ('Building',    'عمارة',            1),
  ('Farm',        'مزرعة',            1),
  ('Chalet',      'شاليه',            1);

-- ---------------------------------------------------------------------------
-- Default admin user
-- Password: Admin@1234
-- Hash: bcrypt cost=12
-- CHANGE THIS PASSWORD IMMEDIATELY after first login.
-- To regenerate:
--   node -e "const b=require('bcryptjs');console.log(b.hashSync('NewPass',12))"
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users`
  (`uuid`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `is_active`)
VALUES (
  UUID(),
  'admin@company.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/UHJZ5iBCO',
  'System',
  'Admin',
  'admin',
  1
);

-- Sample agent (for development / testing only — remove before delivery)
INSERT IGNORE INTO `users`
  (`uuid`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `phone`, `is_active`)
VALUES (
  UUID(),
  'agent@company.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/UHJZ5iBCO',
  'Ahmed',
  'Al-Rashid',
  'agent',
  '+966 50 000 0001',
  1
);

-- =============================================================================
-- SECTION 7 — RESTORE SETTINGS
-- =============================================================================
SET SQL_MODE          = @OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS     = @OLD_UNIQUE_CHECKS;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
