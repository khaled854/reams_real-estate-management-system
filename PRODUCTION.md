# Real Estate Management System — Production Guide

## Quick Start (3 commands)

```bash
# From the project root (real-estate-management-system/)

npm run build          # Build React → copy to backend/public/
cd backend
npm start              # Start Express in production mode
```

Access at: **http://YOUR_SERVER_IP:5000** (LAN) or **http://localhost:5000** (server machine)

Run `ipconfig` on the server to find your LAN IP address.

---

## How Production Mode Works

In production, a single Express process on port 5000 serves everything:

```
http://SERVER_IP:5000/              → React SPA (backend/public/index.html)
http://SERVER_IP:5000/dashboard     → React Router catch-all → index.html
http://SERVER_IP:5000/login         → React Router catch-all → index.html
http://SERVER_IP:5000/api/v1/...    → REST API
http://SERVER_IP:5000/uploads/...   → Uploaded images and videos
http://SERVER_IP:5000/health        → Health check (JSON)
```

**No Vite dev server needed. No port 3000. One terminal.**

---

## Installation

### Prerequisites
- Node.js ≥ 18.0.0
- MySQL 8.x (running, database created)
- The `backend/.env` file configured (see below)

### Steps

```bash
# 1. Install all dependencies
npm install --prefix backend
npm install --prefix frontend

# 2. Configure environment (first time only)
#    Edit backend/.env — set DB password, JWT secrets, CORS_ORIGINS

# 3. Run migrations (first time only)
cd backend
node scripts/migrate-live-db.js

# 4. Seed the first admin account (first time only)
node scripts/seed-admin.js
# ⚠ IMPORTANT: Change the default password immediately after first login.
# Default: admin@test.com / Admin@123456

# 5. Build and start
cd ..
npm run build       # Builds React → backend/public/
cd backend
npm start           # Starts server in production mode
```

---

## Default Credentials

> ⚠ **MUST BE CHANGED IMMEDIATELY after first login on any production system.**

| Email | Password | Role |
|---|---|---|
| `admin@test.com` | `Admin@123456` | Admin |

To change: log in → Users → click your account → Change Password.
Or: Admin → Users → find your account → Reset Password.

---

## Environment Configuration

### `backend/.env` — Production values

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | Express port | `5000` |
| `HOST` | Must be `0.0.0.0` for LAN | `0.0.0.0` |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` (XAMPP default) |
| `DB_NAME` | Database name | `real_estate_db` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | *(your password)* |
| `JWT_SECRET` | 64-char hex string | *(generate below)* |
| `JWT_REFRESH_SECRET` | Different 64-char hex string | *(generate below)* |
| `CORS_ORIGINS` | Server's own LAN IP | `http://192.168.1.X:5000,http://localhost:5000` |
| `MAX_VIDEO_SIZE_MB` | Max video upload size | `500` |
| `COOKIE_SECRET` | Cookie signing secret (different from JWT secrets) | *(generate below)* |
| `FORCE_HTTPS` | Set `Secure` flag on refresh token cookie (HTTPS only) | `false` |
| `RATE_LIMIT_MAX` | Max API requests per 15-minute window | `500` |

