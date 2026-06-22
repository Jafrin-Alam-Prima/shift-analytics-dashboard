// Sticky header: a mobile menu button, the app title + dataset date range, and a
// right-hand cluster of header actions (trust chip, data-source status, export,
// dark-mode, settings gear) supplied by the app shell.
import { IconMenu } from "./icons.jsx";

export default function TopBar({ appTitle, dateRange, onMenu, right }) {
  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenu} aria-label="Open navigation">
        <IconMenu />
      </button>
      <div className="topbar-titles">
        <h1 className="topbar-title">{appTitle}</h1>
        {dateRange && <span className="topbar-subtitle">{dateRange}</span>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
