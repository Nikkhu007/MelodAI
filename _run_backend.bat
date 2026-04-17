@echo off
chcp 65001 > nul 2>&1
title MelodAI - Backend [port 5000]
color 0A
cd /d "%~dp0backend"
echo.
echo  ==========================================
echo    MelodAI Backend  --  port 5000
echo  ==========================================
echo.
npx nodemon server.js
echo.
echo  Backend stopped. Press any key to close.
pause > nul
