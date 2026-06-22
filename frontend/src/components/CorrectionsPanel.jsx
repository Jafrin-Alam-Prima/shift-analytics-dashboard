// Auditable per-row corrections (X4). Flagged rows first. You can override any
// field, exclude/include a row, or revert. Corrections apply ON TOP of the
// auto-clean pipeline (so with none active the official numbers are unchanged),
// are counted, fully revertible, sent to the backend, and disclosed in the report.
import { useState } from "react";
import { LOGICAL_FIELDS } from "../lib/config.js";
import InfoTip from "./InfoTip.jsx";

const FIELD_LABELS = { date: "Date", start: "Start", end: "End", hours: "Hours", reason: "Reason" };

export default function CorrectionsPanel({ dash }) {
  const [showAll, setShowAll] = useState(false);
  if (!dash.ready || !dash.dataset) return null;

  const logical = dash.logical;
  const overrides = dash.overrides;
  const flagged = new Set(dash.dataset.flaggedRows);
  const overridden = new Set(Object.keys(overrides).map(Number));

  const allIdx = logical.map((_, i) => i);
  const priority = allIdx.filter((i) => flagged.has(i) || overridden.has(i));
  const rest = allIdx.filter((i) => !flagged.has(i) && !overridden.has(i));
  const rowsToShow = showAll ? [...priority, ...rest] : priority;

  function valueOf(i, field) {
    const ov = overrides[i];
    if (ov && ov.fields && ov.fields[field] != null) return ov.fields[field];
    return (logical[i] && logical[i][field]) || "";
  }

  return (
    <section className="card">
      <div className="chart-head">
        <h3>
          Manual corrections
          <InfoTip
            text="Corrections apply on top of the automatic cleaning. With none active, the official numbers are unchanged. Every change is counted, revertible, and disclosed in the report."
            label="How manual corrections work"
          />
        </h3>
        {dash.correctionCount > 0 && (
          <button className="reset-btn" onClick={dash.revertAllOverrides}>
            Revert all
          </button>
        )}
      </div>

      {dash.correctionCount > 0 ? (
        <p className="custom-note">
          {dash.correctionCount} manual correction{dash.correctionCount === 1 ? "" : "s"} applied — these
          override the automatic result and are disclosed in the report.
        </p>
      ) : (
        <p className="muted">No manual corrections. The automatic cleaning result is canonical.</p>
      )}

      <div className="table-scroll">
        <table className="issue-table corrections-table">
          <thead>
            <tr>
              <th>Row</th>
              {LOGICAL_FIELDS.map((f) => (
                <th key={f}>{FIELD_LABELS[f]}</th>
              ))}
              <th>Exclude</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((i) => {
              const ov = overrides[i];
              const excluded = !!(ov && ov.excluded);
              const hasOverride = !!ov;
              return (
                <tr key={i} className={excluded ? "row-excluded" : ""}>
                  <td>
                    {i + 1}
                    {flagged.has(i) && <span className="flag-dot" title="flagged by auto-clean" />}
                  </td>
                  {LOGICAL_FIELDS.map((f) => {
                    const changed = ov && ov.fields && ov.fields[f] != null;
                    return (
                      <td key={f}>
                        <input
                          className={changed ? "corr-input changed" : "corr-input"}
                          value={valueOf(i, f)}
                          onChange={(e) => dash.setFieldOverride(i, f, e.target.value)}
                          aria-label={`Row ${i + 1} ${FIELD_LABELS[f]}`}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <input
                      type="checkbox"
                      checked={excluded}
                      onChange={() => dash.toggleExclude(i)}
                      aria-label={`Exclude row ${i + 1}`}
                    />
                  </td>
                  <td>
                    <button
                      className="reset-btn"
                      onClick={() => dash.revertRow(i)}
                      disabled={!hasOverride}
                    >
                      Revert
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showAll && rest.length > 0 && (
        <button className="reset-btn" style={{ marginTop: "0.6rem" }} onClick={() => setShowAll(true)}>
          Show all {logical.length} rows
        </button>
      )}
      {showAll && (
        <button className="reset-btn" style={{ marginTop: "0.6rem" }} onClick={() => setShowAll(false)}>
          Show flagged only
        </button>
      )}
    </section>
  );
}
