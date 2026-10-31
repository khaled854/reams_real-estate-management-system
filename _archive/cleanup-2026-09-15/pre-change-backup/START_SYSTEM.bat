@echo off
:: ================================================================
:: START_SYSTEM.bat  v3.0
:: Real Estate Management System (REMS) - One-Click Startup
::
:: HOW IT WORKS:
::   Double-click this file. That is all.
::   Do NOT move this file out of the project folder.
::   The file must stay next to the "backend" and "frontend" folders.
::
:: PORTABILITY:
::   Uses %~dp0 to locate itself, so the whole project folder can be
::   placed anywhere:
::     C:\company\rems\         - OK
::     D:\rems\                 - OK
::     C:\Users\Ahmed\Desktop\  - OK
::     External USB drive       - OK (if Node.js is installed on the PC)
::
:: WHAT IT DOES AUTOMATICALLY:
::   [1] Locates the project folder from its own position
::   [2] Checks Node.js is installed
::   [3] Checks backend/.env exists (copies template if missing)
::   [4] Detects this computer's LAN IP address
::   [5] Updates CORS_ORIGINS in .env with the correct current IP
::   [6] Checks MySQL is running (tries to start it if not)
::   [7] Verifies the production build is ready
::   [8] Checks port 5000 is free (handles conflict)
::   [9] Starts the Express server
::  [10] Opens the browser automatically after 5 seconds
::
:: WHAT NEVER CHANGES:
::   - No hardcoded usernames (no "Khaled", no "Ahmed")
::   - No hardcoded drive letters for the project
::   - No hardcoded IP addresses for this machine
::   - XAMPP is expected at C:\xampp (its universal install location)
:: ================================================================

setlocal EnableDelayedExpansion
title REMS - Real Estate Management System

:: ----------------------------------------------------------------
:: LOCATE PROJECT ROOT FROM THIS FILE'S POSITION
:: %~dp0 = the drive + directory of this .bat file, always ends in \
:: We strip the trailing backslash so paths like %ROOT%\backend work.
:: ----------------------------------------------------------------
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "ENV_FILE=%BACKEND%\.env"
set "ENV_TEMPLATE=%BACKEND%\.env.production"
set "PUBLIC_HTML=%BACKEND%\public\index.html"
set "BACKEND_MODULES=%BACKEND%\node_modules"
set "FRONTEND_MODULES=%FRONTEND%\node_modules"
set "SCRIPTS_DIR=%ROOT%\scripts"
set "LOG_FILE=%ROOT%\START_SYSTEM.log"

:: Default port values (overridden later by reading .env)
set "APP_PORT=5000"
set "DB_PORT=3307"

cls
echo.
echo  ============================================================
echo   REMS - Real Estate Management System
echo   Souk Al-Aqarat - Nitham Idaret Al-Aqarat
echo  ============================================================
echo   Starting... Please wait.
echo  ============================================================
echo.
echo  Project folder: %ROOT%
echo.

>> "%LOG_FILE%" echo ============================================================
>> "%LOG_FILE%" echo START_SYSTEM.bat  %date%  %time%
>> "%LOG_FILE%" echo Project root: %ROOT%
>> "%LOG_FILE%" echo ============================================================

:: ----------------------------------------------------------------
:: [1] VERIFY PROJECT STRUCTURE IS INTACT
:: ----------------------------------------------------------------
echo  [1/9] Verifying project structure...

if not exist "%BACKEND%" (
    echo.
    echo  ERROR: "backend" folder not found in: %ROOT%
    echo.
    echo  Make sure START_SYSTEM.bat is in the same folder as
    echo  the "backend" and "frontend" folders.
    echo  Current location: %ROOT%
    echo.
    >> "%LOG_FILE%" echo ERROR: backend folder missing
    pause
    exit /b 1
)

if not exist "%FRONTEND%" (
    echo.
    echo  ERROR: "frontend" folder not found in: %ROOT%
    >> "%LOG_FILE%" echo ERROR: frontend folder missing
    pause
    exit /b 1
)

