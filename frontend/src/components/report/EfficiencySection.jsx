// Efficiency section: a gauge (official score) vs the configured target with the
// gap, a productive-vs-downtime donut (from the pinned official split), an
// efficiency-by-week line with a target line, and reason-contribution bars.
// Official efficiency stays pinned; a custom failure set is shown separately.
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import { reasonColorMap } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";
import { pct, hrs, num, shortDate } from "../../lib/format.js";
import { RULE_TEXT } from "../../lib/ruleText.js";
import InfoTip from "../InfoTip.jsx";

export default function EfficiencySection({ dash }) {
  const { view, params } = dash;
  const rep = view.report;
  const off = view.officialEfficiency; // pinned: {score, productive, total}
  const target = rep.target;
  const gap = off.score == null ? null : off.score - target;
  // failure categories that define "non-productive", read from config (dynamic)
  const failureList = params.failureReasons.join(" / ");

  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(view.cleanRecords)), [view.cleanRecords]);

  const nonProductive = off.total != null ? off.total - off.productive : 0;
  const donutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Productive", "Non-productive"],
        datasets: [{ data: [Number(off.productive.toFixed(2)), Number(nonProductive.toFixed(2))], backgroundColor: ["#16a34a", "#dc2626"] }],
      },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } },
    }),
    [off.productive, nonProductive]
  );

  const weekConfig = useMemo(
    () => ({
      type: "line",
      data: {
        labels: rep.byWeek.map((w) => shortDate(w.startKey)),
        datasets: [
          {
            label: "Efficiency %",
            data: rep.byWeek.map((w) => (w.score == null ? null : Number(w.score.toFixed(1)))),
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.15)",
            tension: 0.3,
            spanGaps: true,
            fill: true,
          },
          {
            label: `Target ${num(target, 0)}%`,
            data: rep.byWeek.map(() => target),
            borderColor: "#16a34a",
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
        scales: { y: { min: 0, max: 100, title: { display: true, text: "Efficiency %" } } },
      },
    }),
    [rep.byWeek, target]
  );

  const contribConfig = useMemo(
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
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Downtime h" } } },
      },
    }),
    [rep.reasonContribution, reasonColors]
  );

  const fillPct = off.score == null ? 0 : Math.max(0, Math.min(100, off.score));

  return (
    <section className="card report-section">
      <h2>
        Efficiency <InfoTip text={RULE_TEXT.efficiency} label="How efficiency is calculated" />
      </h2>

      <div className="formula-box">
        <div className="formula-line">Efficiency = (Productive ÷ Total) × 100</div>
        <div className="muted">
          Productive = hours whose reason is <strong>not</strong> {failureList || "a failure"} (from config).
        </div>
        {off.score != null && (
          <div className="muted">
            = ({hrs(off.productive)} ÷ {hrs(off.total)}) × 100 = <strong>{pct(off.score)}</strong>
          </div>
        )}
      </div>

      <div className="eff-gauge">
        <div className="gauge-num">{pct(off.score)}</div>
        <div className="gauge-side">
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: `${fillPct}%` }} />
            <div className="gauge-target" style={{ left: `${Math.min(100, target)}%` }} title={`Target ${num(target, 0)}%`} />
          </div>
          <div className="gauge-labels">
            <span>0%</span>
            <span>Target {num(target, 0)}%</span>
            <span>100%</span>
          </div>
          <div className={gap == null ? "muted" : gap >= 0 ? "good-text" : "bad-text"}>
            {gap == null ? "No data" : `${gap >= 0 ? "+" : ""}${num(gap)} pts vs target`}
          </div>
          {view.failureCustomized && (
            <div className="muted">Official (pinned). Custom failure set: {pct(view.efficiency.score)}.</div>
          )}
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Productive vs downtime</h4>
          <ChartCanvas config={donutConfig} height={240} downloadName="productive-vs-downtime" label="Productive versus downtime hours" />
        </div>
        <div className="mini-chart">
          <h4>Efficiency by week</h4>
          {rep.byWeek.length ? (
            <ChartCanvas config={weekConfig} height={240} downloadName="efficiency-by-week" label="Efficiency by week with target line" />
          ) : (
            <p className="muted">No weeks in range.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Downtime contribution by reason</h4>
          {rep.reasonContribution.length ? (
            <ChartCanvas config={contribConfig} height={240} downloadName="downtime-contribution" label="Downtime contribution by reason" />
          ) : (
            <p className="muted">No downtime in range.</p>
          )}
        </div>
      </div>
    </section>
  );
}
