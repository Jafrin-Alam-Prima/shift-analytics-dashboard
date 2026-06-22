"""Backend analysis — mirrors the frontend's pure logic so both modes agree.

The same rules as frontend/src/lib/{cleaning,analysis,filters}.js, implemented
in Python. pandas is used to load the CSV; the row-level cleaning is written out
explicitly so it matches the JavaScript exactly.
"""
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent

# default CSV path (same file the frontend serves); override with SHIFT_DATA_CSV
DEFAULT_CSV = BASE_DIR.parent / "frontend" / "public" / "shift_data.csv"


def csv_path():
    return Path(os.environ.get("SHIFT_DATA_CSV", DEFAULT_CSV))


# ---- defaults (kept in step with frontend/src/lib/config.js) ----------------
DEFAULT_FAILURE = ["Breakdown", "Unknown Failure"]
DEFAULT_GROUPS = {
    "Unplanned downtime": ["Breakdown", "Unknown Failure", "Machine Jam", "Power Failure"],
    "Planned work": ["Maintenance", "Cleaning", "Setup", "Quality Check", "Training"],
    "Waiting / idle": ["Idle", "Material Shortage"],
    "Other": ["Other"],
}
FALLBACK_GROUP = "Other"
DEFAULT_STREAK = {
    "method": "consecutive",
    "minStreakDays": 2,
    "maxGapDays": 0,
    "windowHours": 12,
    "minStreakShifts": 2,
}
DEFAULT_CLEANING = {
    "badDate": "useStartDate",
    "missingTime": "keepExcludeTimeline",
    "negativeHours": "recomputeOrExclude",
    "hoursConflict": "recompute",
    "duplicate": "dropExtra",
    "reasonCase": "normalize",
    "crossMidnight": "keepFlag",
}
ISSUE_LABELS = {
    "missingStart": "Missing start time",
    "missingEnd": "Missing end time",
    "badDate": "Invalid date",
    "negativeHours": "Negative hours",
    "hoursConflict": "Hours ≠ start–end",
    "crossMidnight": "Cross-midnight shift",
    "duplicate": "Duplicate row",
    "reasonCase": "Reason needs tidying",
}
HOURS_TOLERANCE = 0.1
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# ---- report config (mirrors config.js) --------------------------------------
DEFAULT_SHIFT_WINDOWS = [
    {"key": "morning", "label": "Morning", "start": 6, "end": 14},
    {"key": "afternoon", "label": "Afternoon", "start": 14, "end": 22},
    {"key": "night", "label": "Night", "start": 22, "end": 6},
]
DEFAULT_EFFICIENCY_TARGET = 90
DEFAULT_SEVERITY_BANDS = {"medium": 6, "high": 12}
ISSUE_SEVERITY = {
    "missingStart": "critical",
    "missingEnd": "critical",
    "negativeHours": "warning",
    "hoursConflict": "warning",
    "badDate": "warning",
    "crossMidnight": "info",
    "reasonCase": "info",
    "duplicate": "duplicate",
}


def default_report_config():
    return {
        "shiftWindows": [dict(w) for w in DEFAULT_SHIFT_WINDOWS],
        "target": DEFAULT_EFFICIENCY_TARGET,
        "severityBands": dict(DEFAULT_SEVERITY_BANDS),
    }


def default_params():
    return {
        "failureReasons": list(DEFAULT_FAILURE),
        "groups": {k: list(v) for k, v in DEFAULT_GROUPS.items()},
        "streak": dict(DEFAULT_STREAK),
        "cleaning": dict(DEFAULT_CLEANING),
        "report": default_report_config(),
    }


# ---- small parsers ----------------------------------------------------------
def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
    except Exception:
        return None


