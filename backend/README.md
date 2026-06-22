# Backend — Django + pandas API

A small Django REST service that recomputes the same analytics as the frontend,
in pandas, using the **same rules and parameters**. This is what powers the app's
"backend mode" so local and backend results always agree.

There are no database models — it just reads the CSV and computes metrics.

## Requirements

- Python 3.11–3.13 (built and tested on 3.13)
- pip

## Setup & run

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver 8000
```

The API is then at <http://127.0.0.1:8000/api/>.

By default it reads the same CSV the frontend serves
(`../frontend/public/shift_data.csv`). Override the path with an env var:

```bash
SHIFT_DATA_CSV=/path/to/shift_data.csv python manage.py runserver 8000
```

## Endpoints

### `GET /api/health/`

Liveness check the frontend pings.

```json
{ "status": "ok", "dataFile": "...", "exists": true }
```

### `POST /api/analyze/`

Recompute everything with the given parameters and filters. All fields are
optional — anything omitted falls back to the defaults.

Request body:

```json
{
  "mode": "clean",
  "params": {
    "failureReasons": ["Breakdown", "Unknown Failure"],
    "streak": { "minStreakDays": 2, "maxGapDays": 0 },
    "groups": { "Unplanned downtime": ["Breakdown", "..."] },
    "cleaning": { "hoursConflict": "recompute" }
  },
  "filters": { "kind": "all", "reasons": [], "groups": [], "dateFrom": "", "dateTo": "", "hoursMin": "", "hoursMax": "" }
}
```

Response (shape):

```json
{
  "mode": "clean",
  "records": [ /* filtered records for the charts */ ],
  "efficiency": { "score": 85.9, "productive": 0, "total": 0 },
  "officialEfficiency": { "score": 85.9 },
  "failureCustomized": false,
  "streaks": [ { "start": "2025-10-08", "end": "2025-10-09", "lengthDays": 2, "hours": 7.4, "count": 2 } ],
  "insights": [ "..." ],
  "dataQuality": { "issues": [], "flaggedCount": 10, "total": 51, "cleanCount": 50, "errorRate": 19.6 }
}
```

On the bundled dataset the defaults give clean efficiency ≈ 85.9 %, raw ≈ 75.7 %,
the Oct 8–9 streak, and 10/51 flagged rows — the same as the frontend.

### `POST /api/validate/`

Inspect a posted dataset without saving it — returns row count, flagged-row count,
error rate, the reasons present, and the per-issue breakdown. A light "check this
file" call.

### `GET/POST /api/reports/` · `GET/DELETE /api/reports/<id>/`

Saved reports (SQLite): list/create, and load/delete one. See the main README.

## Scope note (optional extras)

Kept intentionally minimal for local use: there is **no auth** and **no
large-file streaming**. The endpoints accept the dataset in the request body,
which is fine for the assignment-sized files; add auth + chunked/streamed
uploads if this were ever shared or fed very large files.

## How parity is kept

`api/analysis.py` mirrors the pure functions in
`frontend/src/lib/{cleaning,analysis,filters}.js` rule-for-rule. The frontend
sends its current parameters to `/api/analyze/`, so both modes compute the same
thing from the same file.
