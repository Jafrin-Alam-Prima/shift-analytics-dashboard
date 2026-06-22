// Streaks: a severity card per streak (band from the config rule), the "Method &
// assumptions" note, and a month-style downtime calendar — each day shaded by its
// failure hours, streak days outlined by severity.
import { streakBand } from "../../lib/report.js";
import { STREAK_METHODS } from "../../lib/config.js";
import { downtimeByDate } from "../../lib/analysis.js";
import { hrs, shortDate } from "../../lib/format.js";
import { RULE_TEXT } from "../../lib/ruleText.js";
import InfoTip from "../InfoTip.jsx";
import DowntimeCalendar from "../charts/DowntimeCalendar.jsx";

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

  // calendar inputs (display-side): per-date failure hours/incidents, which dates
  // have any record, and which days fall in a streak (tagged with its severity).
  const byDate = downtimeByDate(view.filtered, params.failureReasons);
  const datesWithData = new Set(view.filtered.map((r) => r.dateKey).filter(Boolean));
  const streakDayBand = {};
  for (const s of streaks) {
    if (!s.start || !s.end) continue;
    const band = streakBand(s.hours, bands);
    for (let d = dn(s.start); d <= dn(s.end); d++) streakDayBand[keyAt(d)] = band;
  }

  return (
    <section className="card report-section">
      <h2>
        Breakdown streaks <InfoTip text={RULE_TEXT.streak} label="What counts as a streak" />
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
      <DowntimeCalendar byDate={byDate} datesWithData={datesWithData} streakDayBand={streakDayBand} range={range} />
    </section>
  );
}
