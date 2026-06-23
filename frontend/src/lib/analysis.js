// Analysis engine (pure functions): the Efficiency Score, breakdown streaks,
// and the action-phrased insights. Everything reads the shared failure set and
// grouping from params, so the same numbers come out in local and backend mode.
import { DEFAULT_GROUPS, FALLBACK_GROUP, DEFAULT_FAILURE_REASONS } from "./config.js";
import { num, pct, hrs, shortDate } from "./format.js";

// which group a reason belongs to (anything unlisted -> "Other")
export function groupOf(reason, groups = DEFAULT_GROUPS) {
  for (const name of Object.keys(groups)) {
    if (groups[name].includes(reason)) return name;
  }
  return FALLBACK_GROUP;
}

// usable hours for a record (cleaning already set this; guard nulls/negatives)
function usable(r) {
  return r.hours != null && r.hours >= 0 ? r.hours : 0;
}

// ---- Efficiency Score (official, literal): (Productive / Total) * 100 -------
// Productive = hours whose reason is NOT a failure. Total = all usable hours.
// Total = 0 -> score is null (shown as "—", never a divide-by-zero error).
export function efficiency(records, failureReasons) {
  let productive = 0;
  let total = 0;
  for (const r of records) {
    const h = usable(r);
    if (h === 0) continue;
    total += h;
    if (!failureReasons.includes(r.reason)) productive += h;
  }
  return { score: total > 0 ? (productive / total) * 100 : null, productive, total };
}

// total hours per reason (used by charts + insights)
export function hoursByReason(records) {
  const map = {};
  for (const r of records) map[r.reason] = (map[r.reason] || 0) + usable(r);
  return map;
}

// total logged hours for EVERY reason, sorted high→low with each reason's share
// of the total. Display-side and additive (like downtimeByWeekday/downtimeByDate)
// — reuses hoursByReason, touches no official metric, and is not part of the
// /analyze contract, so local⇄backend parity is unaffected.
export function hoursByReasonSorted(records) {
  const map = hoursByReason(records);
  const entries = Object.entries(map).filter(([, h]) => h > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, h]) => s + h, 0);
  return entries.map(([reason, hours]) => ({ reason, hours, pct: total > 0 ? (hours / total) * 100 : 0 }));
}

// total hours per group (uses the configured grouping)
export function hoursByGroup(records, groups) {
  const map = {};
  for (const r of records) {
    const g = groupOf(r.reason, groups);
    map[g] = (map[g] || 0) + usable(r);
  }
  return map;
}

// efficiency for each day (null on days with no usable hours)
export function efficiencyByDay(records, failureReasons) {
  const byDay = {};
  for (const r of records) {
    if (!r.dateKey) continue;
    (byDay[r.dateKey] || (byDay[r.dateKey] = [])).push(r);
  }
  return Object.keys(byDay)
    .sort()
    .map((k) => ({ dateKey: k, score: efficiency(byDay[k], failureReasons).score }));
}

// total hours per day key
export function hoursByDay(records) {
  const map = {};
  for (const r of records) {
    if (!r.dateKey) continue;
    map[r.dateKey] = (map[r.dateKey] || 0) + usable(r);
  }
  return map;
}

// days -> day number (for consecutive-day maths)
function dayNumber(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
}

// ---- breakdown streaks -----------------------------------------------------
// A streak = calendar days that each have >= 1 failure shift, within max_gap_days
// of each other, lasting at least min_streak_days. Three methods are available;
// "consecutive" is the default and the official one.
export function findStreaks(records, failureReasons, streak) {
  const method = (streak && streak.method) || "consecutive";
  if (method === "window") return windowStreaks(records, failureReasons, streak);
  if (method === "shift") return shiftStreaks(records, failureReasons, streak);
  return consecutiveStreaks(records, failureReasons, streak);
}

