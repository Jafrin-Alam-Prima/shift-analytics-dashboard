// Combinable filters over the records. All filters are AND-ed together; an empty
// filter means "don't restrict on this". The clean/raw choice is handled
// separately (it picks which record set we filter), so it isn't here.
import { groupOf } from "./analysis.js";

export function defaultFilters() {
  return {
    dateFrom: "", // "YYYY-MM-DD"
    dateTo: "",
    reasons: [], // empty = all reasons
    groups: [], // empty = all groups
    hoursMin: "", // "" = no minimum
    hoursMax: "",
    kind: "all", // all | productive | downtime
  };
}

export function applyFilters(records, filters, params) {
  const { dateFrom, dateTo, reasons, groups, hoursMin, hoursMax, kind } = filters;
  const min = hoursMin === "" ? null : Number(hoursMin);
  const max = hoursMax === "" ? null : Number(hoursMax);
  const failure = params.failureReasons;

  return records.filter((r) => {
    if (dateFrom || dateTo) {
      if (!r.dateKey) return false;
      if (dateFrom && r.dateKey < dateFrom) return false;
      if (dateTo && r.dateKey > dateTo) return false;
    }
    if (reasons.length && !reasons.includes(r.reason)) return false;
    if (groups.length && !groups.includes(groupOf(r.reason, params.groups))) return false;
    if (min != null || max != null) {
      if (r.hours == null) return false;
      if (min != null && r.hours < min) return false;
      if (max != null && r.hours > max) return false;
    }
    if (kind === "productive" && failure.includes(r.reason)) return false;
    if (kind === "downtime" && !failure.includes(r.reason)) return false;
    return true;
  });
}

// Quick date-range presets anchored to the data's latest date (the data is
// historical, so we anchor to the dataset's max date, not the system clock).
// `days` is the window length ending at maxDateKey (inclusive). Returns the
// { dateFrom, dateTo } to apply; dynamic for any uploaded dataset.
export function datePresetRange(maxDateKey, days) {
  const m = maxDateKey && /^(\d{4})-(\d{2})-(\d{2})$/.exec(maxDateKey);
  if (!m) return { dateFrom: "", dateTo: "" };
  const max = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const from = new Date(max - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: maxDateKey };
}

// is any filter active? (used to show a "filtered" hint / enable reset)
export function filtersActive(filters) {
  const d = defaultFilters();
  return JSON.stringify({ ...filters, reasons: [...filters.reasons].sort(), groups: [...filters.groups].sort() })
    !== JSON.stringify({ ...d });
}
