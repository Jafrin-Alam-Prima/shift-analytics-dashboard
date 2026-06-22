"""API views.

- GET  /api/health/        liveness check the frontend pings.
- POST /api/analyze/       recompute everything with the given params/filters/rows.
- GET/POST /api/reports/   list saved reports / save the current analysis.
- GET/DELETE /api/reports/<id>/  load or delete a saved report.

Saved reports (SQLite) are the thing the browser-only mode can't do.
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .analysis import analyze, csv_path
from .models import SavedReport


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "dataFile": str(csv_path()), "exists": csv_path().exists()})


@api_view(["GET", "POST"])
def analyze_view(request):
    body = request.data if request.method == "POST" else {}
    params = body.get("params")
    mode = body.get("mode", "clean")
    filters = body.get("filters")
    rows = body.get("rows")
    overrides = body.get("overrides")
    try:
        result = analyze(params=params, mode=mode, filters=filters, rows=rows, overrides=overrides)
    except FileNotFoundError:
        return Response({"error": f"Data file not found at {csv_path()}"}, status=500)
    return Response(result)


def _summary(result, rows):
    return {
        "efficiency": result["officialEfficiency"]["score"],
        "customEfficiency": result["efficiency"]["score"],
        "streaks": len(result["streaks"]),
        "flagged": result["dataQuality"]["flaggedCount"],
        "total": result["dataQuality"]["total"],
        "rowsCount": len(rows or []),
    }


def _list_item(r):
    return {"id": r.id, "name": r.name, "created": r.created.isoformat(), "summary": r.summary}


@api_view(["POST"])
def validate(request):
    """Inspect a posted dataset (no persistence): row count, flagged rows, the
    reasons present, and the per-issue breakdown. A light 'check this file' call."""
    rows = request.data.get("rows") or []
    result = analyze(params=request.data.get("params"), rows=rows)
    dq = result["dataQuality"]
    reasons = sorted({(r.get("reason") or "").strip() for r in rows if r.get("reason")})
    return Response({
        "ok": dq["total"] > 0,
        "rowCount": dq["total"],
        "flagged": dq["flaggedCount"],
        "errorRate": dq["errorRate"],
        "reasons": reasons,
        "issues": dq["issues"],
    })


@api_view(["GET", "POST"])
def reports(request):
    if request.method == "POST":
        b = request.data
        rows = b.get("rows") or []
        params = b.get("params") or {}
        mode = b.get("mode", "clean")
        filters = b.get("filters") or {}
        name = (b.get("name") or "Untitled report").strip()[:200] or "Untitled report"
        notes = b.get("notes") or ""
        result = analyze(params=params, mode=mode, filters=filters, rows=rows)
        rep = SavedReport.objects.create(
            name=name, rows=rows, params=params, mode=mode, filters=filters,
            summary=_summary(result, rows), notes=notes,
        )
        return Response(_list_item(rep), status=201)
    return Response([_list_item(r) for r in SavedReport.objects.all()])


@api_view(["GET", "DELETE"])
def report_detail(request, pk):
    try:
        rep = SavedReport.objects.get(pk=pk)
    except SavedReport.DoesNotExist:
        return Response({"error": "Report not found."}, status=404)
    if request.method == "DELETE":
        rep.delete()
        return Response({"ok": True})
    return Response({
        "id": rep.id,
        "name": rep.name,
        "created": rep.created.isoformat(),
        "rows": rep.rows,
        "params": rep.params,
        "mode": rep.mode,
        "filters": rep.filters,
        "summary": rep.summary,
        "notes": rep.notes,
    })
