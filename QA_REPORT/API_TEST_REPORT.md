# REMS — API Test Report

**All results are from live HTTP requests to the running production server (localhost:5000).**  
**Test date: 2026-09-14 | Server: NODE_ENV=production**

---

## Endpoint Inventory

### Authentication (`/api/v1/auth/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| POST | `/auth/login` | No | — | 200 / 401 / 422 | ✅ |
| POST | `/auth/logout` | Yes | Any | 200 | ✅ |
| POST | `/auth/refresh` | Cookie | — | 200 / 401 | ✅ |
| GET | `/auth/me` | Yes | Any | 200 / 401 | ✅ |
| POST | `/auth/change-password` | Yes | Any | 200 / 400 / 401 | ✅ |
| POST | `/auth/register` | No / Admin | — | 🔎 CODE PRESENT (not tested in audit) | — |

### Users (`/api/v1/users/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| GET | `/users` | Yes | Admin | 200 / 401 / 403 | ✅ |
| POST | `/users` | Yes | Admin | 201 / 409 / 422 | ✅ |
| GET | `/users/:id` | Yes | Admin | 200 / 404 | ✅ |
| PUT | `/users/:id` | Yes | Admin | 200 | ✅ |
| DELETE | `/users/:id` | Yes | Admin | 200 | ✅ |
| PATCH | `/users/:id/password` | Yes | Admin | 200 | ✅ |
| PATCH | `/users/:id/deactivate` | Yes | Admin | 200 | ✅ |
| PATCH | `/users/:id/activate` | Yes | Admin | 200 | ✅ |

### Properties (`/api/v1/properties/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| GET | `/properties/types` | Yes | Any | 200 | ✅ |
| GET | `/properties` | Yes | Any | 200 / 401 | ✅ |
| POST | `/properties` | Yes | Admin/Mgr/Emp | 201 / 422 | ✅ |
| GET | `/properties/:id` | Yes | Any | 200 / 404 | ✅ |
| PUT | `/properties/:id` | Yes | Admin/Mgr/Emp | 200 / 403 | ✅ |
| DELETE | `/properties/:id` | Yes | Admin/Mgr/Emp | 200 / 403 | ✅ |
| PATCH | `/properties/:id/status` | Yes | Admin/Mgr/Emp | 200 / 422 | ✅ |
| GET | `/properties/:id/images` | Yes | Any | 200 | ✅ |
| POST | `/properties/:id/images` | Yes | Admin/Mgr/Emp | 201 / 400 / 401 | ✅ |
| DELETE | `/properties/:id/images/:imgId` | Yes | Admin/Mgr/Emp | 200 | ✅ |
| GET | `/properties/:id/videos` | Yes | Any | 200 | ✅ |
| POST | `/properties/:id/videos` | Yes | Admin/Mgr/Emp | 400 (invalid type) | ✅ |
| DELETE | `/properties/:id/videos/:vidId` | Yes | Admin/Mgr/Emp | 🔎 CODE PRESENT | — |

### Customers (`/api/v1/customers/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| GET | `/customers/pipeline` | Yes | Any | 200 | ✅ |
| GET | `/customers` | Yes | Any | 200 / 401 | ✅ |
| POST | `/customers` | Yes | Admin/Mgr/Emp | 201 / 422 | ✅ |
| GET | `/customers/:id` | Yes | Any | 200 / 403 / 404 | ✅ |
| PUT | `/customers/:id` | Yes | Admin/Mgr/Emp | 200 | ✅ |
| DELETE | `/customers/:id` | Yes | Admin/Mgr/Emp | 200 | ✅ |
| PATCH | `/customers/:id/status` | Yes | Admin/Mgr/Emp | 200 / 422 | ✅ |
| PATCH | `/customers/:id/assign` | Yes | Admin/Mgr | 🔎 CODE PRESENT | — |

