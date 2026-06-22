import { check } from "./harness.mjs";
import { toTimelinePoints, timeOfDay, hourLabel } from "../src/lib/timeline.js";
import { reasonColorMap, groupColorMap } from "../src/lib/colors.js";
import { defaultParams } from "../src/lib/config.js";

function rec(dateKey, startISO, endISO, reason) {
  return {
    dateKey,
    reason,
    start: new Date(startISO),
    end: new Date(endISO),
    inTimeline: true,
  };
}

export function run() {
  const p = defaultParams();
  const opts = {
    colorBy: "reason",
    reasonColors: reasonColorMap(["Breakdown", "Cleaning", "Quality Check"]),
    groupColors: groupColorMap(Object.keys(p.groups)),
    groups: p.groups,
    merge: false,
  };

  // a normal morning shift
  const normal = toTimelinePoints([rec("2025-10-08", "2025-10-08T08:00:00Z", "2025-10-08T10:30:00Z", "Cleaning")], opts);
  check("normal shift y = [8, 10.5]", normal[0].y[0] === 8 && normal[0].y[1] === 10.5, `(got ${normal[0].y})`);

  // an overnight shift continues past 24h instead of wrapping
  const overnight = toTimelinePoints([rec("2025-10-04", "2025-10-04T07:30:00Z", "2025-10-05T08:00:00Z", "Quality Check")], opts);
  check("overnight shift starts at 7.5", overnight[0].y[0] === 7.5, `(got ${overnight[0].y[0]})`);
  check("overnight shift ends at 32 (8 + 24)", overnight[0].y[1] === 32, `(got ${overnight[0].y[1]})`);

  // up to 6 shifts on one day -> 6 separate bars, same date column
  const day = "2025-10-08";
  const many = toTimelinePoints(
    Array.from({ length: 6 }, (_, i) =>
      rec(day, `2025-10-08T0${i + 1}:00:00Z`, `2025-10-08T0${i + 1}:30:00Z`, "Cleaning")
    ),
    opts
  );
  check("6 shifts/day -> 6 bars", many.length === 6, `(got ${many.length})`);

  // merge mode collapses a day's shifts into one bar
  const merged = toTimelinePoints(
    [
      rec(day, "2025-10-08T08:00:00Z", "2025-10-08T10:00:00Z", "Cleaning"),
      rec(day, "2025-10-08T14:00:00Z", "2025-10-08T16:00:00Z", "Setup"),
    ],
    { ...opts, merge: true }
  );
  check("merge -> one bar for the day", merged.length === 1, `(got ${merged.length})`);
  check("merge spans 8 -> 16", merged[0].y[0] === 8 && merged[0].y[1] === 16, `(got ${merged[0].y})`);

  // empty input -> no points (graceful empty state)
  check("empty input -> no points", toTimelinePoints([], opts).length === 0);

  // helpers
  check("timeOfDay 07:30 = 7.5", timeOfDay(new Date("2025-10-08T07:30:00Z")) === 7.5);
  check("hourLabel(30) = 06:00 +1d", hourLabel(30) === "06:00 +1d", `(got ${hourLabel(30)})`);
}
