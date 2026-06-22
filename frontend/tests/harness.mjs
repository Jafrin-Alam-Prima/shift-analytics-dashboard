// Shared test helpers. Kept separate from the runner so test files can import
// these without creating a circular import with the runner's top-level await.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const results = { passed: 0, failed: 0, fails: [] };

export function check(name, cond, detail = "") {
  if (cond) {
    results.passed++;
    console.log(`  ok   ${name}`);
  } else {
    results.failed++;
    results.fails.push(`${name} ${detail}`);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

export function readDataCsv() {
  return readFileSync(join(here, "..", "public", "shift_data.csv"), "utf8");
}
