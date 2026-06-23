#!/usr/bin/env bash
# Shift Analytics Dashboard - one-click launcher (macOS / Linux).
# Run:  ./run.sh   (or: bash run.sh)
# Checks Node, installs deps on first run, optionally starts the Django
# backend, opens http://localhost:5173, then runs the Vite dev server.
set -u

# always work from the folder this script lives in
cd "$(dirname "$0")"

echo "============================================================"
echo "   Shift Analytics Dashboard - starting up"
echo "============================================================"
echo

# 1) Node.js must be installed
echo "[1/4] Checking for Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "   ERROR: Node.js was not found."
  echo "   This app needs Node.js 18 or newer - install it from https://nodejs.org/"
  echo "   then run ./run.sh again."
  exit 1
fi
echo "       Found Node $(node --version)."
echo

if [ ! -f "frontend/package.json" ]; then
  echo "   ERROR: could not find frontend/package.json next to this script."
  exit 1
fi

# 2) install dependencies on first run
if [ ! -d "frontend/node_modules" ]; then
  echo "[2/4] First run detected - installing dependencies (this can take a minute)..."
  ( cd frontend && npm install ) || { echo "   ERROR: npm install failed."; exit 1; }
  echo "       Dependencies installed."
else
  echo "[2/4] Dependencies already present - skipping npm install."
fi
echo

# 3) optional Django backend (non-fatal if absent)
echo "[3/4] Checking for the optional Django backend..."
if [ -f "backend/manage.py" ] && [ -x "backend/venv/bin/python" ]; then
  echo "       Backend found - launching it on port 8000."
  ( cd backend && ./venv/bin/python manage.py runserver 8000 ) &
else
  echo "       No backend virtual environment - skipping (local mode works fully)."
fi
echo

# 4) open the browser shortly after Vite boots, then run the dev server
echo "[4/4] Starting the dev server at http://localhost:5173 ..."
echo "       Keep this terminal open while you use the app. Press Ctrl+C to stop."
echo
( sleep 4
  if command -v open >/dev/null 2>&1; then open http://localhost:5173
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:5173
  fi ) >/dev/null 2>&1 &

cd frontend
npm run dev
