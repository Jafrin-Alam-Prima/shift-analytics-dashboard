@echo off
setlocal enableextensions
title Shift Analytics Dashboard

REM ============================================================
REM   Shift Analytics Dashboard - one-click launcher (Windows)
REM   Double-click this file, or run "run.bat" from Command Prompt.
REM   It checks Node, installs deps on first run, starts the app,
REM   and opens http://localhost:5173 in your browser.
REM ============================================================

REM --- always work from the folder this script lives in ---
cd /d "%~dp0"

echo ============================================================
echo    Shift Analytics Dashboard - starting up
echo ============================================================
echo.

REM --- 1) Node.js must be installed ---
echo [1/4] Checking for Node.js...
set "NODE_VER="
for /f "delims=" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
if not defined NODE_VER (
  echo.
  echo    ERROR: Node.js was not found on your system.
  echo.
  echo    This app needs Node.js 18 or newer.
  echo    1^) Download the LTS installer from  https://nodejs.org/
  echo    2^) Install it ^(default options are fine^).
  echo    3^) Close this window and double-click run.bat again.
  echo.
  pause
  exit /b 1
)
echo        Found Node %NODE_VER%.
echo.

REM --- the React/Vite app lives in .\frontend ---
if not exist "frontend\package.json" (
  echo    ERROR: could not find "frontend\package.json" next to this script.
  echo    Make sure run.bat is in the project root ^(the folder containing "frontend"^).
  echo.
  pause
  exit /b 1
)

REM --- 2) Install dependencies the first time ---
if not exist "frontend\node_modules" (
  echo [2/4] First run detected - installing dependencies ^(this can take a minute^)...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo    ERROR: "npm install" failed. Scroll up for the details.
    echo.
    pause
    exit /b 1
  )
  popd
  echo        Dependencies installed.
) else (
  echo [2/4] Dependencies already present - skipping npm install.
)
echo.

REM --- 3) Optional: start the Django backend if a venv + Python are set up ---
echo [3/4] Checking for the optional Django backend...
if exist "backend\manage.py" (
  if exist "backend\venv\Scripts\python.exe" (
    echo        Backend found - launching it in a separate window on port 8000.
    start "Shift Dashboard backend" /d "%~dp0backend" cmd /k venv\Scripts\python.exe manage.py runserver 8000
  ) else (
    echo        Backend code found but no virtual environment - skipping it.
    echo        ^(The dashboard is fully functional in local mode without it.^)
  )
) else (
  echo        No backend present - that's fine, the app runs entirely in your browser.
)
echo.

REM --- 4) Open the browser shortly after Vite boots, then run the dev server ---
echo [4/4] Starting the dev server...
echo.
echo    The app will open at:   http://localhost:5173
echo    Keep this window open while you use the app. Press Ctrl+C to stop.
echo.

REM spawn a helper that waits a few seconds (for Vite to come up) then opens the browser
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:5173"

REM run Vite in the foreground so this window stays open with the live logs
cd frontend
call npm run dev

echo.
echo The dev server has stopped.
pause
endlocal
