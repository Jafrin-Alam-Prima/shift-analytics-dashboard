// Data-quality panel: summary cards, the issue list with a handling control for
// each issue (defaults pre-selected), the flagged-row list, and a before/after
// comparison of raw vs cleaned data. Reads the unified `view` (local or backend).
import { CLEANING_OPTIONS } from "../lib/config.js";
import { CLEANING_RULE_TEXT } from "../lib/ruleText.js";
import { num, pct, hrs } from "../lib/format.js";
import InfoTip from "./InfoTip.jsx";

function sumHours(records) {
  return records.reduce((s, r) => s + (r.hours != null && r.hours >= 0 ? r.hours : 0), 0);
}

// which control applies to a given issue type
const ISSUE_TO_CONTROL = {
  missingStart: "missingTime",
  missingEnd: "missingTime",
  badDate: "badDate",
  negativeHours: "negativeHours",
  hoursConflict: "hoursConflict",
  crossMidnight: "crossMidnight",
  duplicate: "duplicate",
  reasonCase: "reasonCase",
};

export default function DataQualityTab({ view, params, setCleaning }) {
  if (!view) return <div className="card">No data loaded.</div>;

  const rawHours = sumHours(view.rawRecords);
  const cleanHours = sumHours(view.cleanRecords);

  return (
    <div>
      <div className="kpi-row">
        <Stat label="Total rows" value={view.total} />
        <Stat label="Clean rows" value={view.cleanCount} />
        <Stat label="Flagged rows" value={view.flaggedCount} />
        <Stat label="Error rate" value={pct(view.errorRate)} />
      </div>

      <section className="card">
        <h3>Issues found</h3>
        {view.issues.length === 0 ? (
          <p className="muted">No issues detected — the data is already clean.</p>
        ) : (
          <table className="issue-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Count</th>
                <th>Handling</th>
              </tr>
            </thead>
            <tbody>
              {view.issues.map((it) => {
                const ctrlKey = ISSUE_TO_CONTROL[it.type];
                const ctrl = CLEANING_OPTIONS[ctrlKey];
                return (
                  <tr key={it.type}>
                    <td>
                      {it.label}
                      {ctrlKey && CLEANING_RULE_TEXT[ctrlKey] && (
                        <InfoTip text={CLEANING_RULE_TEXT[ctrlKey]} label={`How ${it.label} is handled`} />
                      )}
                    </td>
                    <td>{it.count}</td>
                    <td>
                      {ctrl ? (
                        <select value={params.cleaning[ctrlKey]} onChange={(e) => setCleaning(ctrlKey, e.target.value)}>
                          {ctrl.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Before vs after cleaning</h3>
        <table className="issue-table">
          <thead>
            <tr>
              <th></th>
              <th>Raw</th>
              <th>Cleaned</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rows</td>
              <td>{view.total}</td>
              <td>{view.cleanCount}</td>
            </tr>
            <tr>
              <td>Total hours</td>
              <td>{hrs(rawHours)}</td>
              <td>{hrs(cleanHours)}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          Cleaning removed {view.total - view.cleanCount} duplicate row(s) and corrected{" "}
          {num(rawHours - cleanHours)} h of inflated/negative time.
        </p>
      </section>

      <section className="card">
        <h3>Flagged rows ({view.flaggedCount})</h3>
        {view.flaggedCount === 0 ? (
          <p className="muted">Nothing flagged.</p>
        ) : (
          <table className="issue-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Reason</th>
                <th>Problems</th>
              </tr>
            </thead>
            <tbody>
              {view.rawRecords
                .filter((r) => r.issues.length > 0)
                .map((r) => (
                  <tr key={r.i}>
                    <td>{r.i + 1}</td>
                    <td>{r.reason || <span className="muted">(blank)</span>}</td>
                    <td>{r.issues.map((t) => labelFor(view, t)).join(", ")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function labelFor(view, type) {
  const it = view.issues.find((x) => x.type === type);
  return it ? it.label : type;
}

function Stat({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
