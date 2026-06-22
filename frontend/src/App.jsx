// App shell: a left sidebar of the five analytical views + a sticky header. The
// header carries the supporting roles — a live data-quality trust chip (opens the
// Data Quality & Methodology page), the data-source status, Export, the dark-mode
// toggle, and a gear that opens Settings. Data Quality and Settings are overlays,
// not sidebar items, so the nav stays focused on the business story.
import { useEffect, useState } from "react";
import { useDashboard } from "./state/useDashboard.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Modal from "./components/Modal.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import DataQualityPage from "./components/DataQualityPage.jsx";
import ExportMenu from "./components/ExportMenu.jsx";
import FilterBar from "./components/FilterBar.jsx";
import SourceStatus from "./components/SourceStatus.jsx";
import TimelineChart from "./components/charts/TimelineChart.jsx";
import OverviewSection from "./components/report/OverviewSection.jsx";
import ShiftSection from "./components/report/ShiftSection.jsx";
import StreaksSection from "./components/report/StreaksSection.jsx";
import EfficiencySection from "./components/report/EfficiencySection.jsx";
import TrendsSection from "./components/report/TrendsSection.jsx";
import InsightsSection from "./components/report/InsightsSection.jsx";
import { IconQuality, IconSettings } from "./components/icons.jsx";
import { shortDate } from "./lib/format.js";

// The analytical views — the whole sidebar. Everything else is a header role.
const VIEWS = ["Overview", "Shift analysis", "Breakdown streaks", "Efficiency", "Trends", "Insights"];

const SECTION_FOR = {
  Overview: OverviewSection,
  "Shift analysis": ShiftSection,
  "Breakdown streaks": StreaksSection,
  Efficiency: EfficiencySection,
  Trends: TrendsSection,
  Insights: InsightsSection,
};

// one analytical view: a shared filter bar + correction disclosure, then the
// section. Shift analysis leads with the floating timeline (cleaned data).
function AnalyticalView({ view, dash }) {
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
      {view === "Shift analysis" && (
        <TimelineChart records={dash.view.filtered} allRecords={dash.view.cleanRecords} groups={dash.view.groups} />
      )}
      <Section dash={dash} />
    </>
  );
}

// live "{clean} of {total} rows clean" chip — opens the Data Quality page
function TrustChip({ dash, onOpen }) {
  if (!dash.ready || !dash.view) return null;
  const total = dash.view.total;
  const clean = Math.max(0, total - dash.view.flaggedCount);
  const rate = dash.view.errorRate;
  const tone = rate > 15 ? "chip-bad" : rate > 5 ? "chip-warn" : "chip-good";
  return (
    <button
      className={`trust-chip ${tone} no-print`}
      onClick={onOpen}
      title="Open Data Quality & Methodology"
      aria-label={`${clean} of ${total} rows clean — open Data Quality & Methodology`}
    >
      <IconQuality />
      <span>
        {clean} of {total} rows clean
      </span>
    </button>
  );
}

export default function App() {
  const dash = useDashboard();
  const [view, setView] = useState("Overview");
  const [navOpen, setNavOpen] = useState(false);
  const [overlay, setOverlay] = useState(null); // null | "settings" | "dataQuality"
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

  // header subtitle: dataset name + real date range (when available)
  const range = dash.ready && dash.view ? dash.view.report.dateRange : null;
  const dateRange =
    range && range.min
      ? `${dash.datasetName} · ${shortDate(range.min)} – ${shortDate(range.max)} · ${range.days} days`
      : dash.datasetName;

  return (
    <div className="layout">
      <Sidebar
        views={VIEWS}
        active={view}
        onSelect={setView}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onOpenDataQuality={() => setOverlay("dataQuality")}
        dataQualityActive={overlay === "dataQuality"}
      />

      <div className="main">
        <TopBar
          appTitle="Shift Analytics"
          dateRange={dash.loadStatus === "loaded" ? dateRange : null}
          onMenu={() => setNavOpen(true)}
          right={
            <>
              <TrustChip dash={dash} onOpen={() => setOverlay("dataQuality")} />
              {dash.ready ? <SourceStatus dash={dash} /> : null}
              <ExportMenu dash={dash} />
              <button
                className="icon-btn no-print"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
              <button
                className="icon-btn no-print"
                onClick={() => setOverlay("settings")}
                aria-label="Open settings"
                title="Settings"
              >
                <IconSettings />
              </button>
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

          {dash.loadStatus === "loaded" &&
            (dash.ready ? (
              <AnalyticalView view={view} dash={dash} />
            ) : (
              <div className="card error">
                <strong>Some columns need mapping.</strong>
                <p>
                  Missing: {dash.missing.join(", ")}. Open <em>Settings</em> (the gear, top-right) to choose a
                  column for each.
                </p>
              </div>
            ))}
        </div>
      </div>

      {overlay === "settings" && (
        <Modal title="Settings" subtitle="Data source, column mapping, data preparation, and analysis configuration" onClose={() => setOverlay(null)}>
          <SettingsTab dash={dash} />
        </Modal>
      )}

      {overlay === "dataQuality" && (
        <Modal title="Data Quality & Methodology" subtitle="Detection, documentation, and handling of every data issue" onClose={() => setOverlay(null)}>
          <DataQualityPage dash={dash} />
        </Modal>
      )}
    </div>
  );
}
