@echo off
title Debug Run - Family Budget Tracker
color 0E

echo =======================================================
echo  DEBUG RUN - FAMILY BUDGET TRACKER
echo =======================================================
echo.
echo  Current Directory: %cd%
echo  Node Executable Path:
where node.exe
echo.
echo  Testing Node version:
node.exe -v
echo.
echo  -------------------------------------------------------
echo  Step 1: Check node_modules and build (press key to run)
echo  -------------------------------------------------------
pause

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm.cmd install
) else (
    echo [OK] node_modules exists.
)

if not exist "dist\" (
    echo Building frontend...
    call npm.cmd run build
) else (
    echo [OK] dist folder exists.
)

echo.
echo  -------------------------------------------------------
echo  Step 2: Starting server (press key to run node.exe server.js)
echo  -------------------------------------------------------
pause

echo Running: node.exe server.js
node.exe server.js

echo.
echo If you see this, the server closed.
pause
