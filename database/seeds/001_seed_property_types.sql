-- =============================================================================
-- Seed 001 — Default property types
-- =============================================================================

USE `real_estate_db`;

INSERT IGNORE INTO `property_types` (`name`, `name_ar`, `is_active`) VALUES
  ('Apartment',   'شقة',         1),
  ('Villa',       'فيلا',        1),
  ('Townhouse',   'تاون هاوس',   1),
  ('Duplex',      'دوبلكس',      1),
  ('Studio',      'استوديو',     1),
  ('Office',      'مكتب',        1),
  ('Retail Shop', 'محل تجاري',   1),
  ('Warehouse',   'مستودع',      1),
  ('Land',        'أرض',         1),
  ('Building',    'عمارة',       1),
  ('Farm',        'مزرعة',       1),
  ('Chalet',      'شاليه',       1);
