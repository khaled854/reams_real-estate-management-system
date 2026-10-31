@echo off
chcp 65001 >nul
title REMS — Database Setup (First-Time)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         REMS — إعداد قاعدة البيانات (المرة الأولى)           ║
echo ║         REMS — Database Setup (First-Time)                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo  This script will:
echo    1. Create database: real_estate_db
echo    2. Create user: rems_user
echo    3. Create all tables and seed default data
echo.
echo  You need the MySQL ROOT password to proceed.
echo.

set /p "ROOT_PASS=Enter MySQL ROOT password: "
set /p "REMS_PASS=Choose a password for rems_user: "

set "PROJECT_ROOT=%~dp0.."
set "SQL_FILE=%PROJECT_ROOT%\database\database.sql"

:: Check SQL file exists
if not exist "%SQL_FILE%" (
    echo [ERROR] database.sql not found at: %SQL_FILE%
    pause
    exit /b 1
)

echo.
echo  Creating database and running schema...

mysql --host=localhost --user=root --password=%ROOT_PASS% -e ^
  "CREATE DATABASE IF NOT EXISTS real_estate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if %errorlevel% neq 0 (
    echo [ERROR] Could not connect to MySQL. Check root password and that MySQL is running.
    pause
    exit /b 1
)

mysql --host=localhost --user=root --password=%ROOT_PASS% -e ^
  "CREATE USER IF NOT EXISTS 'rems_user'@'localhost' IDENTIFIED BY '%REMS_PASS%'; GRANT ALL PRIVILEGES ON real_estate_db.* TO 'rems_user'@'localhost'; FLUSH PRIVILEGES;"

mysql --host=localhost --user=root --password=%ROOT_PASS% real_estate_db < "%SQL_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo  [OK] Database setup complete!
    echo.
    echo  Now edit backend\.env and set:
    echo    DB_PASSWORD=%REMS_PASS%
    echo.
) else (
    echo  [ERROR] Database setup failed. Check the output above.
)
pause