### Appointments (`/api/v1/appointments/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| POST | `/appointments/public` | **No** | — | 201 / 422 | ✅ |
| GET | `/appointments` | Yes | Any | 200 / 401 | ✅ |
| POST | `/appointments` | Yes | Admin/Mgr/Emp | 201 | ✅ |
| GET | `/appointments/stats` | Yes | Any | 200 | ✅ |
| GET | `/appointments/:id` | Yes | Any | 200 / 404 | ✅ |
| PATCH | `/appointments/:id/status` | Yes | Any | 200 / 422 | ✅ |
| PATCH | `/appointments/:id/reschedule` | Yes | Any | 🔎 CODE PRESENT | — |

### Contracts (`/api/v1/contracts/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| ALL | `/contracts/*` | — | — | 404 (not mounted) | ❌ NOT IMPLEMENTED |

### Clients (`/api/v1/clients/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| ALL | `/clients/*` | — | — | 404 (not mounted) | ❌ NOT IMPLEMENTED |

### Reports (`/api/v1/reports/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| GET | `/reports/dashboard` | Yes | Any | 200 / 401 | ✅ |
| GET | `/reports/properties` | Yes | Any | 200 | ✅ |
| GET | `/reports/customers` | Yes | Any | 200 | ✅ |
| GET | `/reports/financials` | Yes | Admin/Mgr | 200 / 403 | ✅ |
| GET | `/reports/agents` | Yes | Admin/Mgr | 200 / 403 | ✅ |

### Activities (`/api/v1/activities/`)

| Method | Route | Auth | Role | Tested Status | Result |
|---|---|---|---|---|---|
| GET | `/activities` | Yes | Any | 200 / 401 | ✅ |

### Health & Status (Public)

| Method | Route | Auth | Result |
|---|---|---|---|
| GET | `/health` | No | ✅ 200 |
| GET | `/api/v1/status` | No | ✅ 200 |

---

## Security Tests on API Endpoints

| Test | Input | Expected | Got | Result |
|---|---|---|---|---|
| Login wrong password | `password: "WRONG"` | 401 | 401 | ✅ |
| Login empty body | `{}` | 422 | 422 | ✅ |
| Login malformed email | `email: "notanemail"` | 422 | 422 | ✅ |
| No auth token on protected endpoint | No header | 401 | 401 | ✅ |
| Invalid JWT token | `Bearer invalid.token.here` | 401 | 401 | ✅ |
| Forged refresh cookie | `rems_rt=forged.fake.token` | 401 | 401 | ✅ |
| Old refresh token after rotation | (previous cookie) | 401 | 401 | ✅ |
| Refresh after logout | (logged-out cookie) | 401 | 401 | ✅ |
| SQL injection in search | `' OR 1=1 --` | 200 (safe) | 200 | ✅ |
| SQL injection (customers) | `'; DROP TABLE users;--` | 200 (safe) | 200 | ✅ |
| Employee accessing admin resource (IDOR) | `GET /customers/:adminId` | 403 | 403 | ✅ |
| Employee accessing users API | `GET /users` | 403 | 403 | ✅ |
| Employee accessing financial report | `GET /reports/financials` | 403 | 403 | ✅ |
| PHP file upload (disguised as image) | `.php` file + `image/jpeg` MIME | 400 | 400 | ✅ |
| MIME spoofing | `.jpg` ext + `text/plain` MIME | 400 | 400 | ✅ |
| Upload without auth | No token | 401 | 401 | ✅ |
| Invalid JSON body | `{invalid}` | 400 | 400 | ✅ (verified separately) |
| Missing required field | `{phone: "0512345678"}` only | 422 | 422 | ✅ |
| Invalid enum value in status | `status: "flying_unicorn"` | 422 | 422 | ✅ |
| Very long field | `name: "A" * 10000` | 422 | 422 | ✅ |
| Negative price | `price: -999` | 422 | 422 | ✅ |
| Nonexistent resource | `GET /properties/9999999` | 404 | 404 | ✅ |
| Unknown API route | `GET /api/v1/nonexistent_xyz` | 404 JSON | 404 JSON | ✅ |

---

## API Response Format Consistency

All verified endpoints return:
```json
{
  "success": true | false,
  "message": "...",
  "data": { ... } | [ ... ],
  "meta": { "total": N, "page": N, "limit": N }  // where applicable
}
```

No endpoint returned HTML for API-level errors. No endpoint returned stack traces in production mode.

---

*Report generated: 2026-09-14*
