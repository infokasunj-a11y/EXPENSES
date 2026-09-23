@echo off
title Family Budget Tracker - Setup & Server
color 0A

echo.
echo  =================================================================
echo   FAMILY BUDGET TRACKER - Starting...
echo  =================================================================
echo.

:: Get Local Network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

:: Check if node_modules exists
if not exist "node_modules\" (
    echo  [!] node_modules not found. Installing dependencies...
    call npm.cmd install
)

:: Check if dist exists (frontend build)
if not exist "dist\" (
    echo  [!] dist folder not found. Building frontend...
    call npm.cmd run build
)

echo.
echo  =================================================================
echo   HOW TO ACCESS THE BUDGET APP:
echo  =================================================================
echo.
echo   1. Access from this Computer:
echo      --^> http://localhost:3001
echo.
echo   2. Access from iPhone (On Same WiFi Router):
echo      --^> http://%IP%:3001
echo.
echo   3. Access from Anywhere (Cellular Data / Outside Home):
echo      Run "internet-access.bat" to start Ngrok tunnel.
echo.
echo  =================================================================
echo   IMPORTANT: Keep this window open while using the app!
echo  =================================================================
echo.

node.exe server.js
pause
