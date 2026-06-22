// App shell: a persistent left sidebar for navigation + a slim sticky top bar,
// with the active view rendered in the main content area. The six analytical
// sections each get their own view (reusing the report/ section components);
// Reports + Settings sit in a separate nav group below them.
import { useEffect, useState } from "react";
import { useDashboard } from "./state/useDashboard.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import FilterBar from "./components/FilterBar.jsx";
import ReportsView from "./components/ReportsView.jsx";
import SourceStatus from "./components/SourceStatus.jsx";
import OverviewSection from "./components/report/OverviewSection.jsx";
import ShiftSection from "./components/report/ShiftSection.jsx";
import StreaksSection from "./components/report/StreaksSection.jsx";
import EfficiencySection from "./components/report/EfficiencySection.jsx";
import AnomalySection from "./components/report/AnomalySection.jsx";
import InsightsSection from "./components/report/InsightsSection.jsx";

// The six analytical sections, each its own view. Reports + Settings are kept
// exactly as they were, in a separate group below.
const ANALYTICAL_VIEWS = ["Overview", "Shift analysis", "Breakdown streaks", "Efficiency score", "Anomaly report", "Insights"];
const SECONDARY_VIEWS = ["Reports", "Settings"];

// which report/ section renders for each analytical view (Anomaly report is
// handled separately — it doubles as the data-quality hub).
const SECTION_FOR = {
  Overview: OverviewSection,
  "Shift analysis": ShiftSection,
  "Breakdown streaks": StreaksSection,
  "Efficiency score": EfficiencySection,
  Insights: InsightsSection,
};

// content for one analytical view: a shared filter bar + correction disclosure,
// then the section. The Anomaly report is a read-only data-integrity report — just
// the section, no filter bar (the cleaning/correction tools live in Settings).
function AnalyticalView({ view, dash }) {
  if (view === "Anomaly report") {
    return <AnomalySection dash={dash} />;
  }

  const Section = SECTION_FOR[view];
  return (
    <>
      <FilterBar dash={dash} />
      {dash.correctionCount > 0 && (
        <p className="custom-note">
          {dash.correctionCount} manual correction{dash.correctionCount === 1 ? "" : "s"} applied (Settings
          → Data preparation). These sit on top of the automatic cleaning.
        </p>
      )}
      <Section dash={dash} />
    </>
  );
}

export default function App() {
  const dash = useDashboard();
  const [view, setView] = useState("Overview");
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

  const isAnalytical = ANALYTICAL_VIEWS.includes(view);

  return (
    <div className="layout">
      <Sidebar
        views={ANALYTICAL_VIEWS}
        secondary={SECONDARY_VIEWS}
        active={view}
        onSelect={setView}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        badges={{ "Anomaly report": dash.anomalyCount }}
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

              {isAnalytical &&
                (dash.ready ? (
                  <AnalyticalView view={view} dash={dash} />
                ) : (
                  <div className="card">
                    <p className="muted">Map the columns in Settings to see this section.</p>
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
