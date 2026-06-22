// Overview section of the manager report: colour-coded KPI tiles, the
// data-quality severity bar, a downtime-by-reason donut + daily-downtime bar, and
// a week-over-week comparison. Everything reads R1 metrics (view.report) and the
// filtered records, so it adapts to any date range / dataset.
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import SeverityBar from "./SeverityBar.jsx";
import { reasonColorMap } from "../../lib/colors.js";
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

  // daily downtime (failure hours per day) — computed from the same records
  const dayMap = {};
  for (const r of records) {
    if (r.dateKey && params.failureReasons.includes(r.reason)) {
      dayMap[r.dateKey] = (dayMap[r.dateKey] || 0) + usable(r);
    }
  }
  const dayKeys = Object.keys(dayMap).sort();

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
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } },
    }),
    [rep.reasonContribution, reasonColors]
  );

  const dailyConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: dayKeys.map((k) => shortDate(k)),
        datasets: [{ label: "Downtime h", data: dayKeys.map((k) => Number(dayMap[k].toFixed(2))), backgroundColor: "#dc2626" }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Downtime h" } } },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dayKeys), JSON.stringify(dayMap)]
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
            <ChartCanvas config={dailyConfig} height={240} downloadName="daily-downtime" label="Daily downtime" />
          ) : (
            <p className="muted">No downtime in range.</p>
          )}
        </div>
      </div>

      <h4 style={{ marginTop: "1rem" }}>Week over week</h4>
      {wow ? (
        <p>
          Latest week ({shortDate(wow.last.startKey)}–{shortDate(wow.last.endKey)}) had{" "}
          <strong>{hrs(wow.last.downtime)}</strong> downtime vs <strong>{hrs(wow.prev.downtime)}</strong> the week before —{" "}
          <span className={wow.downtimeDelta <= 0 ? "good-text" : "bad-text"}>
            {wow.downtimeDelta <= 0 ? "▼" : "▲"} {hrs(Math.abs(wow.downtimeDelta))}
            {wow.downtimePctChange == null ? "" : ` (${num(Math.abs(wow.downtimePctChange))}%)`}
          </span>
          .
        </p>
      ) : (
        <p className="muted">Not enough weeks in range to compare.</p>
      )}
    </section>
  );
}
