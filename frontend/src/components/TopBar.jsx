// Slim sticky top bar: a mobile menu button, the current view title, and a slot
// on the right for the compact data-source status (wired in U2).
import { IconMenu } from "./icons.jsx";

export default function TopBar({ title, onMenu, right }) {
  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenu} aria-label="Open navigation">
        <IconMenu />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
