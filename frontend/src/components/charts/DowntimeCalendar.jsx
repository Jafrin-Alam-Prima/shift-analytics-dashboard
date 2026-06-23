// Month-style downtime calendar: weekday columns, week rows, one block per month
// the range touches. Each day's intensity scales with that day's failure hours;
// days inside a detected streak get a severity-coloured outline; days with no
// records are muted. Hover (native title) gives the date, failure hours, incident
// count, streak status, and the day's reason(s). Click (or Enter/Space) selects a
// day and opens a detail panel beside the calendar; click again, the × button, or
// Esc deselects. Fully dynamic — any date range / categories.
import { useState } from "react";
import { hrs, shortDate } from "../../lib/format.js";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEV_CLASS = { high: "cal-high", medium: "cal-medium", low: "cal-low" };

function pad(n) {
  return String(n).padStart(2, "0");
}
// weekday index, Monday-first (0 = Mon … 6 = Sun)
function weekdayMon(y, m, d) {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export default function DowntimeCalendar({ byDate, datesWithData, streakDayBand, range }) {
  const [selectedKey, setSelectedKey] = useState(null);

  if (!range || !range.min) return <p className="muted">No dated records.</p>;

  const y0 = +range.min.slice(0, 4);
  const m0 = +range.min.slice(5, 7);
  const y1 = +range.max.slice(0, 4);
  const m1 = +range.max.slice(5, 7);

  // every month the range spans (handles multi-month / multi-year ranges)
  const months = [];
  let y = y0;
  let m = m0;
  while (y < y1 || (y === y1 && m <= m1)) {
    months.push([y, m]);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const maxHours = Math.max(1, ...Object.values(byDate).map((v) => v.hours));

  const toggle = (k) => setSelectedKey((cur) => (cur === k ? null : k));
  // only keep a selection for a day that's still present in the current data
  // (so changing filters can't leave a stale panel open)
  const sel = selectedKey && datesWithData.has(selectedKey) ? selectedKey : null;
  const selInfo = sel ? byDate[sel] : null;
  const selBand = sel ? streakDayBand[sel] : null;

  return (
    <div className="cal-layout">
      <div className="cal-main">
        <div className="cal-wrap">
          {months.map(([yy, mm]) => {
            const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
            const lead = weekdayMon(yy, mm, 1);
            const cells = [];
            for (let i = 0; i < lead; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);

            return (
              <div key={`${yy}-${mm}`} className="cal-month">
                <div className="cal-title">
                  {MONTHS[mm - 1]} {yy}
                </div>
                <div className="cal-grid">
                  {WD.map((w) => (
                    <div key={w} className="cal-wd">
                      {w}
                    </div>
                  ))}
                  {cells.map((d, i) => {
                    if (d == null) return <div key={`e${i}`} className="cal-cell cal-empty" />;
                    const key = `${yy}-${pad(mm)}-${pad(d)}`;
                    // only days within the dataset's actual first–last date are live;
                    // month-padding days before the first / after the last date are
                    // read-only and disabled (muted, not hoverable, not clickable)
                    const inRange = !!(range.min && range.max && key >= range.min && key <= range.max);
                    const has = inRange && datesWithData.has(key);
                    const info = has ? byDate[key] : undefined;
                    const h = info ? info.hours : 0;
                    const count = info ? info.count : 0;
                    const band = inRange ? streakDayBand[key] : undefined;
                    const intensity = h > 0 ? 0.18 + 0.82 * (h / maxHours) : 0;
                    const bg = !inRange ? "transparent" : !has ? "var(--soft)" : h > 0 ? `rgba(220,38,38,${intensity.toFixed(2)})` : "var(--panel)";
                    const reasons = info ? [...new Set(info.incidents.map((it) => it.reason))] : [];
                    const cls = `cal-cell${!inRange ? " cal-out" : has ? "" : " cal-nodata"}${band ? ` ${SEV_CLASS[band]}` : ""}${sel === key ? " cal-selected" : ""}`;
                    const title = !inRange
                      ? `${shortDate(key)} · outside the data range`
                      : !has
                      ? `${shortDate(key)} · no data`
                      : `${shortDate(key)} · ${hrs(h)} lost · ${count} incident${count === 1 ? "" : "s"}${band ? ` · in a ${band} streak` : ""}${reasons.length ? ` · ${reasons.join(", ")}` : ""}`;
                    return (
                      <div
                        key={key}
                        className={cls}
                        style={{ background: bg }}
                        title={title}
                        role={has ? "button" : undefined}
                        tabIndex={has ? 0 : undefined}
                        aria-pressed={has ? sel === key : undefined}
                        aria-disabled={inRange ? undefined : true}
                        aria-label={has ? title : undefined}
                        onClick={has ? () => toggle(key) : undefined}
                        onKeyDown={
                          has
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggle(key);
                                } else if (e.key === "Escape") {
                                  setSelectedKey(null);
                                }
                              }
                            : undefined
                        }
                      >
                        <span className="cal-day">{d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cal-legend">
          <span className="cal-legend-scale">
            <span className="muted">less</span>
            <i style={{ background: "rgba(220,38,38,0.18)" }} />
            <i style={{ background: "rgba(220,38,38,0.45)" }} />
            <i style={{ background: "rgba(220,38,38,0.72)" }} />
            <i style={{ background: "rgba(220,38,38,1)" }} />
            <span className="muted">more time lost</span>
          </span>
          <span className="cal-legend-item"><span className="cal-swatch cal-high" /> high</span>
          <span className="cal-legend-item"><span className="cal-swatch cal-medium" /> medium</span>
          <span className="cal-legend-item"><span className="cal-swatch cal-low" /> low</span>
          <span className="cal-legend-item"><span className="cal-swatch cal-nodata" /> no data</span>
        </div>
      </div>

      {sel && (
        <aside className="cal-detail" aria-label={`Details for ${shortDate(sel)}`}>
          <div className="cal-detail-head">
            <h5>{shortDate(sel)}</h5>
            <button type="button" className="cal-detail-close" onClick={() => setSelectedKey(null)} aria-label="Close day details">
              ×
            </button>
          </div>
          <p className="cal-detail-streak">{selBand ? `In a ${selBand}-severity streak` : "Not part of a streak"}</p>
          {selInfo && selInfo.incidents.length ? (
            <>
              <ul className="cal-detail-list">
                {selInfo.incidents.map((it, i) => (
                  <li key={i}>
                    <span>{it.reason}</span>
                    <span>{hrs(it.hours)}</span>
                  </li>
                ))}
              </ul>
              <div className="cal-detail-total">
                Total lost: {hrs(selInfo.hours)} · {selInfo.count} incident{selInfo.count === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <p className="muted">No time lost on this day.</p>
          )}
        </aside>
      )}
    </div>
  );
}
