// Trends: a day-of-week downtime pattern. Average downtime hours per weekday
// (Mon–Sun) from the cleaned records, the worst weekday highlighted, and an
// overall-average reference line — plus a computed one-line takeaway and an
// honesty caption (a ~few-week period is indicative, not proven seasonality).
// All figures are display-side aggregations; no official metric is touched.
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import { downtimeByWeekday } from "../../lib/analysis.js";
import { CHART_COLORS } from "../../lib/colors.js";
import { hrs, num } from "../../lib/format.js";

export default function TrendsSection({ dash }) {
  const { view, params } = dash;
  const records = view.filtered;
  const range = view.report.dateRange;

  const wk = useMemo(() => downtimeByWeekday(records, params.failureReasons), [records, params.failureReasons]);

  const hasData = wk.worst != null;
  const weeks = range && range.days ? Math.max(1, Math.round(range.days / 7)) : null;

  const config = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: wk.weekdays.map((w) => w.weekday),
        datasets: [
          {
            label: "Avg downtime h/day",
            data: wk.weekdays.map((w) => (w.avgDowntime == null ? 0 : Number(w.avgDowntime.toFixed(2)))),
            backgroundColor: wk.weekdays.map((w) =>
              wk.worst && w.index === wk.worst.index ? CHART_COLORS.downtimeWorst : CHART_COLORS.downtime
            ),
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
        scales: { y: { beginAtZero: true, title: { display: true, text: "Avg downtime h / day" } } },
      },
    }),
    [wk]
  );

  return (
    <section className="card report-section">
      <h2>Trends</h2>

      {!hasData ? (
        <p className="muted">Not enough dated records to show a weekday pattern.</p>
      ) : (
        <>
          <h4>Average downtime by day of week</h4>
          <ChartCanvas
            config={config}
            height={300}
            downloadName="downtime-by-weekday"
            label="Average downtime hours per weekday, worst day highlighted, with an overall-average line"
          />
          <p className="trend-takeaway">
            {wk.worst.weekday} averages the most downtime — {hrs(wk.worst.avgDowntime)}/day.
          </p>
          <p className="boundary-caption">
            Based on ~{weeks} week{weeks === 1 ? "" : "s"} of data ({range.days} days), so each weekday recurs only
            a few times — read this as an indicative pattern, not proven seasonality.
          </p>
        </>
      )}
    </section>
  );
}
