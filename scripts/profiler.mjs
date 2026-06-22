// One-off data profiler. Reads the CSV and prints a quick profile so we can
// confirm the dataset matches what the plan expects (row count, columns,
// reasons, and the rows that look broken). Run: node scripts/profiler.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = join(here, "..", "frontend", "public", "shift_data.csv");

// tiny CSV reader (no quoted-comma cases in this file)
const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
const headers = lines[0].split(",").map((h) => h.trim());
const rows = lines.slice(1).map((line) => {
  const cells = line.split(",");
  const o = {};
  headers.forEach((h, i) => (o[h] = (cells[i] ?? "").trim()));
  return o;
});

function parseTs(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function dateValid(s) {
  // expects M/D/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const mm = +m[1], dd = +m[2];
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

console.log("Columns:", headers.join(", "));
console.log("Data rows:", rows.length);

// dtypes (guessed)
const numericHours = rows.filter((r) => r.HOURS !== "" && !isNaN(Number(r.HOURS))).length;
console.log(`HOURS numeric in ${numericHours}/${rows.length} rows`);

// unique reasons
const reasons = [...new Set(rows.map((r) => r.REASON))].sort();
console.log(`Unique reasons (${reasons.length}):`, reasons.join(", "));

// duplicate groups: every row sharing an identical key is part of the issue
const groups = new Map();
rows.forEach((r, i) => {
  const key = [r.DAY_DATE, r.START, r.END, r.HOURS, r.REASON].join("|");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(i);
});

// flagged rows
const flagged = [];
rows.forEach((r, i) => {
  const issues = [];
  const st = parseTs(r.START);
  const en = parseTs(r.END);
  if (!r.START || st === null) issues.push("missing/invalid START");
  if (!r.END || en === null) issues.push("missing/invalid END");
  if (!dateValid(r.DAY_DATE)) issues.push("invalid DAY_DATE");
  const h = Number(r.HOURS);
  if (!isNaN(h) && h < 0) issues.push("negative HOURS");
  if (st && en) {
    const dur = (en - st) / 3600000;
    if (Math.abs(dur - h) > 0.1) issues.push(`HOURS != end-start (${h} vs ${dur.toFixed(2)})`);
    if (st.toISOString().slice(0, 10) !== en.toISOString().slice(0, 10))
      issues.push("cross-midnight");
  }
  const key = [r.DAY_DATE, r.START, r.END, r.HOURS, r.REASON].join("|");
  const grp = groups.get(key);
  if (grp.length > 1) issues.push(`duplicate (rows ${grp.join(", ")})`);
  if (issues.length) flagged.push({ row: i, reason: r.REASON, issues });
});

console.log(`\nFlagged rows: ${flagged.length}/${rows.length} (${((flagged.length / rows.length) * 100).toFixed(1)}%)`);
for (const f of flagged) console.log(`  row ${f.row} [${f.reason}]: ${f.issues.join("; ")}`);
