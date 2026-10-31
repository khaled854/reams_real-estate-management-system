-- =============================================================================
-- Seed 002 — Default admin user
--
-- Password: Admin@1234  (bcrypt cost=12)
-- CHANGE THIS PASSWORD IMMEDIATELY after first login.
--
-- Column names match the canonical users table:
--   first_name, last_name, password_hash  (NOT name / password)
--
-- To generate a new hash:
--   node -e "const b=require('bcryptjs');console.log(b.hashSync('NewPass',12))"
-- =============================================================================

USE `real_estate_db`;

INSERT IGNORE INTO `users`
  (`uuid`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `is_active`)
VALUES (
  UUID(),
  'admin@company.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/UHJZ5iBCO',
  'System',
  'Admin',
  'admin',
  1
);
