@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title سوق العقارات — تشغيل الخادم

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║            سوق العقارات — نظام إدارة العقارات               ║
echo ║            REMS — Server Startup Script                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: ── Check Node.js ────────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download from: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v

:: ── Check MySQL ───────────────────────────────────────────────
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] MySQL client not found in PATH - make sure MySQL service is running.
) else (
    for /f "tokens=*" %%v in ('mysql --version') do echo [OK] %%v
)

:: ── Set working directory to project root ─────────────────────
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"
echo [OK] Project root: %PROJECT_ROOT%
echo.

:: ── Check .env exists ─────────────────────────────────────────
if not exist "backend\.env" (
    echo [WARN] backend\.env not found — copying from .env.production template...
    copy "backend\.env.production" "backend\.env" >nul
    echo [WARN] Please edit backend\.env with your actual values before continuing!
    echo        Press any key to open it in Notepad...
    pause >nul
    start notepad "backend\.env"
    echo        Save the file and press any key to continue...
    pause >nul
)

:: ── Build frontend (production) ───────────────────────────────
echo.
echo [1/3] Building frontend for production...
echo       This may take 30-60 seconds on first run.
echo.
cd "%PROJECT_ROOT%\frontend"
if not exist "node_modules" (
    echo       Installing frontend dependencies...
    call npm install --prefer-offline
)
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed. Check the output above.
    pause
    exit /b 1
)
echo [OK] Frontend built successfully.

:: ── Copy dist to backend/public ───────────────────────────────
echo.
echo [2/3] Deploying frontend to backend/public...
if exist "%PROJECT_ROOT%\backend\public" (
    rmdir /s /q "%PROJECT_ROOT%\backend\public"
)
xcopy /e /i /q "%PROJECT_ROOT%\frontend\dist" "%PROJECT_ROOT%\backend\public" >nul
echo [OK] Frontend deployed to backend/public

:: ── Start backend ─────────────────────────────────────────────
echo.
echo [3/3] Starting backend server...
echo.
cd "%PROJECT_ROOT%\backend"
if not exist "node_modules" (
    echo       Installing backend dependencies...
    call npm install --prefer-offline
)

:: ── Show server IP ─────────────────────────────────────────────
echo ─────────────────────────────────────────────────────────────
echo.
echo  Server is starting on all network interfaces (0.0.0.0:5000)
echo.
echo  To find your server IP, open a new CMD window and run:
echo     ipconfig
echo  Look for "IPv4 Address" under your active network adapter.
echo.
echo  Then tell other computers to open:
echo     http://YOUR_SERVER_IP:5000
echo.
echo ─────────────────────────────────────────────────────────────
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: ── Set NODE_ENV to production and start ──────────────────────
set NODE_ENV=production
call npm start

pause