def parse_day_date(s):
    if not s:
        return None
    s = s.strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        mo, d, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
        if not m:
            return None
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if mo < 1 or mo > 12 or d < 1 or d > 31:
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def parse_hours(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except Exception:
        return None


def ts_date_key(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def normalize_reason(s):
    return re.sub(r"\s+", " ", (s or "").strip())


def iso(dt):
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---- display helpers (match frontend/src/lib/format.js) ---------------------
def num(n, dp=1):
    if n is None:
        return "—"
    r = round(float(n), dp)
    return str(int(r)) if r == int(r) else str(r)


def pct(n, dp=1):
    return "—" if n is None else f"{num(n, dp)}%"


def hrs(n, dp=1):
    return "—" if n is None else f"{num(n, dp)} h"


def short_date(key):
    if not key:
        return "—"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", key)
    return f"{MONTHS[int(m.group(2)) - 1]} {int(m.group(3))}" if m else key


def group_of(reason, groups):
    for name, members in groups.items():
        if reason in members:
            return name
    return FALLBACK_GROUP


# ---- data loading -----------------------------------------------------------
def load_logical():
    """Read the CSV with pandas and return logical rows (strings)."""
    df = pd.read_csv(csv_path(), dtype=str, keep_default_na=False)
    df.columns = [c.strip() for c in df.columns]
    cols = {c.lower(): c for c in df.columns}

    def pick(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    cmap = {
        "date": pick("day_date", "date", "day"),
        "start": pick("start"),
        "end": pick("end"),
        "hours": pick("hours"),
        "reason": pick("reason"),
    }
    rows = []
    for _, r in df.iterrows():
        rows.append({k: (str(r[v]).strip() if v else "") for k, v in cmap.items()})
    return rows


# ---- cleaning (mirrors cleaning.js) -----------------------------------------
def detect_issues(row, p):
    issues = []
    if p["start"] is None:
        issues.append("missingStart")
    if p["end"] is None:
        issues.append("missingEnd")
    if p["dayKey"] is None:
        issues.append("badDate")
    if p["hours"] is not None and p["hours"] < 0:
        issues.append("negativeHours")
    if p["start"] and p["end"]:
        dur = (p["end"] - p["start"]).total_seconds() / 3600
        if p["hours"] is not None and abs(dur - p["hours"]) > HOURS_TOLERANCE:
            issues.append("hoursConflict")
        if ts_date_key(p["start"]) != ts_date_key(p["end"]):
            issues.append("crossMidnight")
    if normalize_reason(row["reason"]) != row["reason"]:
        issues.append("reasonCase")
    return issues


def build_dataset(logical, params):
    strat = params["cleaning"]
    base = []
    for i, row in enumerate(logical):
        p = {
            "start": parse_ts(row["start"]),
            "end": parse_ts(row["end"]),
            "dayKey": parse_day_date(row["date"]),
            "hours": parse_hours(row["hours"]),
        }
        rid = row["__id"] if "__id" in row else i
        base.append({"i": rid, "row": row, "parsed": p, "issues": detect_issues(row, p)})

    # duplicate detection
    groups_map = {}
    for b in base:
        key = "|".join([b["row"]["date"], b["row"]["start"], b["row"]["end"], b["row"]["hours"], b["row"]["reason"]])
        groups_map.setdefault(key, []).append(b["i"])
    for b in base:
        key = "|".join([b["row"]["date"], b["row"]["start"], b["row"]["end"], b["row"]["hours"], b["row"]["reason"]])
        if len(groups_map[key]) > 1:
            b["issues"].append("duplicate")

    seen = set()
    raw, clean = [], []
    for b in base:
        p, issues = b["parsed"], b["issues"]
        raw.append({
            "i": b["i"],
            "reason": b["row"]["reason"],
            "start": iso(p["start"]),
            "end": iso(p["end"]),
            "dateKey": p["dayKey"],
            "hours": p["hours"],
            "issues": issues,
            "removed": False,
            "inTimeline": bool(p["start"] and p["end"]),
            "crossMidnight": "crossMidnight" in issues,
        })

        drop_row = False
        key = "|".join([b["row"]["date"], b["row"]["start"], b["row"]["end"], b["row"]["hours"], b["row"]["reason"]])
        is_dup = len(groups_map[key]) > 1
        removed = is_dup and strat["duplicate"] == "dropExtra" and key in seen
        if is_dup:
            seen.add(key)

        date_key = p["dayKey"]
        if date_key is None:
            if strat["badDate"] == "useStartDate":
                if p["start"]:
                    date_key = ts_date_key(p["start"])
                elif p["end"]:
                    date_key = ts_date_key(p["end"])
            elif strat["badDate"] == "drop":
                drop_row = True

        missing_time = p["start"] is None or p["end"] is None
        if missing_time and strat["missingTime"] == "drop":
            drop_row = True

        conflict = "hoursConflict" in issues
        hours = None
        if conflict and strat["hoursConflict"] == "keepHours" and p["hours"] is not None and p["hours"] >= 0:
            hours = p["hours"]
        elif p["start"] and p["end"] and p["end"] > p["start"]:
            hours = (p["end"] - p["start"]).total_seconds() / 3600
        elif p["hours"] is not None and p["hours"] >= 0:
            hours = p["hours"]

        if "crossMidnight" in issues and strat["crossMidnight"] == "drop":
            drop_row = True

        reason_clean = normalize_reason(b["row"]["reason"]) if strat["reasonCase"] == "normalize" else b["row"]["reason"]

        if not removed and not drop_row:
            clean.append({
                "i": b["i"],
                "reason": reason_clean,
                "start": iso(p["start"]),
                "end": iso(p["end"]),
                "dateKey": date_key,
                "hours": hours,
                "issues": issues,
                "removed": False,
                "inTimeline": bool(p["start"] and p["end"]),
                "crossMidnight": "crossMidnight" in issues,
            })

    issues_summary = []
    for t in ISSUE_LABELS:
        rows_with = [b["i"] for b in base if t in b["issues"]]
        if rows_with:
            issues_summary.append({"type": t, "label": ISSUE_LABELS[t], "rows": rows_with, "count": len(rows_with)})

    flagged = [b["i"] for b in base if b["issues"]]
    total = len(base)
    return {
        "raw": raw,
        "clean": clean,
        "issues": issues_summary,
        "flaggedRows": flagged,
        "total": total,
        "cleanCount": len(clean),
        "flaggedCount": len(flagged),
        "errorRate": (len(flagged) / total * 100) if total else 0,
    }


# ---- analysis (mirrors analysis.js) -----------------------------------------
def _usable(r):
    return r["hours"] if (r["hours"] is not None and r["hours"] >= 0) else 0


def efficiency(records, failure):
    prod = tot = 0.0
    for r in records:
        h = _usable(r)
        if h == 0:
            continue
        tot += h
        if r["reason"] not in failure:
            prod += h
    return {"score": (prod / tot * 100) if tot > 0 else None, "productive": prod, "total": tot}


def hours_by_reason(records):
    m = {}
    for r in records:
        m[r["reason"]] = m.get(r["reason"], 0) + _usable(r)
    return m


def hours_by_day(records):
    m = {}
    for r in records:
        if r["dateKey"]:
            m[r["dateKey"]] = m.get(r["dateKey"], 0) + _usable(r)
    return m


def _day_number(key):
    y, mo, d = (int(x) for x in key.split("-"))
    return datetime(y, mo, d, tzinfo=timezone.utc).timestamp() / 86400


def find_streaks(records, failure, streak):
    method = (streak or {}).get("method", "consecutive")
    if method == "window":
        return _window_streaks(records, failure, streak)
    if method == "shift":
        return _shift_streaks(records, failure, streak)
    return _consecutive_streaks(records, failure, streak)


def _consecutive_streaks(records, failure, streak):
    min_days = streak.get("minStreakDays", 2)
    max_gap = streak.get("maxGapDays", 0)
    days = {}
    for r in records:
        if not r["dateKey"] or r["reason"] not in failure:
            continue
        d = days.setdefault(r["dateKey"], {"hours": 0, "count": 0})
        d["hours"] += _usable(r)
        d["count"] += 1

    keys = sorted(days)
    streaks = []
    run = []

    def push(run):
        if len(run) < min_days:
            return
        start, end = run[0], run[-1]
        length = int(round(_day_number(end) - _day_number(start))) + 1
        streaks.append({
            "start": start,
            "end": end,
            "lengthDays": length,
            "hours": sum(days[k]["hours"] for k in run),
            "count": sum(days[k]["count"] for k in run),
        })

    for k in keys:
        if not run:
            run = [k]
        elif _day_number(k) - _day_number(run[-1]) <= max_gap + 1:
            run.append(k)
        else:
            push(run)
            run = [k]
    push(run)
    return streaks


def _summarise_run(run):
    keys = sorted(r["dateKey"] for r in run if r["dateKey"])
    start = keys[0] if keys else None
    end = keys[-1] if keys else None
    length = (int(round(_day_number(end) - _day_number(start))) + 1) if (start and end) else len(run)
    return {
        "start": start,
        "end": end,
        "lengthDays": length,
        "hours": sum(_usable(r) for r in run),
        "count": len(run),
    }


def _window_streaks(records, failure, streak):
    window_hours = streak.get("windowHours", 12)
    min_shifts = streak.get("minStreakShifts", 2)
    fails = sorted(
        (r for r in records if r["reason"] in failure and r["start"]),
        key=lambda r: r["start"],
    )
    out, run = [], []
    for r in fails:
        if not run:
            run = [r]
        else:
            gap = (parse_ts(r["start"]) - parse_ts(run[-1]["start"])).total_seconds() / 3600
            if gap <= window_hours:
                run.append(r)
            else:
                if len(run) >= min_shifts:
                    out.append(_summarise_run(run))
                run = [r]
    if len(run) >= min_shifts:
        out.append(_summarise_run(run))
    return out


def _shift_streaks(records, failure, streak):
    min_shifts = streak.get("minStreakShifts", 2)
    allrecs = sorted((r for r in records if r["start"]), key=lambda r: r["start"])
    out, run = [], []
    for r in allrecs:
        if r["reason"] in failure:
            run.append(r)
        else:
            if len(run) >= min_shifts:
                out.append(_summarise_run(run))
            run = []
    if len(run) >= min_shifts:
        out.append(_summarise_run(run))
    return out


def build_insights(records, failure, groups, streaks):
    out = []
    by_reason = hours_by_reason(records)
    by_day = hours_by_day(records)
    downtime = sum(by_reason.get(r, 0) for r in failure)

    if downtime > 0:
        top = None
        for r in failure:
            if by_reason.get(r, 0) > 0 and (top is None or by_reason[r] > by_reason[top]):
                top = r
        if top:
            share = by_reason[top] / downtime * 100
            out.append(f"{top} causes the most lost hours ({hrs(by_reason[top])}, {pct(share)} of downtime) — prioritise fixing {top}.")

    down_by_day = {}
    for r in records:
        if r["dateKey"] and r["reason"] in failure:
            down_by_day[r["dateKey"]] = down_by_day.get(r["dateKey"], 0) + _usable(r)
    if down_by_day:
        peak = sorted(down_by_day, key=lambda k: -down_by_day[k])[0]
        out.append(f"Downtime peaked on {short_date(peak)} ({hrs(down_by_day[peak])}) — investigate what happened that day.")

    if streaks:
        s = streaks[0]
        out.append(f"Breakdowns recurred {short_date(s['start'])}–{short_date(s['end'])} ({s['count']} shifts, {hrs(s['hours'])}) — look for a shared root cause across those days.")

    eff = efficiency(records, failure)
    if eff["score"] is not None:
        top = None
        for r in failure:
            if by_reason.get(r, 0) > 0 and (top is None or by_reason[r] > by_reason[top]):
                top = r
        if top:
            out.append(f"Overall efficiency is {pct(eff['score'])}; the biggest lever is reducing {top} hours.")
        else:
            out.append(f"Overall efficiency is {pct(eff['score'])} with no failure hours recorded — keep it up.")

    if len(out) < 3 and by_day:
        busiest = sorted(by_day, key=lambda k: -by_day[k])[0]
        out.append(f"The busiest day was {short_date(busiest)} ({hrs(by_day[busiest])} logged).")
    if len(out) < 3:
        out.append(f"Tracking {len(records)} shift records across {len(by_day)} days.")
    return out


# ---- report metrics (mirrors report.js) -------------------------------------
def _rec_hour(r):
    d = parse_ts(r["start"]) if r["start"] else None
    if d is None:
        return None
    return d.hour + d.minute / 60


def slot_of(hour, windows):
    if hour is None:
        return None
    for w in windows:
        if w["start"] < w["end"]:
            if w["start"] <= hour < w["end"]:
                return w["key"]
        elif hour >= w["start"] or hour < w["end"]:
            return w["key"]
    return None


def _median(arr):
    if not arr:
        return None
    s = sorted(arr)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def _key_from_daynum(n):
    return datetime.fromtimestamp(n * 86400, tz=timezone.utc).strftime("%Y-%m-%d")


def streak_band(hours, bands):
    if hours >= bands["high"]:
        return "high"
    if hours >= bands["medium"]:
        return "medium"
    return "low"


def report_metrics(records, params, report_config, data_quality):
    failure = params["failureReasons"]
    windows = report_config["shiftWindows"]
    target = report_config["target"]
    bands = report_config["severityBands"]

    day_keys = sorted(r["dateKey"] for r in records if r["dateKey"])
    min_key = day_keys[0] if day_keys else None
    max_key = day_keys[-1] if day_keys else None
    days = (int(round(_day_number(max_key) - _day_number(min_key))) + 1) if (min_key and max_key) else 0

    # shift slots
    slot_map = {w["key"]: {"key": w["key"], "label": w["label"], "count": 0, "hours": 0.0, "durations": [], "byReason": {}} for w in windows}
    for r in records:
        k = slot_of(_rec_hour(r), windows)
        if not k or k not in slot_map:
            continue
        s = slot_map[k]
        s["count"] += 1
        h = _usable(r)
        s["hours"] += h
        if h > 0:
            s["durations"].append(h)
        s["byReason"][r["reason"]] = s["byReason"].get(r["reason"], 0) + h
    shift_slots = []
    for w in windows:
        s = slot_map[w["key"]]
        shift_slots.append({
            "key": s["key"], "label": s["label"], "count": s["count"], "hours": s["hours"],
            "avg": (s["hours"] / len(s["durations"])) if s["durations"] else None,
            "median": _median(s["durations"]), "byReason": s["byReason"],
        })

    # weeks from real min date
    by_week = []
    if min_key:
        week_of = {}
        for r in records:
            if not r["dateKey"]:
                continue
            wi = int((_day_number(r["dateKey"]) - _day_number(min_key)) // 7)
            week_of.setdefault(wi, []).append(r)
        for wi in sorted(week_of):
            total = prod = down = 0.0
            for r in week_of[wi]:
                h = _usable(r)
                if h <= 0:
                    continue
                total += h
                if r["reason"] in failure:
                    down += h
                else:
                    prod += h
            by_week.append({
                "index": wi,
                "startKey": _key_from_daynum(_day_number(min_key) + wi * 7),
                "endKey": _key_from_daynum(_day_number(min_key) + wi * 7 + 6),
                "downtime": down, "total": total, "productive": prod,
                "score": (prod / total * 100) if total > 0 else None,
            })
    wow = None
    if len(by_week) >= 2:
        prev, last = by_week[-2], by_week[-1]
        delta = last["downtime"] - prev["downtime"]
        wow = {"prev": prev, "last": last, "downtimeDelta": delta,
               "downtimePctChange": (delta / prev["downtime"] * 100) if prev["downtime"] > 0 else None}

    # peak downtime day + worst efficiency day
    down_by_day = {}
    day_recs = {}
    for r in records:
        if not r["dateKey"]:
            continue
        day_recs.setdefault(r["dateKey"], []).append(r)
        if r["reason"] in failure:
            down_by_day[r["dateKey"]] = down_by_day.get(r["dateKey"], 0) + _usable(r)
    peak_downtime_day = None
    for k, v in down_by_day.items():
        if v > 0 and (peak_downtime_day is None or v > peak_downtime_day["hours"]):
            peak_downtime_day = {"dateKey": k, "hours": v}
    worst_efficiency_day = None
    for k, recs in day_recs.items():
        t = p = 0.0
        for r in recs:
            h = _usable(r)
            if h <= 0:
                continue
            t += h
            if r["reason"] not in failure:
                p += h
        if t <= 0:
            continue
        sc = p / t * 100
        if worst_efficiency_day is None or sc < worst_efficiency_day["score"]:
            worst_efficiency_day = {"dateKey": k, "score": sc}

    # reason contribution to downtime
    reason_hours = {}
    for r in records:
        if r["reason"] in failure:
            reason_hours[r["reason"]] = reason_hours.get(r["reason"], 0) + _usable(r)
    downtime_total = sum(reason_hours.values())
    reason_contribution = [
        {"reason": rn, "hours": reason_hours[rn], "pct": (reason_hours[rn] / downtime_total * 100) if downtime_total > 0 else 0}
        for rn in sorted([rn for rn in reason_hours if reason_hours[rn] > 0], key=lambda x: -reason_hours[x])
    ]

    # overall efficiency + target gap
    T = P = 0.0
    for r in records:
        h = _usable(r)
        if h <= 0:
            continue
        T += h
        if r["reason"] not in failure:
            P += h
    score = (P / T * 100) if T > 0 else None
    target_gap = (score - target) if score is not None else None

    # data-quality severity tiers
    sev = {"critical": 0, "warning": 0, "info": 0, "duplicate": 0}
    for it in (data_quality or {}).get("issues", []):
        tier = ISSUE_SEVERITY.get(it["type"], "info")
        sev[tier] = sev.get(tier, 0) + it["count"]

    return {
        "dateRange": {"min": min_key, "max": max_key, "days": days},
        "shiftSlots": shift_slots,
        "byWeek": by_week,
        "wow": wow,
        "peakDowntimeDay": peak_downtime_day,
        "worstEfficiencyDay": worst_efficiency_day,
        "reasonContribution": reason_contribution,
        "downtimeTotal": downtime_total,
        "target": target,
        "score": score,
        "targetGap": target_gap,
        "severity": {"dataQuality": sev},
        "bands": bands,
    }


# ---- filters (mirrors filters.js) -------------------------------------------
def default_filters():
    return {"dateFrom": "", "dateTo": "", "reasons": [], "groups": [], "hoursMin": "", "hoursMax": "", "kind": "all"}


def apply_filters(records, filters, params):
    f = {**default_filters(), **(filters or {})}
    mn = None if f["hoursMin"] == "" else float(f["hoursMin"])
    mx = None if f["hoursMax"] == "" else float(f["hoursMax"])
    failure = params["failureReasons"]
    out = []
    for r in records:
        if f["dateFrom"] or f["dateTo"]:
            if not r["dateKey"]:
                continue
            if f["dateFrom"] and r["dateKey"] < f["dateFrom"]:
                continue
            if f["dateTo"] and r["dateKey"] > f["dateTo"]:
                continue
        if f["reasons"] and r["reason"] not in f["reasons"]:
            continue
        if f["groups"] and group_of(r["reason"], params["groups"]) not in f["groups"]:
            continue
        if mn is not None or mx is not None:
            if r["hours"] is None:
                continue
            if mn is not None and r["hours"] < mn:
                continue
            if mx is not None and r["hours"] > mx:
                continue
        if f["kind"] == "productive" and r["reason"] in failure:
            continue
        if f["kind"] == "downtime" and r["reason"] not in failure:
            continue
        out.append(r)
    return out


# ---- top-level: the full result the API returns -----------------------------
# ---- manual overrides (mirrors overrides.js) --------------------------------
def apply_overrides(logical, overrides):
    overrides = overrides or {}
    out = []
    for i, row in enumerate(logical):
        ov = overrides.get(str(i), overrides.get(i))
        if ov and ov.get("excluded"):
            continue
        merged = dict(row)
        if ov and ov.get("fields"):
            for f, v in ov["fields"].items():
                merged[f] = v
        merged["__id"] = i
        out.append(merged)
    return out


def analyze(params=None, mode="clean", filters=None, rows=None, overrides=None):
    # merge incoming params over the defaults so partial params still work
    base = default_params()
    p = params or {}
    params = {
        "failureReasons": p.get("failureReasons") or base["failureReasons"],
        "groups": {**base["groups"], **(p.get("groups") or {})},
        "streak": {**base["streak"], **(p.get("streak") or {})},
        "cleaning": {**base["cleaning"], **(p.get("cleaning") or {})},
        "report": {**base["report"], **(p.get("report") or {})},
    }

    # use the rows the frontend sent (its current dataset, sample or uploaded);
    # fall back to the bundled file only when none are provided.
    if rows:
        logical = [
            {k: str(r.get(k, "")) for k in ("date", "start", "end", "hours", "reason")}
            for r in rows
        ]
    else:
        logical = load_logical()
    # apply manual corrections on top (none by default), then clean canonically
    logical = apply_overrides(logical, overrides)
    ds = build_dataset(logical, params)
    active = ds["raw"] if mode == "raw" else ds["clean"]
    filtered = apply_filters(active, filters, params)

    eff = efficiency(filtered, params["failureReasons"])
    official = efficiency(filtered, DEFAULT_FAILURE)
    streaks = find_streaks(filtered, params["failureReasons"], params["streak"])
    insights = build_insights(filtered, params["failureReasons"], params["groups"], streaks)

    data_quality = {
        "issues": ds["issues"],
        "flaggedRows": ds["flaggedRows"],
        "flaggedCount": ds["flaggedCount"],
        "total": ds["total"],
        "cleanCount": ds["cleanCount"],
        "errorRate": ds["errorRate"],
    }
    report = report_metrics(filtered, params, params["report"], data_quality)

    same = sorted(params["failureReasons"]) == sorted(DEFAULT_FAILURE)
    return {
        "mode": mode,
        "records": filtered,
        "efficiency": eff,
        "officialEfficiency": official,
        "failureCustomized": not same,
        "streaks": streaks,
        "insights": insights,
        "dataQuality": data_quality,
        "report": report,
        "raw": ds["raw"],
        "clean": ds["clean"],
    }
