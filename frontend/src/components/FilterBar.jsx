// Compact, collapsible Filters panel. Collapsed by default so the dashboard
// leads with information, not a control wall. Sub-sections: Show (kind), Date,
// Hours, Reasons, Groups — all combinable, with one Reset. (Clean/raw and the
// data source live in Settings → Data; they're data choices, not filters.)
import { useState } from "react";
import Segmented from "./Segmented.jsx";
import { filtersActive, datePresetRange } from "../lib/filters.js";
import { uniqueReasons } from "../lib/cleaning.js";

export default function FilterBar({ dash }) {
  const { dataset, filters, setFilter, setDateRange, resetFilters, params, datasetDates } = dash;
  const reasons = uniqueReasons(dataset.raw);
  const groupNames = Object.keys(params.groups);
  const [open, setOpen] = useState(false);
  const active = filtersActive(filters);

  // quick date presets, anchored to the dataset's latest date (not the clock)
  const maxDate = datasetDates && datasetDates.max;
  const r7 = datePresetRange(maxDate, 7);
  const r14 = datePresetRange(maxDate, 14);
  const datePresets = [
    { label: "Full range", on: !filters.dateFrom && !filters.dateTo, apply: () => setDateRange("", "") },
    { label: "Last 7 days", on: filters.dateFrom === r7.dateFrom && filters.dateTo === r7.dateTo, apply: () => setDateRange(r7.dateFrom, r7.dateTo) },
    { label: "Last 14 days", on: filters.dateFrom === r14.dateFrom && filters.dateTo === r14.dateTo, apply: () => setDateRange(r14.dateFrom, r14.dateTo) },
  ];

  // count how many distinct filters are set, for the collapsed summary
  const activeCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.hoursMin !== "" || filters.hoursMax !== "" ? 1 : 0) +
    (filters.kind !== "all" ? 1 : 0) +
    (filters.reasons.length ? 1 : 0) +
    (filters.groups.length ? 1 : 0);

  function toggleInArray(key, value) {
    const arr = filters[key];
    setFilter(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  return (
    <section className="card filter-panel">
      <div className="filter-head">
        <button
          className="filter-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"} Filters{activeCount > 0 ? ` (${activeCount} active)` : ""}
        </button>
        {active && (
          <button className="reset-btn" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="filter-body">
          <div className="filter-group">
            <span className="seg-label">Show</span>
            <Segmented
              value={filters.kind}
              onChange={(v) => setFilter("kind", v)}
              ariaLabel="Show"
              options={[
                { value: "all", label: "All" },
                { value: "productive", label: "Productive" },
                { value: "downtime", label: "Downtime" },
              ]}
            />
          </div>

          <div className="filter-group">
            <span className="seg-label">Date</span>
            <div className="chip-wrap">
              {datePresets.map((p) => (
                <button
                  key={p.label}
                  className={p.on ? "chip active" : "chip"}
                  onClick={p.apply}
                  aria-pressed={p.on}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="filter-field">
              <span className="seg-label">From</span>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
            </label>
            <label className="filter-field">
              <span className="seg-label">To</span>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
            </label>
          </div>

          <div className="filter-group">
            <span className="seg-label">Hours</span>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="min"
              value={filters.hoursMin}
              onChange={(e) => setFilter("hoursMin", e.target.value)}
              className="num-input"
              aria-label="Minimum hours"
            />
            <span className="seg-label">–</span>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="max"
              value={filters.hoursMax}
              onChange={(e) => setFilter("hoursMax", e.target.value)}
              className="num-input"
              aria-label="Maximum hours"
            />
          </div>

          <div className="filter-group wrap">
            <span className="seg-label">Reasons</span>
            <div className="chip-wrap">
              {reasons.map((r) => (
                <button
                  key={r}
                  className={filters.reasons.includes(r) ? "chip active" : "chip"}
                  onClick={() => toggleInArray("reasons", r)}
                  aria-pressed={filters.reasons.includes(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group wrap">
            <span className="seg-label">Groups</span>
            <div className="chip-wrap">
              {groupNames.map((g) => (
                <button
                  key={g}
                  className={filters.groups.includes(g) ? "chip active" : "chip"}
                  onClick={() => toggleInArray("groups", g)}
                  aria-pressed={filters.groups.includes(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
