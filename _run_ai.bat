@echo off
chcp 65001 > nul 2>&1
title MelodAI - AI Service [port 8000]
color 0B
cd /d "%~dp0ai-service"
echo.
echo  ==========================================
echo    MelodAI AI Service  --  port 8000
echo  ==========================================
echo.
venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload
echo.
echo  AI Service stopped. Press any key to close.
pause > nul
