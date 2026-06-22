// Turns shift records into floating-bar points for the timeline. Each bar runs
// from its start time to its end time on a 36-hour axis, so an overnight shift
// simply continues past the 24-hour mark instead of wrapping around.
import { groupOf } from "./analysis.js";
import { shortDate } from "./format.js";

// time of day in hours (UTC), e.g. 07:30 -> 7.5
export function timeOfDay(d) {
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

// whole-day difference between two timestamps (0 = same day, 1 = next day)
function dayDiff(start, end) {
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((b - a) / 86400000);
}

// y label for the 36-hour axis: 0..23 same day, 24..36 the next day
export function hourLabel(v) {
  const h = ((v % 24) + 24) % 24;
  const next = v >= 24 ? " +1d" : "";
  return `${String(Math.round(h)).padStart(2, "0")}:00${next}`;
}

// Build the points. opts: { colorBy: 'reason'|'group', reasonColors, groupColors,
// groups, merge:boolean }. Only rows that have both timestamps appear.
export function toTimelinePoints(records, opts) {
  const { colorBy, reasonColors, groupColors, groups, merge } = opts;
  const plottable = records.filter((r) => r.inTimeline && r.start && r.end && r.dateKey);

  if (merge) {
    // one bar per day: earliest start to latest end
    const byDay = {};
    for (const r of plottable) {
      const lo = timeOfDay(r.start);
      const hi = timeOfDay(r.end) + 24 * dayDiff(r.start, r.end);
      if (!byDay[r.dateKey]) byDay[r.dateKey] = { lo, hi, count: 0 };
      byDay[r.dateKey].lo = Math.min(byDay[r.dateKey].lo, lo);
      byDay[r.dateKey].hi = Math.max(byDay[r.dateKey].hi, hi);
      byDay[r.dateKey].count += 1;
    }
    return Object.keys(byDay)
      .sort()
      .map((key) => ({
        dateKey: key,
        xLabel: shortDate(key),
        y: [byDay[key].lo, byDay[key].hi],
        color: "#94a3b8",
        tooltip: `${shortDate(key)}: ${byDay[key].count} shift(s), ${hourLabel(byDay[key].lo)}–${hourLabel(byDay[key].hi)}`,
      }));
  }

  // per-shift: one bar per record
  return plottable
    .slice()
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
    .map((r) => {
      const lo = timeOfDay(r.start);
      const hi = timeOfDay(r.end) + 24 * dayDiff(r.start, r.end);
      const group = groupOf(r.reason, groups);
      const color =
        colorBy === "group" ? groupColors[group] || "#94a3b8" : reasonColors[r.reason] || "#94a3b8";
      return {
        dateKey: r.dateKey,
        xLabel: shortDate(r.dateKey),
        y: [lo, hi],
        color,
        reason: r.reason,
        group,
        tooltip: `${shortDate(r.dateKey)} · ${r.reason} · ${hourLabel(lo)}–${hourLabel(hi)}`,
      };
    });
}

// sorted unique day labels for the category axis
export function dayLabels(points) {
  const keys = [...new Set(points.map((p) => p.dateKey))].sort();
  return keys.map((k) => shortDate(k));
}
