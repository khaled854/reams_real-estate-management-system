-- =============================================================================
-- Migration 002 — Create property_types lookup table
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `property_types` (
  `id`         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)     NOT NULL UNIQUE,
  `name_ar`    VARCHAR(100)             DEFAULT NULL  COMMENT 'Arabic label',
  `is_active`  TINYINT(1)       NOT NULL DEFAULT 1    COMMENT 'Backend filters WHERE is_active = 1',
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_property_types_name` (`name`),
  INDEX `idx_property_types_active`   (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Property category lookup';
