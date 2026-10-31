@echo off
chcp 65001 >nul
title سوق العقارات — عنوان IP الخادم

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         سوق العقارات — عنوان IP الخادم                       ║
echo ║         REMS — Server IP Address Finder                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo عناوين IP المتاحة على هذا الجهاز:
echo Available IP addresses on this machine:
echo.

:: Show all IPv4 addresses (excludes loopback)
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set ip=%%i
    set ip=!ip: =!
    echo   IP Address: %%i
)

echo.
echo ─────────────────────────────────────────────────────────────
ipconfig | findstr /i "IPv4"
echo ─────────────────────────────────────────────────────────────
echo.
echo الأجهزة الأخرى تتصل عبر / Other PCs connect via:
echo.
echo   Frontend (App):  http://YOUR_IP:5000
echo   Backend API:     http://YOUR_IP:5000/api/v1/status
echo   Health Check:    http://YOUR_IP:5000/health
echo.
echo مثال / Example:
echo   http://192.168.1.100:5000
echo.
pause