### Generate JWT secrets (run once)

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this **twice** — once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET`. They must be different.

### CORS_ORIGINS for LAN

In production the frontend and API share the same origin (same IP, same port),
so browsers don't send CORS headers for the SPA. List the server's own IP here
for non-browser clients (Postman, mobile tools):

```
CORS_ORIGINS=http://192.168.1.X:5000,http://localhost:5000
```

Replace `192.168.1.X` with the actual IP shown by `ipconfig`.

---

## Authentication Notes

- **Access tokens** (8h): Stored in memory and Zustand's localStorage state. Sent in `Authorization: Bearer` header.
- **Refresh tokens** (7d): Stored in an `HttpOnly` cookie (`rems_rt`). JavaScript cannot read them directly.
- **Token rotation**: Each `/auth/refresh` call revokes the old token server-side and issues a new one. Using a revoked token returns HTTP 401.
- **Logout**: Revokes the refresh token in the database. Old tokens are permanently invalidated.
- **Token revocation table**: `refresh_tokens` database table tracks active/revoked tokens by SHA-256 hash.

---

```bash
# From project root
npm run build
```

This:
1. Installs dependencies in both `frontend/` and `backend/`
2. Runs `vite build` → `frontend/dist/`
3. Cleans `backend/public/`
4. Copies `frontend/dist/` → `backend/public/`

Then restart Express:
```bash
cd backend && npm start
```

---

## URL Reference

| URL | Description |
|---|---|
| http://localhost:5000 | App on the server machine |
| http://SERVER_IP:5000 | App from any office PC on the LAN |
| http://localhost:5000/health | Health check |

To find `SERVER_IP`: run `ipconfig` on the server machine and note the `IPv4 Address`.

---

## File Structure (production)

```
real-estate-management-system/
├── package.json               ← Root: npm run build, npm start
├── scripts/
│   └── build.js               ← Build script (build + copy)
├── frontend/
│   ├── src/                   ← React source
│   ├── dist/                  ← Vite output (after build)
│   └── .env.production        ← Auto-written by scripts/build.js
└── backend/
    ├── server.js              ← Entry point
    ├── app.js                 ← Express config (SPA serving)
    ├── .env                   ← Runtime environment (NODE_ENV=production)
    ├── public/                ← Copied from frontend/dist/ by build script
    │   ├── index.html
    │   ├── favicon.svg
    │   └── assets/
    │       ├── index-*.js
    │       ├── index-*.css
    │       └── ...
    ├── uploads/               ← User-uploaded files (NOT in public/)
    │   ├── properties/        ← Property images
    │   ├── videos/            ← Property videos
    │   ├── documents/         ← Reserved for future use
    │   └── avatars/           ← User avatars
    └── logs/                  ← Application logs
```

---

## Verification Checklist

After starting, verify these all return the expected results:

```bash
# 1. Health check
curl http://localhost:5000/health
# → {"status":"ok","environment":"production",...}

# 2. SPA served
curl -I http://localhost:5000/
# → HTTP 200, Content-Type: text/html

# 3. React Router catch-all (deep links work on refresh)
curl -I http://localhost:5000/dashboard
# → HTTP 200, Content-Type: text/html

# 4. API works (replace credentials if you've already changed the default password)
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin@123456"}'
# → {"success":true,"data":{"user":{...},"accessToken":"..."}}
# ⚠ Use your actual email/password if you have already changed the defaults

# 5. LAN access (replace IP with your actual server IP)
curl http://SERVER_IP:5000/health
```

---

## Troubleshooting

### "Cannot connect" from other PCs
- Check `HOST=0.0.0.0` in `backend/.env`
- Check Windows Firewall: allow inbound on TCP port 5000
  ```cmd
  netsh advfirewall firewall add rule name="REMS Port 5000" ^
    dir=in action=allow protocol=TCP localport=5000
  ```

### Page refreshes show "Cannot GET /path"
- This means `NODE_ENV` is not `production` — the SPA catch-all is disabled
- Verify: `curl http://localhost:5000/health` shows `"environment":"production"`

### Images not loading
- Verify `UPLOAD_DIR=./uploads` in `backend/.env`
- Check `backend/uploads/properties/` exists
- Test: `curl http://localhost:5000/uploads/properties/<filename.jpg>`

### Login returns 500
- Check MySQL is running
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in `backend/.env`
- Check logs: `backend/logs/combined.log`

### "CORS: origin is not allowed"
- Add the client's IP to `CORS_ORIGINS` in `backend/.env`
- Restart Express after changing `.env`

### Dashboard shows 0 for contracts / revenue
- This is expected in this version. The Contracts module is not yet implemented.
- Properties, customers, and appointments counts are live and accurate.
