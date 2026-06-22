// Plain Node test runner (no test framework). Run: npm test
// Loads each suite, then prints a summary. Helpers live in harness.mjs.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { results } from "./harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const suites = [
  "columnmap.test.mjs",
  "cleaning.test.mjs",
  "analysis.test.mjs",
  "timeline.test.mjs",
  "filters.test.mjs",
  "report.test.mjs",
  "overrides.test.mjs",
  "similarity.test.mjs",
];

for (const file of suites) {
  const path = join(here, file);
  if (!existsSync(path)) continue; // suite not written yet
  console.log(`\n# ${file}`);
  // import() needs a file:// URL, not a bare absolute path (required on Windows)
  const mod = await import(pathToFileURL(path).href);
  await mod.run();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
if (results.failed > 0) {
  console.log("\nFailures:\n" + results.fails.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
