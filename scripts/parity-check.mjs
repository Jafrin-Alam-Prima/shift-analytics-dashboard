// Dual-mode parity check. Computes the result locally (the same JS the frontend
// uses) and compares it to the Django backend's /api/analyze, on BOTH the
// default settings and a non-default settings, for clean and raw modes.
//
// Requires the backend running:  cd backend && ./venv/bin/python manage.py runserver 8000
// Run:  node scripts/parity-check.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseCsvText } from "../frontend/src/lib/csv.js";
import { autoGuessMap, applyMap } from "../frontend/src/lib/columnMap.js";
import { buildDataset } from "../frontend/src/lib/cleaning.js";
import { analyse, efficiency } from "../frontend/src/lib/analysis.js";
import { reportMetrics } from "../frontend/src/lib/report.js";
import { applyOverrides } from "../frontend/src/lib/overrides.js";
import { applyFilters, defaultFilters } from "../frontend/src/lib/filters.js";
import { defaultParams, defaultReportConfig, DEFAULT_FAILURE_REASONS } from "../frontend/src/lib/config.js";

const BACKEND = "http://127.0.0.1:8000/api";
const here = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(here, "..", "frontend", "public", "shift_data.csv"), "utf8");

const { headers, rows } = parseCsvText(csv);
const { map } = autoGuessMap(headers, rows);
const logical = applyMap(rows, map);

// the local result, assembled the way the frontend's `view` does
function localResult(params, mode, filters, rowsOverride, overrides) {
  const baseRows = rowsOverride || logical;
  const ds = buildDataset(applyOverrides(baseRows, overrides || {}), params);
  const active = mode === "raw" ? ds.raw : ds.clean;
  const filtered = applyFilters(active, filters, params);
  const a = analyse(filtered, params);
  const rep = reportMetrics(filtered, params, params.report || defaultReportConfig(), { issues: ds.issues });
  return {
    efficiency: a.efficiency.score,
    official: efficiency(filtered, DEFAULT_FAILURE_REASONS).score,
    streaks: a.streaks.map((s) => `${s.start}..${s.end}:${s.count}:${round(s.hours)}`),
    insights: a.insights,
    flaggedCount: ds.flaggedCount,
    total: ds.total,
    cleanCount: ds.cleanCount,
    records: filtered.length,
    report: rep,
  };
}

