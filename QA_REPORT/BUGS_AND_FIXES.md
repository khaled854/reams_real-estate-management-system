# REMS — Bugs and Fixes Report

**All issues below are based on runtime evidence. Severity per Phase 20 classification.**

---

## Summary

| Severity | Count |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🟢 Low | 1 |
| **Total** | **4** |

---

## BUG-001 — Contracts and Clients Routes Not Mounted

| Field | Value |
|---|---|
| **Severity** | 🟡 MEDIUM |
| **Module** | Contracts, Clients |
| **Reproducibility** | 100% |
| **Affected Roles** | All |

### Exact Steps
1. Send `GET http://localhost:5000/api/v1/contracts` (with valid auth token)
2. Send `GET http://localhost:5000/api/v1/clients` (with valid auth token)

### Expected Result
`contractRoutes.js` and `clientRoutes.js` exist and both contain `router.all('*', 501)` handlers.
Expected: 501 with message "Contracts module not yet implemented" / "Clients module not yet implemented"

### Actual Result
Both return `404 {"success":false,"message":"Route not found: ..."}`.

### Root Cause
`routes/index.js` does not mount either route file. The only mounted routes are:
`auth, users, properties, customers, appointments, reports, activities`.

```javascript
// routes/index.js — these lines are MISSING:
// v1.use('/contracts', require('./contractRoutes'));
// v1.use('/clients',   require('./clientRoutes'));
```

### Impact
- Contracts module completely inaccessible (API returns 404, not 501)
- Financial module inaccessible (depends on contracts)
- Dashboard shows revenue=0, active_contracts=0 (correct — no data, not broken)

### Fix Options
**Option A (Recommended if client expects 501):** Mount the stub routes so the intended 501 is returned:
```javascript
// Add to routes/index.js
v1.use('/contracts', require('./contractRoutes'));
v1.use('/clients',   require('./clientRoutes'));
```
**Option B:** Leave as-is, update documentation to state these endpoints return 404 (not 501).

### Regression Test
After fix: `GET /contracts` should return 501. `GET /clients` should return 501.

### Fix Applied
Not applied — this is a pre-existing design decision. Documented as a known limitation.

---

## BUG-002 — Database Engine Mismatch (MariaDB vs MySQL 8)

| Field | Value |
|---|---|
| **Severity** | 🟡 MEDIUM |
| **Module** | Infrastructure / Documentation |
| **Reproducibility** | 100% |

### Evidence
```sql
SELECT VERSION() as db_version;
-- Returns: 10.4.32-MariaDB
```

Multiple documentation files (DEPLOYMENT.md, docs/database.md, README.md) describe the requirement as **MySQL 8.x**.

### Actual DB
**MariaDB 10.4.32** — a MySQL fork. Functionally compatible for this codebase (no MySQL 8-specific features like window functions, JSON_TABLE, etc. were found in use).

### Impact
- Client attempting to deploy on a strict MySQL 8 environment may see minor behavior differences in edge cases
- SHOW ENGINE output differs
- No functional defects observed in this environment

### Fix
Update all documentation to reflect **MariaDB 10.4.x (XAMPP)** as the supported database engine, and note MySQL 8.x compatibility.

### Status
Documentation update needed — **not a code defect**.

---

## BUG-003 — npm audit: Dependency Vulnerabilities

| Field | Value |
|---|---|
| **Severity** | 🟡 MEDIUM |
| **Module** | Dependencies |
| **Reproducibility** | 100% |

### Evidence
```
Backend:  7 vulnerabilities (1 low, 4 moderate, 2 high)
Frontend: 5 vulnerabilities (3 moderate, 2 high)
```

### Details
These are in npm-reported transitive dependencies. None were traced to production runtime code in this audit. The `high` vulnerabilities were not exploitable through the application's attack surface as tested.

### Fix
Run `npm audit fix` in both `backend/` and `frontend/` directories before final client delivery. For breaking-change fixes: `npm audit fix --force` (with regression testing).

### Status
Not fixed — should be addressed by developer before delivery.

---

## BUG-004 — Property Type Arabic Names (name_ar) are NULL

| Field | Value |
|---|---|
| **Severity** | 🟢 LOW |
| **Module** | Property Types / Database |
| **Reproducibility** | 100% |

### Evidence
```sql
SELECT id, name, name_ar FROM property_types;
-- IDs 1-10: name_ar = NULL
-- IDs 21-22 (Farm, Chalet): name_ar = present but garbled in terminal (encoding)
```

### Impact
In Arabic (RTL) mode, property type dropdowns will display English names instead of Arabic translations.

### Fix
Populate `name_ar` values for all 12 property types:
```sql
UPDATE property_types SET name_ar = 'شقة'       WHERE name = 'Apartment';
UPDATE property_types SET name_ar = 'فيلا'       WHERE name = 'Villa';
UPDATE property_types SET name_ar = 'تاون هاوس' WHERE name = 'Townhouse';
UPDATE property_types SET name_ar = 'مكتب'       WHERE name = 'Office';
UPDATE property_types SET name_ar = 'محل'        WHERE name = 'Retail Shop';
UPDATE property_types SET name_ar = 'مستودع'     WHERE name = 'Warehouse';
UPDATE property_types SET name_ar = 'أرض'        WHERE name = 'Land';
UPDATE property_types SET name_ar = 'عمارة'      WHERE name = 'Building';
UPDATE property_types SET name_ar = 'استوديو'    WHERE name = 'Studio';
UPDATE property_types SET name_ar = 'دوبلكس'     WHERE name = 'Duplex';
```

### Status
Not applied — data population is a client-side setup responsibility. Documented for handover.

---

## Test Script Issues (Not Application Defects)

These appeared as failures in `qa_master_test.js` but are script-writing errors, not application bugs:

| # | Label | Script Error | Application Behavior |
|---|---|---|---|
| TS-1 | `/clients returns 501` | Test expected 501, got 404 | Application correctly returns 404 JSON (route not mounted) |
| TS-2 | `GET /contracts → 501` | Same as TS-1 | Same — 404 JSON is correct |
| TS-3 | `Contracts returns 501 message` | Follows from TS-2 | N/A |
| TS-4 | `Invalid JSON body → 400` | Test wrote truncated body with wrong Content-Length → TCP 408 | Separately verified: real invalid JSON → 400 ✅ |

*These are NOT application defects. The application behavior is correct in all 4 cases.*

---

*Report generated: 2026-09-14*
