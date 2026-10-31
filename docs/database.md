# Database Documentation
## Real Estate Management System

**Engine:** MySQL 8.x
**Charset:** utf8mb4 · **Collation:** utf8mb4_unicode_ci
**Timezone:** All `DATETIME` columns store UTC values
**Single-file schema:** `database/database.sql`

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Table Reference](#3-table-reference)
   - [roles (not implemented — ENUM only)](#31-roles)
   - [users](#32-users)
   - [property_types](#33-property_types)
   - [properties](#34-properties)
   - [property_images](#35-property_images)
   - [customers](#36-customers)
   - [contracts](#37-contracts)
   - [financials](#38-financials)
   - [activities](#39-activities)
4. [Foreign Key Relationships](#4-foreign-key-relationships)
5. [Indexes](#5-indexes)
6. [Views](#6-views)
7. [Stored Procedures & Functions](#7-stored-procedures--functions)
8. [Triggers](#8-triggers)
9. [Seed Data](#9-seed-data)
10. [Naming Conventions](#10-naming-conventions)
11. [Design Decisions](#11-design-decisions)
12. [Common Queries](#12-common-queries)

---

## 1. Quick Start

```bash
# Import the complete schema (creates DB, all tables, views, and property type seeds)
mysql -u root -p < database/database.sql

# Verify tables were created
mysql -u root -p real_estate_db -e "SHOW TABLES;"
```

Expected output includes:

```
+----------------------------+
| Tables_in_real_estate_db   |
+----------------------------+
| activities                 |
| activity_log               |
| appointments               |
| contracts                  |
| customers                  |
| financials                 |
| properties                 |
| property_images            |
| property_types             |
| property_videos            |
| refresh_tokens             |
| users                      |
| v_customers_full           |
| v_dashboard_stats          |
| v_properties_full          |
+----------------------------+
```

Then create the first admin:

```bash
cd backend
node scripts/seed-admin.js
```

Default credentials seeded by the script:

| Email | Password | Role |
|---|---|---|
| `admin@test.com` | `Admin@123456` | admin |

> **Change the password immediately after first login.**
> Go to Users → click your account → Change Password.

---

## 2. Entity Relationship Diagram

```
┌─────────────┐        ┌──────────────────┐        ┌────────────────────┐
│    roles    │        │      users       │        │   property_types   │
│─────────────│        │──────────────────│        │────────────────────│
│ id (PK)     │        │ id (PK)          │        │ id (PK)            │
│ name        │        │ uuid             │        │ name               │
│ label       │        │ name             │        │ name_ar            │
│ description │        │ email            │        │ is_active          │
└─────────────┘        │ password         │        └────────────────────┘
   (lookup)            │ role ────────────┼──────────────┐ (lookup)
                       │ phone            │              │
                       │ avatar_path      │              ▼
                       │ is_active        │   ┌──────────────────────┐
                       │ last_login_at    │   │      properties      │
                       │ created_at       │   │──────────────────────│
                       │ updated_at       │   │ id (PK)              │
                       └──────────────────┘   │ uuid                 │
                              │  │            │ type_id (FK)─────────┘
                              │  │            │ type                 │
                    ┌─────────┘  └──────┐     │ title                │
                    │ agent_id (FK)     │     │ description          │
                    ▼                   │     │ location             │
          ┌──────────────────┐          │     │ address              │
          │    properties    │          │     │ area                 │
          │   (agent_id FK)  │          │     │ rooms / bedrooms /   │
          └──────────────────┘          │     │ bathrooms / floor    │
                    │                   │     │ price                │
                    │ 1 : N             │     │ payment_method       │
                    ▼                   │     │ owner_name           │
          ┌──────────────────┐          │     │ owner_phone          │
          │ property_images  │          │     │ listing_type         │
          │──────────────────│          │     │ status               │
          │ id (PK)          │          │     │ is_featured          │
          │ property_id (FK) │          │     │ agent_id (FK) ───────┘
          │ image_path       │          │     │ created_at           │
          │ is_cover         │          │     │ updated_at           │
          │ sort_order       │          │     └──────────────────────┘
          └──────────────────┘          │               │
                                        │               │ 1 : N
                                        │               ▼
                                        │    ┌──────────────────────┐
                                        │    │      contracts       │
                                        │    │──────────────────────│
          ┌──────────────────┐          │    │ id (PK)              │
          │    customers     │          │    │ uuid                 │
          │──────────────────│          │    │ contract_number      │
          │ id (PK)          │          │    │ property_id (FK)─────┘
          │ uuid             │          │    │ customer_id (FK) ────┐
          │ name             │          │    │ agent_id (FK)  ──────┘
          │ phone            │  1 : N   │    │ type                 │
          │ email            ├──────────┼───▶│ start_date           │
          │ property_type    │          │    │ end_date             │
          │ location         │          │    │ value                │
          │ budget           │          │    │ payment_method       │
          │ notes            │          │    │ status               │
          │ status           │          │    │ document_path        │
          │ employee_id (FK)─┼──────────┘    │ created_at           │
          │ created_at       │               │ updated_at           │
          └──────────────────┘               └──────────────────────┘
                                                        │
                                                        │ 1 : N
                                                        ▼
                                             ┌──────────────────────┐
          ┌──────────────────┐               │      financials      │
          │    activities    │               │──────────────────────│
          │──────────────────│               │ id (PK)              │
          │ id (PK)          │               │ contract_id (FK)     │
          │ user_id (FK) ────┼───────────┐   │ type                 │
          │ action           │           │   │ amount               │
          │ description      │           │   │ due_date             │
          │ entity_type      │           │   │ paid_date            │
          │ entity_id        │           │   │ status               │
          │ old_values       │           │   │ reference            │
          │ new_values       │           │   │ recorded_by (FK) ────┤
          │ ip_address       │           │   │ created_at           │
          │ created_at       │           └───┼──── users.id         │
          └──────────────────┘               └──────────────────────┘
```

### Cardinality Summary

| Relationship | Type |
|---|---|
| `users` → `properties` (agent) | 1 : N |
| `property_types` → `properties` | 1 : N |
| `properties` → `property_images` | 1 : N |
| `users` → `customers` (employee) | 1 : N |
| `properties` → `contracts` | 1 : N |
| `customers` → `contracts` | 1 : N |
| `users` → `contracts` (agent) | 1 : N |
| `contracts` → `financials` | 1 : N |
| `users` → `financials` (recorded_by) | 1 : N |
| `users` → `activities` | 1 : N |

---

## 3. Table Reference

### 3.1 `roles`

> **This table does NOT exist in the current schema.**
> Roles are stored as a direct ENUM column (`admin` · `manager` · `agent`) on the `users` table.
> The roles documentation below is kept for historical reference but reflects a planned design that was not implemented.

---

### 3.2 `users`

Internal system users: administrators, managers, and agents (employees).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `uuid` | CHAR(36) | NO | — | Public identifier (exposed in API URLs) |
| `email` | VARCHAR(255) | NO | — | Login email — must be unique |
| `password_hash` | VARCHAR(255) | NO | — | bcrypt hash (cost=12) — never plain text |
| `first_name` | VARCHAR(100) | NO | — | First name |
| `last_name` | VARCHAR(100) | NO | — | Last name (may be empty string) |
| `phone` | VARCHAR(30) | YES | NULL | Contact phone number |
| `role` | ENUM | NO | `agent` | `admin` · `manager` · `agent` |
| `avatar_path` | VARCHAR(500) | YES | NULL | Relative path under `uploads/avatars/` |
| `is_active` | TINYINT(1) | NO | `1` | `0` = deactivated (soft disable) |
| `last_login_at` | DATETIME | YES | NULL | Timestamp of most recent successful login |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last modification time (auto-updated) |

**Constraints:** `PRIMARY KEY (id)` · `UNIQUE (uuid)` · `UNIQUE (email)`

**Indexes:** `idx_users_role` · `idx_users_active` · `idx_users_first_name` · `idx_users_last_name`

> **Column notes:**
> - The column is `password_hash`, not `password`. The application never stores or compares plain-text passwords.
> - The user's display name is composed from `first_name` + `last_name` in queries. The API response includes a virtual `name` field = `CONCAT_WS(' ', first_name, last_name)`.
> - Roles stored in DB as `agent`; the application layer normalises `agent` → `employee` in JWT payloads and API responses.
>
> **Security note:** The `password_hash` column stores a bcrypt hash. The application layer must never log, return, or compare this value in plain text.

> **Note: There is no `roles` table.** Roles are stored directly as an ENUM column on the `users` table.

---

### 3.3 `property_types`

Lookup table for property categories. New types can be added without altering any other table.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | TINYINT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `name` | VARCHAR(100) | NO | — | English name, e.g. `Apartment` |
| `name_ar` | VARCHAR(100) | YES | NULL | Arabic name, e.g. `شقة` |
| `is_active` | TINYINT(1) | NO | `1` | Hide inactive types from UI |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |

**Constraints:** `PRIMARY KEY (id)` · `UNIQUE (name)`

**Seeded values:** Apartment, Villa, Townhouse, Duplex, Studio, Office, Retail Shop, Warehouse, Land, Building, Farm, Chalet

---

### 3.4 `properties`

Core property listings. Each row represents one real estate unit offered for sale or rent.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `uuid` | CHAR(36) | NO | — | Public identifier (API URLs) |
| `type_id` | TINYINT UNSIGNED | NO | — | **FK → property_types.id** |
| `type` | VARCHAR(100) | NO | — | Denormalised type name (fast reads without JOIN) |
| `title` | VARCHAR(255) | NO | — | Listing headline |
| `description` | TEXT | YES | NULL | Full property description |
| `location` | VARCHAR(200) | NO | — | City / district / area (searchable) |
| `address` | VARCHAR(500) | NO | — | Full street address |
| `area` | DECIMAL(10,2) | NO | — | Surface area in m² |
| `rooms` | TINYINT UNSIGNED | YES | NULL | Total room count |
| `bedrooms` | TINYINT UNSIGNED | YES | NULL | Bedroom count |
| `bathrooms` | TINYINT UNSIGNED | YES | NULL | Bathroom count |
| `floor` | SMALLINT | YES | NULL | Floor number (0 = ground) |
| `price` | DECIMAL(15,2) | NO | — | Listing price |
| `payment_method` | ENUM | NO | `cash` | `cash` · `installment` · `mortgage` · `lease` · `negotiable` |
| `owner_name` | VARCHAR(150) | NO | — | Property owner's full name |
| `owner_phone` | VARCHAR(30) | NO | — | Owner's contact number |
| `listing_type` | ENUM | NO | `sale` | `sale` · `rent` · `both` |
| `status` | ENUM | NO | `available` | `available` · `rented` · `sold` · `reserved` · `off_market` |
| `is_featured` | TINYINT(1) | NO | `0` | Pin to top of listings |
| `agent_id` | INT UNSIGNED | YES | NULL | **FK → users.id** — responsible agent |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last modification time |

**Constraints:** `PRIMARY KEY (id)` · `UNIQUE (uuid)` · `FK type_id → property_types` · `FK agent_id → users (SET NULL)`

**Indexes:** `idx_properties_type_id` · `idx_properties_status` · `idx_properties_listing_type` · `idx_properties_location` · `idx_properties_price` · `idx_properties_agent` · `idx_properties_is_featured` · `idx_properties_created_at` · `idx_properties_status_type` (composite)

---

### 3.5 `property_images`

Photo gallery for each property. Supports multiple images, a designated cover photo, and display ordering.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `property_id` | INT UNSIGNED | NO | — | **FK → properties.id** (CASCADE DELETE) |
| `image_path` | VARCHAR(500) | NO | — | Relative path under `uploads/properties/` |
| `is_cover` | TINYINT(1) | NO | `0` | `1` = main cover image (trigger enforces one per property) |
| `sort_order` | SMALLINT | NO | `0` | Display order ascending |
| `file_size` | INT UNSIGNED | YES | NULL | File size in bytes |
| `mime_type` | VARCHAR(50) | YES | NULL | e.g. `image/jpeg` |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Upload timestamp |

**Constraints:** `PRIMARY KEY (id)` · `FK property_id → properties (CASCADE DELETE)`

**Indexes:** `idx_images_property_id` · `idx_images_is_cover` (composite on property_id + is_cover)

> **Cover rule:** The trigger `trg_property_images_one_cover` automatically sets `is_cover = 0` on all existing images for a property when a new cover is inserted.

---

### 3.6 `customers`

CRM records for external leads: prospective buyers, tenants, and investors.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `uuid` | CHAR(36) | NO | — | Public identifier |
| `name` | VARCHAR(150) | NO | — | Customer's full name |
| `phone` | VARCHAR(30) | NO | — | Primary contact number |
| `email` | VARCHAR(255) | YES | NULL | Email address |
| `national_id` | VARCHAR(50) | YES | NULL | National ID or Iqama number |
| `property_type` | VARCHAR(100) | YES | NULL | Type of property the customer wants |
| `location` | VARCHAR(200) | YES | NULL | Preferred city / district |
| `budget` | DECIMAL(15,2) | YES | NULL | Maximum budget |
| `budget_min` | DECIMAL(15,2) | YES | NULL | Minimum budget (for a price range) |
| `notes` | TEXT | YES | NULL | Free-form agent notes |
| `status` | ENUM | NO | `new` | `new` · `contacted` · `interested` · `negotiating` · `closed` · `lost` |
| `source` | VARCHAR(100) | YES | NULL | Lead source: `walk-in`, `referral`, `website`, … |
| `employee_id` | INT UNSIGNED | YES | NULL | **FK → users.id** — assigned agent |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last modification time |

**Constraints:** `PRIMARY KEY (id)` · `UNIQUE (uuid)` · `FK employee_id → users (SET NULL)`

**Indexes:** `idx_customers_status` · `idx_customers_employee` · `idx_customers_property_type` · `idx_customers_location` · `idx_customers_phone` · `idx_customers_created_at`

---

### 3.7 `contracts`

Sale and lease agreements linking a property to a customer.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `uuid` | CHAR(36) | NO | — | Public identifier |
| `contract_number` | VARCHAR(50) | NO | — | Human-readable ref, e.g. `CNT-2026-0001` (auto-generated by trigger) |
| `property_id` | INT UNSIGNED | NO | — | **FK → properties.id** |
| `customer_id` | INT UNSIGNED | NO | — | **FK → customers.id** |
| `agent_id` | INT UNSIGNED | YES | NULL | **FK → users.id** — closing agent (SET NULL on delete) |
| `type` | ENUM | NO | — | `sale` · `lease` |
| `start_date` | DATE | NO | — | Contract effective date |
| `end_date` | DATE | YES | NULL | Expiry date (NULL = indefinite) |
| `value` | DECIMAL(15,2) | NO | — | Total contract value |
| `payment_method` | ENUM | NO | `cash` | Same options as properties |
| `payment_terms` | TEXT | YES | NULL | Instalment schedule or special terms |
| `status` | ENUM | NO | `draft` | `draft` · `active` · `expired` · `terminated` · `completed` |
| `document_path` | VARCHAR(500) | YES | NULL | Signed PDF path under `uploads/documents/` |
| `notes` | TEXT | YES | NULL | Internal notes |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last modification time |

**Constraints:** `PRIMARY KEY (id)` · `UNIQUE (uuid)` · `UNIQUE (contract_number)` · `FK property_id → properties` · `FK customer_id → customers` · `FK agent_id → users (SET NULL)`

**Indexes:** `idx_contracts_property` · `idx_contracts_customer` · `idx_contracts_agent` · `idx_contracts_status` · `idx_contracts_type` · `idx_contracts_start_date` · `idx_contracts_end_date`

**Contract lifecycle:**
```
draft → active → completed
            └──→ expired
            └──→ terminated
```

---

### 3.8 `financials`

Financial transactions and payment records, each linked to a contract.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `contract_id` | INT UNSIGNED | NO | — | **FK → contracts.id** |
| `type` | ENUM | NO | — | `payment` · `refund` · `commission` · `expense` · `deposit` |
| `amount` | DECIMAL(15,2) | NO | — | Transaction amount |
| `due_date` | DATE | YES | NULL | When payment is expected |
| `paid_date` | DATE | YES | NULL | When payment was received (NULL = not yet paid) |
| `status` | ENUM | NO | `pending` | `pending` · `paid` · `overdue` · `cancelled` |
| `reference` | VARCHAR(100) | YES | NULL | Bank transfer ref / cheque number / receipt ID |
| `notes` | TEXT | YES | NULL | Additional notes |
| `recorded_by` | INT UNSIGNED | YES | NULL | **FK → users.id** — staff member who entered the record |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last modification time |

**Constraints:** `PRIMARY KEY (id)` · `FK contract_id → contracts` · `FK recorded_by → users (SET NULL)`

**Indexes:** `idx_financials_contract` · `idx_financials_status` · `idx_financials_due_date` · `idx_financials_type` · `idx_financials_recorded`

> **Overdue detection:** The trigger `trg_financials_before_update` automatically changes `status` from `pending` to `overdue` when `due_date < CURRENT_DATE` on the next update to that row.

---

### 3.9 `activities`

Immutable audit trail. Every significant action in the system is recorded here. Rows are **never updated or deleted**.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AUTO_INCREMENT | Primary key (BIGINT for high volume) |
| `user_id` | INT UNSIGNED | YES | NULL | **FK → users.id** — actor (NULL = system action) |
| `action` | VARCHAR(100) | NO | — | Machine-readable verb, e.g. `property.created` |
| `description` | TEXT | NO | — | Human-readable sentence logged at the time |
| `entity_type` | VARCHAR(50) | YES | NULL | Affected table name, e.g. `properties` |
| `entity_id` | INT UNSIGNED | YES | NULL | ID of the affected record |
| `old_values` | JSON | YES | NULL | Snapshot of the record **before** the change |
| `new_values` | JSON | YES | NULL | Snapshot of the record **after** the change |
| `ip_address` | VARCHAR(45) | YES | NULL | Client IPv4 or IPv6 address |
| `user_agent` | VARCHAR(500) | YES | NULL | Browser / client user-agent string |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | When the action occurred |

**Constraints:** `PRIMARY KEY (id)` · `FK user_id → users (SET NULL)`

**Indexes:** `idx_activities_user` · `idx_activities_action` · `idx_activities_entity` (composite on entity_type + entity_id) · `idx_activities_created_at`

**Standard action verbs:**

| Action | Triggered by |
|---|---|
| `user.login` | Successful authentication |
| `user.logout` | Sign-out |
| `property.created` | New property listing saved |
| `property.updated` | Property fields modified |
| `property.deleted` | Listing removed |
| `property.status_changed` | Status field change |
| `customer.created` | New CRM record |
| `customer.updated` | Customer fields modified |
| `customer.status_changed` | Lead stage change |
| `contract.created` | Contract drafted |
| `contract.signed` | Status moved to active |
| `contract.terminated` | Contract ended early |
| `financial.recorded` | Payment entry added |
| `financial.paid` | Payment marked as paid |
| `user.created` | New staff account |
| `user.deactivated` | Account disabled |

---

## 4. Foreign Key Relationships

| Constraint Name | Child Table | Child Column | Parent Table | Parent Column | On Delete |
|---|---|---|---|---|---|
| `fk_properties_type_id` | `properties` | `type_id` | `property_types` | `id` | RESTRICT |
| `fk_properties_agent` | `properties` | `agent_id` | `users` | `id` | SET NULL |
| `fk_images_property` | `property_images` | `property_id` | `properties` | `id` | **CASCADE** |
| `fk_customers_employee` | `customers` | `employee_id` | `users` | `id` | SET NULL |
| `fk_contracts_property` | `contracts` | `property_id` | `properties` | `id` | RESTRICT |
| `fk_contracts_customer` | `contracts` | `customer_id` | `customers` | `id` | RESTRICT |
| `fk_contracts_agent` | `contracts` | `agent_id` | `users` | `id` | SET NULL |
| `fk_financials_contract` | `financials` | `contract_id` | `contracts` | `id` | RESTRICT |
| `fk_financials_user` | `financials` | `recorded_by` | `users` | `id` | SET NULL |
| `fk_activities_user` | `activities` | `user_id` | `users` | `id` | SET NULL |

**On Delete behaviour:**

- **CASCADE** — child rows are automatically deleted when the parent is deleted (`property_images` when a property is deleted).
- **SET NULL** — the FK column is set to NULL when the parent is deleted (agent / employee assignment references). Preserves data history.
- **RESTRICT** — deletion of the parent is blocked if child rows exist (prevents orphaned contracts or financials).

---

## 5. Indexes

### Primary & Unique

| Table | Index | Columns |
|---|---|---|
| All tables | `PRIMARY KEY` | `id` |
| `users` | `uq_users_uuid`, `uq_users_email` | `uuid`, `email` |
| `property_types` | `uq_property_types_name` | `name` |
| `properties` | `uq_properties_uuid` | `uuid` |
| `customers` | `uq_customers_uuid` | `uuid` |
| `contracts` | `uq_contracts_uuid`, `uq_contracts_number` | `uuid`, `contract_number` |

### Performance Indexes

| Table | Index Name | Columns | Purpose |
|---|---|---|---|
| `users` | `idx_users_role` | `role` | Filter by role |
| `users` | `idx_users_active` | `is_active` | Active user queries |
| `users` | `idx_users_first_name` | `first_name` | First-name search |
| `users` | `idx_users_last_name` | `last_name` | Last-name search |
| `property_types` | `idx_property_types_active` | `is_active` | Active type dropdown |
| `properties` | `idx_properties_type_id` | `type_id` | Filter by type |
| `properties` | `idx_properties_status` | `status` | Listing status filter |
| `properties` | `idx_properties_listing_type` | `listing_type` | Sale vs rent filter |
| `properties` | `idx_properties_location` | `location` | Location search |
| `properties` | `idx_properties_price` | `price` | Price range queries |
| `properties` | `idx_properties_agent` | `agent_id` | Agent's property list |
| `properties` | `idx_properties_is_featured` | `is_featured` | Featured listings |
| `properties` | `idx_properties_created_at` | `created_at` | Recent listings sort |
| `properties` | `idx_properties_status_type` | `(status, type_id)` | Dashboard composite |
| `property_images` | `idx_images_property_id` | `property_id` | Load property gallery |
| `property_images` | `idx_images_is_cover` | `(property_id, is_cover)` | Get cover image |
| `customers` | `idx_customers_status` | `status` | CRM pipeline filter |
| `customers` | `idx_customers_employee` | `employee_id` | Agent's customers |
| `customers` | `idx_customers_property_type` | `property_type` | Match to listings |
| `customers` | `idx_customers_location` | `location` | Location preference |
| `customers` | `idx_customers_phone` | `phone` | Phone lookup |
| `customers` | `idx_customers_created_at` | `created_at` | Recent leads sort |
| `contracts` | `idx_contracts_property` | `property_id` | Property contracts |
| `contracts` | `idx_contracts_customer` | `customer_id` | Customer contracts |
| `contracts` | `idx_contracts_agent` | `agent_id` | Agent contracts |
| `contracts` | `idx_contracts_status` | `status` | Status filter |
| `contracts` | `idx_contracts_type` | `type` | Sale vs lease |
| `contracts` | `idx_contracts_start_date` | `start_date` | Date range |
| `contracts` | `idx_contracts_end_date` | `end_date` | Expiry queries |
| `financials` | `idx_financials_contract` | `contract_id` | Contract payments |
| `financials` | `idx_financials_status` | `status` | Payment status |
| `financials` | `idx_financials_due_date` | `due_date` | Overdue detection |
| `financials` | `idx_financials_type` | `type` | Transaction type |
| `financials` | `idx_financials_recorded` | `recorded_by` | Who recorded |
| `activities` | `idx_activities_user` | `user_id` | User activity feed |
| `activities` | `idx_activities_action` | `action` | Filter by action |
| `activities` | `idx_activities_entity` | `(entity_type, entity_id)` | Record history |
| `activities` | `idx_activities_created_at` | `created_at` | Timeline sort |

---

## 6. Views

### `v_properties_full`

Properties joined with their type name, agent name, total image count, and cover image path. Use this for any listing page or property card.

```sql
SELECT * FROM v_properties_full WHERE status = 'available';
SELECT * FROM v_properties_full WHERE agent_id = 2 ORDER BY created_at DESC;
```

**Columns returned:** all `properties` columns + `agent_name`, `agent_phone`, `image_count`, `cover_image`

---

### `v_customers_full`

Customers joined with their assigned agent name and open contract count.

```sql
SELECT * FROM v_customers_full WHERE status = 'interested';
SELECT * FROM v_customers_full WHERE employee_id = 3;
```

**Columns returned:** all `customers` columns + `employee_name`, `employee_phone`, `contract_count`

---

### `v_dashboard_stats`

Single-row KPI snapshot. Used by the main dashboard to avoid N separate queries.

```sql
SELECT * FROM v_dashboard_stats;
```

**Columns returned:**

| Column | Description |
|---|---|
| `available_properties` | Properties with status = available |
| `rented_properties` | Properties with status = rented |
| `sold_properties` | Properties with status = sold |
| `new_customers` | Customers with status = new |
| `interested_customers` | Customers with status = interested |
| `active_contracts` | Contracts with status = active |
| `draft_contracts` | Contracts with status = draft |
| `revenue_this_month` | Sum of paid financials in current calendar month |
| `overdue_amount` | Sum of pending financials where due_date ≤ today |

---

## 7. Stored Procedures & Functions

> **Not present in the current live database.**
> The `database/database.sql` file defines `fn_next_contract_number()` and `sp_get_agent_performance()`, but these were not included in the migration scripts that built the current live database. Contract numbering and agent performance queries are handled by the application layer instead.

---

## 8. Triggers

> **Not present in the current live database.**
> The `database/database.sql` file defines several triggers (`trg_*`), but these were not included in the migration scripts that built the current live database. The application layer handles the responsibilities that would have been covered by these triggers (UUID assignment, cover-image management, overdue detection, etc.).

---
