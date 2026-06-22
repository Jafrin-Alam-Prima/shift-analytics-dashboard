// Persistent left navigation. Switches the active view; the current one is
// highlighted. On mobile it becomes a drawer (toggled from the top bar in U7).
import { IconDashboard, IconQuality, IconReports, IconSettings } from "./icons.jsx";

const ICONS = {
  Dashboard: IconDashboard,
  "Data quality": IconQuality,
  Reports: IconReports,
  Settings: IconSettings,
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
