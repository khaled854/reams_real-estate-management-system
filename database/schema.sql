-- =============================================================================
-- Real Estate Management System — Master Schema Reference
-- Engine: MySQL 8.x
-- Character Set: utf8mb4 / Collation: utf8mb4_unicode_ci
--
-- !! IMPORTANT !!
-- This file is a HUMAN-READABLE REFERENCE ONLY.
-- The authoritative table definitions are in /migrations/001–009.sql.
-- DO NOT use this file to create tables — always run the migrations instead.
--
-- This file describes an EARLIER design iteration and is intentionally
-- kept for historical reference.  The following divergences exist between
-- this file and the live schema (migrations are correct):
--
--  Table               | This file              | Migration (live)
--  ────────────────────┼────────────────────────┼──────────────────────────────
--  properties          | property_type_id col   | type_id col (003)
--  property_images     | file_path col          | image_path col (003)
--  customers/clients   | clients table          | customers table (004)
--  activity_log        | activity_log table     | activities table (007)
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Database & User Bootstrap
-- Run once as root before executing migrations.
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `real_estate_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create application user (replace password before running)
CREATE USER IF NOT EXISTS 'rems_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON `real_estate_db`.* TO 'rems_user'@'localhost';
FLUSH PRIVILEGES;

USE `real_estate_db`;

-- ---------------------------------------------------------------------------
-- TABLE: users
-- System users (agents, managers, admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `uuid`         CHAR(36)        NOT NULL UNIQUE,
  `email`        VARCHAR(255)    NOT NULL UNIQUE,
  `password_hash`VARCHAR(255)    NOT NULL,
  `first_name`   VARCHAR(100)    NOT NULL,
  `last_name`    VARCHAR(100)    NOT NULL,
  `phone`        VARCHAR(30)             DEFAULT NULL,
  `role`         ENUM('admin','manager','agent') NOT NULL DEFAULT 'agent',
  `avatar_path`  VARCHAR(500)            DEFAULT NULL,
  `is_active`    TINYINT(1)      NOT NULL DEFAULT 1,
  `last_login_at`DATETIME                DEFAULT NULL,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_email`  (`email`),
  INDEX `idx_users_role`   (`role`),
  INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: property_types
-- Lookup: Apartment, Villa, Office, Land, Warehouse …
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `property_types` (
  `id`         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)     NOT NULL UNIQUE,
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: properties
-- Core property listings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `properties` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `uuid`            CHAR(36)        NOT NULL UNIQUE,
  `property_type_id`TINYINT UNSIGNED NOT NULL,
  `title`           VARCHAR(255)    NOT NULL,
  `description`     TEXT                    DEFAULT NULL,
  `address`         VARCHAR(500)    NOT NULL,
  `city`            VARCHAR(100)    NOT NULL,
  `district`        VARCHAR(100)            DEFAULT NULL,
  `area_sqm`        DECIMAL(10,2)           DEFAULT NULL,
  `bedrooms`        TINYINT UNSIGNED        DEFAULT NULL,
  `bathrooms`       TINYINT UNSIGNED        DEFAULT NULL,
  `floor`           SMALLINT                DEFAULT NULL,
  `price`           DECIMAL(15,2)           DEFAULT NULL,
  `status`          ENUM('available','rented','sold','off_market')
                                    NOT NULL DEFAULT 'available',
  `listing_type`    ENUM('sale','rent','both') NOT NULL DEFAULT 'sale',
  `owner_id`        INT UNSIGNED            DEFAULT NULL,
  `agent_id`        INT UNSIGNED            DEFAULT NULL,
  `is_featured`     TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_properties_status`  (`status`),
  INDEX `idx_properties_type`    (`property_type_id`),
  INDEX `idx_properties_city`    (`city`),
  INDEX `idx_properties_agent`   (`agent_id`),
  CONSTRAINT `fk_properties_type`  FOREIGN KEY (`property_type_id`) REFERENCES `property_types`(`id`),
  CONSTRAINT `fk_properties_agent` FOREIGN KEY (`agent_id`)         REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: property_images
-- One property → many images
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `property_images` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `file_path`   VARCHAR(500) NOT NULL,
  `is_cover`    TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`  SMALLINT     NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_images_property` (`property_id`),
  CONSTRAINT `fk_images_property` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: clients
-- Buyers, tenants, and property owners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `clients` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid`         CHAR(36)     NOT NULL UNIQUE,
  `type`         ENUM('buyer','tenant','owner','investor') NOT NULL DEFAULT 'buyer',
  `first_name`   VARCHAR(100) NOT NULL,
  `last_name`    VARCHAR(100) NOT NULL,
  `email`        VARCHAR(255)         DEFAULT NULL,
  `phone`        VARCHAR(30)          DEFAULT NULL,
  `national_id`  VARCHAR(50)          DEFAULT NULL,
  `address`      VARCHAR(500)         DEFAULT NULL,
  `notes`        TEXT                 DEFAULT NULL,
  `assigned_agent_id` INT UNSIGNED    DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_clients_type`  (`type`),
  INDEX `idx_clients_agent` (`assigned_agent_id`),
  CONSTRAINT `fk_clients_agent` FOREIGN KEY (`assigned_agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: contracts
