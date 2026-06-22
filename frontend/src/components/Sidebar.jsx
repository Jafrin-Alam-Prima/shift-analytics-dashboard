// Persistent left navigation. The six analytical sections sit in the top group;
// Reports + Settings sit in a separate group below. The current view is
// highlighted. A nav item can show a small count badge (e.g. live data-quality
// issues on Anomaly report). On mobile it becomes a drawer (toggled from the top
// bar in U7).
import {
  IconDashboard,
  IconClock,
  IconStreak,
  IconGauge,
  IconAlert,
  IconInsight,
  IconReports,
  IconSettings,
} from "./icons.jsx";

const ICONS = {
  Overview: IconDashboard,
  "Shift analysis": IconClock,
  "Breakdown streaks": IconStreak,
  "Efficiency score": IconGauge,
  "Anomaly report": IconAlert,
  Insights: IconInsight,
  Reports: IconReports,
  Settings: IconSettings,
};

export default function Sidebar({ views, secondary = [], active, onSelect, open, onClose, badges = {} }) {
  function renderLink(v) {
    const Icon = ICONS[v] || IconDashboard;
    const badge = badges[v];
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
        {badge > 0 && (
          <span className="nav-badge" aria-label={`${badge} data-quality issue${badge === 1 ? "" : "s"}`}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">SA</span>
          <span className="brand-name">Shift Analytics</span>
        </div>
        <nav className="side-nav" aria-label="Analysis">
          {views.map(renderLink)}
        </nav>
        {secondary.length > 0 && (
          <nav className="side-nav side-nav-secondary" aria-label="Tools">
            {secondary.map(renderLink)}
          </nav>
        )}
      </aside>
    </>
  );
}
