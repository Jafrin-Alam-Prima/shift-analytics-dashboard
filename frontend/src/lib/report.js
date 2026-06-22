// Report metrics layer (pure functions). Everything here is computed from the
// cleaned logical records + params (failure set / grouping) + the report config
// (shift windows, target, severity bands). Nothing is hardcoded to a month or to
// raw column names. Mirrored in backend/api/analysis.py for local⇄backend parity.
import { ISSUE_SEVERITY } from "./config.js";

function usable(r) {
  return r.hours != null && r.hours >= 0 ? r.hours : 0;
}

// hour-of-day (UTC) of a record's start, or null if it has no valid start
function recHour(r) {
  if (!r.start) return null;
  const d = r.start instanceof Date ? r.start : new Date(r.start);
  if (isNaN(d.getTime())) return null;
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

// which shift window an hour falls in (night wraps past midnight)
export function slotOf(hour, windows) {
  if (hour == null) return null;
  for (const w of windows) {
    if (w.start < w.end) {
      if (hour >= w.start && hour < w.end) return w.key;
    } else if (hour >= w.start || hour < w.end) {
      return w.key;
    }
  }
  return null;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function dayNum(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
}
function keyFromDayNum(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

// streak total-hours -> severity band (documented rule, bands from config)
export function streakBand(hours, bands) {
  if (hours >= bands.high) return "high";
  if (hours >= bands.medium) return "medium";
  return "low";
}

// data-issue type -> severity tier (fixed documented rule)
export function issueSeverity(type) {
  return ISSUE_SEVERITY[type] || "info";
}

// The one entry point. Returns every report number, all derived from `records`.
export function reportMetrics(records, params, reportConfig, dataQuality) {
  const failure = params.failureReasons;
  const windows = reportConfig.shiftWindows;
  const target = reportConfig.target;
  const bands = reportConfig.severityBands;

  // real date range (no hardcoded month)
  const dayKeys = records.map((r) => r.dateKey).filter(Boolean).sort();
  const minKey = dayKeys[0] || null;
  const maxKey = dayKeys.length ? dayKeys[dayKeys.length - 1] : null;
  const days = minKey && maxKey ? dayNum(maxKey) - dayNum(minKey) + 1 : 0;

  // ---- shift slots (config windows) ----
  const slotMap = {};
  for (const w of windows) {
    slotMap[w.key] = { key: w.key, label: w.label, count: 0, hours: 0, durations: [], byReason: {} };
  }
  for (const r of records) {
    const k = slotOf(recHour(r), windows);
    if (!k || !slotMap[k]) continue;
    const s = slotMap[k];
    s.count += 1;
    const h = usable(r);
    s.hours += h;
    if (h > 0) s.durations.push(h);
    s.byReason[r.reason] = (s.byReason[r.reason] || 0) + h;
  }
  const shiftSlots = windows.map((w) => {
    const s = slotMap[w.key];
    return {
      key: s.key,
      label: s.label,
      count: s.count,
      hours: s.hours,
      avg: s.durations.length ? s.hours / s.durations.length : null,
      median: median(s.durations),
      byReason: s.byReason,
    };
  });

  // ---- weeks from the real min date ----
  const byWeek = [];
  if (minKey) {
    const weekOf = {};
    for (const r of records) {
      if (!r.dateKey) continue;
      const wi = Math.floor((dayNum(r.dateKey) - dayNum(minKey)) / 7);
      (weekOf[wi] || (weekOf[wi] = [])).push(r);
    }
    for (const wi of Object.keys(weekOf).map(Number).sort((a, b) => a - b)) {
      let total = 0;
      let prod = 0;
      let down = 0;
      for (const r of weekOf[wi]) {
        const h = usable(r);
        if (h <= 0) continue;
        total += h;
        if (failure.includes(r.reason)) down += h;
        else prod += h;
      }
      byWeek.push({
        index: wi,
        startKey: keyFromDayNum(dayNum(minKey) + wi * 7),
        endKey: keyFromDayNum(dayNum(minKey) + wi * 7 + 6),
        downtime: down,
        total,
        productive: prod,
        score: total > 0 ? (prod / total) * 100 : null,
      });
    }
  }
  let wow = null;
  if (byWeek.length >= 2) {
    const prev = byWeek[byWeek.length - 2];
    const last = byWeek[byWeek.length - 1];
    const delta = last.downtime - prev.downtime;
    wow = { prev, last, downtimeDelta: delta, downtimePctChange: prev.downtime > 0 ? (delta / prev.downtime) * 100 : null };
  }

  // ---- peak downtime day + worst efficiency day ----
  const downByDay = {};
  const dayRecs = {};
  for (const r of records) {
    if (!r.dateKey) continue;
    (dayRecs[r.dateKey] || (dayRecs[r.dateKey] = [])).push(r);
    if (failure.includes(r.reason)) downByDay[r.dateKey] = (downByDay[r.dateKey] || 0) + usable(r);
  }
  let peakDowntimeDay = null;
  for (const k of Object.keys(downByDay)) {
    if (downByDay[k] > 0 && (!peakDowntimeDay || downByDay[k] > peakDowntimeDay.hours)) {
      peakDowntimeDay = { dateKey: k, hours: downByDay[k] };
    }
  }
  let worstEfficiencyDay = null;
  for (const k of Object.keys(dayRecs)) {
    let t = 0;
    let p = 0;
    for (const r of dayRecs[k]) {
      const h = usable(r);
      if (h <= 0) continue;
      t += h;
      if (!failure.includes(r.reason)) p += h;
    }
    if (t <= 0) continue;
    const sc = (p / t) * 100;
    if (!worstEfficiencyDay || sc < worstEfficiencyDay.score) worstEfficiencyDay = { dateKey: k, score: sc };
  }

  // ---- each failure reason's contribution to the downtime bucket ----
  const reasonHours = {};
  for (const r of records) {
    if (failure.includes(r.reason)) reasonHours[r.reason] = (reasonHours[r.reason] || 0) + usable(r);
  }
  const downtimeTotal = Object.values(reasonHours).reduce((a, b) => a + b, 0);
  const reasonContribution = Object.keys(reasonHours)
    .filter((rn) => reasonHours[rn] > 0)
    .sort((a, b) => reasonHours[b] - reasonHours[a])
    .map((rn) => ({ reason: rn, hours: reasonHours[rn], pct: downtimeTotal > 0 ? (reasonHours[rn] / downtimeTotal) * 100 : 0 }));

  // ---- overall efficiency + target gap ----
  let T = 0;
  let P = 0;
  for (const r of records) {
    const h = usable(r);
    if (h <= 0) continue;
    T += h;
    if (!failure.includes(r.reason)) P += h;
  }
  const score = T > 0 ? (P / T) * 100 : null;
  const targetGap = score != null ? score - target : null;

  // ---- data-quality severity tiers ----
  const sev = { critical: 0, warning: 0, info: 0, duplicate: 0 };
  const issues = (dataQuality && dataQuality.issues) || [];
  for (const it of issues) {
    const tier = issueSeverity(it.type);
    sev[tier] = (sev[tier] || 0) + it.count;
  }

  return {
    dateRange: { min: minKey, max: maxKey, days },
    shiftSlots,
    byWeek,
    wow,
    peakDowntimeDay,
    worstEfficiencyDay,
    reasonContribution,
    downtimeTotal,
    target,
    score,
    targetGap,
    severity: { dataQuality: sev },
    bands,
  };
}
