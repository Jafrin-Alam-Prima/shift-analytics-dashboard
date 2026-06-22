#!/usr/bin/env bash
# One-command setup for the Shift Analytics Dashboard.
# Installs the frontend deps and (if Python is available) the backend venv + deps.
# Usage:  ./setup.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Frontend: installing npm dependencies"
cd "$ROOT/frontend"
npm install

echo ""
echo "==> Backend (optional): venv + dependencies"
# prefer a Python that has pandas wheels (3.11–3.13); fall back to python3
PY=""
for c in python3.13 python3.12 python3.11 python3; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -n "$PY" ]; then
  cd "$ROOT/backend"
  "$PY" -m venv venv
  ./venv/bin/python -m pip install --quiet --upgrade pip
  ./venv/bin/pip install -r requirements.txt
  ./venv/bin/python manage.py migrate
  echo "==> Backend ready (using $PY)."
else
  echo "!! No python3 found — skipping the backend. Local mode still works."
fi

echo ""
echo "Setup complete."
echo "  Run the app (local mode):   cd frontend && npm run dev"
echo "  Run the backend (optional): cd backend && source venv/bin/activate && python manage.py runserver 8000"
