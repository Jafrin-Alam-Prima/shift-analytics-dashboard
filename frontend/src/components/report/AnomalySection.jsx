// Read-only Data Integrity & Quality report: severity count tiles, the
// data-quality severity bar, and a categorized list where each flagged row gets
// an explanation generated from THAT row's own values (e.g. "HOURS=18 but
// start–end=4h") plus how its issue type was handled. Explanations are specific to
// the loaded data, not templated prose. The cleaning controls themselves live in
// Settings → Data preparation; this view only reports the result.
import { issueSeverity } from "../../lib/report.js";
import { ISSUE_LABELS } from "../../lib/cleaning.js";
import { CLEANING_OPTIONS } from "../../lib/config.js";
import { shortDate, num } from "../../lib/format.js";
import SeverityBar from "./SeverityBar.jsx";

const TIERS = [
  { key: "critical", label: "Critical", cls: "sev-critical" },
  { key: "warning", label: "Warning", cls: "sev-warning" },
  { key: "duplicate", label: "Duplicate", cls: "sev-duplicate" },
  { key: "info", label: "Info", cls: "sev-info" },
];

// which cleaning control governs each issue type (mirrors the Data preparation
// panel) — used to report, read-only, how each issue was handled.
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

// the human label of the strategy currently applied to an issue type (dynamic:
// reflects whatever is chosen in Settings; null if the type has no control)
function handledLabel(type, cleaning) {
  const ctrlKey = ISSUE_TO_CONTROL[type];
  const ctrl = CLEANING_OPTIONS[ctrlKey];
  if (!ctrl) return null;
  const chosen = ctrl.options.find((o) => o.value === cleaning[ctrlKey]);
  return chosen ? chosen.label : null;
}

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
  const { view, logical, params } = dash;
  const sev = view.report.severity.dataQuality;

  // one entry per (flagged row, issue), tagged with its tier + how it was handled
  const entries = [];
  for (const rec of view.rawRecords) {
    if (!rec.issues || rec.issues.length === 0) continue;
    const orig = logical[rec.i] || {};
    const label = `${rec.dateKey ? shortDate(rec.dateKey) : orig.date || "row " + (rec.i + 1)} · ${rec.reason || "(blank)"}`;
    for (const type of rec.issues) {
      entries.push({
        tier: issueSeverity(type),
        label,
        text: explain(type, orig, rec),
        row: rec.i + 1,
        handled: handledLabel(type, params.cleaning),
      });
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

      <SeverityBar severity={sev} />

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
                    {e.handled && <span className="muted"> · handled: {e.handled}</span>}
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
