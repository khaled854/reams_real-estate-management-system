-- =============================================================================
-- Migration 001 — Create users table
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `uuid`          CHAR(36)        NOT NULL UNIQUE,
  `email`         VARCHAR(255)    NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)    NOT NULL,
  `first_name`    VARCHAR(100)    NOT NULL,
  `last_name`     VARCHAR(100)    NOT NULL,
  `phone`         VARCHAR(30)             DEFAULT NULL,
  `role`          ENUM('admin','manager','agent') NOT NULL DEFAULT 'agent',
  `avatar_path`   VARCHAR(500)            DEFAULT NULL,
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `last_login_at` DATETIME                DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_email`  (`email`),
  INDEX `idx_users_role`   (`role`),
  INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
