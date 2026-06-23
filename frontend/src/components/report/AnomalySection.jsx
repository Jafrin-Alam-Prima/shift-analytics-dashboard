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

// severity order (lower = worse) used to pick a flagged row's representative tier
const TIER_RANK = { critical: 0, warning: 1, duplicate: 2, info: 3 };

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
      return `Start time is missing or can't be read${orig.start ? ` ("${orig.start}")` : ""}.`;
    case "missingEnd":
      return `End time is missing or can't be read${orig.end ? ` ("${orig.end}")` : ""}.`;
    case "badDate":
      return `Date "${orig.date}" isn't a real calendar date.`;
    case "negativeHours":
      return `Recorded hours are negative (${orig.hours}).`;
    case "hoursConflict": {
      if (rec.start && rec.end) {
        const dur = (rec.end - rec.start) / 3600000;
        return `Recorded ${orig.hours} h, but start–end is ${num(dur)} h.`;
      }
      return `Recorded ${orig.hours} h doesn't match the start–end times.`;
    }
    case "crossMidnight":
      return rec.start && rec.end
        ? `Shift crosses midnight (${hhmm(rec.start)} → ${hhmm(rec.end)} next day).`
        : "Shift crosses midnight.";
    case "duplicate":
      return "Identical to another record (duplicate).";
    case "reasonCase":
      return `Label "${orig.reason}" needs tidying.`;
    default:
      return ISSUE_LABELS[type] || type;
  }
}

export default function AnomalySection({ dash }) {
  const { view, logical, params } = dash;
  const sev = view.report.severity.dataQuality;

  // one entry per (flagged row, issue), tagged with its tier + how it was handled;
  // and a row-level composition (each flagged row counted once, by its most
  // severe issue) so the bar can show % clean vs flagged. All live, never hardcoded.
  const entries = [];
  const rowComposition = { critical: 0, warning: 0, duplicate: 0, info: 0 };
  let flaggedRows = 0;
  for (const rec of view.rawRecords) {
    if (!rec.issues || rec.issues.length === 0) continue;
    flaggedRows += 1;
    const orig = logical[rec.i] || {};
    const label = `${rec.dateKey ? shortDate(rec.dateKey) : orig.date || "row " + (rec.i + 1)} · ${rec.reason || "(blank)"}`;
    let worst = null;
    for (const type of rec.issues) {
      const tier = issueSeverity(type);
      if (worst == null || TIER_RANK[tier] < TIER_RANK[worst]) worst = tier;
      entries.push({
        tier,
        label,
        text: explain(type, orig, rec),
        row: rec.i + 1,
        handled: handledLabel(type, params.cleaning),
      });
    }
    rowComposition[worst] = (rowComposition[worst] || 0) + 1;
  }
  const cleanRows = Math.max(0, view.total - flaggedRows);

  return (
    <section className="card report-section">
      <h2>Data quality check</h2>
      <p className="section-subtitle">What we found and fixed in the raw data before counting anything.</p>

      <h4>Issues found, by severity</h4>
      <div className="kpi-row">
        {TIERS.map((t) => (
          <div key={t.key} className={`kpi tile-${t.key === "critical" ? "bad" : t.key === "warning" ? "warn" : "neutral"}`}>
            <div className="kpi-value">{num(sev[t.key] || 0, 0)}</div>
            <div className="kpi-label">{t.label}</div>
          </div>
        ))}
      </div>

      <h4>Clean records vs records with issues</h4>
      <SeverityBar severity={rowComposition} clean={cleanRows} />

      {entries.length === 0 ? (
        <p className="muted">No issues found — the data is clean.</p>
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
                    <strong>{e.label}</strong> — {e.text} <span className="muted">(record {e.row})</span>
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
