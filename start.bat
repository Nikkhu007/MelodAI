@echo off
chcp 65001 > nul 2>&1
title MelodAI Launcher
cls

echo.
echo  ============================================================
echo        MelodAI  ^|  AI-Powered Music Streaming
echo  ============================================================
echo.

REM ── Store root directory ─────────────────────────────────────────────────────
set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

REM ── Kill anything already on ports 5000, 5173, 8000 ─────────────────────────
echo [1/6] Freeing ports 5000, 5173, 8000...
for /f "tokens=5 delims= " %%a in ('netstat -aon 2^>nul ^| findstr " :5000 "') do (
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5 delims= " %%a in ('netstat -aon 2^>nul ^| findstr " :5173 "') do (
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5 delims= " %%a in ('netstat -aon 2^>nul ^| findstr " :8000 "') do (
    taskkill /F /PID %%a > nul 2>&1
)
echo     Done.
echo.

REM ── Install root node_modules if missing ─────────────────────────────────────
echo [2/6] Checking Node dependencies...
if not exist "%ROOT%\node_modules" (
    echo     Installing root packages...
    pushd "%ROOT%"
    call npm install --silent
    if errorlevel 1 ( echo ERROR: root npm install failed & pause & exit /b 1 )
    popd
) else ( echo     Root packages OK. )

if not exist "%ROOT%\backend\node_modules" (
    echo     Installing backend packages...
    pushd "%ROOT%\backend"
    call npm install --silent
    if errorlevel 1 ( echo ERROR: backend npm install failed & pause & exit /b 1 )
    popd
) else ( echo     Backend packages OK. )

if not exist "%ROOT%\frontend\node_modules" (
    echo     Installing frontend packages...
    pushd "%ROOT%\frontend"
    call npm install --silent
    if errorlevel 1 ( echo ERROR: frontend npm install failed & pause & exit /b 1 )
    popd
) else ( echo     Frontend packages OK. )
echo.

REM ── Set up Python venv for AI service ────────────────────────────────────────
echo [3/6] Checking Python / AI service...
if not exist "%ROOT%\ai-service\venv\Scripts\uvicorn.exe" (
    echo     Creating Python venv...
    pushd "%ROOT%\ai-service"
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create venv. Is Python installed?
        pause & exit /b 1
    )
    echo     Installing AI dependencies ^(this may take a minute...^)
    call venv\Scripts\pip install -r requirements.txt --quiet
    if errorlevel 1 ( echo ERROR: pip install failed & pause & exit /b 1 )
    popd
) else ( echo     Python venv OK. )
echo.

REM ── Check yt-dlp ─────────────────────────────────────────────────────────────
echo [4/6] Checking yt-dlp...
where yt-dlp > nul 2>&1
if errorlevel 1 (
    echo     yt-dlp not found. Installing via pip...
    call pip install yt-dlp --quiet 2>&1
    where yt-dlp > nul 2>&1
    if errorlevel 1 (
        echo     WARNING: yt-dlp install failed. YouTube search will not work.
        echo     Fix manually: pip install yt-dlp
    ) else (
        echo     yt-dlp installed OK.
    )
) else (
    for /f %%v in ('yt-dlp --version 2^>nul') do echo     yt-dlp %%v OK.
)
echo.

REM ── Launch each service in its own window ────────────────────────────────────
echo [5/6] Starting services...
echo.

echo     ^> AI Service   http://localhost:8000
start "MelodAI - AI Service" cmd /k ^
    "cd /d "%ROOT%\ai-service" && echo [AI SERVICE] Starting on http://localhost:8000 && echo. && venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 > nul

echo     ^> Backend      http://localhost:5000
start "MelodAI - Backend" cmd /k ^
    "cd /d "%ROOT%\backend" && echo [BACKEND] Starting on http://localhost:5000 && echo. && npx nodemon server.js"

timeout /t 2 > nul

echo     ^> Frontend     http://localhost:5173
start "MelodAI - Frontend" cmd /k ^
    "cd /d "%ROOT%\frontend" && echo [FRONTEND] Starting on http://localhost:5173 && echo. && npx vite"

echo.
echo [6/6] Opening browser in 5 seconds...
timeout /t 5 > nul
start http://localhost:5173

echo.
echo  ============================================================
echo    All 3 services launched in separate windows.
echo    Close those windows (or Ctrl+C in each) to stop.
echo  ============================================================
echo.
pause
