// Analysis controls (Settings): failure categories, streak knobs, and grouping.
// These are parameters — the official Efficiency Score stays pinned to the
// literal formula; changing the failure set shows a separate "custom" result on
// the dashboard, clearly labelled.
import { groupOf } from "../lib/analysis.js";
import { uniqueReasons } from "../lib/cleaning.js";
import { STREAK_METHODS } from "../lib/config.js";

export default function AnalysisControls({ dash }) {
  const { dataset, params, toggleFailure, setStreakKnob, setReasonGroup, resetParams, failureCustomized } = dash;
  const reasons = uniqueReasons(dataset.raw);
  const groupNames = Object.keys(params.groups);

  return (
    <section className="card">
      <div className="chart-head">
        <h3>Analysis settings</h3>
        <button className="reset-btn" onClick={resetParams}>
          Reset to defaults
        </button>
      </div>

      <h4>Failure categories</h4>
      <p className="muted">
        Reasons counted as downtime by the score and the streak finder. The
        official score always uses the default set; changing it shows a custom
        result on the dashboard.
      </p>
      <div className="filter-chips">
        {reasons.map((r) => (
          <button
            key={r}
            className={params.failureReasons.includes(r) ? "chip active" : "chip"}
            onClick={() => toggleFailure(r)}
            aria-pressed={params.failureReasons.includes(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {failureCustomized && (
        <p className="warn-text">Failure set is customised — the dashboard shows both official and custom scores.</p>
      )}

      <h4 style={{ marginTop: "1rem" }}>Breakdown streak</h4>
      <div className="map-grid">
        <label className="map-row">
          <span className="map-label">Method</span>
          <select value={params.streak.method} onChange={(e) => setStreakKnob("method", e.target.value)}>
            {STREAK_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {params.streak.method === "consecutive" && (
          <>
            <label className="map-row">
              <span className="map-label">Min streak days</span>
              <input
                type="number"
                min="1"
                className="num-input"
                value={params.streak.minStreakDays}
                onChange={(e) => setStreakKnob("minStreakDays", Number(e.target.value))}
              />
            </label>
            <label className="map-row">
              <span className="map-label">Max gap days</span>
              <input
                type="number"
                min="0"
                className="num-input"
                value={params.streak.maxGapDays}
                onChange={(e) => setStreakKnob("maxGapDays", Number(e.target.value))}
              />
            </label>
          </>
        )}

        {params.streak.method === "window" && (
          <label className="map-row">
            <span className="map-label">Window (hours)</span>
            <input
              type="number"
              min="1"
              className="num-input"
              value={params.streak.windowHours}
              onChange={(e) => setStreakKnob("windowHours", Number(e.target.value))}
            />
          </label>
        )}

        {(params.streak.method === "window" || params.streak.method === "shift") && (
          <label className="map-row">
            <span className="map-label">Min shifts</span>
            <input
              type="number"
              min="1"
              className="num-input"
              value={params.streak.minStreakShifts}
              onChange={(e) => setStreakKnob("minStreakShifts", Number(e.target.value))}
            />
          </label>
        )}
      </div>
      <p className="muted">
        <em>Consecutive days</em> (official): days each with a failure. <em>Time window</em>:
        failures within N hours of each other. <em>Consecutive shifts</em>: back-to-back failure
        shifts.
      </p>

      <h4 style={{ marginTop: "1rem" }}>Grouping</h4>
      <p className="muted">Which group each reason belongs to (used by the charts and filters, not the score).</p>
      <table className="issue-table">
        <thead>
          <tr>
            <th>Reason</th>
            <th>Group</th>
          </tr>
        </thead>
        <tbody>
          {reasons.map((r) => (
            <tr key={r}>
              <td>{r}</td>
              <td>
                <select value={groupOf(r, params.groups)} onChange={(e) => setReasonGroup(r, e.target.value)}>
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
