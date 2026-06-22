// Streaks upgrade: a severity card per streak (band from the config rule) and a
// calendar heat strip spanning the dataset's real date range, shaded by each
// day's downtime hours, with streak days outlined.
import { streakBand } from "../../lib/report.js";
import { STREAK_METHODS } from "../../lib/config.js";
import { hrs, shortDate } from "../../lib/format.js";
import { RULE_TEXT } from "../../lib/ruleText.js";
import InfoTip from "../InfoTip.jsx";

const BAND_CLASS = { low: "band-low", medium: "band-medium", high: "band-high" };

function dn(key) {
  return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000;
}
function keyAt(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

export default function StreaksSection({ dash }) {
  const { view, params } = dash;
  const streaks = view.streaks;
  const bands = params.report.severityBands;
  const range = view.report.dateRange;

  // plain-language "Method & assumptions", read straight from config (dynamic)
  const streak = params.streak;
  const methodLabel = (STREAK_METHODS.find((m) => m.value === streak.method) || {}).label || streak.method;
  let methodText;
  if (streak.method === "window") {
    methodText = `failure shifts that fall within a ${streak.windowHours}-hour window of each other (at least ${streak.minStreakShifts} shift${streak.minStreakShifts === 1 ? "" : "s"})`;
  } else if (streak.method === "shift") {
    methodText = `back-to-back failure shifts (at least ${streak.minStreakShifts} in a row)`;
  } else {
    methodText = `consecutive calendar days that each have at least one failure shift (minimum ${streak.minStreakDays} day${streak.minStreakDays === 1 ? "" : "s"}, gaps up to ${streak.maxGapDays} day${streak.maxGapDays === 1 ? "" : "s"})`;
  }
  const failureList = params.failureReasons.join(", ");

  // per-day downtime (failure hours) from the same filtered records
  const downByDay = {};
  for (const r of view.filtered) {
    if (r.dateKey && params.failureReasons.includes(r.reason)) {
      downByDay[r.dateKey] = (downByDay[r.dateKey] || 0) + (r.hours > 0 ? r.hours : 0);
    }
  }
  const maxDown = Math.max(1, ...Object.values(downByDay));

  // days covered by any streak (start..end inclusive)
  const streakDays = new Set();
  for (const s of streaks) {
    if (!s.start || !s.end) continue;
    for (let d = dn(s.start); d <= dn(s.end); d++) streakDays.add(keyAt(d));
  }

  // every calendar day in the real range
  const days = [];
  if (range.min && range.max) {
    for (let d = dn(range.min); d <= dn(range.max); d++) days.push(keyAt(d));
  }

  return (
    <section className="card report-section">
      <h2>
        Breakdown streaks <InfoTip text={RULE_TEXT.streak} label="What counts as a streak" />
        <InfoTip text={RULE_TEXT.severityBands} label="How streak severity is banded" />
      </h2>

      <div className="method-card">
        <h4>Method &amp; assumptions</h4>
        <ul className="method-list">
          <li>
            A <strong>failure</strong> is any shift whose reason is in: {failureList || "—"}.
          </li>
          <li>
            Method — <strong>{methodLabel}</strong>: a streak is {methodText}.
          </li>
          <li>
            Severity by total breakdown hours: <strong>low</strong> below {hrs(bands.medium)}, <strong>medium</strong>{" "}
            {hrs(bands.medium)}–{hrs(bands.high)}, <strong>high</strong> at {hrs(bands.high)} and above.
          </li>
          <li className="muted">Read from Settings → Analysis settings — change a value and streaks recompute.</li>
        </ul>
      </div>

      {streaks.length === 0 ? (
        <p className="muted">No breakdown streaks with the current settings.</p>
      ) : (
        <div className="streak-cards">
          {streaks.map((s, i) => {
            const band = streakBand(s.hours, bands);
            return (
              <div key={i} className={`streak-card ${BAND_CLASS[band]}`}>
                <div className="streak-badge">{band} severity</div>
                <div className="streak-dates">
                  {shortDate(s.start)}–{shortDate(s.end)}
                </div>
                <div className="muted">
                  {s.lengthDays} day{s.lengthDays === 1 ? "" : "s"} · {s.count} shift{s.count === 1 ? "" : "s"} · {hrs(s.hours)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h4>Downtime calendar ({range.min ? `${shortDate(range.min)} – ${shortDate(range.max)}` : "no range"})</h4>
      {days.length === 0 ? (
        <p className="muted">No dated records.</p>
      ) : (
        <>
          <div className="heat-strip">
            {days.map((k) => {
              const h = downByDay[k] || 0;
              const intensity = h > 0 ? 0.15 + 0.85 * (h / maxDown) : 0;
              const inStreak = streakDays.has(k);
              return (
                <span
                  key={k}
                  className={inStreak ? "heat-cell in-streak" : "heat-cell"}
                  style={{ background: h > 0 ? `rgba(220,38,38,${intensity.toFixed(2)})` : "var(--soft)" }}
                  title={`${shortDate(k)}: ${hrs(h)} downtime${inStreak ? " (streak)" : ""}`}
                />
              );
            })}
          </div>
          <p className="muted heat-note">
            Shaded by daily downtime hours; outlined cells are part of a streak.
          </p>
        </>
      )}
    </section>
  );
}
