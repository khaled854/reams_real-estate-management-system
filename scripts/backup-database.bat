@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title سوق العقارات — نسخ احتياطي لقاعدة البيانات

:: ══════════════════════════════════════════════════════════════
:: REMS Database Backup Script
:: Saves a timestamped .sql dump to database/backups/
:: ══════════════════════════════════════════════════════════════

:: ── Configuration — edit these values ─────────────────────────
set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=real_estate_db
set DB_USER=rems_user

:: Backup destination folder
set "PROJECT_ROOT=%~dp0.."
set "BACKUP_DIR=%PROJECT_ROOT%\database\backups"

:: ── Create backup directory if it does not exist ──────────────
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: ── Generate timestamp: YYYY-MM-DD_HH-MM ──────────────────────
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do (
    set "DATESTR=%%c-%%a-%%b"
)
for /f "tokens=1-2 delims=:. " %%a in ("%time%") do (
    set "HR=%%a"
    set "MN=%%b"
    if "!HR:~0,1!"==" " set "HR=0!HR:~1!"
    set "TIMESTR=!HR!-!MN!"
)
set "TIMESTAMP=%DATESTR%_%TIMESTR%"
set "BACKUP_FILE=%BACKUP_DIR%\rems_backup_%TIMESTAMP%.sql"

:: ── Run mysqldump ──────────────────────────────────────────────
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         سوق العقارات — نسخ احتياطي قاعدة البيانات           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo  Database : %DB_NAME%
echo  Output   : %BACKUP_FILE%
echo.

:: Prompt for password
set /p "DB_PASS=Enter MySQL password for user '%DB_USER%': "

echo.
echo  Running backup...

mysqldump ^
  --host=%DB_HOST% ^
  --port=%DB_PORT% ^
  --user=%DB_USER% ^
  --password=%DB_PASS% ^
  --single-transaction ^
  --routines ^
  --triggers ^
  --events ^
  --hex-blob ^
  --default-character-set=utf8mb4 ^
  %DB_NAME% > "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo  [OK] Backup completed successfully!
    echo  File: %BACKUP_FILE%

    :: Show file size
    for %%F in ("%BACKUP_FILE%") do (
        set /a SIZE_KB=%%~zF/1024
        echo  Size: !SIZE_KB! KB
    )

    :: ── Keep only last 30 backups ─────────────────────────────
    echo.
    echo  Cleaning up old backups (keeping last 30)...
    set COUNT=0
    for /f "skip=30 delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\rems_backup_*.sql" 2^>nul') do (
        del "%BACKUP_DIR%\%%F" >nul 2>&1
        set /a COUNT+=1
    )
    if !COUNT! gtr 0 echo  Removed !COUNT! old backup(s).

) else (
    echo.
    echo  [ERROR] Backup FAILED! Check the error above.
    echo  Common causes:
    echo    - Wrong password
    echo    - MySQL is not running
    echo    - mysqldump not in PATH (add MySQL bin folder to PATH)
)

echo.
pause
