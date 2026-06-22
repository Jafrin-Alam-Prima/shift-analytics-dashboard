// Suggestion-only similarity detection (X5). It only *suggests* — confirming a
// suggestion becomes one auditable X4 override. Nothing here changes data.

// Levenshtein edit distance (case-insensitive).
function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// normalized similarity 0..1 (1 = identical)
export function similarityRatio(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Find reason spellings that look like a more-common spelling (variant -> canonical).
// Suggestion-only: returns {variant, canonical, score, rows[]}.
export function reasonSuggestions(logical, threshold) {
  const counts = {};
  logical.forEach((row) => {
    const r = (row.reason || "").trim();
    if (r) counts[r] = (counts[r] || 0) + 1;
  });
  const reasons = Object.keys(counts);
  const out = [];
  for (const v of reasons) {
    let best = null;
    for (const c of reasons) {
      if (c === v) continue;
      const score = similarityRatio(v.toLowerCase(), c.toLowerCase());
      if (score >= threshold && score < 1) {
        // canonical = the more frequent spelling (ties broken alphabetically)
        const moreCanonical = counts[c] > counts[v] || (counts[c] === counts[v] && c < v);
        if (moreCanonical && (!best || score > best.score)) best = { canonical: c, score };
      }
    }
    if (best) {
      const rows = [];
      logical.forEach((row, i) => {
        if ((row.reason || "").trim() === v) rows.push(i);
      });
      out.push({ variant: v, canonical: best.canonical, score: best.score, rows });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// Find near-duplicate rows: same day + reason, start times within tolerance, but
// NOT exact duplicates (those are handled by the cleaning dedup). Suggestion-only.
export function nearDuplicateSuggestions(records, toleranceMinutes) {
  const byKey = {};
  for (const r of records) {
    if (!r.dateKey || !r.start) continue;
    const k = `${r.dateKey}|${r.reason}`;
    (byKey[k] || (byKey[k] = [])).push(r);
  }
  const out = [];
  for (const k of Object.keys(byKey)) {
    const arr = byKey[k].slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1];
      const b = arr[i];
      const mins = Math.abs(b.start - a.start) / 60000;
      if (mins > toleranceMinutes) continue;
      const exact = mins === 0 && a.hours === b.hours;
      if (exact) continue; // exact dupes are already removed by cleaning
      out.push({
        row: b.i,
        ofRow: a.i,
        dateKey: b.dateKey,
        reason: b.reason,
        minutesApart: Math.round(mins),
        score: toleranceMinutes > 0 ? 1 - mins / toleranceMinutes : 0,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
