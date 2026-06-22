// Stable colours for reasons and groups. The colour for a reason depends only
// on the sorted list of all reasons, so a reason keeps its colour even when the
// data is filtered down. New/unknown reasons just take the next palette slot.
import { DEFAULT_GROUPS } from "./config.js";

const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#ea580c", "#0d9488", "#9333ea", "#475569",
  "#ca8a04", "#be123c", "#1d4ed8", "#15803d",
];

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
