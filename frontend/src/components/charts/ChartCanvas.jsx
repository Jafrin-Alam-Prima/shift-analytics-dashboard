// Thin React wrapper around a Chart.js chart: creates it from a config object,
// updates on change, tidies up on unmount, and (optionally) offers a PNG export.
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// theme-neutral defaults so charts stay readable in light and dark mode
Chart.defaults.color = "#94a3b8";
Chart.defaults.borderColor = "rgba(148, 163, 184, 0.25)";

export default function ChartCanvas({ config, height = 320, label, downloadName }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current, config);
    chartRef.current = chart;
    return () => chart.destroy();
  }, [config]);

  function savePng() {
    const chart = chartRef.current;
    if (!chart) return;
    const a = document.createElement("a");
    a.href = chart.toBase64Image("image/png", 1);
    a.download = `${downloadName || "chart"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="chart-canvas-wrap">
      {downloadName && (
        <button className="png-btn no-print" onClick={savePng} title="Download as PNG">
          PNG
        </button>
      )}
      <div style={{ height }}>
        <canvas ref={canvasRef} role="img" aria-label={label || "chart"} />
      </div>
    </div>
  );
}
