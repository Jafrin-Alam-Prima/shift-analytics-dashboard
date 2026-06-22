// Overview section of the manager report: colour-coded KPI tiles, the
// data-quality severity bar, a downtime-by-reason donut + daily-downtime bar, and
// a week-over-week comparison. Everything reads R1 metrics (view.report) and the
// filtered records, so it adapts to any date range / dataset.
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import SeverityBar from "./SeverityBar.jsx";
import { reasonColorMap, CHART_COLORS } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";
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

function Tile({ label, value, note, tone }) {
  return (
    <div className={`kpi tile-${tone || "neutral"}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
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
  // worst day + daily average, to mark/annotate the daily-downtime bar (live)
  const worstIdx = dayValues.length ? dayValues.indexOf(Math.max(...dayValues)) : -1;
  const dailyAvg = dayValues.length ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length : 0;

  const donutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: rep.reasonContribution.map((c) => c.reason),
        datasets: [
          {
            data: rep.reasonContribution.map((c) => Number(c.hours.toFixed(2))),
            backgroundColor: rep.reasonContribution.map((c) => reasonColors[c.reason] || "#94a3b8"),
          },
        ],
      },
      // legend beneath the donut so it sits close, not across a wide right-hand gap
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } },
    }),
    [rep.reasonContribution, reasonColors]
  );

  const dailyConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: dayKeys.map((k) => shortDate(k)),
        datasets: [
          {
            label: "Downtime h",
            data: dayValues,
            // the worst day is marked with a darker bar
            backgroundColor: dayValues.map((_, i) => (i === worstIdx ? CHART_COLORS.downtimeWorst : CHART_COLORS.downtime)),
            order: 2,
          },
          {
            type: "line",
            label: `Daily avg ${num(dailyAvg)} h`,
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
        scales: { y: { beginAtZero: true, title: { display: true, text: "Downtime h" } } },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dayValues), worstIdx, dailyAvg]
  );

  // Productive vs Non-productive (tied to the efficiency score). Semantic colours
  // (green/red), not categories, so no reasonColorMap here.
  const prodDonutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Productive", "Non-productive"],
        datasets: [{ data: [Number(productive.toFixed(2)), Number(nonProductive.toFixed(2))], backgroundColor: ["#16a34a", "#dc2626"] }],
      },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } },
    }),
    [productive, nonProductive]
  );

  // Top reasons by downtime hours (Pareto-style, already sorted high→low),
  // coloured via reasonColorMap so any reason — new ones included — gets a colour.
  const paretoConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: rep.reasonContribution.map((c) => c.reason),
        datasets: [{ label: "Downtime h", data: rep.reasonContribution.map((c) => Number(c.hours.toFixed(2))), backgroundColor: rep.reasonContribution.map((c) => reasonColors[c.reason] || "#94a3b8") }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${hrs(ctx.parsed.x)} (${pct(rep.reasonContribution[ctx.dataIndex].pct)})` } } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Downtime h" } } },
      },
    }),
    [rep.reasonContribution, reasonColors]
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

      <div className="kpi-row">
        <Tile
          label="Official efficiency"
          value={pct(officialScore)}
          note={`Target ${num(rep.target, 0)}% · ${officialGap == null ? "—" : (officialGap >= 0 ? "+" : "") + num(officialGap)} pts${view.failureCustomized ? ` · custom ${pct(view.efficiency.score)}` : ""}`}
          tone={effTone}
        />
        <Tile label="Total hours" value={hrs(totalHours)} note={`${records.length} shifts`} />
        <Tile label="Downtime" value={hrs(rep.downtimeTotal)} note={`${pct(downtimePctOfTotal)} of hours`} tone={downtimePctOfTotal > 25 ? "warn" : "neutral"} />
        <Tile label="Avg shift" value={hrs(avg)} note={`median ${hrs(med)}`} />
        <Tile label="Flagged rows" value={num(view.flaggedCount, 0)} note={`error ${pct(view.errorRate)}`} tone={flagTone} />
      </div>

      <h4>
        Data-quality severity <InfoTip text={RULE_TEXT.severityTiers} label="How issues map to severity tiers" />
      </h4>
      <SeverityBar severity={rep.severity.dataQuality} />

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Downtime by reason</h4>
          {rep.reasonContribution.length ? (
            <ChartCanvas config={donutConfig} height={240} downloadName="downtime-by-reason" label="Downtime by reason" />
          ) : (
            <p className="muted">No downtime in range.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Daily downtime</h4>
          {dayKeys.length ? (
            <>
              <ChartCanvas config={dailyConfig} height={240} downloadName="daily-downtime" label="Daily downtime with daily-average line" />
              <p className="muted chart-note">
                Worst day: <strong>{shortDate(dayKeys[worstIdx])}</strong> ({hrs(dayValues[worstIdx])}) · daily avg {hrs(dailyAvg)}
              </p>
            </>
          ) : (
            <p className="muted">No downtime in range.</p>
          )}
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Productive vs non-productive</h4>
          {off.total ? (
            <>
              <ChartCanvas config={prodDonutConfig} height={240} downloadName="productive-vs-nonproductive" label="Productive versus non-productive hours" />
              <p className="muted chart-note">
                {hrs(productive)} productive · {hrs(nonProductive)} non-productive ({pct(officialScore)} efficient)
              </p>
            </>
          ) : (
            <p className="muted">No hours in range.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Top reasons by downtime hours</h4>
          {rep.reasonContribution.length ? (
            <ChartCanvas config={paretoConfig} height={240} downloadName="top-reasons" label="Top downtime reasons ranked by hours" />
          ) : (
            <p className="muted">No downtime in range.</p>
          )}
        </div>
      </div>

      <h4 style={{ marginTop: "1rem" }}>Week over week</h4>
      {wow ? (
        <p>
          Latest week: <strong>{hrs(wow.last.downtime)}</strong> downtime —{" "}
          <span className={wow.downtimeDelta <= 0 ? "good-text" : "bad-text"}>
            {wow.downtimeDelta <= 0 ? "▼" : "▲"} {hrs(Math.abs(wow.downtimeDelta))}
            {wow.downtimePctChange == null ? "" : ` (${num(Math.abs(wow.downtimePctChange))}%)`}
          </span>{" "}
          vs the prior week.
        </p>
      ) : (
        <p className="muted">Not enough weeks in range to compare.</p>
      )}
    </section>
  );
}
