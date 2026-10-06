@echo off
title Internet Access Sharing - Family Budget Tracker
color 0D

echo.
echo  =================================================================
echo   INTERNET SHARING SETUP - Family Budget Tracker
echo   (Access from cellular data / outside home)
echo  =================================================================
echo.

:: Check if ngrok.exe exists in the current folder
if exist "ngrok.exe" (
    set NGROK_CMD=ngrok.exe
    goto :ngrok_found
)

:: Check if ngrok is in the PATH
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set NGROK_CMD=ngrok
    goto :ngrok_found
)

echo  [!] ngrok was not found.
echo.
echo  To access the app from outside your home:
echo    1. Go to: https://ngrok.com/download
echo    2. Download and extract ngrok.exe
echo    3. Place ngrok.exe in this folder: %~dp0
echo    4. Register a free account at https://ngrok.com
echo    5. Run this in Command Prompt: ngrok config add-authtoken YOUR_TOKEN
echo    6. Then run this script again!
echo.
pause
exit /b 1

:ngrok_found
echo  [OK] ngrok found!
echo.
echo  Make sure the budget server is already running (run run.bat)!
echo.
echo  Starting tunnel on port 3001...
echo  =================================================================
echo   Look for the URL in the terminal below like:
echo   Forwarding: https://xxxx-xxxx.ngrok-free.app -> http://localhost:3001
echo.
echo   Open that "https://xxxx-xxxx.ngrok-free.app" URL on both iPhones!
echo  =================================================================
echo.
pause

%NGROK_CMD% http 3001
pause
