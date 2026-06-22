import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { efficiency } from "../src/lib/analysis.js";
import { applyOverrides, overrideCount, overrideAudit } from "../src/lib/overrides.js";
import { defaultParams, DEFAULT_FAILURE_REASONS } from "../src/lib/config.js";

function loadLogical() {
  const { headers, rows } = parseCsvText(readDataCsv());
  const { map } = autoGuessMap(headers, rows);
  return applyMap(rows, map);
}

export function run() {
  const logical = loadLogical();
  const p = defaultParams();

  // zero overrides -> identical to the canonical result
  const baseline = buildDataset(logical, p);
  const eff0 = efficiency(baseline.clean, DEFAULT_FAILURE_REASONS).score;
  const effEmpty = efficiency(buildDataset(applyOverrides(logical, {}), p).clean, DEFAULT_FAILURE_REASONS).score;
  check("zero overrides: efficiency unchanged (≈85.9)", Math.abs(effEmpty - eff0) < 0.001 && Math.abs(effEmpty - 85.9) < 0.5, `(${effEmpty} vs ${eff0})`);
  check("zero overrides: clean count unchanged", buildDataset(applyOverrides(logical, {}), p).cleanCount === baseline.cleanCount);
  check("overrideCount(empty) = 0", overrideCount({}) === 0);

  // stable row id survives applyOverrides (record.i = original index)
  const ds = buildDataset(applyOverrides(logical, {}), p);
  check("record ids match original indices", ds.clean.every((r) => typeof r.i === "number") && ds.raw[0].i === 0);

  // a field override flows through cleaning (fix the negative-hours reason row 20 -> reason change)
  const ovField = { 20: { fields: { reason: "Maintenance" } } };
  const dsField = buildDataset(applyOverrides(logical, ovField), p);
  const row20 = dsField.clean.find((r) => r.i === 20);
  check("field override applied (row 20 reason -> Maintenance)", row20 && row20.reason === "Maintenance", `(got ${row20 && row20.reason})`);
  check("overrideCount(one field) = 1", overrideCount(ovField) === 1);

  // excluding a row removes it from the cleaned set and lowers the count by one
  const ovExcl = { 0: { excluded: true } };
  const dsExcl = buildDataset(applyOverrides(logical, ovExcl), p);
  check("exclude drops the row from clean", !dsExcl.clean.some((r) => r.i === 0));
  check("exclude reduces clean count by 1", dsExcl.cleanCount === baseline.cleanCount - 1, `(${dsExcl.cleanCount} vs ${baseline.cleanCount})`);
  check("overrideCount(one exclude) = 1", overrideCount(ovExcl) === 1);

  // audit list records the change with from/to + action
  const audit = overrideAudit(logical, { 45: { fields: { hours: "4" } }, 0: { excluded: true } });
  check("audit has both entries", audit.length === 2);
  check("audit records field override from→to", audit.some((a) => a.row === 46 && a.field === "hours" && a.to === "4" && a.action === "override"));
  check("audit records exclude", audit.some((a) => a.row === 1 && a.action === "exclude"));
}
