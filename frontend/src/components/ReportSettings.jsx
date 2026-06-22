// Report config (Settings → Report): shift windows, efficiency target, and the
// streak severity bands. These are the documented defaults made editable — every
// change re-runs the report metrics live (and is sent to the backend).
import { RULE_TEXT } from "../lib/ruleText.js";
import InfoTip from "./InfoTip.jsx";

export default function ReportSettings({ dash }) {
  const r = dash.params.report;

  return (
    <section className="card">
      <div className="chart-head">
        <h3>Report settings</h3>
        <button className="reset-btn" onClick={dash.resetReport}>
          Reset to defaults
        </button>
      </div>
      <p className="muted">
        Defaults shown. Shift windows are hours of the day (0–24); “night” may wrap past midnight.
        These drive the report — nothing here is hardcoded.
      </p>

      <h4>Efficiency target (%)</h4>
      <input
        type="number"
        min="0"
        max="100"
        className="num-input"
        value={r.target}
        onChange={(e) => dash.setReport({ target: Number(e.target.value) })}
        aria-label="Efficiency target percent"
      />

      <h4 style={{ marginTop: "1rem" }}>Shift windows</h4>
      <table className="issue-table">
        <thead>
          <tr>
            <th>Shift</th>
            <th>Start (h)</th>
            <th>End (h)</th>
          </tr>
        </thead>
        <tbody>
          {r.shiftWindows.map((w, i) => (
            <tr key={w.key}>
              <td>{w.label}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="24"
                  className="num-input"
                  value={w.start}
                  onChange={(e) => dash.setShiftWindow(i, "start", Number(e.target.value))}
                  aria-label={`${w.label} start hour`}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="24"
                  className="num-input"
                  value={w.end}
                  onChange={(e) => dash.setShiftWindow(i, "end", Number(e.target.value))}
                  aria-label={`${w.label} end hour`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: "1rem" }}>
        Streak severity bands (breakdown hours) <InfoTip text={RULE_TEXT.severityBands} label="How streak severity is banded" />
      </h4>
      <p className="muted">
        Below “medium” = low; “medium” to below “high” = medium; “high” and up = high.
      </p>
      <div className="map-grid">
        <label className="map-row">
          <span className="map-label">Medium ≥</span>
          <input
            type="number"
            min="0"
            className="num-input"
            value={r.severityBands.medium}
            onChange={(e) => dash.setSeverityBand("medium", Number(e.target.value))}
          />
        </label>
        <label className="map-row">
          <span className="map-label">High ≥</span>
          <input
            type="number"
            min="0"
            className="num-input"
            value={r.severityBands.high}
            onChange={(e) => dash.setSeverityBand("high", Number(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
