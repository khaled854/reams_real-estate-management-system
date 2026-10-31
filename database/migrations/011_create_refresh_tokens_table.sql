-- =============================================================================
-- Migration 011 — Create refresh_tokens table
-- Purpose: enables server-side refresh-token revocation on logout.
--          Each issued refresh token is hashed (SHA-256) and stored.
--          On logout the row is marked revoked=1.
--          POST /auth/refresh checks the DB before accepting any token.
-- Depends on: 001 (users)
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED     NOT NULL,
  `token_hash` CHAR(64)         NOT NULL  COMMENT 'SHA-256 hex of the raw JWT refresh token',
  `expires_at` DATETIME         NOT NULL,
  `revoked`    TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_hash` (`token_hash`),
  INDEX `idx_rt_user`   (`user_id`),
  INDEX `idx_rt_expiry` (`expires_at`),

  CONSTRAINT `fk_rt_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Server-side refresh token registry — enables revocation on logout';
