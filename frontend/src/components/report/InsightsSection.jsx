// Plant-manager "decision cards": each is a severity-colored icon, a bold
// one-line finding, a short evidence paragraph citing live numbers, and a → Action
// line with a concrete recommendation (and a measurable target where the data
// supports one). The cards are generated dynamically in lib/analysis.js from
// outputs already computed — no hardcoded text or numbers, no invented causes.
import { decisionCards } from "../../lib/analysis.js";

const SEV = {
  critical: { cls: "dc-critical", label: "Critical" },
  warning: { cls: "dc-warning", label: "Watch" },
  good: { cls: "dc-good", label: "On track" },
  info: { cls: "dc-info", label: "Note" },
};

function CardIcon({ severity }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (severity === "good") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </svg>
    );
  }
  if (severity === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5h.01" />
      </svg>
    );
  }
  // critical / warning — alert triangle
  return (
    <svg {...common}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export default function InsightsSection({ dash }) {
  const { view, params } = dash;

  const cards = decisionCards({
    records: view.filtered,
    report: view.report,
    streaks: view.streaks,
    officialEfficiency: view.officialEfficiency,
    target: view.report.target,
    severityBands: params.report.severityBands,
  });

  return (
    <section className="card report-section">
      <h2>Insights</h2>
      <p className="section-subtitle">What to look at, and what to do about it.</p>
      <p className="boundary-caption">
        Each card is something we spotted in the data, with a suggested action. The findings are facts; any
        possible causes are for your team to check.
      </p>

      {cards.length === 0 ? (
        <p className="muted">Not enough data yet to surface insights.</p>
      ) : (
        <div className="decision-cards">
          {cards.map((c) => {
            const sev = SEV[c.severity] || SEV.info;
            return (
              <article key={c.key} className={`decision-card ${sev.cls}`}>
                <div className="dc-icon">
                  <CardIcon severity={c.severity} />
                </div>
                <div className="dc-body">
                  <div className="dc-head">
                    <h3 className="dc-title">{c.title}</h3>
                    <span className="dc-tag">{sev.label}</span>
                  </div>
                  <p className="dc-evidence">{c.evidence}</p>
                  <p className="dc-action">{c.action}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
