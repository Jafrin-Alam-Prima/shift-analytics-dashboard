import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { applyFilters, defaultFilters, filtersActive } from "../src/lib/filters.js";
import { defaultParams } from "../src/lib/config.js";

function loadClean() {
  const { headers, rows } = parseCsvText(readDataCsv());
  const { map } = autoGuessMap(headers, rows);
  return buildDataset(applyMap(rows, map)).clean;
}

export function run() {
  const recs = loadClean();
  const p = defaultParams();

  // no filters -> everything passes
  const all = applyFilters(recs, defaultFilters(), p);
  check("no filters keeps all clean rows", all.length === recs.length, `(got ${all.length}/${recs.length})`);
  check("default filters are 'not active'", filtersActive(defaultFilters()) === false);

  // reason filter
  const f1 = { ...defaultFilters(), reasons: ["Breakdown"] };
  const onlyBreak = applyFilters(recs, f1, p);
  check("reason filter keeps only Breakdown", onlyBreak.every((r) => r.reason === "Breakdown"));
  check("reason filter is active", filtersActive(f1) === true);

  // downtime kind
  const downtime = applyFilters(recs, { ...defaultFilters(), kind: "downtime" }, p);
  check("downtime keeps only failure reasons", downtime.every((r) => p.failureReasons.includes(r.reason)));

  // productive kind
  const productive = applyFilters(recs, { ...defaultFilters(), kind: "productive" }, p);
  check("productive excludes failure reasons", productive.every((r) => !p.failureReasons.includes(r.reason)));

  // hours range
  const small = applyFilters(recs, { ...defaultFilters(), hoursMax: "1" }, p);
  check("hours<=1 filter works", small.every((r) => r.hours != null && r.hours <= 1));

  // group filter
  const planned = applyFilters(recs, { ...defaultFilters(), groups: ["Planned work"] }, p);
  check("group filter keeps planned reasons", planned.length > 0 && planned.length < recs.length);

  // combined filters AND together
  const combo = applyFilters(recs, { ...defaultFilters(), kind: "productive", hoursMax: "2" }, p);
  check("combined filters AND", combo.every((r) => !p.failureReasons.includes(r.reason) && r.hours <= 2));

  // an impossible combination -> empty (graceful)
  const none = applyFilters(recs, { ...defaultFilters(), reasons: ["Breakdown"], kind: "productive" }, p);
  check("impossible combo -> empty result", none.length === 0, `(got ${none.length})`);
}