echo  [OK] Project structure verified.
echo.

:: ----------------------------------------------------------------
:: [2] CHECK NODE.JS IS INSTALLED
:: ----------------------------------------------------------------
echo  [2/9] Checking Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ============================================================
    echo   ERROR: Node.js is NOT installed on this computer.
    echo  ============================================================
    echo.
    echo   You must install Node.js before using this system.
    echo.
    echo   Step 1: Open a web browser.
    echo   Step 2: Go to:  https://nodejs.org
    echo   Step 3: Click the green "LTS" button to download.
    echo   Step 4: Run the downloaded file and click Next/Install.
    echo   Step 5: Restart your computer.
    echo   Step 6: Double-click START_SYSTEM.bat again.
    echo.
    >> "%LOG_FILE%" echo ERROR: Node.js not installed
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo  [OK] Node.js %NODE_VER%
>> "%LOG_FILE%" echo Node.js: %NODE_VER%
echo.

:: ----------------------------------------------------------------
:: [3] CHECK/CREATE .env SETTINGS FILE
:: ----------------------------------------------------------------
echo  [3/9] Checking settings file...

if not exist "%ENV_FILE%" (
    if exist "%ENV_TEMPLATE%" (
        echo  Settings file not found. Creating from template...
        copy "%ENV_TEMPLATE%" "%ENV_FILE%" >nul
        echo  [OK] Settings file created. Continuing with defaults.
        >> "%LOG_FILE%" echo .env created from template
    ) else (
        echo.
        echo  ERROR: Settings file missing: %ENV_FILE%
        echo  Contact technical support.
        >> "%LOG_FILE%" echo ERROR: .env missing, no template
        pause
        exit /b 1
    )
)

:: Read APP_PORT from .env
for /f "tokens=2 delims==" %%a in ('findstr /i "^PORT=" "%ENV_FILE%" 2^>nul') do set "APP_PORT=%%a"
set "APP_PORT=%APP_PORT: =%"
if "%APP_PORT%"=="" set "APP_PORT=5000"

:: Read DB_PORT from .env
for /f "tokens=2 delims==" %%a in ('findstr /i "^DB_PORT=" "%ENV_FILE%" 2^>nul') do set "DB_PORT=%%a"
set "DB_PORT=%DB_PORT: =%"
if "%DB_PORT%"=="" set "DB_PORT=3307"

echo  [OK] Settings file OK (App port: %APP_PORT%, DB port: %DB_PORT%)
>> "%LOG_FILE%" echo Settings: APP_PORT=%APP_PORT%  DB_PORT=%DB_PORT%
echo.

:: ----------------------------------------------------------------
:: [4] DETECT THIS COMPUTER'S LAN IP AND UPDATE CORS_ORIGINS
::
:: WHY THIS MATTERS:
::   CORS_ORIGINS in .env must contain this computer's actual IP.
::   If the project is moved to a new computer with a different IP
::   (e.g., old IP was 192.168.1.6, new is 192.168.1.25), the old
::   value in .env will cause LAN connections to fail with a CORS
::   error. This step auto-corrects it every time the system starts.
::
:: IP SELECTION:
::   Prefers real network adapters over virtual ones.
::   Skips 192.168.56.x (VMware host-only) and 192.168.99.x (Docker).
::   Falls back to 10.x.x.x range if no 192.168 found.
:: ----------------------------------------------------------------
echo  [4/9] Detecting LAN IP and updating network settings...

set "LAN_IP="

:: First pass: prefer 192.168.x.x but skip common virtual adapter ranges
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "RAW=%%a"
    set "RAW=!RAW: =!"
    :: Accept 192.168.x.x
    echo !RAW! | findstr /r "^192\.168\." >nul 2>&1
    if !errorlevel! equ 0 (
        :: Skip VMware host-only (192.168.56.x) and Docker (192.168.99.x)
        echo !RAW! | findstr /r "^192\.168\.56\.\|^192\.168\.99\." >nul 2>&1
        if !errorlevel! neq 0 (
            if "!LAN_IP!"=="" set "LAN_IP=!RAW!"
        )
    )
)

