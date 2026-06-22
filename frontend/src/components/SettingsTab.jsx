// Settings tab — the one home for non-filter controls, grouped by purpose:
// Data (source + clean/raw), Column mapping, Data preparation (cleaning controls,
// per-row corrections, similarity suggestions), and Analysis settings.
import DatasetPanel from "./DatasetPanel.jsx";
import DataSourceBar from "./DataSourceBar.jsx";
import RemapPanel from "./RemapPanel.jsx";
import DataQualityTab from "./DataQualityTab.jsx";
import CorrectionsPanel from "./CorrectionsPanel.jsx";
import SimilarityPanel from "./SimilarityPanel.jsx";
import AnalysisControls from "./AnalysisControls.jsx";
import ReportSettings from "./ReportSettings.jsx";

export default function SettingsTab({ dash }) {
  return (
    <div>
      <DatasetPanel dash={dash} />
      {dash.ready && <DataSourceBar dash={dash} />}
      <RemapPanel headers={dash.headers} map={dash.map} setMap={dash.setMap} missing={dash.missing} />

      {dash.ready && (
        <>
          <section className="card">
            <h3>Data preparation</h3>
            <p className="muted">
              Choose how each data issue is cleaned, make auditable per-row corrections (reversible and
              disclosed), and review similarity suggestions (suggestion-only — nothing auto-merges). These
              feed the analytics and the read-only Anomaly report.
            </p>
          </section>
          <DataQualityTab view={dash.view} params={dash.params} setCleaning={dash.setCleaning} />
          <CorrectionsPanel dash={dash} />
          <SimilarityPanel dash={dash} />
        </>
      )}

      {dash.ready && <AnalysisControls dash={dash} />}
      {dash.ready && <ReportSettings dash={dash} />}
    </div>
  );
}
