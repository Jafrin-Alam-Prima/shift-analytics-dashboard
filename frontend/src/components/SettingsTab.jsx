// Settings — slimmed to data input only: upload a CSV, choose the data source /
// clean-or-raw view, and map the columns (auto-guessed, manually adjustable so any
// file with different column names still works). The automatic cleaning engine and
// the read-only Data Quality & Methodology report are unchanged — this page no
// longer carries the manual cleaning-strategy, per-row correction, or similarity
// controls.
import DatasetPanel from "./DatasetPanel.jsx";
import DataSourceBar from "./DataSourceBar.jsx";
import RemapPanel from "./RemapPanel.jsx";

export default function SettingsTab({ dash }) {
  return (
    <div>
      <DatasetPanel dash={dash} />
      {dash.ready && <DataSourceBar dash={dash} />}
      <RemapPanel headers={dash.headers} map={dash.map} setMap={dash.setMap} missing={dash.missing} />
    </div>
  );
}
