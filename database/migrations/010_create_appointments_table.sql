-- =============================================================================
-- Migration 010 — Create appointments table
-- Depends on: 001 (users), 003 (properties), 004 (customers)
--
-- Stores property-viewing and other real-estate appointments.
-- Supports status lifecycle: pending → confirmed | rejected | cancelled
--                                      confirmed → completed | rescheduled | no_show | cancelled
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `appointments` (
  `id`              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `uuid`            CHAR(36)       NOT NULL UNIQUE,

  -- ── Property ─────────────────────────────────────────────────────────────
  `property_id`     INT UNSIGNED   NOT NULL,

  -- ── Customer info (denormalised + optional FK) ────────────────────────────
  -- We store the name/phone/email directly so appointments survive even if the
  -- customer record is later merged or deleted.
  `customer_id`     INT UNSIGNED           DEFAULT NULL COMMENT 'FK → customers.id (nullable)',
  `customer_name`   VARCHAR(150)   NOT NULL,
  `customer_phone`  VARCHAR(30)    NOT NULL,
  `customer_email`  VARCHAR(255)           DEFAULT NULL,

  -- ── Scheduling ────────────────────────────────────────────────────────────
  `appointment_date` DATE          NOT NULL  COMMENT 'Local date (YYYY-MM-DD)',
  `appointment_time` TIME          NOT NULL  COMMENT 'Local time (HH:MM)',
  `duration_minutes` SMALLINT      NOT NULL  DEFAULT 60  COMMENT 'Expected visit length',

  -- ── Appointment type ──────────────────────────────────────────────────────
  `type`            ENUM('viewing','meeting','call','other')
                                   NOT NULL  DEFAULT 'viewing',

  -- ── Status lifecycle ──────────────────────────────────────────────────────
  `status`          ENUM('pending','confirmed','rescheduled','cancelled','rejected','completed','no_show')
                                   NOT NULL  DEFAULT 'pending',

  -- ── Rescheduling ─────────────────────────────────────────────────────────
  -- When an appointment is rescheduled, the old date/time is preserved here.
  `original_date`   DATE                   DEFAULT NULL,
  `original_time`   TIME                   DEFAULT NULL,

  -- ── Assignment ────────────────────────────────────────────────────────────
  `assigned_to`     INT UNSIGNED           DEFAULT NULL  COMMENT 'FK → users.id (assigned agent)',

  -- ── Notes ─────────────────────────────────────────────────────────────────
  `customer_notes`  TEXT                   DEFAULT NULL  COMMENT 'Notes from the customer',
  `admin_notes`     TEXT                   DEFAULT NULL  COMMENT 'Internal notes (not public)',

  -- ── Source tracking ───────────────────────────────────────────────────────
  `source`          ENUM('public_website','admin','phone','walk_in','other')
                                   NOT NULL  DEFAULT 'public_website',

  -- ── Timestamps ───────────────────────────────────────────────────────────
  `created_at`      DATETIME       NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME       NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- ── Indexes ────────────────────────────────────────────────────────────────
  INDEX `idx_appt_property`    (`property_id`),
  INDEX `idx_appt_customer`    (`customer_id`),
  INDEX `idx_appt_assigned`    (`assigned_to`),
  INDEX `idx_appt_date`        (`appointment_date`),
  INDEX `idx_appt_status`      (`status`),
  INDEX `idx_appt_type`        (`type`),
  INDEX `idx_appt_created`     (`created_at`),
  -- Composite: fast lookup of an agent's schedule for conflict detection
  INDEX `idx_appt_agent_slot`  (`assigned_to`, `appointment_date`, `appointment_time`),

  -- ── Foreign keys ────────────────────────────────────────────────────────────
  CONSTRAINT `fk_appt_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_appt_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_appt_assigned`
    FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`)
    ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Property viewing and other real-estate appointments';
