// Analysis engine (pure functions): the Efficiency Score, breakdown streaks,
// and the action-phrased insights. Everything reads the shared failure set and
// grouping from params, so the same numbers come out in local and backend mode.
import { DEFAULT_GROUPS, FALLBACK_GROUP } from "./config.js";
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
