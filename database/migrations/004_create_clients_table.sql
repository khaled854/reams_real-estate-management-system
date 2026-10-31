-- =============================================================================
-- Migration 004 — Create customers table
-- Depends on: 001 (users)
--
-- NOTE: The application uses a `customers` table (CRM leads with a single
-- `name` field and `employee_id`). The old migration created a `clients`
-- table with first_name/last_name. This migration creates the correct
-- `customers` table that matches customerModel.js exactly.
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `customers` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `uuid`          CHAR(36)      NOT NULL UNIQUE,
  `name`          VARCHAR(150)  NOT NULL              COMMENT 'Customer full name',
  `phone`         VARCHAR(30)   NOT NULL,
  `email`         VARCHAR(255)          DEFAULT NULL,
  `national_id`   VARCHAR(50)           DEFAULT NULL,
  `property_type` VARCHAR(100)          DEFAULT NULL  COMMENT 'Type of property sought',
  `location`      VARCHAR(200)          DEFAULT NULL  COMMENT 'Preferred city / district',
  `budget`        DECIMAL(15,2)         DEFAULT NULL,
  `budget_min`    DECIMAL(15,2)         DEFAULT NULL,
  `notes`         TEXT                  DEFAULT NULL,
  `status`        ENUM('new','contacted','interested','negotiating','closed','lost')
                                NOT NULL DEFAULT 'new',
  `source`        VARCHAR(100)          DEFAULT NULL  COMMENT 'Lead source: walk-in, referral …',
  `employee_id`   INT UNSIGNED          DEFAULT NULL  COMMENT 'FK → users.id (assigned agent)',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_customers_status`        (`status`),
  INDEX `idx_customers_employee`      (`employee_id`),
  INDEX `idx_customers_property_type` (`property_type`),
  INDEX `idx_customers_location`      (`location`),
  INDEX `idx_customers_phone`         (`phone`),
  INDEX `idx_customers_created_at`    (`created_at`),
  CONSTRAINT `fk_customers_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='CRM customer / lead records';
