// Settings tab — the one home for non-filter controls, grouped by purpose:
// Data (source + clean/raw), Column mapping, and Analysis settings.
import DatasetPanel from "./DatasetPanel.jsx";
import DataSourceBar from "./DataSourceBar.jsx";
import RemapPanel from "./RemapPanel.jsx";
import AnalysisControls from "./AnalysisControls.jsx";
import ReportSettings from "./ReportSettings.jsx";

export default function SettingsTab({ dash }) {
  return (
    <div>
      <DatasetPanel dash={dash} />
      {dash.ready && <DataSourceBar dash={dash} />}
      <RemapPanel headers={dash.headers} map={dash.map} setMap={dash.setMap} missing={dash.missing} />
      {dash.ready && <AnalysisControls dash={dash} />}
      {dash.ready && <ReportSettings dash={dash} />}
    </div>
  );
}
