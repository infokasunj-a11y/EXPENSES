@echo off
title Bandarawela Divisional Secretariat - WhatsApp Sender Server
echo =====================================================================
echo Starting Bandarawela Divisional Secretariat WhatsApp Sender Server...
echo =====================================================================
echo Local URL: http://localhost:3000
echo.
start cmd /k "node server.js"
timeout /t 3
start cmd /k "for /L %%i in (1,0,2) do (npx localtunnel --port 3000 --subdomain bandarawela-ds-app)"
echo =====================================================================
echo Server and Online Tunnel started successfully!
echo Online Mobile URL: https://bandarawela-ds-app.loca.lt
echo =====================================================================
pause
