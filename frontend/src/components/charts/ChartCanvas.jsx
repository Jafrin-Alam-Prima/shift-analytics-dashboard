// Thin React wrapper around a Chart.js chart: creates it from a config object,
// updates on change, tidies up on unmount, and (optionally) offers a PNG export.
// Global Chart.js defaults (font, axis text, gridlines, tooltip) come from the
// design tokens so every chart matches the UI in both light and dark.
import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { IconDownload } from "../icons.jsx";
import { chartTheme } from "../../lib/colors.js";

Chart.register(...registerables);

// pull Chart.js defaults from the live CSS tokens (Inter font + neutral axes +
// themed tooltip). Re-applied per chart create, so it tracks the active theme.
function applyChartDefaults() {
  const t = chartTheme();
  Chart.defaults.font.family = t.fontFamily;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = t.text;
  Chart.defaults.borderColor = t.grid;
  const tip = Chart.defaults.plugins.tooltip;
  tip.backgroundColor = t.tooltipBg;
  tip.titleColor = t.tooltipText;
  tip.bodyColor = t.tooltipText;
  tip.borderColor = t.tooltipBorder;
  tip.borderWidth = 1;
  tip.padding = 8;
  tip.cornerRadius = 6;
  tip.titleFont = { family: t.fontFamily, weight: "600" };
  tip.bodyFont = { family: t.fontFamily };
}

export default function ChartCanvas({ config, height = 320, label, downloadName }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") || "light" : "light"
  );

  // recreate charts on theme toggle so axis/tooltip colours track the tokens
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTheme(el.getAttribute("data-theme") || "light"));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // create / rebuild on mount + theme toggle only — a full rebuild so the new
  // token colours (axes, tooltip) take effect.
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    applyChartDefaults();
    const chart = new Chart(canvasRef.current, config);
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // on data/config change (not theme): update the existing chart in place so
  // Chart.js tweens to the new values (~360ms, easeOutQuart) instead of snapping.
  // Honour prefers-reduced-motion by disabling the tween.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.data = config.data;
    chart.options = { ...(config.options || {}), animation: reduce ? false : { duration: 360, easing: "easeOutQuart" } };
    chart.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <button className="png-btn no-print" onClick={savePng} title="Download as PNG" aria-label="Download chart as PNG">
          <IconDownload />
        </button>
      )}
      <div style={{ height }}>
        <canvas ref={canvasRef} role="img" aria-label={label || "chart"} />
      </div>
    </div>
  );
}
