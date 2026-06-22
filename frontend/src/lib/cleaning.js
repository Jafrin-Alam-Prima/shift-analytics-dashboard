// Cleaning + detection engine (pure functions). It looks at the logical rows,
// finds every kind of data issue dynamically, and produces two parallel views:
//   raw   = the rows exactly as parsed (untouched)
//   clean = the same rows after the default fixes are applied
// Every fix comes from the row's OWN valid fields — we never invent values.
import { defaultParams } from "./config.js";

// ---- small parsers -------------------------------------------------------

// ISO timestamp like 2025-10-08T08:00:00Z -> Date, or null if unparseable
export function parseTimestamp(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// M/D/YYYY (or YYYY-MM-DD) -> "YYYY-MM-DD", or null if not a real calendar date
export function parseDayDate(s) {
  if (!s) return null;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  let y, mo, d;
  if (m) {
    mo = +m[1]; d = +m[2]; y = +m[3];
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
    if (!m) return null;
    y = +m[1]; mo = +m[2]; d = +m[3];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseHours(s) {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// date key (UTC) of a timestamp
function tsDateKey(d) {
  return d.toISOString().slice(0, 10);
}

// normalize a reason: trim + collapse inner whitespace (no case forcing, so
// multi-word reasons like "Material Shortage" survive untouched)
function normalizeReason(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

const HOURS_TOLERANCE = 0.1; // how far HOURS may drift from start-end before we flag it

// ---- the engine ----------------------------------------------------------

// Issue types and the human label shown in the UI.
export const ISSUE_LABELS = {
  missingStart: "Missing start time",
  missingEnd: "Missing end time",
  badDate: "Invalid date",
  negativeHours: "Negative hours",
  hoursConflict: "Hours ≠ start–end",
  crossMidnight: "Cross-midnight shift",
  duplicate: "Duplicate row",
  reasonCase: "Reason needs tidying",
};

// Detect the issues on one logical row. Pure: returns a list of issue types.
function detectIssues(row, parsed) {
  const issues = [];
  if (parsed.start === null) issues.push("missingStart");
  if (parsed.end === null) issues.push("missingEnd");
  if (parsed.dayKey === null) issues.push("badDate");
  if (parsed.hours !== null && parsed.hours < 0) issues.push("negativeHours");
  if (parsed.start && parsed.end) {
    const dur = (parsed.end - parsed.start) / 3600000;
    if (parsed.hours !== null && Math.abs(dur - parsed.hours) > HOURS_TOLERANCE)
      issues.push("hoursConflict");
    if (tsDateKey(parsed.start) !== tsDateKey(parsed.end)) issues.push("crossMidnight");
  }
  if (normalizeReason(row.reason) !== row.reason) issues.push("reasonCase");
  return issues;
}

// Main entry. logical = [{date,start,end,hours,reason}]. params optional.
export function buildDataset(logical, params = defaultParams()) {
  const strat = params.cleaning;

  // first pass: parse + detect. Each record's id is the row's stable __id when
  // present (so manual overrides/exclusions keep their original row numbers),
  // otherwise the array index.
  const base = logical.map((row, i) => {
    const parsed = {
      start: parseTimestamp(row.start),
      end: parseTimestamp(row.end),
      dayKey: parseDayDate(row.date),
      hours: parseHours(row.hours),
    };
    const issues = detectIssues(row, parsed);
    return { i: row.__id != null ? row.__id : i, row, parsed, issues };
  });

  // duplicate detection: identical rows share a key; flag every member
  const groups = new Map();
  base.forEach((b) => {
    const key = [b.row.date, b.row.start, b.row.end, b.row.hours, b.row.reason].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b.i);
  });
  base.forEach((b) => {
    const key = [b.row.date, b.row.start, b.row.end, b.row.hours, b.row.reason].join("|");
    if (groups.get(key).length > 1) b.issues.push("duplicate");
  });
  const seenKeys = new Set(); // for choosing which duplicate copy to drop

  // build raw + clean records
  const raw = [];
  const clean = [];
  base.forEach((b) => {
    const { parsed, issues } = b;

    // ---- raw record: values exactly as parsed ----
    raw.push({
      i: b.i,
      reason: b.row.reason,
      start: parsed.start,
      end: parsed.end,
      dateKey: parsed.dayKey, // raw keeps an invalid date as null
      hours: parsed.hours, // may be negative / null
      issues,
      removed: false,
      inTimeline: !!(parsed.start && parsed.end),
      crossMidnight: issues.includes("crossMidnight"),
    });

    // ---- clean record (honors the chosen per-issue strategies) ----
    let dropRow = false;

    // duplicates: keep the first copy, drop later ones (unless "keep all")
    const key = [b.row.date, b.row.start, b.row.end, b.row.hours, b.row.reason].join("|");
    const isDup = groups.get(key).length > 1;
    let removed = false;
    if (isDup && strat.duplicate === "dropExtra") removed = seenKeys.has(key);
    if (isDup) seenKeys.add(key);

    // effective date: use the valid day date, else fall back to this row's own
    // start (or end) date; or drop the row if that strategy is chosen.
    let dateKey = parsed.dayKey;
    if (dateKey === null) {
      if (strat.badDate === "useStartDate") {
        if (parsed.start) dateKey = tsDateKey(parsed.start);
        else if (parsed.end) dateKey = tsDateKey(parsed.end);
      } else if (strat.badDate === "drop") {
        dropRow = true;
      }
    }

    // missing start/end: kept but off the timeline, or dropped
    const missingTime = parsed.start === null || parsed.end === null;
    if (missingTime && strat.missingTime === "drop") dropRow = true;

    // effective hours: by default trust start-end; "keepHours" trusts the
    // column instead when the two disagree.
    const conflict = issues.includes("hoursConflict");
    let hours = null;
    if (conflict && strat.hoursConflict === "keepHours" && parsed.hours !== null && parsed.hours >= 0) {
      hours = parsed.hours;
    } else if (parsed.start && parsed.end && parsed.end > parsed.start) {
      hours = (parsed.end - parsed.start) / 3600000;
    } else if (parsed.hours !== null && parsed.hours >= 0) {
      hours = parsed.hours;
    }
    // a negative-hours row with no valid pair simply has no usable hours

    // cross-midnight: kept and flagged by default, or dropped
    if (issues.includes("crossMidnight") && strat.crossMidnight === "drop") dropRow = true;

    const reasonClean =
      strat.reasonCase === "normalize" ? normalizeReason(b.row.reason) : b.row.reason;

    if (!removed && !dropRow) {
      clean.push({
        i: b.i,
        reason: reasonClean,
        start: parsed.start,
        end: parsed.end,
        dateKey,
        hours,
        issues,
        removed: false,
        inTimeline: !!(parsed.start && parsed.end),
        crossMidnight: issues.includes("crossMidnight"),
      });
    }
  });

  // per-issue summary
  const issueOrder = Object.keys(ISSUE_LABELS);
  const issues = issueOrder
    .map((type) => {
      const rows = base.filter((b) => b.issues.includes(type)).map((b) => b.i);
      return { type, label: ISSUE_LABELS[type], rows, count: rows.length };
    })
    .filter((it) => it.count > 0);

  // flagged = any row with at least one issue
  const flaggedRows = base.filter((b) => b.issues.length > 0).map((b) => b.i);
  const total = base.length;
  const errorRate = total ? (flaggedRows.length / total) * 100 : 0;

  return {
    raw,
    clean,
    issues,
    flaggedRows,
    total,
    cleanCount: clean.length,
    flaggedCount: flaggedRows.length,
    errorRate,
  };
}

// unique reasons present in a set of records (sorted, for stable display)
export function uniqueReasons(records) {
  return [...new Set(records.map((r) => r.reason).filter(Boolean))].sort();
}
