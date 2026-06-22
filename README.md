# Shift Analytics Dashboard

A web app that turns messy factory shift-log data into a clean operational story. It detects and
handles data-quality issues, scores operational efficiency, finds recurring breakdown streaks, draws
shift and time-based visualizations, and surfaces plain-language insights a plant manager can act on.

It runs two ways:

- **Local mode (default)** — all analysis runs in the browser. No server needed. This is the
  canonical result.
- **Backend mode (optional)** — a Django + pandas API recomputes the same numbers with the same
  rules, so both modes always agree. A built-in parity check proves it.

---

## Features

- Six analytical views: **Overview**, **Shift analysis**, **Breakdown streaks**, **Efficiency**,
  **Trends**, and **Insights**.
- **Data quality** — automatic detection, documentation, and handling of operational inconsistencies,
  with a Methodology page that documents every detection rule and how each issue was handled.
- **Breakdown-streak detection** with clearly documented assumptions.
- **Operational Efficiency Score** = (Productive ÷ Total) × 100.
- **At least three operational insights** a plant manager can act on.
- **Filtering** by any combination of date range, reason, group, hours, and type.
- **Stays correct when new activity categories appear** — fully dynamic, with no hardcoded categories.
- **Export** (cleaned CSV, Markdown report, chart PNGs, print) and **dark mode**.

---

## Tech stack

- **Frontend:** React + Vite (JavaScript), Chart.js, PapaParse (CSV parsing), Inter font (bundled via
  `@fontsource`).
- **Backend (optional):** Django + Django REST Framework + pandas, SQLite.
- **Quality:** ~131 unit tests (Node test runner) plus a local-vs-backend parity script.

---

## Requirements

- Node.js 18+ (tested on Node 22)
- npm 9+
- Python 3.11–3.13 (only needed for the optional backend mode)

---

## Quick start (one command)

```bash
git clone https://github.com/Jafrin-Alam-Prima/shift-analytics-dashboard.git
cd shift-analytics-dashboard
./setup.sh
cd frontend && npm run dev
```

Then open the URL Vite prints — usually <http://localhost:5173>. The app loads a sample dataset
automatically.

> **Windows:** run `./setup.sh` in **Git Bash**, or follow the manual steps below.

`setup.sh` installs the frontend dependencies and, if Python is present, creates the backend virtual
environment, installs its dependencies, and migrates the database. If no Python is found it skips the
backend gracefully — local mode still works.

---

## Manual setup

### 1. Frontend (local mode — fully functional on its own)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

Production build:

```bash
npm run build
npm run preview
```

### 2. Backend (optional — enables Auto/Backend mode and parity)

In a second terminal:

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Then in the app, open **Settings** (the gear, top-right) and set **Source** to **Auto** (uses the
backend when it is running, falls back to local when it is not) or **Backend**.

---

## Using the app

- The app loads a bundled sample CSV on start.
- **Upload your own data:** Settings (gear) → upload a CSV, and remap columns if the names differ.
- **Explore:** switch views in the sidebar; use the **Filters** bar to combine date / reason / group /
  hours / type.
- **Data quality:** click the "_X of Y rows clean_" chip at the top (or the **Data Quality** item) to
  see every detected issue and how it was handled.
- **Export:** the **Export** menu (CSV / Markdown / Print) and the per-chart PNG buttons.
- **Dark mode:** toggle in the header.

---

## Expected data

Each row is one shift or incident. The column mapper maps your columns to five logical fields:

| Field    | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `date`   | calendar day                                         |
| `start`  | shift start time                                     |
| `end`    | shift end time                                       |
| `hours`  | recorded duration                                    |
| `reason` | activity / incident type (Breakdown, Power Failure…) |

Renamed columns and brand-new reason categories are handled automatically.

---

## How it works

**Pipeline:** CSV → parse → column map → clean (detect + handle issues) → filter → analyze →
views + export.

Local mode computes everything in the browser (the canonical result). Backend mode sends the same rows
and parameters to the Django/pandas API, which mirrors the exact logic so both agree. Verify it with:

```bash
node scripts/parity-check.mjs   # with the backend running
```

Key definitions:

- **Operational Efficiency Score** = (Productive ÷ Total) × 100, where _Productive_ = hours whose
  reason is **not** Breakdown or Unknown Failure, and _Total_ = sum of all usable shift hours.
- **Breakdown streak** = consecutive calendar days that each contain at least one failure shift;
  severity is graded by total failure hours. The exact assumptions are documented in-app under
  **Breakdown streaks → Method & assumptions**.

The detection rules and how each data issue is handled are documented in-app on the **Data Quality**
page.

---

## Tests

```bash
cd frontend
npm test
```

---

## Deployment (Vercel — frontend only)

The frontend is a static Vite app and runs fully in local mode, so deploying just the frontend gives a
complete, working application.

In Vercel, set:

- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

The deployed app runs in local mode (the canonical engine) and loads the bundled sample data; users can
upload their own CSV. The Django backend is for local development and the parity check — to run it live,
deploy it separately on a Python-friendly host (Render, Railway, Fly.io) and point the frontend at it.

---

## Project structure

```
shift-analytics-dashboard/
├── frontend/             # React + Vite app (local-mode engine + UI)
│   ├── src/lib/          # pure logic: csv, columnMap, cleaning, analysis, report, filters, ...
│   ├── src/components/   # views, charts, panels
│   └── src/state/        # useDashboard (wires the whole pipeline together)
├── backend/              # optional Django + DRF + pandas API (mirrors the logic)
├── scripts/              # parity check and helpers
├── setup.sh              # one-command setup
└── README.md
```
