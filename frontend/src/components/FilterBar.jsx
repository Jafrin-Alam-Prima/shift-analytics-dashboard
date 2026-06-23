// Prominent, expanded-by-default Filters panel so the controls are discoverable
// on load. A filter-icon + "Filters" label + accent active-count badge toggles
// it; applied filters also appear as inline chips (each with a quick clear ×)
// next to a Reset. Sub-sections: Show (kind), Date, Hours, Reasons, Groups — all
// combinable. (Clean/raw and the data source live in Settings → Data.)
import Segmented from "./Segmented.jsx";
import { IconFilter } from "./icons.jsx";
import { filtersActive, datePresetRange } from "../lib/filters.js";
import { uniqueReasons } from "../lib/cleaning.js";
import { shortDate } from "../lib/format.js";

export default function FilterBar({ dash }) {
  const { dataset, filters, setFilter, setDateRange, resetFilters, params, datasetDates, filtersOpen, setFiltersOpen } = dash;
  const reasons = uniqueReasons(dataset.raw);
  const groupNames = Object.keys(params.groups);
  const open = filtersOpen;
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

  // count how many distinct filters are set, for the badge
  const activeCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.hoursMin !== "" || filters.hoursMax !== "" ? 1 : 0) +
    (filters.kind !== "all" ? 1 : 0) +
    (filters.reasons.length ? 1 : 0) +
    (filters.groups.length ? 1 : 0);

  // applied filters as removable chips, so what's active is always visible
  const dateLabel =
    filters.dateFrom && filters.dateTo
      ? `${shortDate(filters.dateFrom)} – ${shortDate(filters.dateTo)}`
      : filters.dateFrom
      ? `from ${shortDate(filters.dateFrom)}`
      : `to ${shortDate(filters.dateTo)}`;
  const hoursLabel =
    filters.hoursMin !== "" && filters.hoursMax !== ""
      ? `${filters.hoursMin}–${filters.hoursMax} h`
      : filters.hoursMin !== ""
      ? `≥ ${filters.hoursMin} h`
      : `≤ ${filters.hoursMax} h`;
  const activeChips = [];
  if (filters.dateFrom || filters.dateTo) activeChips.push({ key: "date", label: dateLabel, clear: () => setDateRange("", "") });
  if (filters.kind !== "all") activeChips.push({ key: "kind", label: filters.kind === "downtime" ? "Downtime only" : "Productive only", clear: () => setFilter("kind", "all") });
  if (filters.hoursMin !== "" || filters.hoursMax !== "") activeChips.push({ key: "hours", label: hoursLabel, clear: () => { setFilter("hoursMin", ""); setFilter("hoursMax", ""); } });
  for (const r of filters.reasons) activeChips.push({ key: `reason-${r}`, label: r, clear: () => setFilter("reasons", filters.reasons.filter((x) => x !== r)) });
  for (const g of filters.groups) activeChips.push({ key: `group-${g}`, label: g, clear: () => setFilter("groups", filters.groups.filter((x) => x !== g)) });

  function toggleInArray(key, value) {
    const arr = filters[key];
    setFilter(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  return (
    <section className="card filter-panel">
      <div className="filter-head">
        <button
          className="filter-toggle"
          onClick={() => setFiltersOpen(!open)}
          aria-expanded={open}
        >
          <IconFilter />
          <span>Filters</span>
          {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          <span className="filter-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        {activeChips.length > 0 && (
          <div className="active-chips">
            {activeChips.map((c) => (
              <button
                key={c.key}
                className="active-chip"
                onClick={c.clear}
                title={`Clear: ${c.label}`}
                aria-label={`Clear filter ${c.label}`}
              >
                <span>{c.label}</span>
                <span className="active-chip-x" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
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
