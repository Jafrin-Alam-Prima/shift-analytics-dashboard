// CSV loading. parseCsvText is pure (takes a string) so it can be tested in
// Node; loadCsv just fetches the file in the browser and hands it over.
import Papa from "papaparse";

// Parse CSV text into { headers, rows }. Handles a leading BOM and blank lines.
export function parseCsvText(text) {
  if (text == null) throw new Error("No CSV text was provided.");
  const clean = text.replace(/^﻿/, ""); // strip BOM if present
  const result = Papa.parse(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields || []).filter((h) => h !== "");
  if (headers.length === 0) throw new Error("The file has no columns (is it empty?).");
  // keep only the named columns; drop fully blank phantom columns
  const rows = result.data.map((row) => {
    const out = {};
    for (const h of headers) out[h] = (row[h] ?? "").toString();
    return out;
  });
  return { headers, rows };
}

// Fetch and parse the CSV at the given URL (defaults to the public file).
export async function loadCsv(url = "/shift_data.csv") {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Could not reach the data file. Is the dev server running?");
  }
  if (!res.ok) throw new Error(`Data file not found (${res.status}). Expected at ${url}.`);
  const text = await res.text();
  if (!text.trim()) throw new Error("The data file is empty.");
  return parseCsvText(text);
}