-- Sale and lease agreements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contracts` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `uuid`            CHAR(36)      NOT NULL UNIQUE,
  `contract_number` VARCHAR(50)   NOT NULL UNIQUE,
  `type`            ENUM('sale','lease') NOT NULL,
  `property_id`     INT UNSIGNED  NOT NULL,
  `client_id`       INT UNSIGNED  NOT NULL,
  `agent_id`        INT UNSIGNED          DEFAULT NULL,
  `start_date`      DATE          NOT NULL,
  `end_date`        DATE                  DEFAULT NULL,
  `value`           DECIMAL(15,2) NOT NULL,
  `payment_terms`   TEXT                  DEFAULT NULL,
  `status`          ENUM('draft','active','expired','terminated','completed')
                                  NOT NULL DEFAULT 'draft',
  `document_path`   VARCHAR(500)          DEFAULT NULL,
  `notes`           TEXT                  DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_contracts_property` (`property_id`),
  INDEX `idx_contracts_client`   (`client_id`),
  INDEX `idx_contracts_status`   (`status`),
  CONSTRAINT `fk_contracts_property` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`),
  CONSTRAINT `fk_contracts_client`   FOREIGN KEY (`client_id`)   REFERENCES `clients`(`id`),
  CONSTRAINT `fk_contracts_agent`    FOREIGN KEY (`agent_id`)    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: financials
-- Payment records linked to contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `financials` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `contract_id`   INT UNSIGNED  NOT NULL,
  `type`          ENUM('payment','refund','commission','expense') NOT NULL,
  `amount`        DECIMAL(15,2) NOT NULL,
  `due_date`      DATE                  DEFAULT NULL,
  `paid_date`     DATE                  DEFAULT NULL,
  `status`        ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  `reference`     VARCHAR(100)          DEFAULT NULL,
  `notes`         TEXT                  DEFAULT NULL,
  `recorded_by`   INT UNSIGNED          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_financials_contract` (`contract_id`),
  INDEX `idx_financials_status`   (`status`),
  INDEX `idx_financials_due_date` (`due_date`),
  CONSTRAINT `fk_financials_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`),
  CONSTRAINT `fk_financials_user`     FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- TABLE: activity_log
-- Immutable audit trail for all significant actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED            DEFAULT NULL,
  `action`      VARCHAR(100)    NOT NULL,
  `entity_type` VARCHAR(50)             DEFAULT NULL,
  `entity_id`   INT UNSIGNED            DEFAULT NULL,
  `details`     JSON                    DEFAULT NULL,
  `ip_address`  VARCHAR(45)             DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_log_user`   (`user_id`),
  INDEX `idx_log_entity` (`entity_type`, `entity_id`),
  INDEX `idx_log_action` (`action`),
  CONSTRAINT `fk_log_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
