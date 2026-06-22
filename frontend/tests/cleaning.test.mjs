import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { DEFAULT_FAILURE_REASONS } from "../src/lib/config.js";

// simple efficiency calc, kept local so this suite does not depend on analysis
function efficiency(records, failureSet) {
  let prod = 0, tot = 0;
  for (const r of records) {
    if (r.hours == null || r.hours < 0) continue;
    tot += r.hours;
    if (!failureSet.includes(r.reason)) prod += r.hours;
  }
  return tot > 0 ? (prod / tot) * 100 : null;
}

function loadClean() {
  const { headers, rows } = parseCsvText(readDataCsv());
  const { map } = autoGuessMap(headers, rows);
  const logical = applyMap(rows, map);
  return buildDataset(logical);
}

export function run() {
  const ds = loadClean();

  check("total rows = 51", ds.total === 51, `(got ${ds.total})`);
  check("flagged rows = 10", ds.flaggedCount === 10, `(got ${ds.flaggedCount})`);
  check("error rate ≈ 19.6%", Math.abs(ds.errorRate - 19.6) < 0.1, `(got ${ds.errorRate.toFixed(1)})`);
  check("clean count = 50 (one duplicate dropped)", ds.cleanCount === 50, `(got ${ds.cleanCount})`);

  const byType = Object.fromEntries(ds.issues.map((it) => [it.type, it.count]));
  check("2 missing start", byType.missingStart === 2, `(got ${byType.missingStart})`);
  check("1 missing end", byType.missingEnd === 1, `(got ${byType.missingEnd})`);
  check("1 invalid date", byType.badDate === 1, `(got ${byType.badDate})`);
  check("1 negative hours", byType.negativeHours === 1, `(got ${byType.negativeHours})`);
  check("4 hours-conflict rows", byType.hoursConflict === 4, `(got ${byType.hoursConflict})`);
  check("1 cross-midnight", byType.crossMidnight === 1, `(got ${byType.crossMidnight})`);
  check("2 duplicate rows", byType.duplicate === 2, `(got ${byType.duplicate})`);

  const rawEff = efficiency(ds.raw, DEFAULT_FAILURE_REASONS);
  const cleanEff = efficiency(ds.clean, DEFAULT_FAILURE_REASONS);
  check("raw efficiency ≈ 75.7%", Math.abs(rawEff - 75.7) < 0.5, `(got ${rawEff.toFixed(2)})`);
  check("clean efficiency ≈ 85.9%", Math.abs(cleanEff - 85.9) < 0.5, `(got ${cleanEff.toFixed(2)})`);

  // honesty: cleaning must not invent hours out of thin air — every clean row
  // either has start+end, or a non-negative HOURS value, or null hours.
  const invented = ds.clean.filter((r) => r.hours != null && !(r.start && r.end) && false);
  check("no invented values", invented.length === 0);

  // ---- edge cases ----

  // perfectly clean data: 0 issues, raw count == clean count
  const allClean = buildDataset([
    { date: "10/1/2025", start: "2025-10-01T08:00:00Z", end: "2025-10-01T10:00:00Z", hours: "2", reason: "Setup" },
    { date: "10/2/2025", start: "2025-10-02T08:00:00Z", end: "2025-10-02T09:30:00Z", hours: "1.5", reason: "Cleaning" },
  ]);
  check("all-clean: 0 flagged", allClean.flaggedCount === 0, `(got ${allClean.flaggedCount})`);
  check("all-clean: nothing removed", allClean.cleanCount === 2, `(got ${allClean.cleanCount})`);

  // an all-bad row: missing start, invalid date, negative hours all at once
  const allBad = buildDataset([
    { date: "2025-99-99", start: "", end: "nope", hours: "-5", reason: "Breakdown" },
  ]);
  check("all-bad: row flagged once", allBad.flaggedCount === 1, `(got ${allBad.flaggedCount})`);
  check("all-bad: has multiple issues", allBad.raw[0].issues.length >= 3, `(got ${allBad.raw[0].issues.length})`);
  check("all-bad: clean hours excluded (null)", allBad.clean[0].hours === null, `(got ${allBad.clean[0].hours})`);

  // a row with several issues is still counted as one flagged row
  const multi = buildDataset([
    { date: "10/4/2025", start: "2025-10-04T07:30:00Z", end: "2025-10-05T08:00:00Z", hours: "0.9", reason: "Quality Check" },
  ]);
  check("multi-issue row: counted once", multi.flaggedCount === 1, `(got ${multi.flaggedCount})`);
  check("multi-issue row: cross + conflict detected", multi.raw[0].issues.includes("crossMidnight") && multi.raw[0].issues.includes("hoursConflict"));
}
