// Stable colours for reasons and groups. The colour for a reason depends only
// on the sorted list of all reasons, so a reason keeps its colour even when the
// data is filtered down. New/unknown reasons just take the next palette slot.
import { DEFAULT_GROUPS } from "./config.js";

// Cohesive categorical palette — leads with the brand blues/teals to harmonize
// with the corporate-blue UI, then fans out to distinct hues that read cleanly on
// white. The first 12 are maximally distinct; the rest extend it. New/unknown
// reasons just take the next slot (dynamic fallback preserved).
const PALETTE = [
  "#2480c9", "#14b8a6", "#7c3aed", "#e8794b", "#db2777", "#65a30d",
  "#0ea5e9", "#f59e0b", "#6366f1", "#0e7490", "#be123c", "#475569",
  "#84cc16", "#a855f7", "#0891b2", "#eab308",
];

// Semantic (non-category) chart colours, kept here so charts share one source:
// downtime is red, the worst point a deeper red, reference lines a neutral
// blue-grey (mid-tone so it reads on both light and dark).
export const CHART_COLORS = {
  downtime: "#dc2626",
  downtimeWorst: "#7f1d1d",
  reference: "#7c93ad",
  brand: "#1e5ba8",
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
