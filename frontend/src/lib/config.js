// One shared config. The reasons themselves are always read from the data;
// what lives here are the defaults the analysis uses (failure set, grouping,
// streak knobs, cleaning choices) and the hints for guessing columns.
//
// Important: these are *defaults*. Every one of them can be changed from the
// Settings tab, and the same values are sent to the backend so both modes agree.

// The five logical fields every part of the app reads (never raw headers).
export const LOGICAL_FIELDS = ["date", "start", "end", "hours", "reason"];

// Name hints used to auto-guess which CSV column is which logical field.
export const HEADER_HINTS = {
  date: /\b(day[_ ]?date|date|day)\b/i,
  start: /\b(start|begin|from|clock[_ ]?in)\b/i,
  end: /\b(end|finish|stop|to|clock[_ ]?out)\b/i,
  hours: /\b(hours?|hrs|duration|dur|length)\b/i,
  reason: /\b(reason|cause|category|type|label|tag)\b/i,
};

// The failure set is read by BOTH the efficiency score and the streak finder.
export const DEFAULT_FAILURE_REASONS = ["Breakdown", "Unknown Failure"];

// Grouping is for charts/filters only — it does NOT change the score.
// Any reason not listed here falls into "Other" automatically.
export const DEFAULT_GROUPS = {
  "Unplanned downtime": ["Breakdown", "Unknown Failure", "Machine Jam", "Power Failure"],
  "Planned work": ["Maintenance", "Cleaning", "Setup", "Quality Check", "Training"],
  "Waiting / idle": ["Idle", "Material Shortage"],
  Other: ["Other"],
};
export const FALLBACK_GROUP = "Other";

// Streak knobs: a streak is consecutive days that each have >=1 failure shift.
// Other methods (window, shift) use windowHours / minStreakShifts.
export const DEFAULT_STREAK = {
  method: "consecutive", // consecutive | window | shift
  minStreakDays: 2,
  maxGapDays: 0,
  windowHours: 12,
  minStreakShifts: 2,
};

export const STREAK_METHODS = [
  { value: "consecutive", label: "Consecutive days" },
  { value: "window", label: "Time window" },
  { value: "shift", label: "Consecutive shifts" },
];

// Default handling chosen for each kind of data issue. These reproduce the
// official cleaned numbers without anyone touching a control.
export const DEFAULT_CLEANING = {
  badDate: "useStartDate", // fall back to the START timestamp's date
  missingTime: "keepExcludeTimeline", // keep the row, leave it off the timeline
  negativeHours: "recomputeOrExclude", // recompute from start/end, else drop the row
  hoursConflict: "recompute", // trust start/end over the HOURS column
  duplicate: "dropExtra", // keep one copy, drop the rest
  reasonCase: "normalize", // trim + tidy the reason text
  crossMidnight: "keepFlag", // keep it, just flag it
};

// The choices offered for each issue in the Data-quality panel. The first
// option in each list is the default (and reproduces the official numbers).
export const CLEANING_OPTIONS = {
  badDate: {
    label: "Invalid date",
    options: [
      { value: "useStartDate", label: "Use the row's start date" },
      { value: "drop", label: "Drop the row" },
    ],
  },
  missingTime: {
    label: "Missing start/end",
    options: [
      { value: "keepExcludeTimeline", label: "Keep, but leave off the timeline" },
      { value: "drop", label: "Drop the row" },
    ],
  },
  negativeHours: {
    label: "Negative hours",
    options: [
      { value: "recomputeOrExclude", label: "Recompute from start–end, else exclude" },
      { value: "exclude", label: "Exclude from totals" },
    ],
  },
  hoursConflict: {
    label: "Hours ≠ start–end",
    options: [
      { value: "recompute", label: "Trust start–end (recompute)" },
      { value: "keepHours", label: "Keep the HOURS value" },
    ],
  },
  duplicate: {
    label: "Duplicate rows",
    options: [
      { value: "dropExtra", label: "Keep one, drop the extras" },
      { value: "keepAll", label: "Keep all copies" },
    ],
  },
  reasonCase: {
    label: "Reason text",
    options: [
      { value: "normalize", label: "Trim & tidy" },
      { value: "keepAsIs", label: "Keep as-is" },
    ],
  },
  crossMidnight: {
    label: "Cross-midnight shift",
    options: [
      { value: "keepFlag", label: "Keep & flag" },
      { value: "drop", label: "Drop the row" },
    ],
  },
};

// ---- Report config (defaults; editable in Settings → Report) ----------------
// Shift windows are [start, end) in whole hours of the day (UTC). "night" wraps
// past midnight. These are config, not magic numbers — change them and every
// shift metric re-buckets.
export const DEFAULT_SHIFT_WINDOWS = [
  { key: "morning", label: "Morning", start: 6, end: 14 },
  { key: "afternoon", label: "Afternoon", start: 14, end: 22 },
  { key: "night", label: "Night", start: 22, end: 6 },
];

// The efficiency target the report compares against (%).
export const DEFAULT_EFFICIENCY_TARGET = 90;

// Streak severity bands by total breakdown hours: < medium = low,
// medium..< high = medium, >= high = high. Documented rule, editable.
export const DEFAULT_SEVERITY_BANDS = { medium: 6, high: 12 };

// Fixed, documented mapping of data-issue types to a severity tier (a rule, not
// an opinion). Used for the data-quality severity bar and the anomaly report.
export const ISSUE_SEVERITY = {
  missingStart: "critical",
  missingEnd: "critical",
  negativeHours: "warning",
  hoursConflict: "warning",
  badDate: "warning",
  crossMidnight: "info",
  reasonCase: "info",
  duplicate: "duplicate",
};

// Defaults for the suggestion-only similarity detector (X5). Editable in its panel.
export const DEFAULT_SIMILARITY = { reasonThreshold: 0.8, nearDupMinutes: 60 };

export function defaultReportConfig() {
  return {
    shiftWindows: DEFAULT_SHIFT_WINDOWS.map((w) => ({ ...w })),
    target: DEFAULT_EFFICIENCY_TARGET,
    severityBands: { ...DEFAULT_SEVERITY_BANDS },
  };
}

// Build a fresh copy of the default parameters (so callers can mutate safely).
export function defaultParams() {
  return {
    failureReasons: [...DEFAULT_FAILURE_REASONS],
    groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
    streak: { ...DEFAULT_STREAK },
    cleaning: { ...DEFAULT_CLEANING },
    report: defaultReportConfig(),
  };
}
