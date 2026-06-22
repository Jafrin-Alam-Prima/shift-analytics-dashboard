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

  return (
    <div>
      <AnomalySection dash={dash} />

      <section className="card report-section">
        <h2>How issues are detected &amp; handled</h2>
        <p className="muted">
          Every issue type the cleaning engine checks for — how it’s spotted and its default disposition.
          Handling strategies are configurable in <strong>Settings → Data preparation</strong>.
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
