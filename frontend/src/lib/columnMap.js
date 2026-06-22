// Auto-guess which column is which logical field, by name hint first and data
// shape second. The user can override any guess from the Settings tab.
import { LOGICAL_FIELDS, HEADER_HINTS } from "./config.js";

// crude type sniffers used as a tie-breaker when names are unclear
function looksLikeTimestamp(v) {
  if (!v) return false;
  return /\d{4}-\d{2}-\d{2}[ tT]\d/.test(v) || !isNaN(Date.parse(v)) && /[:t]/i.test(v);
}
function looksLikeDate(v) {
  if (!v) return false;
  return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(v);
}
function looksNumeric(v) {
  return v !== "" && !isNaN(Number(v));
}

// sample a column's non-empty values
function sample(rows, header, n = 10) {
  const out = [];
  for (const r of rows) {
    const v = (r[header] ?? "").toString().trim();
    if (v) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

// score how well one header fits one logical field (0 = no fit)
function score(field, header, values) {
  let s = 0;
  if (HEADER_HINTS[field].test(header)) s += 100; // name hint dominates
  const hit = (fn) => values.filter(fn).length / Math.max(values.length, 1);
  if (field === "hours") s += hit(looksNumeric) * 30;
  if (field === "start" || field === "end") s += hit(looksLikeTimestamp) * 30;
  if (field === "date") s += hit((v) => looksLikeDate(v) && !looksLikeTimestamp(v)) * 30;
  if (field === "reason") s += hit((v) => isNaN(Number(v)) && !looksLikeTimestamp(v)) * 10;
  return s;
}

// Returns { map, missing } where map is { logicalField: header | null }.
export function autoGuessMap(headers, rows) {
  const map = {};
  const taken = new Set();
  // greedy: assign the strongest (field, header) pairs first
  const candidates = [];
  for (const field of LOGICAL_FIELDS) {
    for (const h of headers) {
      candidates.push({ field, header: h, s: score(field, h, sample(rows, h)) });
    }
  }
  candidates.sort((a, b) => b.s - a.s);
  for (const c of candidates) {
    if (map[c.field] || taken.has(c.header) || c.s <= 0) continue;
    map[c.field] = c.header;
    taken.add(c.header);
  }
  for (const field of LOGICAL_FIELDS) if (!map[field]) map[field] = null;
  const missing = LOGICAL_FIELDS.filter((f) => !map[f]);
  return { map, missing };
}

// Turn raw rows into logical rows { date, start, end, hours, reason } using the
// map. Unmapped fields come back as empty strings.
export function applyMap(rows, map) {
  return rows.map((r) => {
    const out = {};
    for (const field of LOGICAL_FIELDS) {
      const header = map[field];
      out[field] = header ? (r[header] ?? "").toString().trim() : "";
    }
    return out;
  });
}
