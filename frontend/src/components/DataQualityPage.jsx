// Data Quality & Methodology — reached from the header trust chip, not the
// sidebar. Renders the existing read-only integrity report (severity counts, the
// % clean-vs-flagged bar, the categorized issue list) and a plain-language
// methodology table so "detect · document · handle" is visible in one place.
// All figures come from the live cleaning engine; the methodology text documents
// the fixed rules (strategies are configurable in Settings → Data preparation).
import AnomalySection from "./report/AnomalySection.jsx";
import { ISSUE_LABELS } from "../lib/cleaning.js";
import { ISSUE_SEVERITY } from "../lib/config.js";
import { CLEANING_RULE_TEXT } from "../lib/ruleText.js";
import { cleaningImpact } from "../lib/analysis.js";
import { pct, hrs, num } from "../lib/format.js";

// which cleaning control governs each issue type (mirrors Data preparation)
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

// how each issue is spotted (documents the cleaning engine's detection rules)
const DETECTION_TEXT = {
  missingStart: "The start timestamp is missing or can't be parsed.",
  missingEnd: "The end timestamp is missing or can't be parsed.",
  badDate: "The date isn't a valid calendar date.",
  negativeHours: "The HOURS value is below zero.",
  hoursConflict: "HOURS disagrees with the start–end duration.",
  crossMidnight: "The shift's start and end fall on different days.",
  duplicate: "The row is identical to another row.",
  reasonCase: "The reason text has stray casing or whitespace to tidy.",
};

const SEV_LABEL = { critical: "Critical", warning: "Warning", info: "Info", duplicate: "Duplicate" };

export default function DataQualityPage({ dash }) {
  if (!dash.ready || !dash.view) {
    return <p className="muted">Load a dataset (map its columns in Settings) to see the data-quality report.</p>;
  }

  const types = Object.keys(ISSUE_LABELS);
  const flagged = dash.view.flaggedCount;
  const impact = cleaningImpact(dash.view.rawRecords, dash.view.cleanRecords);

  return (
    <div>
      <AnomalySection dash={dash} />

      {flagged > 0 && (
        <p className="custom-note">
          <strong>Why cleaning matters:</strong>{" "}
          {impact
            ? impact.overstatePct != null
              ? `handling the ${num(flagged, 0)} flagged row${flagged === 1 ? "" : "s"} prevented ${impact.reason} from being overstated by ~${pct(impact.overstatePct)} (${hrs(impact.rawH)} raw → ${hrs(impact.cleanH)} cleaned).`
              : `handling the ${num(flagged, 0)} flagged row${flagged === 1 ? "" : "s"} removed ${hrs(impact.rawH)} of phantom ${impact.reason} hours that would otherwise have inflated the totals.`
            : `the ${num(flagged, 0)} flagged row${flagged === 1 ? "" : "s"} were corrected before any figure here was computed, so every number reflects cleaned data.`}
        </p>
      )}

      <section className="card report-section">
        <h2>How issues are detected &amp; handled</h2>
        <p className="muted">
          Every issue type the cleaning engine checks for — how it’s spotted and how it’s handled. These
          handling strategies run automatically on any uploaded data.
        </p>
        <table className="issue-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Severity</th>
              <th>How it’s detected</th>
              <th>How it’s handled</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t}>
                <td>{ISSUE_LABELS[t]}</td>
                <td>{SEV_LABEL[ISSUE_SEVERITY[t]] || "Info"}</td>
                <td>{DETECTION_TEXT[t] || "—"}</td>
                <td>{CLEANING_RULE_TEXT[ISSUE_TO_CONTROL[t]] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
