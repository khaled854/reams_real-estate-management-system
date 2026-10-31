@echo off
chcp 65001 >nul
title REMS — Development Mode (Two Servers)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║       REMS — Development Mode (Backend + Frontend)           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."

:: ── Start backend in its own window ───────────────────────────
echo Starting Backend (port 5000)...
start "REMS Backend :5000" cmd /k "cd /d "%PROJECT_ROOT%\backend" && npm run dev"

:: Wait 3 seconds for backend to initialise
timeout /t 3 /nobreak >nul

:: ── Start frontend in its own window ──────────────────────────
echo Starting Frontend (port 3000)...
start "REMS Frontend :3000" cmd /k "cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo.
echo   Backend API:  http://localhost:5000/api/v1/status
echo   Frontend App: http://localhost:3000
echo.
echo Close those windows to stop the servers.
echo.
pause