:: Second pass: if first pass found nothing, accept VMware IPs too
if "%LAN_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
        set "RAW=%%a"
        set "RAW=!RAW: =!"
        echo !RAW! | findstr /r "^192\.168\." >nul 2>&1
        if !errorlevel! equ 0 (
            if "!LAN_IP!"=="" set "LAN_IP=!RAW!"
        )
    )
)

:: Third pass: try 10.x.x.x range (some corporate networks)
if "%LAN_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
        set "RAW=%%a"
        set "RAW=!RAW: =!"
        echo !RAW! | findstr /r "^10\." >nul 2>&1
        if !errorlevel! equ 0 (
            if "!LAN_IP!"=="" set "LAN_IP=!RAW!"
        )
    )
)

if "%LAN_IP%"=="" (
    echo  INFO: No LAN IP found. Will use localhost only.
    set "CORS_VALUE=http://localhost:%APP_PORT%,http://127.0.0.1:%APP_PORT%"
) else (
    echo  [OK] LAN IP detected: %LAN_IP%
    set "CORS_VALUE=http://%LAN_IP%:%APP_PORT%,http://localhost:%APP_PORT%,http://127.0.0.1:%APP_PORT%"
)

:: Update CORS_ORIGINS in .env with the correct current IP.
:: Uses PowerShell (available on all Windows 7+) to do a safe text replacement.
powershell -NoProfile -Command ^
    "$f='%ENV_FILE%'; $c=[System.IO.File]::ReadAllText($f,[System.Text.Encoding]::UTF8); $c=$c -replace '(?m)^CORS_ORIGINS=.*$','CORS_ORIGINS=%CORS_VALUE%'; [System.IO.File]::WriteAllText($f,$c,[System.Text.Encoding]::UTF8)" 2>nul

if %errorlevel% equ 0 (
    echo  [OK] Network settings updated.
) else (
    echo  INFO: Could not auto-update CORS. LAN access from other computers
    echo        may not work. Manual fix: edit backend\.env and set:
    echo        CORS_ORIGINS=http://%LAN_IP%:%APP_PORT%,http://localhost:%APP_PORT%
)

>> "%LOG_FILE%" echo LAN IP: %LAN_IP%
>> "%LOG_FILE%" echo CORS: %CORS_VALUE%
echo.

:: ----------------------------------------------------------------
:: [5] CHECK/START MYSQL DATABASE
:: ----------------------------------------------------------------
echo  [5/9] Checking MySQL database (port %DB_PORT%)...

:: Check if MySQL is already listening
netstat -ano 2>nul | findstr ":%DB_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] MySQL is already running on port %DB_PORT%.
    >> "%LOG_FILE%" echo MySQL: already running
    goto :mysql_ready
)

echo  MySQL is not running. Trying to start it automatically...

:: Attempt A: Windows service (covers MySQL Installer and XAMPP-as-service)
for %%s in (mysql MySQL MySQL57 MySQL80 MySQL84 MariaDB mariadb) do (
    sc query "%%s" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  Starting MySQL service ^(%%s^)...
        net start "%%s" >nul 2>&1
        if !errorlevel! equ 0 (
            echo  [OK] MySQL service ^(%%s^) started.
            >> "%LOG_FILE%" echo MySQL started: service %%s
            timeout /t 3 /nobreak >nul
            goto :mysql_ready
        )
    )
)

