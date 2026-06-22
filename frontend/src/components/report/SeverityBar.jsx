// A segmented bar showing data-quality issue counts split by severity tier.
// Counts come from the report metrics (a documented rule maps issue type -> tier).
import { num } from "../../lib/format.js";

const TIERS = [
  { key: "critical", label: "Critical", cls: "sev-critical" },
  { key: "warning", label: "Warning", cls: "sev-warning" },
  { key: "info", label: "Info", cls: "sev-info" },
  { key: "duplicate", label: "Duplicate", cls: "sev-duplicate" },
];

export default function SeverityBar({ severity }) {
  const total = TIERS.reduce((s, t) => s + (severity[t.key] || 0), 0);
  if (total === 0) return <p className="muted">No data-quality issues.</p>;

  return (
    <div>
      <div className="sev-bar" role="img" aria-label="Data-quality issues by severity">
        {TIERS.map((t) =>
          severity[t.key] > 0 ? (
            <div
              key={t.key}
              className={`sev-seg ${t.cls}`}
              style={{ width: `${(severity[t.key] / total) * 100}%` }}
              title={`${t.label}: ${severity[t.key]}`}
            />
          ) : null
        )}
      </div>
      <div className="legend">
        {TIERS.map((t) => (
          <span key={t.key} className="legend-item">
            <span className={`legend-swatch ${t.cls}`} />
            {t.label} ({num(severity[t.key] || 0, 0)})
          </span>
        ))}
      </div>
    </div>
  );
}
