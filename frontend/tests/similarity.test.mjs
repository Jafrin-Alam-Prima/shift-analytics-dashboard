import { check, readDataCsv } from "./harness.mjs";
import { parseCsvText } from "../src/lib/csv.js";
import { autoGuessMap, applyMap } from "../src/lib/columnMap.js";
import { buildDataset } from "../src/lib/cleaning.js";
import { similarityRatio, reasonSuggestions, nearDuplicateSuggestions } from "../src/lib/similarity.js";
import { defaultParams } from "../src/lib/config.js";

export function run() {
  // ratio basics
  check("identical ratio = 1", similarityRatio("Breakdown", "Breakdown") === 1);
  check("typo ratio high", similarityRatio("breakdwn", "breakdown") >= 0.8, `(${similarityRatio("breakdwn", "breakdown")})`);
  check("different ratio low", similarityRatio("setup", "training") < 0.5);

  // reason spelling suggestion: a rarer typo maps to the common spelling
  const logical = [
    { date: "10/1/2025", start: "", end: "", hours: "2", reason: "Breakdown" },
    { date: "10/2/2025", start: "", end: "", hours: "2", reason: "Breakdown" },
    { date: "10/3/2025", start: "", end: "", hours: "2", reason: "Breakdwn" },
    { date: "10/4/2025", start: "", end: "", hours: "2", reason: "Cleaning" },
  ];
  const sugs = reasonSuggestions(logical, 0.8);
  check("one reason suggestion found", sugs.length === 1, `(got ${sugs.length})`);
  check("variant -> canonical (Breakdwn -> Breakdown)", sugs[0] && sugs[0].variant === "Breakdwn" && sugs[0].canonical === "Breakdown");
  check("suggestion targets the typo row", sugs[0] && sugs[0].rows.length === 1 && sugs[0].rows[0] === 2);

  // well-spelled sample has no reason suggestions at 0.8
  const sampleLogical = applyMap(parseCsvText(readDataCsv()).rows, autoGuessMap(parseCsvText(readDataCsv()).headers, parseCsvText(readDataCsv()).rows).map);
  check("clean sample reasons: no false suggestions", reasonSuggestions(sampleLogical, 0.8).length === 0);

  // near-duplicate detection: same day+reason, starts within tolerance, not identical
  const recs = [
    { i: 0, dateKey: "2025-10-08", reason: "Power Failure", hours: 3, start: new Date("2025-10-08T08:00:00Z") },
    { i: 1, dateKey: "2025-10-08", reason: "Power Failure", hours: 2, start: new Date("2025-10-08T08:30:00Z") },
    { i: 2, dateKey: "2025-10-08", reason: "Cleaning", hours: 1, start: new Date("2025-10-08T14:00:00Z") },
  ];
  const nd = nearDuplicateSuggestions(recs, 60);
  check("one near-duplicate found", nd.length === 1, `(got ${nd.length})`);
  check("near-dup pairs the two power-failure rows", nd[0] && nd[0].ofRow === 0 && nd[0].row === 1 && nd[0].minutesApart === 30);
  check("near-dup respects tolerance (none within 10 min)", nearDuplicateSuggestions(recs, 10).length === 0);

  // detection never mutates data
  const before = buildDataset(logical, defaultParams()).cleanCount;
  reasonSuggestions(logical, 0.8);
  nearDuplicateSuggestions(recs, 60);
  check("detection is read-only", buildDataset(logical, defaultParams()).cleanCount === before);
}
