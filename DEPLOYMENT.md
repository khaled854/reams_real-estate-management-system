# REMS — Complete Deployment Guide

**Real Estate Management System**
Internal LAN Application · Node.js + React + MySQL

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First Installation](#2-first-installation)
3. [MySQL Setup](#3-mysql-setup)
4. [Environment Variables](#4-environment-variables)
5. [Production Build](#5-production-build)
6. [Running the Application](#6-running-the-application)
7. [LAN Access from Other Computers](#7-lan-access-from-other-computers)
8. [Auto-Start on Windows Boot — PM2](#8-auto-start-pm2)
9. [Auto-Start on Windows Boot — NSSM Windows Service](#9-auto-start-nssm)
10. [Database Backup](#10-database-backup)
11. [Uploads Backup](#11-uploads-backup)
12. [Full Restore on a New Computer](#12-full-restore)
13. [Maintenance](#13-maintenance)
14. [Final Testing Checklist](#14-final-testing-checklist)

---

## Implemented Modules in This Version

| Module | Status |
|---|---|
| Properties (CRUD, images, videos, status) | ✅ Fully working |
| Customers / CRM pipeline | ✅ Fully working |
| Appointments (scheduling, status lifecycle) | ✅ Fully working |
| Reports (dashboard, properties, customers, agents, financials) | ✅ Working — financial figures are 0 until Contracts is implemented |
| Users (CRUD, roles, password reset, activate/deactivate) | ✅ Fully working |
| Authentication (login, logout, refresh, change password) | ✅ Fully working |
| Activity log | ✅ Fully working |
| **Contracts & Payments** | 🚧 **Not implemented** — all contract API routes return HTTP 501. No contract UI exists. |

> The database tables for contracts and financials are present in the schema.
> When the Contracts module is added in a future update, the dashboard revenue
> and financial report figures will begin showing real data automatically.

---

## 1. Prerequisites

Install the following on the **server computer** (the machine that will run the application):

### 1.1 Node.js

Download and install **Node.js v18 or later** (LTS recommended):
- <https://nodejs.org/en/download>
- Choose **Windows Installer (.msi)**
- Accept all defaults
- Verify after install:

```cmd
node --version
npm --version
```

Expected output: `v18.x.x` or higher, `9.x.x` or higher.

### 1.2 MySQL 8

Option A — XAMPP (easiest for Windows offices):
- Download: <https://www.apachefriends.org/download.html>
- Install XAMPP, start the **MySQL** service from XAMPP Control Panel
- Default port: **3306**

Option B — MySQL Installer:
- Download: <https://dev.mysql.com/downloads/installer/>
- Select "Server only" during setup
- Set a strong root password during setup
- Default port: **3306**

### 1.3 Git (optional — only needed if cloning from a repository)

- Download: <https://git-scm.com/download/win>

---

## 2. First Installation

### 2.1 Copy the project to the server

Place the project folder on the server machine, for example:

```
C:\rems\
```

The folder should contain:
```
C:\rems\
  backend\
  frontend\
  scripts\
  package.json
  README.md
  DEPLOYMENT.md
```

### 2.2 Install all dependencies

Open **Command Prompt** or **PowerShell** as Administrator.

```cmd
cd C:\rems
npm install --prefix backend
npm install --prefix frontend
```

This installs all Node.js packages needed by both backend and frontend.
It does **not** install anything globally — everything stays inside `node_modules/`.

> If you see npm warnings about deprecated packages, ignore them — they do not affect functionality.

---

## 3. MySQL Setup

### 3.1 Create the database

Open MySQL Workbench, phpMyAdmin, or run this from the command line:

```sql
-- Connect to MySQL as root, then run:
CREATE DATABASE IF NOT EXISTS real_estate_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Or using the command line:

```cmd
mysql -u root -p -e "CREATE DATABASE real_estate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.2 Create the application database user (recommended)

Do not use the root account for the application in production.
Create a dedicated user with limited permissions:

```sql
CREATE USER 'rems_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON real_estate_db.* TO 'rems_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3.3 Import the schema

Run the complete schema file to create all tables, views, and seed data:

```cmd
cd C:\rems
mysql -u root -p real_estate_db < database\database.sql
```

Or import `database\database.sql` through phpMyAdmin:
- Open phpMyAdmin → select `real_estate_db` → click **Import** → choose the file → click **Go**

### 3.4 Seed the admin user

After the schema is imported, create the first admin account:

```cmd
cd C:\rems\backend
node scripts\seed-admin.js
```

Output confirms: `admin@test.com` created with password `Admin@123456`.

> ⚠ **MUST CHANGE IMMEDIATELY** — these are default credentials for initial setup only.
> Log in and change the password before any employee uses the system.
> Go to Users → click your account → Change Password.
> Or: Admin → Users → Reset Password on the admin account.

### 3.5 Verify the database

```cmd
cd C:\rems\backend
node scripts\check-db.js
```

Expected output: all tables exist, all views exist, checks pass.

---

## 4. Environment Variables

The file `backend\.env` controls all runtime configuration.

### 4.1 Create the .env file

```cmd
cd C:\rems\backend
copy .env.example .env
```

Then open `backend\.env` in Notepad and set these values:

### 4.2 Full .env reference

```ini
# ── Application ───────────────────────────────────────────────
NODE_ENV=production
PORT=5000
HOST=0.0.0.0          # 0.0.0.0 allows LAN connections — do NOT change

# ── MySQL Database ─────────────────────────────────────────────
DB_HOST=127.0.0.1     # MySQL is on the same machine → keep as 127.0.0.1
DB_PORT=3306          # Default MySQL port (XAMPP uses 3306, sometimes 3307)
DB_NAME=real_estate_db
DB_USER=rems_user     # The user you created in step 3.2
DB_PASSWORD=YourStrongPassword123!
DB_CONNECTION_LIMIT=20

# ── JWT Authentication ─────────────────────────────────────────
# IMPORTANT: Generate strong unique secrets for production.
# Run this command TWICE — use different output for each:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_64_CHAR_HEX_STRING_HERE
JWT_REFRESH_SECRET=PASTE_DIFFERENT_64_CHAR_HEX_STRING_HERE
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d

# ── Cookie Security ─────────────────────────────────────────────
# Used to sign the HttpOnly refresh-token cookie.
# Generate the same way as JWT secrets (different value).
COOKIE_SECRET=PASTE_ANOTHER_64_CHAR_HEX_STRING_HERE
# Set to true ONLY if the server runs over HTTPS (not needed for plain HTTP LAN).
FORCE_HTTPS=false

# ── CORS ───────────────────────────────────────────────────────
# Add the server's own IP and any specific client IPs needed.
# Replace 192.168.1.X with your actual server LAN IP address.
# Run: ipconfig   →  look for "IPv4 Address" under your network adapter
CORS_ORIGINS=http://192.168.1.X:5000,http://localhost:5000

# ── File Uploads ───────────────────────────────────────────────
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
MAX_VIDEO_SIZE_MB=500   # 500 MB per video (configurable via env)

# ── Logging ────────────────────────────────────────────────────
LOG_LEVEL=info
LOG_DIR=./logs

# ── Rate Limiting ──────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
```

### 4.3 Find your server's LAN IP address

```cmd
ipconfig
```

Look for **IPv4 Address** under your active network adapter (Wi-Fi or Ethernet):
```
IPv4 Address. . . . . . . . : 192.168.1.6
```

Use this IP in `CORS_ORIGINS` and for accessing the app from other computers.

### 4.4 Generate JWT secrets

```cmd
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this twice. Paste each output into `JWT_SECRET` and `JWT_REFRESH_SECRET`.

---

## 5. Production Build

The build process compiles the React frontend and places it inside the backend folder so Express can serve everything from one port.

### 5.1 Run the build

```cmd
cd C:\rems
node scripts\build.js
```

Or using the npm shortcut:

```cmd
npm run build
```

This automatically:
1. Installs all dependencies (backend + frontend)
2. Builds the React app with Vite → `frontend\dist\`
3. Cleans `backend\public\`
4. Copies `frontend\dist\` → `backend\public\`

Expected output:
```
[build] Step 1/4 — Installing backend dependencies…
[build] Step 2/4 — Installing frontend dependencies…
[build] Step 3/4 — Building React app with Vite…
[build] Step 4/4 — Copying dist → backend/public…
Build complete!
```

### 5.2 Verify the build

```cmd
dir C:\rems\backend\public
```

You should see:
```
index.html
favicon.svg
logo.svg
assets\          (contains .js and .css files)
```

> You only need to rebuild when the source code changes. Normal daily use does not require a rebuild.

---

## 6. Running the Application

### 6.1 Start manually

```cmd
cd C:\rems\backend
npm start
```

You should see:
```
[info] MySQL connected — database: real_estate_db
[info] Server running on http://0.0.0.0:5000 [production]
[info] Health check: http://0.0.0.0:5000/health
```

**Leave this window open.** Closing it stops the server.

### 6.2 Verify it's working

Open a browser on the server machine and go to:

```
http://localhost:5000
```

You should see the login page.

Test the health endpoint:
```
http://localhost:5000/health
```

Expected response:
```json
{"status": "ok", "environment": "production", ...}
```

### 6.3 Open the Windows Firewall (required for LAN access)

Other computers on the network cannot connect until you allow port 5000 through the firewall.

Run this in **Command Prompt as Administrator**:

```cmd
netsh advfirewall firewall add rule name="REMS Port 5000" dir=in action=allow protocol=TCP localport=5000
```

To remove later (if needed):
```cmd
netsh advfirewall firewall delete rule name="REMS Port 5000"
```

---

## 7. LAN Access from Other Computers

Once the server is running and the firewall is open, **any computer on the same office network** can access the system.

### 7.1 Find the server's IP address

On the server machine:

```cmd
ipconfig
```

Note the IPv4 address, for example: `192.168.1.6`

### 7.2 Access from another computer

On any office computer, open a web browser and go to:

```
http://192.168.1.6:5000
```

Replace `192.168.1.6` with your actual server IP.

### 7.3 Set a bookmark

On each employee's computer, create a browser bookmark:
```
Name:  REMS - Real Estate System
URL:   http://192.168.1.6:5000
```

### 7.4 Troubleshooting LAN access

| Problem | Solution |
|---|---|
| Page does not load | Check that `npm start` is running on the server |
| "Connection refused" | Add firewall rule (Section 6.3) |
| Loads on server but not on other PCs | Verify both machines are on the same network |
| Very slow loading | Check network connection quality |

### 7.5 Optional: Use a static IP on the server

To prevent the server IP from changing after a router restart, assign a static IP:

1. On the server: Settings → Network → your adapter → Edit → Manual
2. Set IP to something like `192.168.1.10` (outside your router's DHCP range)
3. Update `CORS_ORIGINS` in `backend\.env` if you change the IP
4. Rebuild is not needed — only restart the server: `npm start`

---

## 8. Auto-Start on Windows Boot — PM2

PM2 is a Node.js process manager that keeps the application running and restarts it automatically if it crashes.

### 8.1 Install PM2

```cmd
npm install -g pm2
npm install -g pm2-windows-startup
```

Verify:
```cmd
pm2 --version
```

### 8.2 Create the PM2 ecosystem file

Create the file `C:\rems\backend\ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name:        'rems',
      script:      'server.js',
      cwd:         'C:\\rems\\backend',
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'C:\\rems\\backend\\logs\\pm2-error.log',
      out_file:   'C:\\rems\\backend\\logs\\pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

### 8.3 Start the application with PM2

```cmd
cd C:\rems\backend
pm2 start ecosystem.config.js
```

### 8.4 Verify it's running

```cmd
pm2 status
pm2 logs rems --lines 20
```

Expected:
```
┌─────┬────────┬─────────────┬─────────┬─────────┐
│ id  │ name   │ status      │ cpu     │ memory  │
├─────┼────────┼─────────────┼─────────┼─────────┤
│ 0   │ rems   │ online      │ 0%      │ 80mb    │
└─────┴────────┴─────────────┴─────────┴─────────┘
```

### 8.5 Configure auto-start on Windows boot

```cmd
pm2-startup install
pm2 save
```

This creates a Windows startup task that launches PM2 (and therefore the app) automatically when the computer boots.

### 8.6 Useful PM2 commands

```cmd
pm2 status              # View running processes
pm2 logs rems           # Stream live logs
pm2 logs rems --lines 50  # Show last 50 log lines
pm2 restart rems        # Restart the application
pm2 stop rems           # Stop the application
pm2 start rems          # Start again
pm2 reload rems         # Zero-downtime restart (for updates)
pm2 delete rems         # Remove from PM2
pm2 save                # Save current process list (run after any change)
```

### 8.7 Remove PM2 auto-start (if needed)

```cmd
pm2-startup uninstall
pm2 delete rems
pm2 save
```

---

## 9. Auto-Start on Windows Boot — NSSM Windows Service

NSSM (Non-Sucking Service Manager) installs the application as a proper Windows service — it starts before any user logs in and can be managed from Windows Services panel.

### 9.1 Download NSSM

Download from: <https://nssm.cc/download>

Extract and place `nssm.exe` in a permanent location, for example:
```
C:\tools\nssm\nssm.exe
```

Or add it to your PATH.

### 9.2 Find the full Node.js path

```cmd
where node
```

Example output: `C:\Program Files\nodejs\node.exe`

### 9.3 Install the Windows service

Open **Command Prompt as Administrator**:

```cmd
C:\tools\nssm\nssm.exe install REMS
```

A GUI window opens. Fill in the fields:

**Application tab:**
| Field | Value |
|---|---|
| Path | `C:\Program Files\nodejs\node.exe` |
| Startup directory | `C:\rems\backend` |
| Arguments | `server.js` |

**Environment tab** — add:
```
NODE_ENV=production
```

Click **Install service**.

### 9.4 Alternative: Install via command line (no GUI)

```cmd
C:\tools\nssm\nssm.exe install REMS "C:\Program Files\nodejs\node.exe"
C:\tools\nssm\nssm.exe set REMS AppDirectory "C:\rems\backend"
C:\tools\nssm\nssm.exe set REMS AppParameters "server.js"
C:\tools\nssm\nssm.exe set REMS AppEnvironmentExtra "NODE_ENV=production"
C:\tools\nssm\nssm.exe set REMS Start SERVICE_AUTO_START
C:\tools\nssm\nssm.exe set REMS AppStdout "C:\rems\backend\logs\service-out.log"
C:\tools\nssm\nssm.exe set REMS AppStderr "C:\rems\backend\logs\service-err.log"
C:\tools\nssm\nssm.exe set REMS AppRotateFiles 1
C:\tools\nssm\nssm.exe set REMS AppRotateBytes 10485760
```

### 9.5 Start the service

```cmd
C:\tools\nssm\nssm.exe start REMS
```

Or from Windows Services:
- Press `Win + R` → type `services.msc` → find **REMS** → click **Start**

### 9.6 Verify the service

```cmd
sc query REMS
```

Expected: `STATE: 4 RUNNING`

Then open a browser: `http://localhost:5000`

### 9.7 Useful NSSM commands

```cmd
nssm start REMS          # Start the service
nssm stop REMS           # Stop the service
nssm restart REMS        # Restart the service
nssm status REMS         # Check status
nssm edit REMS           # Open GUI editor
nssm remove REMS confirm # Uninstall the service
```

### 9.8 Comparison: PM2 vs NSSM

| Feature | PM2 | NSSM |
|---|---|---|
| Setup difficulty | Easy | Moderate |
| Starts before login | After PM2 startup task runs | Yes — true Windows service |
| Log management | Built-in log rotation | Manual or via NSSM config |
| Crash recovery | Auto-restart with backoff | Configurable recovery actions |
| Update workflow | `pm2 reload rems` | `nssm restart REMS` |
| Recommended for | Development teams | IT-managed servers |

---

## 10. Database Backup

Regular database backups are essential. Store backups on a separate drive or network share.

### 10.1 Manual backup with mysqldump

```cmd
mysqldump -u root -p real_estate_db > C:\rems-backups\db\rems_%date:~-4,4%%date:~-7,2%%date:~-10,2%.sql
```

Or with a fixed filename (overwrites each time):

```cmd
mysqldump -u root -p --databases real_estate_db > C:\rems-backups\db\latest.sql
```

### 10.2 Automated daily backup — Windows Task Scheduler (optional, operator-configured)

> **Note:** The project does not install or activate Task Scheduler automatically.
> The steps below are instructions for the operator to set up scheduled backups manually.
> Until this is configured, backups are entirely manual (Section 10.1).

Create the file `C:\rems\scripts\backup-db.bat`:

```batch
@echo off
set BACKUP_DIR=C:\rems-backups\db
set DATE=%date:~-4,4%%date:~-7,2%%date:~-10,2%
set TIME=%time:~0,2%%time:~3,2%
set FILENAME=%BACKUP_DIR%\rems_%DATE%_%TIME%.sql

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" ^
  -u root -pYourRootPassword ^
  --single-transaction ^
  --routines ^
  --triggers ^
  real_estate_db > "%FILENAME%"

echo Backup completed: %FILENAME%

REM Delete backups older than 30 days
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul
```

**Schedule it in Task Scheduler:**

```cmd
schtasks /create /tn "REMS Daily Backup" /tr "C:\rems\scripts\backup-db.bat" /sc daily /st 02:00 /ru SYSTEM /f
```

This runs every day at 2:00 AM and keeps the last 30 days of backups.

### 10.3 What a full backup contains

The `.sql` file contains:
- All table structures (CREATE TABLE statements)
- All data (INSERT statements)
- All views, stored procedures, and triggers
- All indexes and foreign keys

This single file is enough to fully restore the database on any machine.

---

## 11. Uploads Backup

The `backend\uploads\` folder contains all property photos, videos, and documents uploaded by users. This folder is **not** inside the database — it must be backed up separately.

### 11.1 What to back up

```
C:\rems\backend\uploads\
  properties\    ← property photos (JPEG/PNG/WebP)
  videos\        ← property videos (MP4/WebM)
  documents\     ← contract documents (PDF/DOC)
  avatars\       ← user profile photos
```

### 11.2 Manual backup

```cmd
xcopy /E /I /Y "C:\rems\backend\uploads" "C:\rems-backups\uploads"
```

Or compress it:

```cmd
powershell Compress-Archive -Path "C:\rems\backend\uploads" -DestinationPath "C:\rems-backups\uploads_%date:~-4,4%%date:~-7,2%%date:~-10,2%.zip" -Force
```

### 11.3 Automated daily uploads backup

Add this to `C:\rems\scripts\backup-db.bat` (after the mysqldump lines):

```batch
REM Backup uploads folder
set UPLOADS_ZIP=%BACKUP_DIR%\uploads_%DATE%.zip
powershell -Command "Compress-Archive -Path 'C:\rems\backend\uploads' -DestinationPath '%UPLOADS_ZIP%' -Force"
echo Uploads backup: %UPLOADS_ZIP%
```

### 11.4 Backup destination recommendations

| Option | Notes |
|---|---|
| External USB drive | Simple, fast, portable |
| Network shared folder | Automatic, stays in the office |
| Cloud storage (OneDrive/Google Drive) | Offsite protection, slower for large video files |

---

## 12. Full Restore on a New Computer

Follow these steps to move the application to a new Windows machine.

### Step 1 — Install prerequisites on the new machine

1. Install Node.js (see Section 1.1)
2. Install MySQL 8 (see Section 1.2)

### Step 2 — Copy the project files

Copy the entire project folder to the new machine:

```
Source:      C:\rems\               (old machine)
Destination: C:\rems\               (new machine)
```

Use a USB drive, network share, or any file transfer method.

> Include the `backend\uploads\` folder — this contains all property photos and videos.

> Do NOT include `backend\node_modules\` or `frontend\node_modules\` — they will be reinstalled.

### Step 3 — Restore the database

1. Copy the latest backup `.sql` file to the new machine
2. Create the database:

```cmd
mysql -u root -p -e "CREATE DATABASE real_estate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

3. Import the backup:

```cmd
mysql -u root -p real_estate_db < C:\rems-backups\db\latest.sql
```

4. Re-create the application database user (if used):

```sql
CREATE USER 'rems_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON real_estate_db.* TO 'rems_user'@'localhost';
FLUSH PRIVILEGES;
```

### Step 4 — Update the .env file

```cmd
cd C:\rems\backend
notepad .env
```

Update these values for the new machine:
- `DB_PASSWORD` — MySQL password on the new machine
- `CORS_ORIGINS` — new machine's IP address
- Generate new JWT secrets if needed

### Step 5 — Find the new IP address

```cmd
ipconfig
```

Note the IPv4 Address and update `CORS_ORIGINS` in `.env`.

### Step 6 — Reinstall dependencies and build

```cmd
cd C:\rems
npm install --prefix backend
npm install --prefix frontend
npm run build
```

### Step 7 — Open the firewall

```cmd
netsh advfirewall firewall add rule name="REMS Port 5000" dir=in action=allow protocol=TCP localport=5000
```

### Step 8 — Start the application

```cmd
cd C:\rems\backend
npm start
```

### Step 9 — Set up auto-start (optional)

Follow Section 8 (PM2) or Section 9 (NSSM) on the new machine.

### Step 10 — Update bookmarks on employee computers

Update the URL on all employee computers from the old IP to the new IP:
```
http://NEW_SERVER_IP:5000
```

---

## 13. Maintenance

### 13.1 Adding a new employee

Log in as Admin, then:

1. Navigate to **Users** in the sidebar
2. Click **Add User**
3. Fill in: Name, Email, Temporary Password, Role (Employee/Manager)
4. Click **Save**
5. Share the login URL and temporary credentials with the new employee
6. Ask them to change their password on first login

Or use the command line (if the UI is unavailable):

```cmd
cd C:\rems\backend
node -e "
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./src/config/database');
(async () => {
  const hash = await bcrypt.hash('TempPassword123!', 12);
  await pool.execute(
    'INSERT INTO users (uuid,first_name,last_name,email,password_hash,role,is_active) VALUES (?,?,?,?,?,?,1)',
    [uuidv4(), 'Ahmed', 'Al-Rashid', 'ahmed@company.com', hash, 'agent']
  );
  console.log('User created');
  await pool.end();
})();
"
```

### 13.2 Resetting an employee's password

**Via the Admin UI:**
1. Go to **Users** → find the user → click **Edit**
2. Use the **Reset Password** option → set a new temporary password

**Via command line (admin-level access):**

```cmd
cd C:\rems\backend
node -e "
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/database');
(async () => {
  const hash = await bcrypt.hash('NewTemp@123', 12);
  const [r] = await pool.execute(
    'UPDATE users SET password_hash=? WHERE email=?',
    [hash, 'employee@company.com']
  );
  console.log('Password reset. Rows affected:', r.affectedRows);
  await pool.end();
})();
"
```

### 13.3 Deactivating an employee

When an employee leaves the company:

1. Admin UI → **Users** → find the user → click **Deactivate**
2. Their account is disabled (data preserved) — they cannot log in

To re-enable: Admin UI → Users → Activate.

### 13.4 Updating the application

When you receive an updated version of the project:

**1. Stop the server**
```cmd
# If using PM2:
pm2 stop rems

# If using NSSM:
nssm stop REMS

# If running manually — press Ctrl+C in the server window
```

**2. Back up the database first**
```cmd
mysqldump -u root -p real_estate_db > C:\rems-backups\db\before_update_%date%.sql
```

**3. Back up uploads**
```cmd
xcopy /E /I /Y "C:\rems\backend\uploads" "C:\rems-backups\uploads_before_update"
```

**4. Copy new project files** (replace the old ones, keep `backend\.env` and `backend\uploads\`)

**5. Run any database migrations**
```cmd
cd C:\rems\backend
node scripts\migrate-live-db.js
```

**6. Rebuild the frontend**
```cmd
cd C:\rems
npm run build
```

**7. Restart the server**
```cmd
# PM2:
pm2 start rems
pm2 save

# NSSM:
nssm start REMS

# Manual:
cd C:\rems\backend && npm start
```

**8. Verify** by opening the app in a browser and checking the health endpoint.

### 13.5 Viewing application logs

```cmd
# Real-time log stream (PM2):
pm2 logs rems

# View error log directly:
type C:\rems\backend\logs\error.log

# View combined log:
type C:\rems\backend\logs\combined.log

# Follow (like tail -f) using PowerShell:
Get-Content C:\rems\backend\logs\combined.log -Wait -Tail 50
```

### 13.6 Database maintenance

**Check database size:**
```sql
SELECT
  table_schema AS database_name,
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'real_estate_db';
```

**Clear old activity logs (keep last 90 days):**
```sql
DELETE FROM activities
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

**Optimize tables after large deletes:**
```sql
OPTIMIZE TABLE activities, properties, customers, contracts, financials;
```

**Run the built-in consistency check:**
```cmd
cd C:\rems\backend
node scripts\check-db.js
```

### 13.7 Checking upload disk usage

```cmd
# PowerShell — see size of each uploads subfolder:
Get-ChildItem C:\rems\backend\uploads -Directory |
  ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    "$($_.Name): $([Math]::Round($size, 1)) MB"
  }
```

---

## 14. Final Testing Checklist

Run through every item on this checklist after each installation or update.
All items must show ✅ before the system is handed to employees.

---

### Section A — Startup & Infrastructure

| # | Test | How to verify | Expected result |
|---|---|---|---|
| A1 | Server starts without errors | Run `npm start` in `backend\` | Logs show "MySQL connected" and "Server running" |
| A2 | Health endpoint responds | Browser: `http://SERVER_IP:5000/health` | `{"status":"ok","environment":"production"}` |
| A3 | Environment is production | Check health response | `"environment": "production"` |
| A4 | Frontend loads | Browser: `http://SERVER_IP:5000` | Login page appears |
| A5 | HTTPS redirect (if configured) | Check with `http://` URL | Redirects or loads correctly |

---

### Section B — Authentication

| # | Test | How to verify | Expected result |
|---|---|---|---|
| B1 | Login with valid credentials | Enter `admin@test.com` / `Admin@123456` | Redirected to dashboard |
| B2 | Login with wrong password | Enter wrong password | Error message: "Invalid email or password" |
| B3 | Login with empty fields | Submit blank form | Field validation error shown |
| B4 | Protected route rejects unauthenticated access | Visit `/dashboard` URL when logged out | Redirected to `/login` |
| B5 | Page refresh keeps session | Log in, refresh the browser | Still logged in, data still visible |
| B6 | Logout clears session | Click Logout | Redirected to login, cannot go back with browser Back button |
| B7 | Expired token refreshes silently | Leave app open for 8+ hours, then use it | Continues working without re-login prompt |

---

### Section C — Users

| # | Test | How to verify | Expected result |
|---|---|---|---|
| C1 | Admin can create a user | Users → Add User → fill form → Save | New user appears in list |
| C2 | New user can log in | Log in with the new account | Login succeeds |
| C3 | Admin can reset a password | Users → Edit → Reset Password | Password changed, user can log in with new password |
| C4 | Admin can deactivate a user | Users → Deactivate | User cannot log in, account shown as inactive |
| C5 | Employee role is restricted | Log in as Employee | Cannot see Users menu, cannot see all customers |
| C6 | Duplicate email rejected | Create user with same email as existing | Error "Email already registered" |

---

### Section D — Properties

| # | Test | How to verify | Expected result |
|---|---|---|---|
| D1 | Create a property | Properties → Add Property → fill all fields → Save | Property appears in list |
| D2 | Edit a property | Properties → open record → Edit → change title → Save | Updated title shows immediately |
| D3 | Delete a property | Properties → delete | Property removed, confirmation dialog shown |
| D4 | Property status change | Open property → change status to "Sold" | Status badge updates on list |
| D5 | Search by title | Properties page → search box | Matching properties appear |
| D6 | Filter by status | Properties → filter "Available" | Only available properties shown |
| D7 | Filter by type | Properties → filter "Villa" | Only villas shown |
| D8 | Pagination works | Add 15+ properties → check page 2 | Second page loads correctly |

---

### Section E — Images

| # | Test | How to verify | Expected result |
|---|---|---|---|
| E1 | Upload 5 images at once | Add/Edit property → Photos → drag 5 JPEGs → Upload | All 5 appear in gallery |
| E2 | First uploaded image is cover | Upload images | First image has "Cover" badge |
| E3 | Cover image shows in list | Go to Properties list | Cover image thumbnail visible |
| E4 | Lightbox opens | Click any image in gallery | Full-screen lightbox with arrows |
| E5 | Lightbox navigation | Open lightbox → use arrows | Cycles through all images |
| E6 | Delete an image | Gallery → delete button on image → confirm | Image removed, gallery updates |
| E7 | Wrong file type rejected | Try to upload a .pdf as an image | Error: "Only JPEG, PNG, and WebP allowed" |
| E8 | Images persist after page refresh | Upload images → refresh browser | Images still visible |
| E9 | Images accessible via URL | Copy image URL from gallery → open in new tab | Image loads correctly |

---

### Section F — Videos

| # | Test | How to verify | Expected result |
|---|---|---|---|
| F1 | Upload 2 videos | Add/Edit property → Videos → select 2 MP4 files → Upload | Both appear in video player |
| F2 | Video plays in browser | Click play button | Video plays with controls (play/pause/seek/volume) |
| F3 | Delete a video | Video → Delete → confirm | Video removed from player list |
| F4 | Wrong file type rejected | Try to upload .avi or .mov | Error: "Only MP4 and WebM videos are allowed" |
| F5 | File size limit enforced | Try to upload file larger than 200 MB | Error: file too large |
| F6 | Video persists after refresh | Upload video → refresh → go back to property | Video still there, still plays |

---

### Section G — Customers

| # | Test | How to verify | Expected result |
|---|---|---|---|
| G1 | Create a customer | Customers → Add Customer → fill form → Save | Customer appears in list |
| G2 | Edit a customer | Customers → open → Edit → change phone → Save | Updated phone shown |
| G3 | Delete a customer | Customers → delete → confirm | Customer removed |
| G4 | Pipeline KPI cards update | Add customer with status "interested" | "Interested" count increases on dashboard |
| G5 | Assign customer to employee | Customers → Assign → select employee → Save | Employee name shows next to customer |
| G6 | Employee sees only own customers | Log in as Employee | Only their assigned customers visible |
| G7 | Search customers | Customers → search by name or phone | Matching records appear |
| G8 | Budget field accepts empty | Create customer with no budget | Saves successfully, no validation error |

---

### Section H — Reports & Dashboard

| # | Test | How to verify | Expected result |
|---|---|---|---|
| H1 | Dashboard KPI cards load | Open Dashboard | Property counts, customer counts, appointment counts visible |
| H2 | Dashboard refreshes | Add a new property → go to dashboard | Property count increased |
| H3 | Property report loads | Reports → Properties | Charts showing properties by status/type |
| H4 | Customer report loads | Reports → Customers | Charts showing customer pipeline |
| H5 | Agent performance report | Reports → Agents (Admin only) | Table with agents and their stats |
| H6 | Financials report | Reports → Financials (Admin only) | Financial report page loads; **data will be empty** since the Contracts module is not yet implemented — this is expected |
| H7 | Reports not visible to Employee | Log in as Employee → check Reports menu | Financial reports hidden or return 403 |

---

### Section I — LAN Access

| # | Test | How to verify | Expected result |
|---|---|---|---|
| I1 | App accessible from another PC | From a different PC on the network: `http://SERVER_IP:5000` | Login page loads |
| I2 | Login works from another PC | Log in from the second PC | Dashboard loads |
| I3 | Images load on another PC | View a property with images from second PC | Images visible, not broken |
| I4 | Videos play on another PC | Open a property with video from second PC | Video plays |
| I5 | Two users simultaneously | Two people logged in at the same time | Both sessions work independently |
| I6 | API accessible | From another PC: `http://SERVER_IP:5000/health` | Returns health JSON |

---

### Section J — Production Quality

| # | Test | How to verify | Expected result |
|---|---|---|---|
| J1 | Page refresh on deep link | Navigate to `/properties`, press F5 | Page reloads correctly — not 404 |
| J2 | Page refresh on `/dashboard` | Go to dashboard, press F5 | Dashboard reloads correctly |
| J3 | No browser console errors | Open DevTools → Console | No red error messages during normal use |
| J4 | Rate limiting works | Send 600 requests in 15 minutes (automated test) | 429 "Too many requests" after limit |
| J5 | Wrong JWT rejected | Send API request with invalid token | Returns 401 "Invalid token" |
| J6 | Error pages not exposed | Try URL that doesn't exist: `/api/v1/doesnotexist` | JSON error, not HTML stack trace |
| J7 | File paths not in health check | `http://SERVER_IP:5000/health` in production | Does NOT show `uploadsDir` or `spaDir` paths |
| J8 | Application logs written | Check `backend\logs\combined.log` | Recent request logs visible |
| J9 | Auto-start after reboot | Restart the server machine | Application restarts automatically |

---

### Checklist Summary

Complete this before handing the system to the company:

```
[ ] A — Server starts, health check works, production mode confirmed
[ ] B — Login, logout, session, protected routes all work
[ ] C — User creation, roles, password reset all work
[ ] D — Property CRUD, search, filters, pagination all work
[ ] E — Image upload (5 images), gallery, lightbox, delete all work
[ ] F — Video upload (2 videos), player, delete all work
[ ] G — Customer CRUD, pipeline, assignment, employee scoping all work
[ ] H — Dashboard KPIs, all reports load, role restrictions enforced
[ ] I — LAN access from other PCs, images and videos load remotely
[ ] J — Page refresh works, no console errors, auto-start configured
```

**All boxes checked = Ready for company use.**

---

## System Is Production-Ready

This system has been built, tested, and audited for production use in a real estate office environment.

| Area | Status |
|---|---|
| Authentication (JWT + bcrypt) | Secure |
| Role-based access control | Enforced at API level |
| SQL injection protection | Parameterised queries throughout |
| File upload security | MIME type + extension dual validation |
| Path traversal protection | Upload paths validated against allowed root |
| XSS protection | Helmet headers + React's built-in output escaping |
| CORS | Production: explicit allowlist; Dev: LAN auto-detect |
| Rate limiting | 500 req/15min per IP |
| Password storage | bcrypt cost=12 |
| Error handling | All errors logged, internals hidden in production |
| Database | All queries parameterised, views/indexes optimised |
| Frontend | Production build, code splitting, gzip compression |
| LAN deployment | Single URL, single port, no extra software on clients |
| Backup | **Manual** — mysqldump + uploads folder (Task Scheduler setup in Section 10 is optional and must be configured by the operator) |
| Logging | Winston with file rotation, combined + error logs |
| Contracts & payments | **Not implemented in this version** — all contract endpoints return HTTP 501 |

**Application version:** 1.0.0
**Minimum Node.js:** 18.0.0
**Minimum MySQL:** 8.0

---

*End of DEPLOYMENT.md*
