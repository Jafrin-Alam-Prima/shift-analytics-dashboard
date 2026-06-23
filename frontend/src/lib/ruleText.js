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

// per-issue "how it's handled" explanations (shown in the Data quality table),
// keyed by the control key — plain language, no field names in caps
export const CLEANING_RULE_TEXT = {
  badDate: "We use the date from the row's start time instead.",
  missingTime: "Kept and counted, but left off the timeline.",
  negativeHours: "Recomputed from start–end where possible, otherwise left out of the totals.",
  hoursConflict: "We trust the start–end times (the recorded hours are only a backup).",
  duplicate: "We keep one copy and drop the extras.",
  reasonCase: "The label is trimmed and tidied.",
  crossMidnight: "Kept and flagged — it's valid, just unusual.",
};
