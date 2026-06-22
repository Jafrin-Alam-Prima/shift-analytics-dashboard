// Persistent left navigation. The analytical views lead; a separated
// "Methodology" group below the divider holds Data Quality, which opens the
// read-only integrity & methodology report (the same page as the header trust
// chip) — supporting evidence, not part of the operational story. Settings still
// lives behind the header gear. On mobile the sidebar is a drawer.
import {
  IconDashboard,
  IconClock,
  IconStreak,
  IconGauge,
  IconTrends,
  IconInsight,
  IconQuality,
} from "./icons.jsx";

const ICONS = {
  Overview: IconDashboard,
  "Shift analysis": IconClock,
  "Breakdown streaks": IconStreak,
  Efficiency: IconGauge,
  Trends: IconTrends,
  Insights: IconInsight,
};

export default function Sidebar({ views, active, onSelect, open, onClose, onOpenDataQuality, dataQualityActive }) {
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">SA</span>
          <span className="brand-name">Shift Analytics</span>
        </div>
        <nav className="side-nav" aria-label="Views">
          {views.map((v) => {
            const Icon = ICONS[v] || IconDashboard;
            return (
              <button
                key={v}
                className={v === active ? "side-link active" : "side-link"}
                onClick={() => {
                  onSelect(v);
                  if (onClose) onClose();
                }}
                aria-current={v === active ? "page" : undefined}
              >
                <Icon />
                <span>{v}</span>
              </button>
            );
          })}
        </nav>

        <div className="side-divider" />
        <div className="side-group-label">Methodology</div>
        <nav className="side-nav" aria-label="Methodology">
          <button
            className={dataQualityActive ? "side-link active" : "side-link"}
            onClick={() => {
              if (onOpenDataQuality) onOpenDataQuality();
              if (onClose) onClose();
            }}
            aria-current={dataQualityActive ? "page" : undefined}
          >
            <IconQuality />
            <span>Data Quality</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
