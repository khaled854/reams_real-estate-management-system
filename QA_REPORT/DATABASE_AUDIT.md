# REMS — Database Audit Report

**Date:** 2026-09-14  
**Engine:** MariaDB 10.4.32 (Note: Documentation states MySQL 8)  
**Database:** real_estate_db  
**Port:** 3307 (XAMPP)

---

## 1. Tables

| Table | Rows | Primary Key | Notes |
|---|---|---|---|
| `activities` | 1088 | `id` (BIGINT, AUTO_INCREMENT) | Append-only audit log |
| `activity_log` | 0 | `id` | Alternative/duplicate of activities? Empty. |
| `appointments` | 10 | `id` (INT UNSIGNED) | |
| `contracts` | **0** | `id` | Tables exist, no data, module not implemented |
| `customers` | 8 | `id` (INT UNSIGNED) | |
| `financials` | **0** | `id` | Depends on contracts |
| `properties` | 15 | `id` (INT UNSIGNED) | |
| `property_images` | 8 | `id` (INT UNSIGNED) | |
| `property_types` | 12 | `id` (TINYINT UNSIGNED) | |
| `property_videos` | 5 | `id` (INT UNSIGNED) | |
| `refresh_tokens` | 30 | `id` (BIGINT UNSIGNED) | SHA-256 hash stored, not raw token |
| `users` | 2 | `id` (INT UNSIGNED) | |

**Total tables:** 12  
**Total views:** 3

---

## 2. Views

### `v_dashboard_stats` ✅ WORKING
Returns single-row KPI snapshot. Verified against table counts:
```
available_properties=12, rented=1, sold=2, total_customers=8,
new_customers=5, interested=3, active_contracts=0, revenue=0.00
```
All counts match direct `SELECT COUNT(*)` queries.

### `v_properties_full` ✅ WORKING
Returns properties with computed fields: `image_count`, `cover_image`, `agent_name`.
Verified: property with 3 images shows `image_count=3`, correct `cover_image` path.

### `v_customers_full` ✅ WORKING
Returns customers with `employee_name` (LEFT JOIN users) and `contract_count`.
Verified: customers with no assigned employee show `employee_name=NULL` correctly.

---

## 3. Foreign Key Relationships

All 16 FK constraints verified present:

| Child Table | Column | Parent | On Delete |
|---|---|---|---|
| `activities` | `user_id` | `users.id` | SET NULL |
| `activity_log` | `user_id` | `users.id` | SET NULL |
| `appointments` | `property_id` | `properties.id` | **CASCADE** |
| `appointments` | `customer_id` | `customers.id` | SET NULL |
| `appointments` | `assigned_to` | `users.id` | SET NULL |
| `contracts` | `customer_id` | `customers.id` | RESTRICT |
| `contracts` | `agent_id` | `users.id` | SET NULL |
| `contracts` | `property_id` | `properties.id` | RESTRICT |
| `customers` | `employee_id` | `users.id` | SET NULL |
| `financials` | `recorded_by` | `users.id` | SET NULL |
| `financials` | `contract_id` | `contracts.id` | RESTRICT |
| `properties` | `agent_id` | `users.id` | SET NULL |
| `properties` | `type_id` | `property_types.id` | RESTRICT |
| `property_images` | `property_id` | `properties.id` | **CASCADE** |
| `property_videos` | `property_id` | `properties.id` | **CASCADE** |
| `refresh_tokens` | `user_id` | `users.id` | **CASCADE** |

**CASCADE delete on:** appointments→properties, property_images→properties, property_videos→properties, refresh_tokens→users  
**RESTRICT on:** contracts→properties/customers (protects against orphaned contract data)

---

## 4. Data Integrity Checks

### Orphan Records
```sql
-- orphaned_images:   0
-- orphaned_videos:   0
-- orphaned_appointments: 0
```
**Result: ✅ No orphaned records found.**

### Duplicate Records
Unique constraints exist on:
- `users.email`
- `users.uuid`
- `properties.uuid`
- `customers.uuid`
- `appointments.uuid`
- `refresh_tokens.token_hash`

No duplicate violations found.

### QA Test Data Cleanup
After the audit, all `QA_TEST_` records were verified deleted:
```sql
-- properties WHERE title LIKE 'QA_TEST_%':   0
-- customers WHERE name LIKE 'QA_TEST_%':     0
-- users WHERE email LIKE 'qa_test_%':        0
-- appointments WHERE customer_name LIKE 'QA_TEST_%': 0
```
**Result: ✅ All QA records cleaned up. No test data remains.**

---

## 5. Schema Details

### `users` — Key Columns
```
id              INT UNSIGNED  PK
uuid            CHAR(36)      UNIQUE
email           VARCHAR(255)  UNIQUE
password_hash   VARCHAR(255)  (never returned in API)
role            ENUM('admin','manager','agent')  — 'agent' displayed as 'employee' in API
is_active       TINYINT(1)
```
**Note:** DB role enum is `admin/manager/agent`. The application layer maps `agent` → `employee` in all API responses. This is correct but potentially confusing.

### `properties` — Key Columns
```
id, uuid, type_id (FK), type (denormalized), title, location, city,
address, area, bedrooms, bathrooms, price, payment_method ENUM,
listing_type ENUM('sale','rent','both'), status ENUM('available','rented','sold','reserved','off_market'),
owner_name, owner_phone, agent_id (FK), is_featured
```

### `refresh_tokens` — Security-Critical Table
```
id          BIGINT UNSIGNED
user_id     INT UNSIGNED FK → users CASCADE
token_hash  CHAR(64) UNIQUE  — SHA-256 hash, raw token never stored
expires_at  DATETIME
revoked     TINYINT(1)
```
**Correct design:** Raw tokens are never stored. Only SHA-256 hashes. A DB breach does not expose usable tokens.

### `property_types` — Issue Found
```
id 1-10: name_ar = NULL  ← Arabic names missing
id 21:   name=Farm  name_ar=?????  (encoding issue in terminal display)
id 22:   name=Chalet name_ar=?????
```
See BUG-004 in `BUGS_AND_FIXES.md`.

---

## 6. Migration Consistency

| Migration File | Status |
|---|---|
| `001_initial_schema.sql` | Applied |
| `002_*.sql` through `011_*.sql` | Applied (verified via table presence) |

Database schema matches what the application expects. No missing tables or columns were found.

---

## 7. Observations

1. `activity_log` table exists with 0 rows — appears to be a secondary audit table. All audit activity goes to `activities`. The `activity_log` table may be unused dead code.
2. `contracts` and `financials` tables have correct schema but 0 rows — the module is not implemented but the data model is ready for future development.
3. `refresh_tokens` table has 30 rows — expired/revoked tokens from prior sessions. These are harmless and will be pruned by `pruneExpired()` called on login.

---

*Report generated: 2026-09-14*
