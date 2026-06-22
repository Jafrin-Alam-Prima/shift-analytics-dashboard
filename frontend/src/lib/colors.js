// Stable colours for reasons and groups. The colour for a reason depends only
// on the sorted list of all reasons, so a reason keeps its colour even when the
// data is filtered down. New/unknown reasons just take the next palette slot.
import { DEFAULT_GROUPS } from "./config.js";

// Cohesive categorical palette — distinguishable and readable in light + dark.
// The first 12 are maximally distinct; the rest extend it. New/unknown reasons
// just take the next slot (dynamic fallback preserved).
const PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4",
  "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#6366f1", "#64748b",
  "#eab308", "#f43f5e", "#0ea5e9", "#a855f7",
];

// Semantic (non-category) chart colours, kept here so charts share one source:
// downtime is red, the worst point a deeper red, reference lines neutral grey
// (mid-tone so it reads on both light and dark).
export const CHART_COLORS = {
  downtime: "#dc2626",
  downtimeWorst: "#7f1d1d",
  reference: "#94a3b8",
};

// Chart.js styling resolved from the live CSS tokens, so every chart matches the
// UI (Inter font, neutral axis text/gridlines, themed tooltip). Reads computed
// custom properties, so it reflects the active light/dark theme.
export function chartTheme() {
  const cs = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const v = (name, fallback) => {
    const val = cs && cs.getPropertyValue(name).trim();
    return val || fallback;
  };
  return {
    fontFamily: v("--font-sans", "Inter, system-ui, sans-serif"),
    text: v("--muted", "#6b7280"),
    grid: v("--line", "#e6e8ec"),
    tooltipBg: v("--ink", "#18181b"),
    tooltipText: v("--panel", "#ffffff"),
    tooltipBorder: v("--line", "#e6e8ec"),
  };
}

// reason -> colour, keyed off the full sorted reason list for stability
export function reasonColorMap(allReasons) {
  const sorted = [...new Set(allReasons)].sort();
  const map = {};
  sorted.forEach((r, i) => (map[r] = PALETTE[i % PALETTE.length]));
  return map;
}

const GROUP_COLORS = {
  "Unplanned downtime": "#dc2626",
  "Planned work": "#16a34a",
  "Waiting / idle": "#d97706",
  Other: "#64748b",
};

// group -> colour (known groups get a fixed colour; others take the palette)
export function groupColorMap(groupNames = Object.keys(DEFAULT_GROUPS)) {
  const map = {};
  let p = 0;
  for (const name of groupNames) {
    map[name] = GROUP_COLORS[name] || PALETTE[p++ % PALETTE.length];
  }
  if (!map.Other) map.Other = GROUP_COLORS.Other;
  return map;
}
