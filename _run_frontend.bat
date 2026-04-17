@echo off
chcp 65001 > nul 2>&1
title MelodAI - Frontend [port 5173]
color 0D
cd /d "%~dp0frontend"
echo.
echo  ==========================================
echo    MelodAI Frontend  --  port 5173
echo  ==========================================
echo.
npx vite
echo.
echo  Frontend stopped. Press any key to close.
pause > nul
