@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title REMS — Restore Database from Backup

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         REMS — Restore Database from Backup                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=real_estate_db
set DB_USER=rems_user
set "BACKUP_DIR=%~dp0..\database\backups"

:: ── List available backups ─────────────────────────────────────
echo  Available backup files:
echo.
set COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\rems_backup_*.sql" 2^>nul') do (
    set /a COUNT+=1
    echo    [!COUNT!] %%F
    set "FILE_!COUNT!=%%F"
)

if %COUNT%==0 (
    echo  No backup files found in: %BACKUP_DIR%
    pause
    exit /b 1
)

echo.
set /p "CHOICE=Enter number to restore (1-%COUNT%): "
if "!FILE_%CHOICE%!"=="" (
    echo  Invalid selection.
    pause
    exit /b 1
)

set "RESTORE_FILE=%BACKUP_DIR%\!FILE_%CHOICE%!"
echo.
echo  WARNING: This will OVERWRITE the current database!
echo  File: !FILE_%CHOICE%!
echo.
set /p "CONFIRM=Type YES to confirm: "
if /i not "%CONFIRM%"=="YES" (
    echo  Restore cancelled.
    pause
    exit /b 0
)

set /p "DB_PASS=Enter MySQL password for user '%DB_USER%': "

echo.
echo  Restoring database...
mysql --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% --password=%DB_PASS% %DB_NAME% < "%RESTORE_FILE%"

if %errorlevel% equ 0 (
    echo  [OK] Database restored successfully!
) else (
    echo  [ERROR] Restore FAILED. Check the error above.
)
echo.
pause