// 1) consecutive-day: calendar days that each have >= 1 failure shift.
function consecutiveStreaks(records, failureReasons, streak) {
  const { minStreakDays = 2, maxGapDays = 0 } = streak || {};

  // collect per-day failure stats
  const days = {};
  for (const r of records) {
    if (!r.dateKey) continue;
    if (!failureReasons.includes(r.reason)) continue;
    if (!days[r.dateKey]) days[r.dateKey] = { hours: 0, count: 0 };
    days[r.dateKey].hours += usable(r);
    days[r.dateKey].count += 1;
  }

  const keys = Object.keys(days).sort();
  const streaks = [];
  let run = [];
  for (const k of keys) {
    if (run.length === 0) {
      run = [k];
    } else {
      const gap = dayNumber(k) - dayNumber(run[run.length - 1]);
      if (gap <= maxGapDays + 1) run.push(k);
      else {
        pushStreak(streaks, run, days, minStreakDays);
        run = [k];
      }
    }
  }
  pushStreak(streaks, run, days, minStreakDays);
  return streaks;
}

function pushStreak(out, run, days, minStreakDays) {
  if (run.length < minStreakDays) return;
  const start = run[0];
  const end = run[run.length - 1];
  const lengthDays = dayNumber(end) - dayNumber(start) + 1;
  let hours = 0;
  let count = 0;
  for (const k of run) {
    hours += days[k].hours;
    count += days[k].count;
  }
  out.push({ start, end, lengthDays, hours, count });
}

// summarise a run of failure shift-records into a streak object
function summariseRun(run) {
  const keys = run.map((r) => r.dateKey).filter(Boolean).sort();
  const start = keys[0];
  const end = keys[keys.length - 1];
  return {
    start,
    end,
    lengthDays: start && end ? dayNumber(end) - dayNumber(start) + 1 : run.length,
    hours: run.reduce((s, r) => s + usable(r), 0),
    count: run.length,
  };
}

// 2) time-window: failure shifts whose start times are within `windowHours` of
//    the previous one form a burst (regardless of calendar boundaries).
function windowStreaks(records, failureReasons, streak) {
  const { windowHours = 12, minStreakShifts = 2 } = streak || {};
  const fails = records
    .filter((r) => failureReasons.includes(r.reason) && r.start)
    .sort((a, b) => a.start - b.start);
  const out = [];
  let run = [];
  for (const r of fails) {
    if (run.length === 0) {
      run = [r];
    } else {
      const gap = (r.start - run[run.length - 1].start) / 3600000;
      if (gap <= windowHours) run.push(r);
      else {
        if (run.length >= minStreakShifts) out.push(summariseRun(run));
        run = [r];
      }
    }
  }
  if (run.length >= minStreakShifts) out.push(summariseRun(run));
  return out;
}

// 3) shift-based: runs of consecutive failure shifts in the overall shift
//    sequence (no non-failure shift in between), regardless of dates.
function shiftStreaks(records, failureReasons, streak) {
  const { minStreakShifts = 2 } = streak || {};
  const all = records.filter((r) => r.start).sort((a, b) => a.start - b.start);
  const out = [];
  let run = [];
  for (const r of all) {
    if (failureReasons.includes(r.reason)) {
      run.push(r);
    } else {
      if (run.length >= minStreakShifts) out.push(summariseRun(run));
      run = [];
    }
  }
  if (run.length >= minStreakShifts) out.push(summariseRun(run));
  return out;
}

