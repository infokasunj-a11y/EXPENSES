@echo off
title Family Budget Tracker - Setup & Server
color 0A

echo.
echo  =================================================================
echo   FAMILY BUDGET TRACKER - Starting Server...
echo  =================================================================
echo.

:: Detect Node Executable
set NODE_BIN=
where node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set NODE_BIN=node.exe
) else (
    if exist "%ProgramFiles%\nodejs\node.exe" set NODE_BIN="%ProgramFiles%\nodejs\node.exe"
    if exist "%ProgramFiles(x86)%\nodejs\node.exe" set NODE_BIN="%ProgramFiles(x86)%\nodejs\node.exe"
)

if "%NODE_BIN%"=="" (
    echo  [!] ERROR: Node.js was not found on your computer!
    echo      Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Get Local Network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

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
echo   IMPORTANT: Keep this CMD window open while using the app!
echo  =================================================================
echo.

%NODE_BIN% server.js
pause