:: Attempt B: XAMPP mysqld.exe (XAMPP always installs to C:\xampp)
set "XMYSQLD=C:\xampp\mysql\bin\mysqld.exe"
set "XMYINI=C:\xampp\mysql\bin\my.ini"
if exist "%XMYSQLD%" (
    echo  Starting MySQL via XAMPP at C:\xampp...
    if exist "%XMYINI%" (
        start "" /B "%XMYSQLD%" "--defaults-file=%XMYINI%"
    ) else (
        start "" /B "%XMYSQLD%"
    )
    echo  Waiting 12 seconds for MySQL to fully start...
    timeout /t 12 /nobreak >nul
    netstat -ano 2>nul | findstr ":%DB_PORT% " | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] MySQL started via XAMPP.
        >> "%LOG_FILE%" echo MySQL started: XAMPP mysqld
        goto :mysql_ready
    )
    echo  XAMPP mysqld started but not yet listening. Waiting 10 more seconds...
    timeout /t 10 /nobreak >nul
    netstat -ano 2>nul | findstr ":%DB_PORT% " | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] MySQL started via XAMPP.
        >> "%LOG_FILE%" echo MySQL started: XAMPP mysqld (delayed)
        goto :mysql_ready
    )
)

:: MySQL could not be started - ask user to do it manually
echo.
echo  ============================================================
echo   MySQL did not start automatically.
echo   Please start it manually, then press any key to continue.
echo  ============================================================
echo.
echo   If you have XAMPP installed:
echo     1. Open "XAMPP Control Panel" from the Start Menu
echo     2. Click the "Start" button next to "MySQL"
echo     3. Wait until the background turns GREEN
echo     4. Come back here and press any key
echo.
echo   If you have MySQL Installer:
echo     1. Press Windows key + R
echo     2. Type:  services.msc  and press Enter
echo     3. Find MySQL80 (or MySQL57) in the list
echo     4. Right-click it and choose "Start"
echo     5. Come back here and press any key
echo.
>> "%LOG_FILE%" echo MySQL: manual start required
pause

:: Final check after manual intervention
netstat -ano 2>nul | findstr ":%DB_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: MySQL is still not running on port %DB_PORT%.
    echo  The system requires MySQL to work. Cannot continue.
    echo.
    echo  Please start MySQL and run START_SYSTEM.bat again.
    >> "%LOG_FILE%" echo ERROR: MySQL not running after manual prompt
    pause
    exit /b 1
)

:mysql_ready
echo.

:: ----------------------------------------------------------------
:: [6] VERIFY PRODUCTION BUILD EXISTS
::     If index.html is missing, build the frontend automatically.
:: ----------------------------------------------------------------
echo  [6/9] Checking production build...

if exist "%PUBLIC_HTML%" (
    echo  [OK] Production build found.
    >> "%LOG_FILE%" echo Build: existing
    goto :build_ready
)

echo  Production build not found. Building frontend now...
echo  This takes 1-3 minutes. Please wait - do not close this window.
echo.

:: Install frontend node_modules if missing
if not exist "%FRONTEND_MODULES%" (
    echo  Installing frontend packages (first time only)...
    cd /d "%FRONTEND%"
    call npm install --prefer-offline
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Failed to install frontend packages.
        echo  Check your internet connection and try again.
        >> "%LOG_FILE%" echo ERROR: npm install frontend failed
        pause
        exit /b 1
    )
)

:: Install backend node_modules if missing
if not exist "%BACKEND_MODULES%" (
    echo  Installing backend packages (first time only)...
    cd /d "%BACKEND%"
    call npm install --prefer-offline
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Failed to install backend packages.
        >> "%LOG_FILE%" echo ERROR: npm install backend failed
        pause
        exit /b 1
    )
)

:: Run the build script
cd /d "%ROOT%"
echo  Building...
node scripts\build.js
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Build failed. See messages above for details.
    >> "%LOG_FILE%" echo ERROR: build failed
    pause
    exit /b 1
)

if not exist "%PUBLIC_HTML%" (
    echo.
    echo  ERROR: Build finished but index.html was not created.
    echo  Contact technical support.
    >> "%LOG_FILE%" echo ERROR: index.html missing after build
    pause
    exit /b 1
)
echo  [OK] Build completed successfully.
>> "%LOG_FILE%" echo Build: completed fresh

:build_ready
echo.

