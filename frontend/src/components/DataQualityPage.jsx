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
  missingStart: "The start time is missing or can't be read.",
  missingEnd: "The end time is missing or can't be read.",
  badDate: "The date isn't a real calendar date.",
  negativeHours: "The recorded hours are below zero.",
  hoursConflict: "The recorded hours don't match the start–end times.",
  crossMidnight: "The start and end fall on different days.",
  duplicate: "The record is identical to another one.",
  reasonCase: "The label has odd spacing or capitalisation to tidy.",
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
          <strong>Why this matters:</strong>{" "}
          {impact
            ? impact.overstatePct != null
              ? `fixing the ${num(flagged, 0)} record${flagged === 1 ? "" : "s"} with issues kept ${impact.reason} from looking about ${pct(impact.overstatePct)} bigger than it really was (${hrs(impact.rawH)} before cleaning → ${hrs(impact.cleanH)} after).`
              : `fixing the ${num(flagged, 0)} record${flagged === 1 ? "" : "s"} with issues removed ${hrs(impact.rawH)} of ${impact.reason} hours that weren't real and would have inflated the totals.`
            : `the ${num(flagged, 0)} record${flagged === 1 ? "" : "s"} with issues were fixed before any number here was worked out, so every figure reflects cleaned data.`}
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
