import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";

export function run() {
  const csv = readDataCsv();

  // real headers resolve all five logical fields
  const { headers, rows } = parseCsvText(csv);
  const { map, missing } = autoGuessMap(headers, rows);
  check("real file: 51 rows parsed", rows.length === 51, `(got ${rows.length})`);
  check("real file: all 5 logical fields resolve", missing.length === 0, `(missing ${missing})`);
  check("real file: date -> DAY_DATE", map.date === "DAY_DATE", `(got ${map.date})`);
  check("real file: hours -> HOURS", map.hours === "HOURS", `(got ${map.hours})`);
  check("real file: reason -> REASON", map.reason === "REASON", `(got ${map.reason})`);

  // a renamed-header copy still loads
  const renamed = csv
    .replace("DAY_DATE", "Shift Date")
    .replace("START", "Clock In")
    .replace("END", "Clock Out")
    .replace("HOURS", "Duration")
    .replace("REASON", "Cause");
  const r2 = parseCsvText(renamed);
  const m2 = autoGuessMap(r2.headers, r2.rows);
  check("renamed file: all 5 logical fields resolve", m2.missing.length === 0, `(missing ${m2.missing})`);
  check("renamed file: start -> Clock In", m2.map.start === "Clock In", `(got ${m2.map.start})`);

  // applyMap produces logical rows
  const logical = applyMap(rows, map);
  check("applyMap: first row has reason Training", logical[0].reason === "Training", `(got ${logical[0].reason})`);
  check("applyMap: logical rows keep count", logical.length === 51);
}
