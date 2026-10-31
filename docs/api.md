# API Reference

Base URL: `http://<server-ip>:5000/api/v1`

**Authentication:** All endpoints except `POST /auth/login`, `POST /auth/refresh`, and `POST /auth/register` require:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Refresh tokens** are managed via HttpOnly cookie (`rems_rt`). The browser sends this cookie automatically. The `/auth/refresh` endpoint reads the token from the cookie only — not from the request body.

---

## Response Envelope

**Success**
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

**Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "email must be a valid email" }
  ]
}
```

---

## Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/login` | Authenticate — returns `accessToken` + sets `rems_rt` HttpOnly cookie | No |
| POST | `/auth/logout` | Revoke refresh token + clear cookie | Bearer |
| POST | `/auth/refresh` | Issue new access token using HttpOnly cookie | Cookie only |
| GET | `/auth/me` | Current user profile | Bearer |
| POST | `/auth/change-password` | Change own password (requires current password) | Bearer |
| POST | `/auth/register` | Bootstrap-only: create the first admin when no admin exists. After that, requires admin JWT. | Public (bootstrap) / Admin JWT |

### Login request/response

**Request:**
```json
{ "email": "user@example.com", "password": "Password@123" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "...", "role": "admin" },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```
The server also sets `Set-Cookie: rems_rt=<jwt>; HttpOnly; SameSite=Strict; Path=/api/v1/auth`.

### Refresh token behavior

- Refresh tokens are stored as SHA-256 hashes in the `refresh_tokens` database table.
- Each `/auth/refresh` call rotates the token: the old token is immediately revoked; a new token is issued.
- Reusing a revoked token returns `HTTP 401`.
- Logging out revokes the active token server-side.
- Token lifetime: access token 8 h, refresh token 7 d (configurable via `backend/.env`).

---

## Users (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users (filterable by role, is_active, search) |
| POST | `/users` | Create user |
| GET | `/users/:id` | Get user by ID |
| PUT | `/users/:id` | Update user |
| PATCH | `/users/:id/password` | Admin resets user password |
| PATCH | `/users/:id/deactivate` | Deactivate user (soft disable) |
| PATCH | `/users/:id/activate` | Re-activate user |
| DELETE | `/users/:id` | Delete user (blocked for last admin or own account) |

---

## Properties

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/properties` | List (filter, paginate, search) | All roles |
| POST | `/properties` | Create listing | All roles |
| GET | `/properties/types` | List property types | All roles |
| GET | `/properties/:id` | Get by ID | All roles |
| PUT | `/properties/:id` | Update listing | All roles |
| PATCH | `/properties/:id/status` | Update status only | All roles |
| DELETE | `/properties/:id` | Delete listing | Admin/Manager |
| GET | `/properties/:id/images` | List images | All roles |
| POST | `/properties/:id/images` | Upload images (multipart) | All roles |
| DELETE | `/properties/:id/images/:imageId` | Delete image | All roles |
| GET | `/properties/:id/videos` | List videos | All roles |
| POST | `/properties/:id/videos` | Upload video (multipart) | All roles |
| DELETE | `/properties/:id/videos/:videoId` | Delete video | All roles |

**Property status values:** `available` · `rented` · `sold` · `reserved` · `off_market`

**Listing type values:** `sale` · `rent` · `both`

---

## Customers

Note: The database table is named `customers`. The API path is `/customers`.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/customers/pipeline` | Pipeline counts by status | All roles |
| GET | `/customers` | List (filter, paginate) | All roles |
| POST | `/customers` | Create customer | All roles |
| GET | `/customers/:id` | Get by ID | All roles |
| PUT | `/customers/:id` | Update | All roles |
| PATCH | `/customers/:id/status` | Update status only | All roles |
| PATCH | `/customers/:id/assign` | Assign to employee | Admin/Manager |
| DELETE | `/customers/:id` | Delete | Admin/Manager |

**Customer status values:** `new` · `contacted` · `interested` · `negotiating` · `closed` · `lost`

---

## Appointments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/appointments/public` | Create appointment from public website | None |
| GET | `/appointments/stats` | Stats snapshot | Bearer |
| GET | `/appointments/property/:propertyId` | Appointments for a property | Bearer |
| GET | `/appointments/customer/:customerId` | Appointments for a customer | Bearer |
| GET | `/appointments` | List appointments | Bearer |
| POST | `/appointments` | Create appointment | Bearer |
| GET | `/appointments/:id` | Get by ID | Bearer |
| PUT | `/appointments/:id` | Full update | Bearer |
| PATCH | `/appointments/:id/status` | Update status | Bearer |
| PATCH | `/appointments/:id/reschedule` | Reschedule | Bearer |
| PATCH | `/appointments/:id/assign` | Assign to agent | Admin/Manager |
| DELETE | `/appointments/:id` | Delete | Admin/Manager |

**Appointment status values:** `pending` · `confirmed` · `rescheduled` · `cancelled` · `rejected` · `completed` · `no_show`

**Appointment type values:** `viewing` · `meeting` · `call` · `other`

---

## Reports

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/reports/dashboard` | KPI snapshot | All roles |
| GET | `/reports/properties` | Property statistics | All roles |
| GET | `/reports/customers` | Customer pipeline statistics | All roles |
| GET | `/reports/agents` | Agent performance | Admin only |
| GET | `/reports/financials` | Financial summary | Admin only |

> **Note on financials:** The `GET /reports/financials` endpoint returns empty data in this version because the Contracts module is not yet implemented. The report structure is correct; data will populate when contracts become available.

---

## Activities

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/activities` | Activity log (paginated, filterable) | Bearer |

---

## Contracts & Clients

Both `/contracts` and `/clients` routes exist but **return HTTP 501 Not Implemented** for all methods. These modules are planned for a future version.

---

## Pagination

List endpoints accept query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number (1-based) |
| `limit` | 20 | Records per page (max 100) |
| `sort` | `created_at` | Sort field |
| `order` | `DESC` | `ASC` or `DESC` |

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (missing, invalid, or expired token) |
| 403 | Forbidden (authenticated but insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate record) |
| 422 | Unprocessable Entity (Joi validation failed) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 501 | Not Implemented (contracts, clients modules) |
