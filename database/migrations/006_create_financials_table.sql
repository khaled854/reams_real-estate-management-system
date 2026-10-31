-- =============================================================================
-- Migration 006 — Create financials table
-- Depends on: 001 (users), 005 (contracts)
--
-- Changes vs original:
--   · type ENUM now includes 'deposit' (matches database.sql canonical schema)
--   · Added composite index idx_financials_status_paid_date (status, paid_date)
--     Required by v_dashboard_stats revenue_this_month subquery for performance.
--   · Added individual indexes idx_financials_type and idx_financials_recorded
--     to match database.sql canonical schema.
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `financials` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `contract_id` INT UNSIGNED  NOT NULL,
  `type`        ENUM('payment','refund','commission','expense','deposit') NOT NULL,
  `amount`      DECIMAL(15,2) NOT NULL,
  `due_date`    DATE                  DEFAULT NULL,
  `paid_date`   DATE                  DEFAULT NULL,
  `status`      ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  `reference`   VARCHAR(100)          DEFAULT NULL,
  `notes`       TEXT                  DEFAULT NULL,
  `recorded_by` INT UNSIGNED          DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_financials_contract`         (`contract_id`),
  INDEX `idx_financials_status`           (`status`),
  INDEX `idx_financials_due_date`         (`due_date`),
  INDEX `idx_financials_status_paid_date` (`status`, `paid_date`),
  INDEX `idx_financials_type`             (`type`),
  INDEX `idx_financials_recorded`         (`recorded_by`),
  CONSTRAINT `fk_financials_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`),
  CONSTRAINT `fk_financials_user`     FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Financial transactions linked to contracts';
