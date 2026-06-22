// Display helpers. Rule for the whole app: never show a raw float — round here.
// A null/undefined value shows as an em dash, not "NaN" or an error.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function num(n, dp = 1) {
  if (n == null || isNaN(n)) return "—";
  return Number(n.toFixed(dp)).toString();
}

export function pct(n, dp = 1) {
  if (n == null || isNaN(n)) return "—";
  return `${num(n, dp)}%`;
}

export function hrs(n, dp = 1) {
  if (n == null || isNaN(n)) return "—";
  return `${num(n, dp)} h`;
}

export function int(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toString();
}

// "2025-10-08" -> "Oct 8"
export function shortDate(dateKey) {
  if (!dateKey) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return dateKey;
  return `${MONTHS[+m[2] - 1]} ${+m[3]}`;
}
