// A segmented bar showing data-quality composition by severity tier. Counts come
// from the report metrics (a documented rule maps issue type -> tier). Pass an
// optional `clean` count to prepend a green "Clean" segment, turning the bar into
// a "% clean vs issues" view (used by the Data Integrity & Quality report).
import { num } from "../../lib/format.js";

const TIERS = [
  { key: "critical", label: "Critical", cls: "sev-critical" },
  { key: "warning", label: "Warning", cls: "sev-warning" },
  { key: "info", label: "Info", cls: "sev-info" },
  { key: "duplicate", label: "Duplicate", cls: "sev-duplicate" },
];

const CLEAN_SEG = { key: "clean", label: "Clean", cls: "sev-clean" };

export default function SeverityBar({ severity, clean = null }) {
  const tierTotal = TIERS.reduce((s, t) => s + (severity[t.key] || 0), 0);
  const cleanN = clean == null ? 0 : clean;
  const total = tierTotal + cleanN;
  if (total === 0) return <p className="muted">No data-quality issues.</p>;

  // include the clean segment only when a clean count was supplied
  const segs = clean == null ? TIERS : [CLEAN_SEG, ...TIERS];
  const countOf = (key) => (key === "clean" ? cleanN : severity[key] || 0);

  return (
    <div>
      <div className="sev-bar" role="img" aria-label="Data quality by severity">
        {segs.map((t) => {
          const c = countOf(t.key);
          if (c <= 0) return null;
          const share = (c / total) * 100;
          return (
            <div
              key={t.key}
              className={`sev-seg ${t.cls}`}
              style={{ width: `${share}%` }}
              title={`${t.label}: ${c} (${share.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="legend">
        {segs.map((t) => (
          <span key={t.key} className="legend-item">
            <span className={`legend-swatch ${t.cls}`} />
            {t.label} ({num(countOf(t.key), 0)})
          </span>
        ))}
      </div>
    </div>
  );
}
