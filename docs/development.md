# Development Guide

## Prerequisites

| Tool | Minimum version | Install |
|------|-----------------|---------|
| Node.js | 18.x LTS | https://nodejs.org |
| npm | 9.x | Bundled with Node |
| MySQL | 8.0 (or MariaDB 10.4+) | https://dev.mysql.com/downloads/ or XAMPP |
| Git | 2.x | https://git-scm.com |

---

## First-time Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd real-estate-management-system
```

### 2. Configure environment variables

```bash
# Backend (required)
cd backend
copy .env.example .env    # Windows
# cp .env.example .env    # Linux/Mac

# Edit backend/.env and set:
#   DB_PASSWORD = your MySQL root/user password
#   JWT_SECRET  = run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
#   JWT_REFRESH_SECRET = run again for a different value
#   CORS_ORIGINS = http://localhost:3000 (dev) or LAN IP for production
```

```bash
# Frontend (optional — defaults work for dev)
cd frontend
copy .env.example .env    # Windows
# cp .env.example .env    # Linux/Mac
# VITE_API_BASE_URL defaults to /api (same-origin proxy)
```

### 3. Set up the MySQL database

**Option A — Import the complete schema (recommended, one command):**

```bash
mysql -u root -p < database/database.sql
```

This creates the database, all tables, views, and seeds property types.

**Option B — Manual steps:**

```sql
-- Run as MySQL root
CREATE DATABASE IF NOT EXISTS real_estate_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

```bash
# Run the full schema
mysql -u root -p real_estate_db < database/database.sql
```

### 4. Create the admin account

```bash
cd backend
node scripts/seed-admin.js
```

This creates the first admin user. Default credentials:
- Email: `admin@test.com`
- Password: `Admin@123456`

> **Change both immediately after first login.**

Alternatively, on a fresh database with no admin, the first `POST /api/v1/auth/register` call (bootstrap mode) creates the admin.

### 5. Verify the database

```bash
cd backend
node scripts/check-db.js
```

This confirms connectivity and that required tables exist.

### 6. Install dependencies

```bash
# From the project root
npm install --prefix backend
npm install --prefix frontend
```

### 7. Start development servers

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```
API available at: `http://localhost:5000`
Health check: `http://localhost:5000/health`

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```
App available at: `http://localhost:3000`

The Vite dev server proxies `/api/*` → `http://localhost:5000`, so API calls work without CORS issues during development.

---

## Environment Variables

All backend environment variables are in `backend/.env`. See `backend/.env.example` for the full reference.

Key variables:

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | Express port | `5000` |
| `HOST` | Bind address | `0.0.0.0` |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `real_estate_db` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | — |
| `JWT_SECRET` | Access token signing key (64-char hex) | — |
| `JWT_REFRESH_SECRET` | Refresh token signing key (different 64-char hex) | — |
| `JWT_EXPIRES_IN` | Access token lifetime | `8h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `COOKIE_SECRET` | Cookie signing key | — |
| `FORCE_HTTPS` | Enable `Secure` cookie flag | `false` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:3000` |
| `UPLOAD_DIR` | Upload path (relative to backend/) | `./uploads` |
| `MAX_FILE_SIZE_MB` | Max image size | `10` |
| `MAX_VIDEO_SIZE_MB` | Max video size | `500` |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run twice — use different output for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

---

## Database Migrations

Migrations live in `database/migrations/` and are numbered sequentially:

```
001_create_users_table.sql
002_create_property_types_table.sql
003_create_properties_table.sql
004_create_clients_table.sql          ← legacy name; creates the customers-related schema
005_create_contracts_table.sql
006_create_financials_table.sql
007_create_activity_log_table.sql
008_create_property_videos_table.sql
009_add_lat_lng_to_properties.sql
010_create_appointments_table.sql
011_create_refresh_tokens_table.sql
```

For **new installations**, use `database/database.sql` — it is the complete single-file schema and is always up to date.

For **updating an existing database**, run the migration script:
```bash
cd backend
node scripts/migrate-live-db.js
```

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `PropertyCard.jsx` |
| React hooks | camelCase, `use-` prefix | `usePropertyList.js` |
| Backend files | camelCase | `propertyController.js` |
| Database tables | snake_case, plural | `property_images` |
| SQL columns | snake_case | `created_at` |
| API routes | kebab-case, plural | `/api/v1/property-types` |
| Environment vars | SCREAMING_SNAKE | `DB_PASSWORD` |
| CSS classes | Tailwind utilities | `bg-primary-600 text-white` |

---

## Adding a New Module

**Backend checklist:**
1. Add migration SQL in `database/migrations/NNN_create_table.sql`
2. Create model in `backend/src/models/featureModel.js`
3. Create controller in `backend/src/controllers/featureController.js`
4. Create Joi validator in `backend/src/validators/featureValidator.js`
5. Create route file in `backend/src/routes/featureRoutes.js`
6. Mount route in `backend/src/routes/index.js`

**Frontend checklist:**
1. Create feature folder `frontend/src/features/featureName/`
2. Add service functions in `frontend/src/services/featureService.js`
3. Build components under `features/featureName/components/`
4. Add pages under `features/featureName/pages/`
5. Register route in `frontend/src/App.jsx`
6. Add nav item to `frontend/src/components/layout/Sidebar.jsx`
7. Add i18n keys to `frontend/src/i18n/locales/en.js` and `ar.js`

---

## Code Quality

```bash
# Lint
cd backend  && npm run lint
cd frontend && npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format with Prettier
npm run format
```

---

## Production Build

From the project root:

```bash
node scripts/build.js
```

Or equivalently:

```bash
npm run build
```

This:
1. Installs dependencies in `backend/` and `frontend/`
2. Runs `vite build` → `frontend/dist/`
3. Cleans `backend/public/`
4. Copies `frontend/dist/` → `backend/public/`

Then start the production server:

```bash
cd backend
npm start
```

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| CORS error in browser | Origin not in `CORS_ORIGINS` | Add the workstation IP to `.env` |
| `ER_ACCESS_DENIED_ERROR` | Wrong DB credentials | Check `DB_USER` / `DB_PASSWORD` in `.env` |
| `JsonWebTokenError` | Wrong `JWT_SECRET` | Make sure backend `.env` has the correct secret |
| Port already in use | Another process on 5000/3000 | Change `PORT` or `VITE_PORT` in `.env` |
| Upload fails | `uploads/` subfolders missing | `mkdir backend/uploads/properties backend/uploads/videos backend/uploads/documents backend/uploads/avatars` |
| "Refresh token has been revoked" | Token rotation invalidated old token | Use the new token returned by `/auth/refresh`, not the old one |
| SPA shows blank on refresh | `NODE_ENV` not `production` | Ensure `backend/.env` has `NODE_ENV=production` when running `npm start` |
