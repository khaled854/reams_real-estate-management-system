-- =============================================================================
-- Migration 007 — Create activities table (audit trail)
-- Depends on: 001 (users)
--
-- IMPORTANT: Table name is `activities` (NOT `activity_log`).
-- activityLogger.js inserts into `activities` with these exact columns:
--   user_id, action, description, entity_type, entity_id,
--   old_values, new_values, ip_address, user_agent
-- All columns must be present.
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `activities` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED            DEFAULT NULL  COMMENT 'FK → users.id (NULL = system)',
  `action`      VARCHAR(100)    NOT NULL              COMMENT 'e.g. property.created',
  `description` TEXT            NOT NULL              COMMENT 'Human-readable event description',
  `entity_type` VARCHAR(50)             DEFAULT NULL  COMMENT 'Table name: properties, customers …',
  `entity_id`   INT UNSIGNED            DEFAULT NULL  COMMENT 'ID of the affected record',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable audit trail — append only';
