@echo off
:: ================================================================
:: STOP_SYSTEM.bat
:: Real Estate Management System (REMS) - Safe Shutdown
:: Double-click this file to stop the system safely.
::
:: What this script does:
::   1. Finds and stops the Node.js server on port 5000
::   2. Optionally stops MySQL
::   3. Confirms everything is stopped
::   4. Does NOT delete any files or data
:: ================================================================

setlocal EnableDelayedExpansion
title REMS - Stop System

cls
echo.
echo  ============================================================
echo   REMS - Real Estate Management System
echo   STOP SYSTEM - Safe Shutdown
echo   Iiqaf Al-Nitham bi-aman
echo  ============================================================
echo.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "ENV_FILE=%ROOT%\backend\.env"

:: Read port from .env (default 5000)
set "APP_PORT=5000"
for /f "tokens=2 delims==" %%a in ('findstr /i "^PORT=" "%ENV_FILE%" 2^>nul') do set "APP_PORT=%%a"
set "APP_PORT=%APP_PORT: =%"

:: Read DB port from .env (default 3307)
set "DB_PORT=3307"
for /f "tokens=2 delims==" %%a in ('findstr /i "^DB_PORT=" "%ENV_FILE%" 2^>nul') do set "DB_PORT=%%a"
set "DB_PORT=%DB_PORT: =%"

:: ----------------------------------------------------------------
:: STEP 1 - Stop the Node.js server on APP_PORT
:: ----------------------------------------------------------------
echo  [1/2] Stopping REMS server (port %APP_PORT%)...
echo.

netstat -ano | findstr "0.0.0.0:%APP_PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  INFO - Server is not running on port %APP_PORT%.
    echo  Nothing to stop.
    goto :check_mysql
)

:: Find all PIDs listening on APP_PORT and stop them
set "STOPPED_COUNT=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "0.0.0.0:%APP_PORT%" ^| findstr "LISTENING"') do (
    if "%%p" neq "" (
        taskkill /PID %%p /F >nul 2>&1
        if !errorlevel! equ 0 (
            set /a STOPPED_COUNT+=1
            echo  Stopped process with PID: %%p
        )
    )
)

:: Wait 2 seconds then verify
timeout /t 2 /nobreak >nul

netstat -ano | findstr "0.0.0.0:%APP_PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  WARNING - Port %APP_PORT% is still in use.
    echo  You may need to restart your computer to fully release it.
) else (
    echo  [OK] Server stopped. Port %APP_PORT% is now free.
)
echo.

:check_mysql
:: ----------------------------------------------------------------
:: STEP 2 - Optionally stop MySQL
:: ----------------------------------------------------------------
echo  [2/2] MySQL database...
echo.

netstat -ano | findstr ":%DB_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  INFO - MySQL is not running.
    goto :done
)

echo  MySQL is running on port %DB_PORT%.
echo.
echo  Do you want to stop MySQL too?
echo  (Recommended when you finish work for the day)
echo.
echo    [Y] Yes - stop MySQL
echo    [N] No  - leave MySQL running
echo.
set /p "MYSQL_CHOICE=Your choice (Y or N): "

if /i "!MYSQL_CHOICE!"=="Y" (
    echo.
    echo  Stopping MySQL...

    :: Try each possible service name
    set "MYSQL_STOPPED=0"
    for %%s in (mysql MySQL MySQL57 MySQL80 MySQL84) do (
        sc query "%%s" >nul 2>&1
        if !errorlevel! equ 0 (
            net stop "%%s" >nul 2>&1
            if !errorlevel! equ 0 (
                echo  [OK] MySQL service "%%s" stopped.
                set "MYSQL_STOPPED=1"
            )
        )
    )

    :: If service stop did not work, try killing mysqld.exe process
    if "!MYSQL_STOPPED!"=="0" (
        taskkill /IM mysqld.exe /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo  [OK] MySQL process (mysqld.exe) stopped.
            set "MYSQL_STOPPED=1"
        )
    )

    if "!MYSQL_STOPPED!"=="0" (
        echo.
        echo  MySQL could not be stopped automatically.
        echo  Please stop it manually via XAMPP Control Panel:
        echo    Click "Stop" next to MySQL
    )
) else (
    echo  MySQL will keep running.
)

:done
echo.
echo  ============================================================
echo   Shutdown complete.
echo   Iiktamal al-iiqaf.
echo.
echo   No files were deleted.
echo   All your data is safe.
echo.
echo   To start the system again:
echo     Double-click START_SYSTEM.bat
echo  ============================================================
echo.
pause
exit /b 0