// ---- insights (>= 3, computed, phrased as actions, no hardcoded numbers) ----
export function buildInsights(records, failureReasons, groups, streaks) {
  const out = [];
  const byReason = hoursByReason(records);
  const byDay = hoursByDay(records);

  // downtime = hours of failure reasons
  const downtime = failureReasons.reduce((s, r) => s + (byReason[r] || 0), 0);

  // 1) the reason losing the most hours
  if (downtime > 0) {
    let top = null;
    for (const r of failureReasons) {
      if ((byReason[r] || 0) > 0 && (!top || byReason[r] > byReason[top])) top = r;
    }
    if (top) {
      const share = (byReason[top] / downtime) * 100;
      out.push(
        `${top} causes the most lost hours (${hrs(byReason[top])}, ${pct(share)} of downtime) — prioritise fixing ${top}.`
      );
    }
  }

  // 2) the day downtime peaked
  const downByDay = {};
  for (const r of records) {
    if (r.dateKey && failureReasons.includes(r.reason)) {
      downByDay[r.dateKey] = (downByDay[r.dateKey] || 0) + usable(r);
    }
  }
  const peakDay = Object.keys(downByDay).sort((a, b) => downByDay[b] - downByDay[a])[0];
  if (peakDay) {
    out.push(
      `Downtime peaked on ${shortDate(peakDay)} (${hrs(downByDay[peakDay])}) — investigate what happened that day.`
    );
  }

  // 3) recurring breakdowns across a streak
  if (streaks && streaks.length > 0) {
    const s = streaks[0];
    out.push(
      `Breakdowns recurred ${shortDate(s.start)}–${shortDate(s.end)} (${s.count} shifts, ${hrs(s.hours)}) — look for a shared root cause across those days.`
    );
  }

  // 4) the biggest efficiency lever (also a useful >=3 fallback)
  const eff = efficiency(records, failureReasons);
  if (eff.score != null) {
    let topReason = null;
    for (const r of failureReasons) {
      if ((byReason[r] || 0) > 0 && (!topReason || byReason[r] > byReason[topReason])) topReason = r;
    }
    if (topReason) {
      out.push(
        `Overall efficiency is ${pct(eff.score)}; the biggest lever is reducing ${topReason} hours.`
      );
    } else {
      out.push(`Overall efficiency is ${pct(eff.score)} with no failure hours recorded — keep it up.`);
    }
  }

  // make sure we always return at least three
  if (out.length < 3) {
    const busiest = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
    if (busiest) out.push(`The busiest day was ${shortDate(busiest)} (${hrs(byDay[busiest])} logged).`);
  }
  if (out.length < 3) out.push(`Tracking ${records.length} shift records across ${Object.keys(byDay).length} days.`);

  return out;
}

// one call that returns everything the dashboard shows
export function analyse(records, params) {
  const eff = efficiency(records, params.failureReasons);
  const streaks = findStreaks(records, params.failureReasons, params.streak);
  const insights = buildInsights(records, params.failureReasons, params.groups, streaks);
  return { efficiency: eff, streaks, insights };
}

// ---- day-of-week downtime pattern (display-side aggregation) ----------------
// Average downtime hours per weekday (Mon–Sun) over the given records. Each
// weekday's average is its total failure-reason downtime divided by how many
// distinct dates of that weekday actually appear in the data (its real
// occurrence count), so it adapts to any uploaded data + date range. Pure and
// additive: changes no official metric and isn't part of the /analyze contract.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekdayIndex(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (d.getUTCDay() + 6) % 7; // 0 = Mon … 6 = Sun
}

export function downtimeByWeekday(records, failureReasons) {
  const totals = WEEKDAYS.map(() => 0);
  const dateSets = WEEKDAYS.map(() => new Set());
  for (const r of records) {
    if (!r.dateKey) continue;
    const wd = weekdayIndex(r.dateKey);
    if (wd == null) continue;
    dateSets[wd].add(r.dateKey);
    if (failureReasons.includes(r.reason)) totals[wd] += usable(r);
  }
  const weekdays = WEEKDAYS.map((label, i) => {
    const days = dateSets[i].size;
    const totalDowntime = totals[i];
    return { weekday: label, index: i, days, totalDowntime, avgDowntime: days > 0 ? totalDowntime / days : null };
  });
  const totalDown = totals.reduce((a, b) => a + b, 0);
  const totalDays = dateSets.reduce((a, s) => a + s.size, 0);
  const overallAvg = totalDays > 0 ? totalDown / totalDays : null;
  let worst = null;
  for (const w of weekdays) {
    if (w.avgDowntime != null && w.avgDowntime > 0 && (worst == null || w.avgDowntime > worst.avgDowntime)) worst = w;
  }
  return { weekdays, overallAvg, worst };
}

// per-date failure-hours + incident count (display-side; powers the streak
// calendar). Pure and additive — no official metric, not in the /analyze contract.
export function downtimeByDate(records, failureReasons) {
  const map = {};
  for (const r of records) {
    if (!r.dateKey || !failureReasons.includes(r.reason)) continue;
    if (!map[r.dateKey]) map[r.dateKey] = { hours: 0, count: 0 };
    map[r.dateKey].hours += usable(r);
    map[r.dateKey].count += 1;
  }
  return map;
}