:: ----------------------------------------------------------------
:: [7] CHECK BACKEND node_modules EXISTS
:: ----------------------------------------------------------------
echo  [7/9] Checking backend packages...

if not exist "%BACKEND_MODULES%" (
    echo  Installing backend packages (first time only)...
    cd /d "%BACKEND%"
    call npm install --prefer-offline
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Failed to install backend packages.
        >> "%LOG_FILE%" echo ERROR: npm install backend failed
        pause
        exit /b 1
    )
)
echo  [OK] Backend packages ready.
echo.

:: ----------------------------------------------------------------
:: [8] CHECK PORT AVAILABILITY
:: ----------------------------------------------------------------
echo  [8/9] Checking port %APP_PORT%...

netstat -ano 2>nul | findstr "0.0.0.0:%APP_PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo  Port %APP_PORT% is already in use.
    echo  The REMS server may already be running.
    echo.
    echo  Choose an option:
    echo    [1] Open browser now (server is already running - recommended)
    echo    [2] Stop the current server and restart it
    echo    [3] Exit without doing anything
    echo.
    set /p "CHOICE=Your choice (1, 2, or 3): "

    if "!CHOICE!"=="1" goto :open_browser_now
    if "!CHOICE!"=="3" (
        echo  Exiting.
        exit /b 0
    )

    :: Option 2: kill existing process
    echo.
    echo  Stopping existing server on port %APP_PORT%...
    for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr "0.0.0.0:%APP_PORT%" ^| findstr "LISTENING"') do (
        if "%%p" neq "" (
            taskkill /PID %%p /F >nul 2>&1
            echo  Stopped PID %%p
        )
    )
    timeout /t 3 /nobreak >nul
    echo  [OK] Port %APP_PORT% is now free.
)

echo  [OK] Port %APP_PORT% is available.
echo.

:: ----------------------------------------------------------------
:: [9] START THE SERVER AND OPEN THE BROWSER
:: ----------------------------------------------------------------
echo  [9/9] Starting REMS server...
echo.

echo  ============================================================
echo   REMS is starting. Please wait for the ready message below.
echo  ============================================================
echo.
echo   Look for this line:
echo     [info] Server running on http://0.0.0.0:%APP_PORT%
echo.
echo   Your browser will open automatically in 5 seconds.
echo.
echo   Access URLs:
echo     This computer : http://localhost:%APP_PORT%
if defined LAN_IP (
echo     Other computers: http://%LAN_IP%:%APP_PORT%
)
echo.
echo   Login:
echo     Email    : admin@test.com
echo     Password : Admin@123456
echo.
echo   DO NOT CLOSE THIS WINDOW.
echo   Closing this window stops the system.
echo  ============================================================
echo.

>> "%LOG_FILE%" echo Server starting at %time%

:: Open browser in 5 seconds (background task, doesn't block the server)
start "" /B cmd /c "timeout /t 5 /nobreak >nul 2>&1 && start http://localhost:%APP_PORT%"

:: Start the server - this line BLOCKS until the server stops (Ctrl+C)
cd /d "%BACKEND%"
call npm start

:: ----------------------------------------------------------------
:: Server exited - only reached after Ctrl+C or a crash
:: ----------------------------------------------------------------
echo.
echo  ============================================================
echo   The REMS server has stopped.
echo   Al-Nitham tawaqaf.
echo.
echo   If this was unexpected, check the messages above for errors.
echo.
echo   Press any key to close this window.
echo  ============================================================
echo.
>> "%LOG_FILE%" echo Server stopped at %time%
pause
exit /b 0

:: ----------------------------------------------------------------
:: Label reached when user chooses "open browser" on port conflict
:: ----------------------------------------------------------------
:open_browser_now
echo  Opening browser to http://localhost:%APP_PORT% ...
start "" "http://localhost:%APP_PORT%"
echo  [OK] Browser opened.
echo.
>> "%LOG_FILE%" echo Browser opened (server was already running)
pause
exit /b 0
