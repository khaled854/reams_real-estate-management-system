-- =============================================================================
-- Migration 008 — Create property_videos table
-- Depends on: 003 (properties)
--
-- Videos are stored separately from images so that:
--   · The existing property_images table and all image logic remains untouched.
--   · Videos can have their own size limits, MIME types, and player config.
--   · A property can have up to MAX_VIDEOS_PER_PROPERTY videos (default 5).
-- =============================================================================

USE `real_estate_db`;

CREATE TABLE IF NOT EXISTS `property_videos` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `video_path`  VARCHAR(500) NOT NULL  COMMENT 'Relative path under uploads/videos/',
  `title`       VARCHAR(255)          DEFAULT NULL  COMMENT 'Optional display label',
  `sort_order`  SMALLINT     NOT NULL DEFAULT 0,
  `file_size`   BIGINT UNSIGNED       DEFAULT NULL  COMMENT 'Bytes',
  `mime_type`   VARCHAR(50)           DEFAULT NULL  COMMENT 'video/mp4 | video/webm',
  `duration`    SMALLINT UNSIGNED     DEFAULT NULL  COMMENT 'Seconds (optional, not required for playback)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_videos_property_id` (`property_id`),
  INDEX `idx_videos_sort_order`  (`property_id`, `sort_order`),
  CONSTRAINT `fk_videos_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Property video attachments — separate from property_images';
