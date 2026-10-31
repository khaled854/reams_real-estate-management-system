-- =============================================================================
-- Migration 009 — Add latitude / longitude to properties table
-- Depends on: 003 (properties)
--
-- Adds two DECIMAL columns for storing GPS coordinates so the public website
-- can display property locations on a Leaflet map.
--
-- Safe to run on an existing database: uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- (MySQL 8.0+) or the fallback COLUMN EXISTS check below.
--
-- Existing rows will have lat/lng set to NULL until an admin updates them.
-- =============================================================================

USE `real_estate_db`;

-- ── Add lat ──────────────────────────────────────────────────────────────────
ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `lat` DECIMAL(10, 7) DEFAULT NULL
    COMMENT 'Latitude (WGS 84, e.g. 30.0626)'
    AFTER `is_featured`;

-- ── Add lng ──────────────────────────────────────────────────────────────────
ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `lng` DECIMAL(10, 7) DEFAULT NULL
    COMMENT 'Longitude (WGS 84, e.g. 31.2497)'
    AFTER `lat`;

-- ── Add show_exact_location privacy flag ─────────────────────────────────────
-- When FALSE (default), the public API should show a ~700 m radius circle
-- instead of an exact pin, preserving the owner's privacy.
ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `show_exact_location` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '0=approximate circle only on public site, 1=exact pin shown publicly'
    AFTER `lng`;

-- ── Index for bounding-box queries (useful if you add map-area search later) ─
CREATE INDEX IF NOT EXISTS `idx_properties_lat_lng`
  ON `properties` (`lat`, `lng`);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'real_estate_db'
  AND TABLE_NAME   = 'properties'
  AND COLUMN_NAME  IN ('lat', 'lng', 'show_exact_location')
ORDER BY ORDINAL_POSITION;
