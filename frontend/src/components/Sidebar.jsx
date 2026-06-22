// Persistent left navigation — the five analytical views, nothing else. Data
// Quality and Settings live in the header (trust chip + gear), not here, so the
// nav stays focused on the business story. The current view is highlighted; on
// mobile the sidebar becomes a drawer toggled from the header.
import { IconDashboard, IconClock, IconStreak, IconGauge, IconInsight } from "./icons.jsx";

const ICONS = {
  Overview: IconDashboard,
  "Shift analysis": IconClock,
  "Breakdown streaks": IconStreak,
  Efficiency: IconGauge,
  Insights: IconInsight,
};

export default function Sidebar({ views, active, onSelect, open, onClose }) {
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
      </aside>
    </>
  );
}
