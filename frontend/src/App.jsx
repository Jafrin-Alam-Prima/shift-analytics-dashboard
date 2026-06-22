// App shell: a persistent left sidebar for navigation + a slim sticky top bar,
// with the active view rendered in the main content area. (Reports view is added
// by the app-upgrade plan.)
import { useEffect, useState } from "react";
import { useDashboard } from "./state/useDashboard.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import DataQualityTab from "./components/DataQualityTab.jsx";
import CorrectionsPanel from "./components/CorrectionsPanel.jsx";
import SimilarityPanel from "./components/SimilarityPanel.jsx";
import DashboardTab from "./components/DashboardTab.jsx";
import ReportsView from "./components/ReportsView.jsx";
import SourceStatus from "./components/SourceStatus.jsx";

const VIEWS = ["Dashboard", "Data quality", "Reports", "Settings"];

export default function App() {
  const dash = useDashboard();
  const [view, setView] = useState("Dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("theme") === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <div className="layout">
      <Sidebar
        views={VIEWS}
        active={view}
        onSelect={setView}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="main">
        <TopBar
          title={view}
          onMenu={() => setNavOpen(true)}
          right={
            <>
              <button
                className="icon-btn no-print"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? "☀ Light" : "☾ Dark"}
              </button>
              {dash.ready ? <SourceStatus dash={dash} /> : null}
            </>
          }
        />

        <div className="content">
          {dash.loadStatus === "loading" && (
            <div className="card">
              <p className="muted">Loading data…</p>
            </div>
          )}

          {dash.loadStatus === "error" && (
            <div className="card error">
              <strong>Could not load the data.</strong>
              <p>{dash.error}</p>
            </div>
          )}

          {dash.loadStatus === "loaded" && (
            <>
              {!dash.ready && view !== "Settings" && (
                <div className="card error">
                  <strong>Some columns need mapping.</strong>
                  <p>
                    Missing: {dash.missing.join(", ")}. Open <em>Settings</em> to choose a column for
                    each.
                  </p>
                </div>
              )}

              {view === "Dashboard" &&
                (dash.ready ? (
                  <DashboardTab dash={dash} />
                ) : (
                  <div className="card">
                    <p className="muted">Map the columns in Settings to see the dashboard.</p>
                  </div>
                ))}

              {view === "Data quality" &&
                (dash.ready ? (
                  <>
                    <DataQualityTab view={dash.view} params={dash.params} setCleaning={dash.setCleaning} />
                    <CorrectionsPanel dash={dash} />
                    <SimilarityPanel dash={dash} />
                  </>
                ) : (
                  <div className="card">
                    <p className="muted">Map the columns in Settings to see data quality.</p>
                  </div>
                ))}

              {view === "Reports" && <ReportsView dash={dash} />}

              {view === "Settings" && <SettingsTab dash={dash} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