// ---- manager decision cards (rich insights for the Insights view) -----------
// Builds up to five plant-manager "decision cards" from outputs that are already
// computed elsewhere (report metrics, streaks, the official efficiency split,
// data-quality counts) — this changes no analysis math and isn't part of the
// /analyze contract, so local⇄backend parity is untouched. Every figure is read
// live (nothing hardcoded); the target comes from config via `target`. Findings
// state facts; causal/operational claims are phrased as hypotheses to verify,
// never asserted, and no field the dataset lacks is ever referenced.
export function decisionCards(ctx) {
  const {
    records = [],
    report,
    streaks = [],
    officialEfficiency,
    target,
    severityBands,
  } = ctx || {};
  if (!report) return [];

  const cards = [];
  // the official score is pinned to the default failure set, so name those here —
  // keep the real reason names, just frame them as the failure categories
  const failureList = DEFAULT_FAILURE_REASONS.length
    ? `failure categories (${DEFAULT_FAILURE_REASONS.join(", ")})`
    : "failure categories";

  // 1) largest downtime driver — top reason by hours, its share + incident count
  const top = report.reasonContribution && report.reasonContribution[0];
  if (top && top.hours > 0) {
    const incidents = records.filter((r) => r.reason === top.reason).length;
    const severity = top.pct >= 50 ? "critical" : top.pct >= 25 ? "warning" : "info";
    cards.push({
      key: "driver",
      severity,
      title: `${top.reason} is the largest downtime driver`,
      evidence: `${top.reason} accounts for ${hrs(top.hours)} of downtime — ${pct(top.pct)} of the ${hrs(report.downtimeTotal)} lost in this period${incidents ? `, across ${incidents} incident${incidents === 1 ? "" : "s"}` : ""}. It is the single biggest contributor among the tracked failure categories.`,
      action: `→ Prioritise ${top.reason}: it is the largest recoverable lever. Target: halving its ${hrs(top.hours)} would return about ${hrs(top.hours / 2)} of capacity.`,
    });
  }

  // 2) efficiency gap vs the configured target + the arithmetic lever
  if (officialEfficiency && officialEfficiency.score != null && target != null) {
    const off = officialEfficiency;
    const gap = off.score - target;
    const failureHours = Math.max(0, off.total - off.productive);
    const severity = gap >= 0 ? "good" : gap >= -5 ? "warning" : "critical";
    let evidence = `Official efficiency is ${pct(off.score)} against the configured ${num(target, 0)}% target — ${gap >= 0 ? `${num(gap)} pts above` : `${num(-gap)} pts below`}. `;
    let action;
    if (failureHours > 0 && off.total - failureHours / 2 > 0) {
      const projected = (off.productive / (off.total - failureHours / 2)) * 100;
      evidence += `${failureList} account for ${hrs(failureHours)} of the ${hrs(off.total)} logged. As arithmetic: avoiding half of that downtime would lift efficiency to about ${pct(projected)}.`;
      action = `→ ${gap >= 0 ? "Hold the margin by keeping" : "Close the gap by cutting"} downtime in the ${failureList}. Target: ~${pct(projected)} efficiency by halving those losses.`;
    } else {
      evidence += `No failure-category downtime was recorded, so there is no efficiency loss to recover here.`;
      action = `→ Maintain current practice — efficiency is at or above target with no recorded failure downtime.`;
    }
    cards.push({
      key: "efficiency",
      severity,
      title:
        gap >= 0
          ? `Efficiency is ${num(gap)} pts above the ${num(target, 0)}% target`
          : `Efficiency is ${num(-gap)} pts below the ${num(target, 0)}% target`,
      evidence,
      action,
    });
  }

  // 3) the real breakdown streak — dates + total streak hours, banded by config
  if (streaks.length > 0) {
    const s = streaks[0];
    const high = severityBands && severityBands.high;
    const medium = severityBands && severityBands.medium;
    const band = high != null && s.hours >= high ? "high" : medium != null && s.hours >= medium ? "medium" : "low";
    const severity = band === "high" ? "critical" : band === "medium" ? "warning" : "info";
    const more = streaks.length > 1 ? ` It was one of ${streaks.length} such clusters in the period.` : "";
    cards.push({
      key: "streak",
      severity,
      title: `Breakdowns clustered over ${s.lengthDays} consecutive day${s.lengthDays === 1 ? "" : "s"}`,
      evidence: `Failures fell on ${s.lengthDays} consecutive day(s), ${shortDate(s.start)}–${shortDate(s.end)}, totalling ${hrs(s.hours)} across ${s.count} shift${s.count === 1 ? "" : "s"} — a ${band}-severity streak.${more}`,
      action: `→ Review the ${shortDate(s.start)}–${shortDate(s.end)} shifts side by side. The clustering is a pattern that suggests a recurring condition worth investigating before it repeats.`,
    });
  }

  // 4) worst day by downtime, with week-over-week context
  const pk = report.peakDowntimeDay;
  if (pk && pk.hours > 0) {
    let wowText = "";
    if (report.wow) {
      const w = report.wow;
      const dir = w.downtimeDelta <= 0 ? "fell" : "rose";
      wowText = ` Week over week, downtime ${dir} by ${hrs(Math.abs(w.downtimeDelta))}${w.downtimePctChange == null ? "" : ` (${num(Math.abs(w.downtimePctChange))}%)`}.`;
    }
    cards.push({
      key: "worstday",
      severity: "warning",
      title: `${shortDate(pk.dateKey)} was the worst day for downtime`,
      evidence: `The highest single-day downtime was ${hrs(pk.hours)} on ${shortDate(pk.dateKey)}.${wowText}`,
      action: `→ Compare the ${shortDate(pk.dateKey)} shift logs against a normal day. A concentration like this is worth a closer look to tell a one-off from a recurring issue.`,
    });
  }

  // 5) shift concentration — which configured window carries the most activity
  const slots = report.shiftSlots || [];
  const busiest = slots.filter((s) => s.count > 0).sort((a, b) => b.count - a.count)[0];
  if (busiest) {
    const lower = busiest.label.toLowerCase();
    cards.push({
      key: "shift",
      severity: "info",
      title: `Activity concentrates in the ${lower} shift`,
      evidence: `The ${lower} window logged the most records (${num(busiest.count, 0)}) and ${hrs(busiest.hours)} of time — more than any other shift in this period.`,
      action: `→ ${busiest.label} is where work, and any issues, concentrate. If shift resourcing or maintenance windows are adjustable, that's the window to watch — worth confirming the timing is expected.`,
    });
  }

  return cards.slice(0, 5);
}

