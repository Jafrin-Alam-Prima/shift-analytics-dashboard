// Near-duplicate / similar-value detection (X5) — SUGGESTION ONLY. It shows a
// similarity score and a canonical suggestion; the user confirms each, and a
// confirmed change becomes one auditable X4 override. Nothing auto-merges.
import { useMemo, useState } from "react";
import { reasonSuggestions, nearDuplicateSuggestions } from "../lib/similarity.js";
import { DEFAULT_SIMILARITY } from "../lib/config.js";
import { pct, shortDate } from "../lib/format.js";

export default function SimilarityPanel({ dash }) {
  const [threshold, setThreshold] = useState(DEFAULT_SIMILARITY.reasonThreshold);
  const [tolerance, setTolerance] = useState(DEFAULT_SIMILARITY.nearDupMinutes);
  if (!dash.ready || !dash.dataset) return null;

  const reasonSugs = useMemo(() => reasonSuggestions(dash.logical, threshold), [dash.logical, threshold]);
  const nearDups = useMemo(
    () => nearDuplicateSuggestions(dash.dataset.clean, tolerance),
    [dash.dataset.clean, tolerance]
  );

  // has a reason suggestion already been confirmed (all its rows overridden to canonical)?
  function reasonApplied(s) {
    return s.rows.every((i) => dash.overrides[i] && dash.overrides[i].fields && dash.overrides[i].fields.reason === s.canonical);
  }
  function applyReason(s) {
    s.rows.forEach((i) => dash.setFieldOverride(i, "reason", s.canonical));
  }
  function applyNearDup(d) {
    dash.toggleExclude(d.row); // exclude the later near-duplicate row
  }

  return (
    <section className="card">
      <h3>Similar values &amp; near-duplicates (suggestions)</h3>
      <p className="custom-note">
        Suggestions only — nothing changes until you confirm. Confirming records one auditable
        correction (see Manual corrections). The app never merges on its own.
      </p>

      <div className="filter-group">
        <label className="filter-field">
          <span className="seg-label">Reason similarity ≥</span>
          <input
            type="number"
            min="0.5"
            max="1"
            step="0.05"
            className="num-input"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Reason similarity threshold"
          />
        </label>
        <label className="filter-field">
          <span className="seg-label">Near-dup within (min)</span>
          <input
            type="number"
            min="1"
            className="num-input"
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            aria-label="Near-duplicate time tolerance in minutes"
          />
        </label>
      </div>

      <h4>Similar reason spellings</h4>
      {reasonSugs.length === 0 ? (
        <p className="muted">No reason spellings above {pct(threshold * 100, 0)} similarity.</p>
      ) : (
        <table className="issue-table">
          <thead>
            <tr>
              <th>Spelling</th>
              <th>Suggested canonical</th>
              <th>Similarity</th>
              <th>Rows</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reasonSugs.map((s, i) => {
              const applied = reasonApplied(s);
              return (
                <tr key={i}>
                  <td>“{s.variant}”</td>
                  <td>“{s.canonical}”</td>
                  <td>{pct(s.score * 100)}</td>
                  <td>{s.rows.length}</td>
                  <td>
                    <button className="reset-btn" onClick={() => applyReason(s)} disabled={applied}>
                      {applied ? "✓ applied" : "Confirm merge"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h4 style={{ marginTop: "1rem" }}>Near-duplicate rows</h4>
      {nearDups.length === 0 ? (
        <p className="muted">No near-duplicate rows within {tolerance} min.</p>
      ) : (
        <table className="issue-table">
          <thead>
            <tr>
              <th>Day · reason</th>
              <th>Rows</th>
              <th>Apart</th>
              <th>Similarity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {nearDups.map((d, i) => {
              const excluded = dash.overrides[d.row] && dash.overrides[d.row].excluded;
              return (
                <tr key={i}>
                  <td>
                    {shortDate(d.dateKey)} · {d.reason}
                  </td>
                  <td>
                    #{d.ofRow + 1} ↔ #{d.row + 1}
                  </td>
                  <td>{d.minutesApart} min</td>
                  <td>{pct(d.score * 100)}</td>
                  <td>
                    <button className="reset-btn" onClick={() => applyNearDup(d)} disabled={excluded}>
                      {excluded ? "✓ excluded #" + (d.row + 1) : "Exclude #" + (d.row + 1)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
