// Three supporting charts: hours by reason (bar), efficiency over time (line),
// and the reason mix (donut). The bar and donut switch between reason and group;
// the line is overall efficiency per day. All handle empty data gracefully.
import { useMemo, useState } from "react";
import ChartCanvas from "./ChartCanvas.jsx";
import Segmented from "../Segmented.jsx";
import { hoursByReason, hoursByGroup, efficiencyByDay } from "../../lib/analysis.js";
import { reasonColorMap, groupColorMap } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";
import { shortDate } from "../../lib/format.js";

const round1 = (n) => Number(n.toFixed(1));

export default function ExtraCharts({ records, allRecords, groups, failureReasons }) {
  const [colorBy, setColorBy] = useState("reason");

  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(allRecords)), [allRecords]);
  const groupColors = useMemo(() => groupColorMap(Object.keys(groups)), [groups]);

  // categorical data (hours per reason or per group), sorted high -> low
  const cat = useMemo(() => {
    const map = colorBy === "group" ? hoursByGroup(records, groups) : hoursByReason(records);
    const entries = Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const colors = entries.map(([k]) =>
      colorBy === "group" ? groupColors[k] || "#94a3b8" : reasonColors[k] || "#94a3b8"
    );
    return {
      labels: entries.map(([k]) => k),
      values: entries.map(([, v]) => round1(v)),
      colors,
    };
  }, [records, colorBy, groups, reasonColors, groupColors]);

  const byDay = useMemo(() => efficiencyByDay(records, failureReasons), [records, failureReasons]);

  const barConfig = useMemo(
    () => ({
      type: "bar",
      data: { labels: cat.labels, datasets: [{ label: "Hours", data: cat.values, backgroundColor: cat.colors }] },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Hours" } } },
      },
    }),
    [cat]
  );

  const donutConfig = useMemo(
    () => ({
      type: "doughnut",
      data: { labels: cat.labels, datasets: [{ data: cat.values, backgroundColor: cat.colors }] },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: "right", labels: { boxWidth: 12 } } },
      },
    }),
    [cat]
  );

  const lineConfig = useMemo(
    () => ({
      type: "line",
      data: {
        labels: byDay.map((d) => shortDate(d.dateKey)),
        datasets: [
          {
            label: "Efficiency (%)",
            data: byDay.map((d) => (d.score == null ? null : round1(d.score))),
            borderColor: "#1e5ba8",
            backgroundColor: "rgba(30,91,168,0.15)",
            tension: 0.3,
            spanGaps: true,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, title: { display: true, text: "Efficiency (%)" } } },
      },
    }),
    [byDay]
  );

  const hasCat = cat.labels.length > 0;
  const hasDays = byDay.some((d) => d.score != null);

  return (
    <section className="card">
      <div className="chart-head">
        <h3>More charts</h3>
        <Segmented
          label="Break down"
          value={colorBy}
          onChange={setColorBy}
          options={[
            { value: "reason", label: "By reason" },
            { value: "group", label: "By group" },
          ]}
        />
      </div>

      <div className="chart-grid">
        <div className="mini-chart">
          <h4>Hours by {colorBy}</h4>
          {hasCat ? (
            <ChartCanvas config={barConfig} height={260} downloadName={`hours-by-${colorBy}`} label={`Bar chart of total hours by ${colorBy}`} />
          ) : (
            <p className="muted">No data.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Reason mix</h4>
          {hasCat ? (
            <ChartCanvas config={donutConfig} height={260} downloadName={`reason-mix-by-${colorBy}`} label={`Donut chart of the hours mix by ${colorBy}`} />
          ) : (
            <p className="muted">No data.</p>
          )}
        </div>
        <div className="mini-chart">
          <h4>Efficiency over time</h4>
          {hasDays ? (
            <ChartCanvas config={lineConfig} height={260} downloadName="efficiency-over-time" label="Line chart of efficiency percentage per day" />
          ) : (
            <p className="muted">No data.</p>
          )}
        </div>
      </div>
    </section>
  );
}
