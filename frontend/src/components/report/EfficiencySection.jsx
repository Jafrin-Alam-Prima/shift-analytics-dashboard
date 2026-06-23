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
  // the failure set the contribution chart breaks down (the categories the score
  // treats as non-productive) — named explicitly so it reads as a defined subset
  const failureLabel = params.failureReasons.join(", ");
  const gap = off.score == null ? null : off.score - target;
  // the worked derivation (with live numbers) lives in the "i" tooltip, not on screen
  const effTip =
    off.score == null
      ? RULE_TEXT.efficiency
      : `${RULE_TEXT.efficiency} Here: ${hrs(off.productive)} ÷ ${hrs(off.total)} × 100 = ${pct(off.score)}.`;

  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(view.cleanRecords)), [view.cleanRecords]);

  const nonProductive = off.total != null ? off.total - off.productive : 0;
  const donutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Working time", "Lost time"],
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
            label: "Efficiency (%)",
            data: rep.byWeek.map((w) => (w.score == null ? null : Number(w.score.toFixed(1)))),
            borderColor: "#1e5ba8",
            backgroundColor: "rgba(30,91,168,0.15)",
            tension: 0.3,
            spanGaps: true,
            fill: true,
          },
          {
            label: `Goal ${num(target, 0)}%`,
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
        scales: { y: { min: 0, max: 100, title: { display: true, text: "Efficiency (%)" } } },
      },
    }),
    [rep.byWeek, target]
  );

  const contribConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: rep.reasonContribution.map((c) => c.reason),
        datasets: [{ label: "Hours lost", data: rep.reasonContribution.map((c) => Number(c.hours.toFixed(2))), backgroundColor: rep.reasonContribution.map((c) => reasonColors[c.reason] || "#94a3b8") }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Hours lost" } } },
      },
    }),
    [rep.reasonContribution, reasonColors]
  );

  const fillPct = off.score == null ? 0 : Math.max(0, Math.min(100, off.score));

  return (
    <section className="card report-section">
      <h2>Efficiency</h2>
      <p className="section-subtitle">How much of the tracked time was working time, not lost to failures.</p>

      <div className="formula-box">
        <span className="formula-line">Working time as a share of all tracked time.</span>{" "}
        <InfoTip text={effTip} label="How efficiency is calculated, with the worked numbers" />
      </div>

      <div className="eff-gauge">
        <div className="gauge-num">{pct(off.score)}</div>
        <div className="gauge-side">
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: `${fillPct}%` }} />
            <div className="gauge-target" style={{ left: `${Math.min(100, target)}%` }} title={`Goal ${num(target, 0)}%`} />
          </div>
          <div className="gauge-labels">
            <span>0%</span>
            <span>Goal {num(target, 0)}%</span>
            <span>100%</span>
          </div>
          <div className={gap == null ? "muted" : gap >= 0 ? "good-text" : "bad-text"}>
            {gap == null ? "No data" : `${num(Math.abs(gap))} ${gap >= 0 ? "over" : "under"} the ${num(target, 0)}% goal`}
          </div>
          {view.failureCustomized && (
            <div className="muted">Headline uses the standard failure set. With your custom set it's {pct(view.efficiency.score)}.</div>
          )}
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <div className="mini-chart">
          <h4>Working time vs lost time</h4>
          <ChartCanvas config={donutConfig} height={240} downloadName="working-vs-lost-time" label="Working time versus time lost to failures" />
        </div>
        <div className="mini-chart">
          <h4>Efficiency, week by week</h4>
          {rep.byWeek.length ? (
            <ChartCanvas config={weekConfig} height={240} downloadName="efficiency-week-by-week" label="Efficiency for each week with the goal line" />
          ) : (
            <p className="muted">No weeks in range.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Time lost to failures ({failureLabel})</h4>
          {rep.reasonContribution.length ? (
            <>
              <ChartCanvas config={contribConfig} height={240} downloadName="time-lost-by-category" label={`Time lost to failures, by category (${failureLabel})`} />
              <p className="muted chart-note">
                These are the categories counted as lost time when working out efficiency — not all reasons.
              </p>
            </>
          ) : (
            <p className="muted">No time lost in this range.</p>
          )}
        </div>
      </div>
    </section>
  );
}