async function backendResult(params, mode, filters, rowsOverride, overrides) {
  const res = await fetch(`${BACKEND}/analyze/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, mode, filters, rows: rowsOverride, overrides }),
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);
  const b = await res.json();
  return {
    efficiency: b.efficiency.score,
    official: b.officialEfficiency.score,
    streaks: b.streaks.map((s) => `${s.start}..${s.end}:${s.count}:${round(s.hours)}`),
    insights: b.insights,
    flaggedCount: b.dataQuality.flaggedCount,
    total: b.dataQuality.total,
    cleanCount: b.dataQuality.cleanCount,
    records: b.records.length,
    report: b.report,
  };
}

const round = (n) => (n == null ? null : Math.round(n * 100) / 100);
let failures = 0;

// compact signature of the report metrics so we can compare local vs backend
function reportSig(rep) {
  if (!rep) return "null";
  return JSON.stringify({
    range: rep.dateRange,
    weeks: rep.byWeek.map((w) => `${w.startKey}:${round(w.downtime)}:${round(w.total)}:${round(w.score)}`),
    slots: rep.shiftSlots.map((s) => `${s.key}:${s.count}:${round(s.hours)}:${round(s.avg)}:${round(s.median)}`),
    contrib: rep.reasonContribution.map((c) => `${c.reason}:${round(c.hours)}:${round(c.pct)}`),
    peak: rep.peakDowntimeDay && `${rep.peakDowntimeDay.dateKey}:${round(rep.peakDowntimeDay.hours)}`,
    worst: rep.worstEfficiencyDay && `${rep.worstEfficiencyDay.dateKey}:${round(rep.worstEfficiencyDay.score)}`,
    target: rep.target,
    score: round(rep.score),
    gap: round(rep.targetGap),
    sev: rep.severity.dataQuality,
  });
}

function near(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.05;
}

function compare(label, l, b) {
  const checks = [
    ["efficiency", near(l.efficiency, b.efficiency)],
    ["official", near(l.official, b.official)],
    ["flaggedCount", l.flaggedCount === b.flaggedCount],
    ["total", l.total === b.total],
    ["cleanCount", l.cleanCount === b.cleanCount],
    ["records", l.records === b.records],
    ["streaks", JSON.stringify(l.streaks) === JSON.stringify(b.streaks)],
    ["insights", JSON.stringify(l.insights) === JSON.stringify(b.insights)],
    ["report", reportSig(l.report) === reportSig(b.report)],
  ];
  console.log(`\n## ${label}`);
  console.log(`   local  eff=${round(l.efficiency)} official=${round(l.official)} streaks=${l.streaks.join(",") || "none"} flagged=${l.flaggedCount} records=${l.records}`);
  console.log(`   backend eff=${round(b.efficiency)} official=${round(b.official)} streaks=${b.streaks.join(",") || "none"} flagged=${b.flaggedCount} records=${b.records}`);
  for (const [name, ok] of checks) {
    if (!ok) failures++;
    console.log(`   ${ok ? "ok  " : "FAIL"} ${name}`);
  }
}

const cases = [
  { label: "Default · clean", params: defaultParams(), mode: "clean", filters: defaultFilters() },
  { label: "Default · raw", params: defaultParams(), mode: "raw", filters: defaultFilters() },
  {
    label: "Non-default · clean (failure += Machine Jam, maxGap=1)",
    params: {
      ...defaultParams(),
      failureReasons: ["Breakdown", "Unknown Failure", "Machine Jam"],
      streak: { minStreakDays: 2, maxGapDays: 1, method: "consecutive" },
    },
    mode: "clean",
    filters: defaultFilters(),
  },
  {
    label: "Non-default · clean + filter (downtime only)",
    params: defaultParams(),
    mode: "clean",
    filters: { ...defaultFilters(), kind: "downtime" },
  },
  {
    label: "Streak method · time-window (12h)",
    params: { ...defaultParams(), streak: { method: "window", windowHours: 12, minStreakShifts: 2 } },
    mode: "clean",
    filters: defaultFilters(),
  },
  {
    label: "Streak method · consecutive shifts",
    params: { ...defaultParams(), streak: { method: "shift", minStreakShifts: 2 } },
    mode: "clean",
    filters: defaultFilters(),
  },
  {
    label: "Non-default report config (windows/target/bands)",
    params: {
      ...defaultParams(),
      report: {
        shiftWindows: [
          { key: "morning", label: "Morning", start: 5, end: 13 },
          { key: "afternoon", label: "Afternoon", start: 13, end: 21 },
          { key: "night", label: "Night", start: 21, end: 5 },
        ],
        target: 80,
        severityBands: { medium: 4, high: 9 },
      },
    },
    mode: "clean",
    filters: defaultFilters(),
  },
];

for (const c of cases) {
  const l = localResult(c.params, c.mode, c.filters);
  const b = await backendResult(c.params, c.mode, c.filters);
  compare(c.label, l, b);
}

// uploaded-data parity: the frontend sends its rows; backend must analyse THOSE
const uploadedRows = [
  { date: "10/1/2025", start: "2025-10-01T08:00:00Z", end: "2025-10-01T10:00:00Z", hours: "2", reason: "Setup" },
  { date: "10/1/2025", start: "2025-10-01T11:00:00Z", end: "2025-10-01T13:00:00Z", hours: "2", reason: "Breakdown" },
  { date: "10/2/2025", start: "2025-10-02T08:00:00Z", end: "2025-10-02T09:00:00Z", hours: "1", reason: "Cleaning" },
];
{
  const l = localResult(defaultParams(), "clean", defaultFilters(), uploadedRows);
  const b = await backendResult(defaultParams(), "clean", defaultFilters(), uploadedRows);
  compare("Uploaded data · clean (rows sent to backend)", l, b);
}

// manual corrections present: a field override + an exclude (rows + overrides sent)
{
  const overrides = { 45: { fields: { reason: "Maintenance" } }, 0: { excluded: true } };
  const l = localResult(defaultParams(), "clean", defaultFilters(), logical, overrides);
  const b = await backendResult(defaultParams(), "clean", defaultFilters(), logical, overrides);
  compare("Overrides present · clean (field override + exclude)", l, b);
}

console.log(`\n${failures === 0 ? "PARITY OK — local and backend agree on every case" : failures + " parity check(s) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
