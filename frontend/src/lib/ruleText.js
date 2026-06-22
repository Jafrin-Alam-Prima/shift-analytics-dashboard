// One-line plain-language explanations of the app's rules, shown in the ℹ️
// tooltips. Kept in one place so the wording stays consistent everywhere.
export const RULE_TEXT = {
  efficiency:
    "Efficiency = (Productive ÷ Total) × 100. Productive = hours whose reason is not a failure (Breakdown, Unknown Failure by default).",
  streak:
    "A streak is consecutive calendar days that each have at least one failure shift (default: minimum 2 days, no gap).",
  severityBands:
    "Streak severity by total breakdown hours: below ‘medium’ = low; ‘medium’ up to ‘high’ = medium; ‘high’ and above = high.",
  severityTiers:
    "Each data issue maps to a fixed tier — missing start/end = critical; negative, hours-conflict, invalid date = warning; cross-midnight, reason tidy = info; duplicate = its own tier.",
};

// per-issue cleaning-strategy explanations, keyed by the control key
export const CLEANING_RULE_TEXT = {
  badDate: "Invalid dates fall back to the row's own start-timestamp date.",
  missingTime: "Rows missing a start/end are kept and counted, but left off the timeline.",
  negativeHours: "Negative hours are recomputed from start–end when possible, otherwise excluded.",
  hoursConflict: "When HOURS disagrees with start–end, start–end wins (HOURS is only a fallback).",
  duplicate: "Identical rows: keep one copy, drop the extras.",
  reasonCase: "Reason text is trimmed and inner spaces are collapsed.",
  crossMidnight: "Shifts that cross midnight are kept and flagged (valid, just unusual).",
};
