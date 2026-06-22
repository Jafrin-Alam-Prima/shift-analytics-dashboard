// The floating-bar timeline: x = date, y = time of day on a 36-hour axis, each
// bar a shift coloured by reason (or group). Controls: per-shift vs merged, and
// colour by reason vs by group. Renders the cleaned data by default.
import { useMemo, useState } from "react";
import ChartCanvas from "./ChartCanvas.jsx";
import Segmented from "../Segmented.jsx";
import { toTimelinePoints, dayLabels, hourLabel } from "../../lib/timeline.js";
import { reasonColorMap, groupColorMap } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";

export default function TimelineChart({ records, allRecords, groups }) {
  const [colorBy, setColorBy] = useState("reason");
  const [merge, setMerge] = useState(false);

  // colours come from ALL records so a reason keeps its colour when filtered
  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(allRecords)), [allRecords]);
  const groupColors = useMemo(() => groupColorMap(Object.keys(groups)), [groups]);

  const points = useMemo(
    () => toTimelinePoints(records, { colorBy, reasonColors, groupColors, groups, merge }),
    [records, colorBy, reasonColors, groupColors, groups, merge]
  );

  const config = useMemo(() => {
    const labels = dayLabels(points);
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Shifts",
            data: points.map((p) => ({ x: p.xLabel, y: p.y })),
            backgroundColor: points.map((p) => p.color),
            borderColor: points.map((p) => p.color),
            borderWidth: 1,
            borderSkipped: false,
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: "Date" }, grid: { display: false } },
          y: {
            min: 0,
            max: 36,
            title: { display: true, text: "Time of day" },
            ticks: { stepSize: 6, callback: (v) => hourLabel(v) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => points[ctx.dataIndex]?.tooltip || "" } },
        },
      },
    };
  }, [points]);

  // legend entries (reasons or groups actually present)
  const legend = useMemo(() => {
    if (colorBy === "group") {
      const names = [...new Set(points.map((p) => p.group))].filter(Boolean).sort();
      return names.map((n) => ({ label: n, color: groupColors[n] }));
    }
    const names = [...new Set(points.map((p) => p.reason))].filter(Boolean).sort();
    return names.map((n) => ({ label: n, color: reasonColors[n] }));
  }, [points, colorBy, reasonColors, groupColors]);

  return (
    <section className="card">
      <div className="chart-head">
        <h3>Shift timeline</h3>
        <div className="chart-controls">
          <Segmented
            label="Colour"
            value={colorBy}
            onChange={setColorBy}
            options={[
              { value: "reason", label: "By reason" },
              { value: "group", label: "By group" },
            ]}
          />
          <Segmented
            label="Shifts"
            value={merge ? "merge" : "each"}
            onChange={(v) => setMerge(v === "merge")}
            options={[
              { value: "each", label: "Per shift" },
              { value: "merge", label: "Merge/day" },
            ]}
          />
        </div>
      </div>

      {points.length === 0 ? (
        <p className="muted">No shifts with valid start and end times to show.</p>
      ) : (
        <>
          <ChartCanvas
            config={config}
            height={360}
            downloadName="shift-timeline"
            label={`Shift timeline: ${points.length} shift bars by time of day on a 36-hour axis, coloured by ${colorBy}`}
          />
          {!merge && (
            <div className="legend">
              {legend.map((l) => (
                <span key={l.label} className="legend-item">
                  <span className="legend-swatch" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
