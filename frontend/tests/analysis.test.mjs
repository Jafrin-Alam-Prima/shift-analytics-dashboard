import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { efficiency, findStreaks, buildInsights, analyse, decisionCards, downtimeByWeekday, downtimeByDate } from "../src/lib/analysis.js";
import { reportMetrics } from "../src/lib/report.js";
import { defaultParams } from "../src/lib/config.js";

function loadClean() {
  const { headers, rows } = parseCsvText(readDataCsv());
  const { map } = autoGuessMap(headers, rows);
  return buildDataset(applyMap(rows, map));
}

export function run() {
  const ds = loadClean();
  const p = defaultParams();

  // ---- pinned numbers on defaults ----
  const eff = efficiency(ds.clean, p.failureReasons);
  check("clean efficiency ≈ 85.9%", Math.abs(eff.score - 85.9) < 0.5, `(got ${eff.score.toFixed(2)})`);

  const rawEff = efficiency(ds.raw, p.failureReasons);
  check("raw efficiency ≈ 75.7%", Math.abs(rawEff.score - 75.7) < 0.5, `(got ${rawEff.score.toFixed(2)})`);

  const streaks = findStreaks(ds.clean, p.failureReasons, p.streak);
  check("exactly one streak", streaks.length === 1, `(got ${streaks.length})`);
  check("streak is Oct 8–9", streaks[0]?.start === "2025-10-08" && streaks[0]?.end === "2025-10-09",
    `(got ${streaks[0]?.start}..${streaks[0]?.end})`);
  check("streak length 2 days", streaks[0]?.lengthDays === 2, `(got ${streaks[0]?.lengthDays})`);

  check("flagged ≈ 10/51", ds.flaggedCount === 10 && ds.total === 51, `(got ${ds.flaggedCount}/${ds.total})`);

  const insights = buildInsights(ds.clean, p.failureReasons, p.groups, streaks);
  check("at least 3 insights", insights.length >= 3, `(got ${insights.length})`);
  check("insights are action-phrased (mention a fix/lever/cause)",
    insights.some((s) => /prioritise|investigate|root cause|lever/i.test(s)));

  // ---- edge cases ----

  // total = 0 -> no divide-by-zero, score is null
  const empty = efficiency([], p.failureReasons);
  check("empty set: score is null (no crash)", empty.score === null);

  // no breakdowns at all -> no streak
  const noFail = findStreaks(ds.clean, [], p.streak);
  check("no failure reasons: no streak", noFail.length === 0, `(got ${noFail.length})`);

  // single-day breakdown -> not long enough to be a streak
  const oneDay = findStreaks(
    [{ dateKey: "2025-10-08", reason: "Breakdown", hours: 3 }],
    ["Breakdown"],
    { minStreakDays: 2, maxGapDays: 0 }
  );
  check("single-day breakdown: no streak", oneDay.length === 0, `(got ${oneDay.length})`);

  // two consecutive days -> a streak
  const twoDay = findStreaks(
    [
      { dateKey: "2025-10-08", reason: "Breakdown", hours: 3 },
      { dateKey: "2025-10-09", reason: "Breakdown", hours: 2 },
    ],
    ["Breakdown"],
    { minStreakDays: 2, maxGapDays: 0 }
  );
  check("two consecutive days: one streak", twoDay.length === 1 && twoDay[0].count === 2);

  // toggling Machine Jam / Unknown Failure into the failure set changes the score
  const withJam = efficiency(ds.clean, ["Breakdown", "Unknown Failure", "Machine Jam"]);
  check("adding Machine Jam lowers efficiency", withJam.score < eff.score,
    `(${withJam.score.toFixed(2)} vs ${eff.score.toFixed(2)})`);

  const onlyUnknown = efficiency(ds.clean, ["Unknown Failure"]);
  check("removing Breakdown from failure set raises efficiency", onlyUnknown.score > eff.score,
    `(${onlyUnknown.score.toFixed(2)} vs ${eff.score.toFixed(2)})`);

  // analyse() ties it together
  const all = analyse(ds.clean, p);
  check("analyse() returns efficiency + streaks + insights",
    all.efficiency.score != null && all.streaks.length === 1 && all.insights.length >= 3);

  // ---- decision cards (rich Insights view; reads existing outputs) ----
  const rep = reportMetrics(ds.clean, p, p.report, { issues: ds.issues });
  const off = efficiency(ds.clean, p.failureReasons);
  const cards = decisionCards({
    records: ds.clean,
    rawRecords: ds.raw,
    report: rep,
    streaks,
    officialEfficiency: off,
    target: rep.target,
    dataQuality: { total: ds.total, flaggedCount: ds.flaggedCount, errorRate: ds.errorRate },
    severityBands: p.report.severityBands,
  });
  check("decisionCards: 3–5 cards on the sample", cards.length >= 3 && cards.length <= 5, `(got ${cards.length})`);
  check("decisionCards: each has finding + evidence + → action",
    cards.every((c) => c.title && c.evidence && typeof c.action === "string" && c.action.startsWith("→")));
  check("decisionCards: cites the configured target, never a hardcoded 85",
    cards.some((c) => c.evidence.includes(`${rep.target}%`)) && !cards.some((c) => /\b85%\b/.test(c.evidence + c.action)));
  // guard against invented hardware refs (machine IDs / "the 2 machines") while
  // still allowing real reason labels like "Machine Jam"
  check("decisionCards: no invented machine references",
    !cards.some((c) => /machine\s*ids?\b|\b(\d+|two|three|the|both)\s+machines\b/i.test(c.evidence + c.action)));
  check("decisionCards: causal claims phrased as hypotheses (suggests/investigat…)",
    cards.some((c) => /suggests|investigat|worth a closer look|confirm/i.test(c.action)));
  check("decisionCards: empty data yields no cards (no crash)", decisionCards({}).length === 0);

  // ---- day-of-week trend aggregation (display-side, changes no metric) ----
  const wk = downtimeByWeekday(ds.clean, p.failureReasons);
  check("downtimeByWeekday: 7 weekdays Mon–Sun",
    wk.weekdays.length === 7 && wk.weekdays[0].weekday === "Mon" && wk.weekdays[6].weekday === "Sun");
  check("downtimeByWeekday: overall average is positive", wk.overallAvg != null && wk.overallAvg > 0);
  check("downtimeByWeekday: each weekday averages over its real occurrence count",
    wk.weekdays.every((w) => w.avgDowntime == null || Math.abs(w.avgDowntime - w.totalDowntime / w.days) < 1e-9));
  check("downtimeByWeekday: worst is the max-average weekday",
    wk.worst && wk.weekdays.every((w) => w.avgDowntime == null || w.avgDowntime <= wk.worst.avgDowntime));
  check("downtimeByWeekday: empty records -> no worst (no crash)",
    downtimeByWeekday([], p.failureReasons).worst === null);

  // ---- per-date downtime (streak calendar input) ----
  const byDate = downtimeByDate(ds.clean, p.failureReasons);
  check("downtimeByDate: Oct 8 carries failure hours + incident count",
    byDate["2025-10-08"] && byDate["2025-10-08"].hours > 0 && byDate["2025-10-08"].count >= 1);
  check("downtimeByDate: only failure-reason hours are counted",
    Object.values(byDate).every((v) => v.hours >= 0 && v.count >= 1));
  check("downtimeByDate: empty records -> empty map (no crash)",
    Object.keys(downtimeByDate([], p.failureReasons)).length === 0);

  // ---- selectable streak methods (S3.1) ----
  const consec = findStreaks(ds.clean, p.failureReasons, { method: "consecutive", minStreakDays: 2, maxGapDays: 0 });
  check("consecutive method = default (Oct 8–9)", consec.length === 1 && consec[0].start === "2025-10-08");

  const win = findStreaks(ds.clean, p.failureReasons, { method: "window", windowHours: 12, minStreakShifts: 2 });
  check("window method runs and returns a list", Array.isArray(win));

  const shift = findStreaks(ds.clean, p.failureReasons, { method: "shift", minStreakShifts: 2 });
  check("shift method runs and returns a list", Array.isArray(shift));

  // shift-based: two failure shifts back-to-back in time with nothing between
  const seq = [
    { dateKey: "2025-10-08", reason: "Breakdown", hours: 2, start: new Date("2025-10-08T08:00:00Z") },
    { dateKey: "2025-10-08", reason: "Breakdown", hours: 2, start: new Date("2025-10-08T11:00:00Z") },
    { dateKey: "2025-10-08", reason: "Cleaning", hours: 2, start: new Date("2025-10-08T14:00:00Z") },
  ];
  const ss = findStreaks(seq, ["Breakdown"], { method: "shift", minStreakShifts: 2 });
  check("shift method: 2 back-to-back failures = 1 streak", ss.length === 1 && ss[0].count === 2);
}
