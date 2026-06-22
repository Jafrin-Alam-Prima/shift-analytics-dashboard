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

// is any filter active? (used to show a "filtered" hint / enable reset)
export function filtersActive(filters) {
  const d = defaultFilters();
  return JSON.stringify({ ...filters, reasons: [...filters.reasons].sort(), groups: [...filters.groups].sort() })
    !== JSON.stringify({ ...d });
}
