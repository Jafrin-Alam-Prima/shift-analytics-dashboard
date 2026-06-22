// Anomaly report: each flagged row gets an explanation generated from THAT row's
// own values (e.g. "HOURS=18 but start–end=4h"), grouped by severity tier, with
// count tiles. Explanations are specific to the loaded data, not templated prose.
import { issueSeverity } from "../../lib/report.js";
import { ISSUE_LABELS } from "../../lib/cleaning.js";
import { shortDate, num } from "../../lib/format.js";

const TIERS = [
  { key: "critical", label: "Critical", cls: "sev-critical" },
  { key: "warning", label: "Warning", cls: "sev-warning" },
  { key: "duplicate", label: "Duplicate", cls: "sev-duplicate" },
  { key: "info", label: "Info", cls: "sev-info" },
];

function hhmm(d) {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// build a specific explanation for one (row, issue) from the row's own values
function explain(type, orig, rec) {
  switch (type) {
    case "missingStart":
      return `Start time is missing or invalid${orig.start ? ` ("${orig.start}")` : ""}.`;
    case "missingEnd":
      return `End time is missing or invalid${orig.end ? ` ("${orig.end}")` : ""}.`;
    case "badDate":
      return `Date "${orig.date}" is not a valid calendar date.`;
    case "negativeHours":
      return `HOURS is negative (${orig.hours}).`;
    case "hoursConflict": {
      if (rec.start && rec.end) {
        const dur = (rec.end - rec.start) / 3600000;
        return `HOURS=${orig.hours} but start–end=${num(dur)}h.`;
      }
      return `HOURS=${orig.hours} disagrees with the start–end times.`;
    }
    case "crossMidnight":
      return rec.start && rec.end
        ? `Shift crosses midnight (${hhmm(rec.start)} → ${hhmm(rec.end)} next day).`
        : "Shift crosses midnight.";
    case "duplicate":
      return "Identical to another row (duplicate).";
    case "reasonCase":
      return `Reason "${orig.reason}" needs trimming/tidying.`;
    default:
      return ISSUE_LABELS[type] || type;
  }
}

export default function AnomalySection({ dash }) {
  const { view, logical } = dash;
  const sev = view.report.severity.dataQuality;

  // one entry per (flagged row, issue), tagged with its tier
  const entries = [];
  for (const rec of view.rawRecords) {
    if (!rec.issues || rec.issues.length === 0) continue;
    const orig = logical[rec.i] || {};
    const label = `${rec.dateKey ? shortDate(rec.dateKey) : orig.date || "row " + (rec.i + 1)} · ${rec.reason || "(blank)"}`;
    for (const type of rec.issues) {
      entries.push({ tier: issueSeverity(type), label, text: explain(type, orig, rec), row: rec.i + 1 });
    }
  }

  return (
    <section className="card report-section">
      <h2>Anomalies</h2>

      <div className="kpi-row">
        {TIERS.map((t) => (
          <div key={t.key} className={`kpi tile-${t.key === "critical" ? "bad" : t.key === "warning" ? "warn" : "neutral"}`}>
            <div className="kpi-value">{num(sev[t.key] || 0, 0)}</div>
            <div className="kpi-label">{t.label}</div>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="muted">No anomalies — the data is clean.</p>
      ) : (
        TIERS.map((t) => {
          const rows = entries.filter((e) => e.tier === t.key);
          if (!rows.length) return null;
          return (
            <div key={t.key} className="anomaly-group">
              <h4>
                <span className={`legend-swatch ${t.cls}`} /> {t.label} ({rows.length})
              </h4>
              <ul className="anomaly-list">
                {rows.map((e, i) => (
                  <li key={i}>
                    <strong>{e.label}</strong> — {e.text} <span className="muted">(row {e.row})</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
