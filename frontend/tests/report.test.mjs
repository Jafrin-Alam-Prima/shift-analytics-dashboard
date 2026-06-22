import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { reportMetrics, slotOf, streakBand } from "../src/lib/report.js";
import { defaultParams, DEFAULT_SHIFT_WINDOWS } from "../src/lib/config.js";

function loadClean() {
  const { headers, rows } = parseCsvText(readDataCsv());
  const { map } = autoGuessMap(headers, rows);
  return buildDataset(applyMap(rows, map));
}

export function run() {
  const ds = loadClean();
  const p = defaultParams();
  const m = reportMetrics(ds.clean, p, p.report, { issues: ds.issues });

  // date range derives from the real data (not hardcoded to October)
  check("date range min = 2025-10-01", m.dateRange.min === "2025-10-01", `(got ${m.dateRange.min})`);
  check("date range max = 2025-10-21", m.dateRange.max === "2025-10-21", `(got ${m.dateRange.max})`);
  check("date range spans 21 days", m.dateRange.days === 21, `(got ${m.dateRange.days})`);

  // weeks bucket from the min date: Oct 1–7, 8–14, 15–21
  check("3 week buckets", m.byWeek.length === 3, `(got ${m.byWeek.length})`);
  check("week 0 starts on min date", m.byWeek[0].startKey === "2025-10-01", `(got ${m.byWeek[0].startKey})`);

  // shift slots: every record with a valid start lands in exactly one slot
  const withStart = ds.clean.filter((r) => r.start).length;
  const slotted = m.shiftSlots.reduce((s, x) => s + x.count, 0);
  check("slotted count = records with a start", slotted === withStart, `(${slotted} vs ${withStart})`);
  check("three shift slots", m.shiftSlots.length === 3);

  // reason contribution to downtime: Breakdown leads on defaults
  check("top downtime reason is Breakdown", m.reasonContribution[0]?.reason === "Breakdown", `(got ${m.reasonContribution[0]?.reason})`);
  check("contribution percentages sum to ~100", Math.abs(m.reasonContribution.reduce((s, x) => s + x.pct, 0) - 100) < 0.01);

  // efficiency + target gap
  check("report score ≈ 85.9", Math.abs(m.score - 85.9) < 0.5, `(got ${m.score})`);
  check("default target = 90", m.target === 90);
  check("target gap ≈ -4.1", Math.abs(m.targetGap - (m.score - 90)) < 0.001);

  // data-quality severity tiers (documented rule)
  const sev = m.severity.dataQuality;
  check("critical tier = 3 (2 missing start + 1 missing end)", sev.critical === 3, `(got ${sev.critical})`);
  check("warning tier = 6 (neg + 4 conflict + bad date)", sev.warning === 6, `(got ${sev.warning})`);
  check("info tier = 1 (cross-midnight)", sev.info === 1, `(got ${sev.info})`);
  check("duplicate tier = 2", sev.duplicate === 2, `(got ${sev.duplicate})`);

  // slot wrap + severity band rules
  check("slotOf(23) = night (wraps)", slotOf(23, DEFAULT_SHIFT_WINDOWS) === "night");
  check("slotOf(2) = night (wraps)", slotOf(2, DEFAULT_SHIFT_WINDOWS) === "night");
  check("slotOf(8) = morning", slotOf(8, DEFAULT_SHIFT_WINDOWS) === "morning");
  check("streakBand(7.4) = medium", streakBand(7.4, p.report.severityBands) === "medium");
  check("streakBand(13) = high", streakBand(13, p.report.severityBands) === "high");
  check("streakBand(3) = low", streakBand(3, p.report.severityBands) === "low");
}
