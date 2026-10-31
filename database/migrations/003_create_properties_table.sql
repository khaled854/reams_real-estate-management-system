-- =============================================================================
-- Migration 003 — Create properties and property_images tables
-- Depends on: 001 (users), 002 (property_types)
-- =============================================================================

USE `real_estate_db`;

-- ---------------------------------------------------------------------------
-- TABLE: properties
-- Must match propertyModel.js columns exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `properties` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `uuid`           CHAR(36)         NOT NULL UNIQUE,
  `type_id`        TINYINT UNSIGNED NOT NULL,
  `type`           VARCHAR(100)     NOT NULL              COMMENT 'Denormalised type name for fast reads',
  `title`          VARCHAR(255)     NOT NULL,
  `description`    TEXT                     DEFAULT NULL,
  `location`       VARCHAR(200)     NOT NULL,
  `address`        VARCHAR(500)     NOT NULL,
  `area`           DECIMAL(10,2)    NOT NULL              COMMENT 'Surface area in m²',
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
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_properties_type_id`      (`type_id`),
  INDEX `idx_properties_status`       (`status`),
  INDEX `idx_properties_listing_type` (`listing_type`),
  INDEX `idx_properties_location`     (`location`),
  INDEX `idx_properties_price`        (`price`),
  INDEX `idx_properties_agent`        (`agent_id`),
  INDEX `idx_properties_is_featured`  (`is_featured`),
  INDEX `idx_properties_created_at`   (`created_at`),
  INDEX `idx_properties_status_type`  (`status`, `type_id`),
  CONSTRAINT `fk_properties_type_id`
    FOREIGN KEY (`type_id`) REFERENCES `property_types`(`id`),
  CONSTRAINT `fk_properties_agent`
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Core property listings';

-- ---------------------------------------------------------------------------
-- TABLE: property_images
--
-- IMPORTANT: Column is `image_path` (NOT `file_path`).
-- propertyModel.js addImage() inserts into `image_path`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `property_images` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `image_path`  VARCHAR(500) NOT NULL  COMMENT 'Relative path under uploads/properties/',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Property photo gallery';
