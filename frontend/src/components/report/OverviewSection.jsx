// Overview section of the manager report: colour-coded KPI tiles, the
// data-quality severity bar, an all-activities "hours by reason" chart, a
// downtime-over-time line, the productive split, a day-of-week pattern, and a
// week-over-week comparison. Everything reads R1 metrics (view.report) and the
// filtered records, so it adapts to any date range / dataset.
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import SeverityBar from "./SeverityBar.jsx";
import { reasonColorMap, CHART_COLORS } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";
import { downtimeByWeekday, hoursByReasonSorted } from "../../lib/analysis.js";
import { num, pct, hrs, shortDate } from "../../lib/format.js";
import { RULE_TEXT } from "../../lib/ruleText.js";
import InfoTip from "../InfoTip.jsx";

function usable(r) {
  return r.hours != null && r.hours >= 0 ? r.hours : 0;
}
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// plain-language hours: "143.5 hrs" (not the compact "143.5 h" used on charts)
const hoursVal = (n) => (n == null || isNaN(n) ? "—" : `${num(n)} hrs`);

function Tile({ label, value, note, tone, tip }) {
  return (
    <div className={`kpi tile-${tone || "neutral"}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">
        {label}
        {tip && <InfoTip text={tip} label={`About: ${label}`} />}
      </div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

export default function OverviewSection({ dash }) {
  const { view, params } = dash;
  const rep = view.report;
  const records = view.filtered;

  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(view.cleanRecords)), [view.cleanRecords]);

  // overall duration stats (from the filtered records)
  const durations = records.map(usable).filter((h) => h > 0);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const med = median(durations);

  const officialScore = view.officialEfficiency.score;
  const officialGap = officialScore == null ? null : officialScore - rep.target;
  const effTone = officialGap == null ? "neutral" : officialGap >= 0 ? "good" : officialGap >= -5 ? "warn" : "bad";

  const totalHours = view.efficiency.total;
  const downtimePctOfTotal = totalHours > 0 ? (rep.downtimeTotal / totalHours) * 100 : 0;
  const flagTone = view.errorRate > 15 ? "bad" : view.errorRate > 5 ? "warn" : "good";

  // productive vs non-productive split, straight from the pinned official score
  const off = view.officialEfficiency; // { score, productive, total }
  const productive = off.productive || 0;
  const nonProductive = off.total != null ? Math.max(0, off.total - productive) : 0;

  // daily downtime (failure hours per day) — computed from the same records
  const dayMap = {};
  for (const r of records) {
    if (r.dateKey && params.failureReasons.includes(r.reason)) {
      dayMap[r.dateKey] = (dayMap[r.dateKey] || 0) + usable(r);
    }
  }
  const dayKeys = Object.keys(dayMap).sort();
  const dayValues = dayKeys.map((k) => Number(dayMap[k].toFixed(2)));
  // worst day + daily average, to mark/annotate the downtime-over-time line (live)
  const worstIdx = dayValues.length ? dayValues.indexOf(Math.max(...dayValues)) : -1;
  const dailyAvg = dayValues.length ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length : 0;

  // day-of-week pattern (folded in from the former Trends view)
  const wk = useMemo(() => downtimeByWeekday(records, params.failureReasons), [records, params.failureReasons]);
  const weeks = rep.dateRange.days ? Math.max(1, Math.round(rep.dateRange.days / 7)) : null;

  // total logged hours for EVERY reason (all activities), sorted high→low
  const allReasons = useMemo(() => hoursByReasonSorted(records), [records]);
  const hoursByReasonConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: allReasons.map((r) => r.reason),
        datasets: [
          {
            label: "Hours",
            data: allReasons.map((r) => Number(r.hours.toFixed(2))),
            backgroundColor: allReasons.map((r) => reasonColors[r.reason] || "#94a3b8"),
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${hrs(ctx.parsed.x)} (${pct(allReasons[ctx.dataIndex].pct)} of hours)` } },
        },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Hours" } } },
      },
    }),
    [allReasons, reasonColors]
  );

  // downtime over time — a daily line, the worst day marked with a larger/darker
  // point, and a dashed daily-average reference line
  const dailyConfig = useMemo(
    () => ({
      type: "line",
      data: {
        labels: dayKeys.map((k) => shortDate(k)),
        datasets: [
          {
            label: "Time lost (hours)",
            data: dayValues,
            borderColor: CHART_COLORS.downtime,
            backgroundColor: "rgba(220,38,38,0.12)",
            tension: 0.3,
            fill: true,
            pointRadius: dayValues.map((_, i) => (i === worstIdx ? 5 : 2)),
            pointBackgroundColor: dayValues.map((_, i) => (i === worstIdx ? CHART_COLORS.downtimeWorst : CHART_COLORS.downtime)),
            pointBorderColor: dayValues.map((_, i) => (i === worstIdx ? CHART_COLORS.downtimeWorst : CHART_COLORS.downtime)),
            order: 2,
          },
          {
            label: `Typical day ${num(dailyAvg)} h`,
            data: dayValues.map(() => Number(dailyAvg.toFixed(2))),
            borderColor: CHART_COLORS.reference,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12 } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Hours lost" } } },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dayValues), worstIdx, dailyAvg]
  );

  // average downtime by day of week (folded in from Trends)
  const weekdayConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: wk.weekdays.map((w) => w.weekday),
        datasets: [
          {
            label: "Hours lost per day (avg)",
            data: wk.weekdays.map((w) => (w.avgDowntime == null ? 0 : Number(w.avgDowntime.toFixed(2)))),
            backgroundColor: wk.weekdays.map((w) => (wk.worst && w.index === wk.worst.index ? CHART_COLORS.downtimeWorst : CHART_COLORS.downtime)),
            order: 2,
          },
          {
            type: "line",
            label: `Overall avg ${num(wk.overallAvg)} h/day`,
            data: wk.weekdays.map(() => (wk.overallAvg == null ? 0 : Number(wk.overallAvg.toFixed(2)))),
            borderColor: CHART_COLORS.reference,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12 } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Hours lost per day" } } },
      },
    }),
    [wk]
  );

  // Productive vs Non-productive (tied to the efficiency score). Semantic colours
  // (green/red), not categories, so no reasonColorMap here.
  const prodDonutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Working time", "Lost time"],
        datasets: [{ data: [Number(productive.toFixed(2)), Number(nonProductive.toFixed(2))], backgroundColor: ["#16a34a", "#dc2626"] }],
      },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } },
    }),
    [productive, nonProductive]
  );

  const wow = rep.wow;

  return (
    <section className="card report-section">
      <div className="report-head">
        <h2>Overview</h2>
        <span className="muted">
          {rep.dateRange.min ? `${shortDate(rep.dateRange.min)} – ${shortDate(rep.dateRange.max)} · ${rep.dateRange.days} days` : "No data"}
        </span>
      </div>
      <p className="section-subtitle">How the operation did over this period.</p>

      <div className="kpi-row">
        <Tile
          label="Efficiency"
          value={pct(officialScore)}
          note={officialGap == null ? `Goal ${num(rep.target, 0)}%` : `${num(Math.abs(officialGap))} ${officialGap >= 0 ? "over" : "under"} the ${num(rep.target, 0)}% goal`}
          tone={effTone}
          tip={`Official Operational Efficiency = productive hours ÷ total hours × 100 = ${pct(officialScore)}${
            officialGap == null
              ? ""
              : `, which is ${num(Math.abs(officialGap))} percentage point${Math.abs(officialGap) === 1 ? "" : "s"} ${officialGap >= 0 ? "above" : "below"} the ${num(rep.target, 0)}% target`
          }.${view.failureCustomized ? ` (With your custom failure set it would be ${pct(view.efficiency.score)}; the headline stays on the standard set.)` : ""}`}
        />
        <Tile
          label="Total time tracked"
          value={hoursVal(totalHours)}
          note={`${records.length} shifts`}
          tip={`The sum of all usable shift hours in the selected range, across ${records.length} shifts — ${hoursVal(totalHours)}.`}
        />
        <Tile
          label="Time lost to failures"
          value={hoursVal(rep.downtimeTotal)}
          note={`${pct(downtimePctOfTotal)} of all time`}
          tone={downtimePctOfTotal > 25 ? "warn" : "neutral"}
          tip={`Hours in the failure categories (${params.failureReasons.join(", ")}) — ${hoursVal(rep.downtimeTotal)}, ${pct(downtimePctOfTotal)} of the ${hoursVal(totalHours)} tracked.`}
        />
        <Tile
          label="Average shift length"
          value={hoursVal(avg)}
          note="per shift"
          tip={`Mean shift length is ${hoursVal(avg)}; the median (middle) shift is ${hoursVal(med)}.`}
        />
        <Tile
          label="Data issues found"
          value={num(view.flaggedCount, 0)}
          note={view.flaggedCount > 0 ? `about 1 in ${Math.max(2, Math.round(view.total / view.flaggedCount))} records` : "none found"}
          tone={flagTone}
          tip={`${num(view.flaggedCount, 0)} of ${view.total} records had a data issue (${pct(view.errorRate)}) — each was found and fixed automatically before any number here was worked out. See the Data quality check for the breakdown.`}
        />
      </div>

      <h4>
        Data issues by severity <InfoTip text={RULE_TEXT.severityTiers} label="How issues map to severity tiers" />
      </h4>
      <SeverityBar severity={rep.severity.dataQuality} />

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Hours by reason (all activities)</h4>
          {allReasons.length ? (
            <ChartCanvas config={hoursByReasonConfig} height={300} downloadName="hours-by-reason" label="Total logged hours by activity reason — all reasons, ranked high to low" />
          ) : (
            <p className="muted">No data in range.</p>
          )}
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Time lost to failures, over time</h4>
          {dayKeys.length ? (
            <>
              <ChartCanvas config={dailyConfig} height={240} downloadName="time-lost-over-time" label="Time lost to failures each day, with the worst day marked and a typical-day line" />
              <p className="muted chart-note">
                Worst day: <strong>{shortDate(dayKeys[worstIdx])}</strong> ({hrs(dayValues[worstIdx])} lost) · typical day {hrs(dailyAvg)}
              </p>
            </>
          ) : (
            <p className="muted">No time lost in this range.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Working time vs lost time</h4>
          {off.total ? (
            <>
              <ChartCanvas config={prodDonutConfig} height={240} downloadName="working-vs-lost-time" label="Working time versus time lost to failures" />
              <p className="muted chart-note">
                {hrs(productive)} working · {hrs(nonProductive)} lost ({pct(officialScore)} efficient)
              </p>
            </>
          ) : (
            <p className="muted">No hours in range.</p>
          )}
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Which weekday is worst</h4>
          {wk.worst ? (
            <>
              <ChartCanvas config={weekdayConfig} height={240} downloadName="worst-weekday" label="Hours lost per day for each weekday, worst day highlighted, with an overall-average line" />
              <p className="muted chart-note">
                {wk.worst.weekday} loses the most time — about {hrs(wk.worst.avgDowntime)} per day. Based on ~{weeks} week
                {weeks === 1 ? "" : "s"} of data, so treat it as a rough pattern, not proof.
              </p>
            </>
          ) : (
            <p className="muted">Not enough dated records to show a weekday pattern.</p>
          )}
        </div>
      </div>

      <h4 style={{ marginTop: "1rem" }}>This week vs last week</h4>
      {wow ? (
        <p>
          Latest week: <strong>{hrs(wow.last.downtime)}</strong> lost to failures —{" "}
          <span className={wow.downtimeDelta <= 0 ? "good-text" : "bad-text"}>
            {wow.downtimeDelta <= 0 ? "▼" : "▲"} {hrs(Math.abs(wow.downtimeDelta))}
            {wow.downtimePctChange == null ? "" : ` (${num(Math.abs(wow.downtimePctChange))}%)`}
          </span>{" "}
          vs the week before.
        </p>
      ) : (
        <p className="muted">Not enough weeks in range to compare.</p>
      )}
    </section>
  );
}