// ---- cleaning impact (credibility note for the Data Quality page) -----------
// Which category's hours the cleaning corrected most (raw vs cleaned), so the
// methodology page can show that handling the flagged rows kept the numbers
// honest. Display-side, reason text normalised so casing/spacing doesn't split a
// category. Returns null when cleaning didn't reduce any category's hours.
export function cleaningImpact(rawRecords, cleanRecords) {
  const norm = (s) => String(s == null ? "" : s).trim().replace(/\s+/g, " ");
  const rawBy = {};
  const cleanBy = {};
  for (const r of rawRecords) {
    const k = norm(r.reason);
    rawBy[k] = (rawBy[k] || 0) + usable(r);
  }
  for (const r of cleanRecords) {
    const k = norm(r.reason);
    cleanBy[k] = (cleanBy[k] || 0) + usable(r);
  }
  let worst = null;
  for (const reason of Object.keys(rawBy)) {
    const rawH = rawBy[reason] || 0;
    const cleanH = cleanBy[reason] || 0;
    const delta = rawH - cleanH;
    if (delta > 0.05 && (worst == null || delta > worst.delta)) {
      worst = { reason, rawH, cleanH, delta, overstatePct: cleanH > 0 ? (delta / cleanH) * 100 : null };
    }
  }
  return worst;
}
