-- =============================================================================
-- Migration 005 — Create contracts table
-- Depends on: 001 (users), 003 (properties), 004 (customers)
--
-- NOTE: FK is to `customers` (NOT `clients`) — matches contractRoutes.js
-- and database.sql canonical schema.
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `contracts` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `uuid`            CHAR(36)      NOT NULL UNIQUE,
  `contract_number` VARCHAR(50)   NOT NULL UNIQUE,
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
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_contracts_property`   (`property_id`),
  INDEX `idx_contracts_customer`   (`customer_id`),
  INDEX `idx_contracts_agent`      (`agent_id`),
  INDEX `idx_contracts_status`     (`status`),
  INDEX `idx_contracts_type`       (`type`),
  INDEX `idx_contracts_start_date` (`start_date`),
  CONSTRAINT `fk_contracts_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`),
  CONSTRAINT `fk_contracts_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_contracts_agent`
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sale and lease contract agreements';
