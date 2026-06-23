// Shift analysis: a stacked bar (shift × reason), an incidents-per-shift donut,
// and an average-duration-by-shift bar — all from the configurable shift windows
// (view.report.shiftSlots, bucketed per record in the R1 metrics layer).
import { useMemo } from "react";
import ChartCanvas from "../charts/ChartCanvas.jsx";
import { reasonColorMap } from "../../lib/colors.js";
import { uniqueReasons } from "../../lib/cleaning.js";
import { hrs, num } from "../../lib/format.js";

const SLOT_COLORS = ["#f59e0b", "#2480c9", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export default function ShiftSection({ dash }) {
  const slots = dash.view.report.shiftSlots;
  const reasonColors = useMemo(() => reasonColorMap(uniqueReasons(dash.view.cleanRecords)), [dash.view.cleanRecords]);

  const hasData = slots.some((s) => s.count > 0);

  // reasons that actually appear in any slot (stable order)
  const reasons = useMemo(() => {
    const set = new Set();
    for (const s of slots) for (const r of Object.keys(s.byReason)) if (s.byReason[r] > 0) set.add(r);
    return [...set].sort();
  }, [slots]);

  const stackedConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: slots.map((s) => s.label),
        datasets: reasons.map((rn) => ({
          label: rn,
          data: slots.map((s) => Number((s.byReason[rn] || 0).toFixed(2))),
          backgroundColor: reasonColors[rn] || "#94a3b8",
        })),
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: "Hours" } } },
      },
    }),
    [slots, reasons, reasonColors]
  );

  const incidentsConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: slots.map((s) => s.label),
        datasets: [{ data: slots.map((s) => s.count), backgroundColor: slots.map((_, i) => SLOT_COLORS[i % SLOT_COLORS.length]) }],
      },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } },
    }),
    [slots]
  );

  const avgConfig = useMemo(
    () => ({
      type: "bar",
      data: {
        labels: slots.map((s) => s.label),
        datasets: [{ label: "Avg h", data: slots.map((s) => (s.avg == null ? 0 : Number(s.avg.toFixed(2)))), backgroundColor: slots.map((_, i) => SLOT_COLORS[i % SLOT_COLORS.length]) }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Avg shift h" } } },
      },
    }),
    [slots]
  );

  return (
    <section className="card report-section">
      <h2>Shift analysis</h2>
      {!hasData ? (
        <p className="muted">No shifts with a start time to bucket into windows.</p>
      ) : (
        <>
          <table className="issue-table">
            <thead>
              <tr>
                <th>Shift</th>
                <th>Incidents</th>
                <th>Hours</th>
                <th>Avg</th>
                <th>Median</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td>{num(s.count, 0)}</td>
                  <td>{hrs(s.hours)}</td>
                  <td>{hrs(s.avg)}</td>
                  <td>{hrs(s.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="chart-grid" style={{ marginTop: "1rem" }}>
            <div className="mini-chart">
              <h4>Hours by shift × reason</h4>
              <ChartCanvas config={stackedConfig} height={260} downloadName="shift-by-reason" label="Hours by shift and reason" />
            </div>
            <div className="mini-chart">
              <h4>Incidents per shift</h4>
              <ChartCanvas config={incidentsConfig} height={260} downloadName="incidents-per-shift" label="Incidents per shift" />
            </div>
            <div className="mini-chart">
              <h4>Avg duration by shift</h4>
              <ChartCanvas config={avgConfig} height={260} downloadName="avg-duration-by-shift" label="Average duration by shift" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
