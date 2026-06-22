// Talks to the Django API. Used only in backend/auto mode; local mode never
// touches this. The base URL can be overridden with VITE_BACKEND_URL.
export const BACKEND_URL =
  (import.meta.env && import.meta.env.VITE_BACKEND_URL) || "http://127.0.0.1:8000/api";

// quick liveness check; resolves true/false, never throws
export async function pingHealth(timeoutMs = 3000) {
  try {
    const res = await fetch(`${BACKEND_URL}/health/`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

// recompute everything on the backend; throws on failure so the caller can fall back
export async function fetchAnalyze(body, timeoutMs = 6000) {
  const res = await fetch(`${BACKEND_URL}/analyze/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

// ---- saved reports (need the backend) ----
export async function listReports() {
  const res = await fetch(`${BACKEND_URL}/reports/`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function saveReport(body) {
  const res = await fetch(`${BACKEND_URL}/reports/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function getReport(id) {
  const res = await fetch(`${BACKEND_URL}/reports/${id}/`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function deleteReport(id) {
  const res = await fetch(`${BACKEND_URL}/reports/${id}/`, {
    method: "DELETE",
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

// backend records carry start/end as ISO strings; the charts expect Date objects
export function hydrateRecords(records) {
  return (records || []).map((r) => ({
    ...r,
    start: typeof r.start === "string" ? new Date(r.start) : r.start,
    end: typeof r.end === "string" ? new Date(r.end) : r.end,
  }));
}
